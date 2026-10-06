import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connect, newStore } from './fakedb.ts';
import { getCompany, saveCompany, listClients, saveClient, deleteClient, listQuotes, getQuote, saveQuote, deleteQuote, exportAll } from '../src/lib/data.ts';
import { newQuote } from '../src/lib/drafts.ts';

const YEAR = new Date().getFullYear();
const sample = (c: any, over: any = {}) => ({ ...newQuote(c), subject: 'Chauffe-eau', client: { name: 'Mme Lambert', phone: '06 00', email: 'l@x.fr', address: '5 rue A' }, discountPercent: 10,
  lines: [{ designation: 'Chauffe-eau', quantity: 1, unit: 'u', unitPriceCents: 48000, vatRate: 10 }, { designation: "Main d'œuvre", quantity: 3, unit: 'h', unitPriceCents: 5500, vatRate: 20 }], ...over });

test('Mon entreprise : enregistrée, puis retrouvée après reconnexion', async () => {
  const s = newStore();
  let c = await getCompany(connect(s)); // fiche créée à la première connexion
  assert.equal(c.name, '');
  const saved = { ...c, name: 'Plomberie Martin', legalForm: 'EI', address: '12 rue des Lilas', phone: '06 12 34 56 78', email: 'c@martin.fr', siret: '812 345 678 00019',
    vatNumber: 'fr12345678901', rcs: 'RM Bayonne', insurance: 'Décennale AXA n°123', vatExempt: false, defaultVatRate: 5.5, defaultValidDays: 45, defaultNote: 'Acompte 30 %', logoData: 'data:image/png;base64,AAAA' };
  await saveCompany(connect(s), saved);
  const again = await getCompany(connect(s)); // nouvelle session
  assert.deepEqual(again, { ...saved, vatNumber: 'FR12345678901' });
  await saveCompany(connect(s), { ...again, vatExempt: true });
  assert.equal((await getCompany(connect(s))).defaultVatRate, 0); // franchise en base : taux par défaut à 0
});

test('Mes clients : ajouter, modifier, supprimer, retrouver', async () => {
  const s = newStore(); const co = await getCompany(connect(s));
  const a = await saveClient(connect(s), co.id, { name: 'Zoé Petit', phone: '', email: '', address: '' });
  const b = await saveClient(connect(s), co.id, { name: ' Alain Dupont ', phone: '07', email: 'a@d.fr', address: '1 rue B' });
  assert.deepEqual((await listClients(connect(s))).map((c) => c.name), ['Alain Dupont', 'Zoé Petit']);
  await saveClient(connect(s), co.id, { ...a, name: 'Zoé Petit-Martin', phone: '06' });
  const list = await listClients(connect(s));
  assert.deepEqual(list.map((c) => [c.name, c.phone]), [['Alain Dupont', '07'], ['Zoé Petit-Martin', '06']]);
  await deleteClient(connect(s), b.id);
  assert.equal((await listClients(connect(s))).length, 1);
});

test('Devis : création, numérotation, relecture, modification, suppression', async () => {
  const s = newStore(); const co = await getCompany(connect(s));
  await saveCompany(connect(s), { ...co, name: 'Martin', defaultNote: 'Conditions' });
  const c = await getCompany(connect(s));
  const r1 = await saveQuote(connect(s), c.id, sample(c));
  const r2 = await saveQuote(connect(s), c.id, sample(c, { subject: 'Second' }));
  assert.equal(r1.number, `DEV-${YEAR}-001`); assert.equal(r2.number, `DEV-${YEAR}-002`);

  const q = (await getQuote(connect(s), r1.id))!; // après reconnexion
  assert.equal(q.number, r1.number); assert.equal(q.company.name, 'Martin'); assert.equal(q.note, 'Conditions');
  assert.deepEqual(q.lines.map((l) => l.designation), ['Chauffe-eau', "Main d'œuvre"]);
  assert.equal(q.client.name, 'Mme Lambert'); assert.equal(q.discountPercent, 10); assert.equal(q.status, 'brouillon');

  // 480 + 165 = 645 HT, remise 10 % : bases 432 (10 %) et 148,50 (20 %) -> TVA 43,20 + 29,70 -> TTC 653,40
  const list = await listQuotes(connect(s));
  assert.equal(list.length, 2); assert.equal(list.find((x) => x.id === r1.id)!.ttc, 65340);

  const upd = { ...q, status: 'envoye' as const, lines: [q.lines[0]], client: { ...q.client, phone: '07 99' } };
  const r3 = await saveQuote(connect(s), c.id, upd);
  assert.equal(r3.id, r1.id); assert.equal(r3.number, r1.number); // même devis, même numéro
  const q2 = (await getQuote(connect(s), r1.id))!;
  assert.equal(q2.lines.length, 1); assert.equal(q2.status, 'envoye'); assert.equal(q2.client.phone, '07 99');
  assert.equal(s.quote_lines.filter((l) => l.quote_id === r1.id).length, 1); // pas de lignes en double

  await deleteQuote(connect(s), r1.id);
  assert.equal(await getQuote(connect(s), r1.id), null);
  assert.equal(s.quote_lines.filter((l) => l.quote_id === r1.id).length, 0);
  assert.equal((await listQuotes(connect(s))).length, 1);
});

test('Supprimer un client ne modifie pas ses devis (copie des coordonnées)', async () => {
  const s = newStore(); const c = await getCompany(connect(s));
  const cl = await saveClient(connect(s), c.id, { name: 'Mme Lambert', phone: '06', email: '', address: '' });
  const r = await saveQuote(connect(s), c.id, sample(c, { clientId: cl.id }));
  await deleteClient(connect(s), cl.id);
  const q = (await getQuote(connect(s), r.id))!;
  assert.equal(q.clientId, null); assert.equal(q.client.name, 'Mme Lambert'); assert.equal(q.client.phone, '06 00');
});

test('Export complet des données', async () => {
  const s = newStore(); const c = await getCompany(connect(s));
  await saveClient(connect(s), c.id, { name: 'A', phone: '', email: '', address: '' });
  await saveQuote(connect(s), c.id, sample(c));
  const e = await exportAll(connect(s));
  assert.equal(e.clients.length, 1); assert.equal(e.quotes.length, 1); assert.ok(e.exportedAt);
});

test('Erreur de base : message clair, rien ne passe sous silence', async () => {
  const s = newStore(); const db: any = connect(s);
  db.from = () => ({ select: () => ({ maybeSingle: async () => ({ data: null, error: { message: 'permission denied' } }) }) });
  await assert.rejects(() => getCompany(db), /permission denied/);
});
