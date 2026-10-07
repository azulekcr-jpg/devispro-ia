import { getCompany, getQuote } from './data';
import { buildQuotePdf } from './pdf';
import { buildQuoteEmail, quoteFilename, resendErrorMessage } from './email';
import { isEmail } from './validation';

export const MAX_EMAILS_PER_HOUR = 20;
export const RESEND_URL = 'https://api.resend.com/emails';

type Deps = {
  db: any; // client Supabase du serveur, avec la session de l'utilisateur connecté
  env: Record<string, string | undefined>;
  fetchImpl: typeof fetch;
  body: unknown;
  now?: () => number;
};
export type SendResult = { status: number; body: { ok: boolean; message: string; code?: string; to?: string; id?: string } };
const fail = (status: number, code: string, message: string): SendResult => ({ status, body: { ok: false, code, message } });

async function journal(db: any, row: Record<string, unknown>) {
  try {
    const r = await db.from('quote_emails').insert(row);
    if (r?.error) console.warn("Journal d'envoi indisponible (migration 0003 exécutée ?) :", r.error.message);
  } catch (e) { console.warn("Journal d'envoi indisponible :", e); }
}

// Envoie le devis (PDF en pièce jointe) à l'adresse du client enregistrée dans le devis.
// Le destinataire est lu dans la base : il ne peut pas être imposé par la requête.
export async function sendQuoteEmail({ db, env, fetchImpl, body, now = Date.now }: Deps): Promise<SendResult> {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.EMAIL_FROM?.trim();
  if (!apiKey || !from)
    return fail(503, 'not_configured', "L'envoi d'e-mails n'est pas encore configuré sur le serveur : variables RESEND_API_KEY et EMAIL_FROM à ajouter dans Vercel, puis redéployer.");

  const user = (await db.auth.getUser())?.data?.user;
  if (!user) return fail(401, 'unauthenticated', 'Session expirée : reconnectez-vous puis réessayez.');

  const b = (body ?? {}) as { quoteId?: unknown; message?: unknown };
  const quoteId = typeof b.quoteId === 'string' ? b.quoteId : '';
  if (!quoteId) return fail(400, 'bad_request', 'Devis non précisé.');
  const message = typeof b.message === 'string' ? b.message.trim().slice(0, 1000) : '';

  let quote, company;
  try {
    [quote, company] = await Promise.all([getQuote(db, quoteId), getCompany(db)]);
  } catch (e) {
    console.error('Envoi devis : lecture impossible', e);
    return fail(500, 'db_error', 'Lecture du devis impossible. Réessayez dans un instant.');
  }
  if (!quote) return fail(404, 'not_found', 'Devis introuvable.');
  const to = quote.client.email.trim();
  if (!to || !isEmail(to)) return fail(422, 'no_recipient', "Ce devis n'a pas d'adresse e-mail client valide. Renseignez-la dans le devis, enregistrez, puis réessayez.");
  if (!quote.lines.length) return fail(422, 'no_lines', 'Le devis ne contient aucune ligne.');

  const since = new Date(now() - 3_600_000).toISOString();
  const recent = await db.from('quote_emails').select('id').eq('company_id', company.id).eq('status', 'envoye').gte('created_at', since);
  if (recent.error) console.warn("Limite horaire non appliquée (migration 0003 non exécutée ?) :", recent.error.message);
  else if ((recent.data?.length ?? 0) >= MAX_EMAILS_PER_HOUR)
    return fail(429, 'rate_limited', `Limite atteinte : ${MAX_EMAILS_PER_HOUR} e-mails par heure. Réessayez plus tard.`);

  const pdf = await buildQuotePdf(quote, company.logoData);
  const mail = buildQuoteEmail({ quote, company, message });
  const replyTo = company.email.trim() && isEmail(company.email) ? company.email.trim() : undefined;
  const log = { quote_id: quote.id, company_id: company.id, to_email: to };

  let res: Response;
  try {
    res = await fetchImpl(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from, to: [to], subject: mail.subject, html: mail.html, text: mail.text,
        ...(replyTo ? { reply_to: replyTo } : {}),
        attachments: [{ filename: quoteFilename(quote), content: Buffer.from(pdf).toString('base64') }],
      }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (e) {
    console.error('Envoi devis : service injoignable', e);
    await journal(db, { ...log, status: 'echec', error: 'réseau' });
    return fail(502, 'network', "Le service d'envoi n'a pas répondu. Réessayez dans un instant.");
  }

  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('Envoi devis : refus du fournisseur', res.status, JSON.stringify(data));
    await journal(db, { ...log, status: 'echec', error: String(data?.message ?? res.status).slice(0, 300) });
    return fail(res.status === 429 ? 429 : 502, 'provider_error', resendErrorMessage(res.status, data));
  }

  await journal(db, { ...log, status: 'envoye', provider_id: String(data?.id ?? '') });
  if (quote.status === 'brouillon') await db.from('quotes').update({ status: 'envoye' }).eq('id', quote.id);
  return { status: 200, body: { ok: true, to, id: data?.id, message: `Devis envoyé à ${to}.` } };
}
