import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connect, newStore, type Store } from './fakedb.ts';
import { getCompany, saveCompany, saveQuote } from '../src/lib/data.ts';
import { newQuote } from '../src/lib/drafts.ts';
import { sendQuoteEmail, MAX_EMAILS_PER_HOUR } from '../src/lib/send-quote.ts';

const ENV = { RESEND_API_KEY: 're_test_123', EMAIL_FROM: 'DevisPro <devis@exemple.fr>' };
const YEAR = new Date().getFullYear();

async function setup(clientEmail = 'sophie@mail.fr') {
  const s = newStore();
  const c0 = await getCompany(connect(s));
  await saveCompany(connect(s), { ...c0, name: 'Plomberie Martin', email: 'contact@martin.fr', phone: '06 12 34 56 78', siret: '812 345 678 00019' });
  const c = await getCompany(connect(s));
  const q = { ...newQuote(c), subject: 'Chauffe-eau', client: { name: 'Mme Lambert', phone: '', email: clientEmail, address: '5 rue A' },
    lines: [{ designation: 'Chauffe-eau', quantity: 1, unit: 'u', unitPriceCents: 48000, vatRate: 10 }] };
  const r = await saveQuote(connect(s), c.id, q);
  return { s, c, id: r.id };
}
const okFetch = () => { const calls: any[] = []; const f: any = async (url: string, init: any) => { calls.push({ url, init, payload: JSON.parse(init.body) }); return new Response(JSON.stringify({ id: 'resend-123' }), { status: 200 }); }; return { f, calls }; };
const send = (s: Store, id: string, f: any, env: any = ENV, body: any = { quoteId: id }) => sendQuoteEmail({ db: connect(s), env, fetchImpl: f, body });

test('succès : e-mail au client avec le PDF en pièce jointe', async () => {
  const { s, id } = await setup(); const { f, calls } = okFetch();
  const r = await send(s, id, f);
  assert.equal(r.status, 200); assert.equal(r.body.ok, true); assert.equal(r.body.to, 'sophie@mail.fr');
  assert.equal(calls.length, 1);
  const { url, init, payload } = calls[0];
  assert.equal(url, 'https://api.resend.com/emails');
  assert.equal(init.headers.Authorization, 'Bearer re_test_123');
  assert.deepEqual(payload.to, ['sophie@mail.fr']); assert.equal(payload.from, ENV.EMAIL_FROM); assert.equal(payload.reply_to, 'contact@martin.fr');
  assert.match(payload.subject, new RegExp(`DEV-${YEAR}-001`));
  assert.equal(payload.attachments[0].filename, `DEV-${YEAR}-001.pdf`);
  assert.equal(Buffer.from(payload.attachments[0].content, 'base64').subarray(0, 5).toString(), '%PDF-');
  assert.equal(s.quotes[0].status, 'envoye'); // brouillon -> envoyé
  assert.deepEqual([s.quote_emails![0].status, s.quote_emails![0].to_email, s.quote_emails![0].provider_id], ['envoye', 'sophie@mail.fr', 'resend-123']);
});
test('sécurité : le destinataire vient du devis, jamais de la requête', async () => {
  const { s, id } = await setup(); const { f, calls } = okFetch();
  await send(s, id, f, ENV, { quoteId: id, to: 'pirate@evil.com', email: 'pirate@evil.com', from: 'x@y.z' });
  assert.deepEqual(calls[0].payload.to, ['sophie@mail.fr']); assert.equal(calls[0].payload.from, ENV.EMAIL_FROM);
});
test('non configuré : message précis, aucun appel', async () => {
  const { s, id } = await setup(); const { f, calls } = okFetch();
  for (const env of [{}, { RESEND_API_KEY: 're_x' }, { EMAIL_FROM: 'a@b.fr' }]) {
    const r = await send(s, id, f, env); assert.equal(r.status, 503); assert.match(r.body.message, /RESEND_API_KEY et EMAIL_FROM/);
  }
  assert.equal(calls.length, 0);
});
test('non connecté, requête incomplète, devis introuvable', async () => {
  const { s, id } = await setup(); const { f, calls } = okFetch();
  const db: any = connect(s); db.auth.getUser = async () => ({ data: { user: null }, error: null });
  assert.equal((await sendQuoteEmail({ db, env: ENV, fetchImpl: f, body: { quoteId: id } })).status, 401);
  assert.equal((await send(s, id, f, ENV, {})).status, 400);
  assert.equal((await send(s, id, f, ENV, null)).status, 400);
  assert.equal((await send(s, id, f, ENV, { quoteId: 'inconnu' })).status, 404);
  assert.equal(calls.length, 0);
});
test('client sans e-mail ou e-mail invalide : refus clair', async () => {
  for (const mail of ['', '   ', 'pas-un-mail']) {
    const { s, id } = await setup(mail); const { f, calls } = okFetch();
    const r = await send(s, id, f); assert.equal(r.status, 422); assert.match(r.body.message, /adresse e-mail client/); assert.equal(calls.length, 0);
  }
});
test('refus du fournisseur (domaine non vérifié) : message clair et journal', async () => {
  const { s, id } = await setup();
  const f: any = async () => new Response(JSON.stringify({ name: 'validation_error', message: 'The martin.fr domain is not verified.' }), { status: 403 });
  const r = await send(s, id, f);
  assert.equal(r.status, 502); assert.match(r.body.message, /domaine/);
  assert.equal(s.quote_emails![0].status, 'echec'); assert.equal(s.quotes[0].status, 'brouillon'); // statut inchangé
});
test('service injoignable', async () => {
  const { s, id } = await setup(); const f: any = async () => { throw new Error('ECONNRESET'); };
  const r = await send(s, id, f); assert.equal(r.status, 502); assert.equal(r.body.code, 'network');
});
test('limite horaire', async () => {
  const { s, c, id } = await setup(); const { f, calls } = okFetch();
  for (let i = 0; i < MAX_EMAILS_PER_HOUR; i++) s.quote_emails!.push({ id: `x${i}`, company_id: c.id, status: 'envoye', created_at: new Date().toISOString() });
  const r = await send(s, id, f); assert.equal(r.status, 429); assert.equal(calls.length, 0);
  s.quote_emails!.forEach((e) => (e.created_at = new Date(Date.now() - 2 * 3_600_000).toISOString())); // plus d'une heure
  assert.equal((await send(s, id, f)).status, 200);
});
test("migration 0003 absente : l'envoi fonctionne quand même", async () => {
  const { s, id } = await setup(); delete s.quote_emails; const { f } = okFetch();
  assert.equal((await send(s, id, f)).status, 200);
});
