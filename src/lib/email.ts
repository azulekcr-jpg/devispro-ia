import { addDaysIso, fmtDate, formatEur, totals } from './quotes';
import type { Company, Quote } from './types';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const oneLine = (s: string) => s.replace(/[\r\n]+/g, ' ').trim();
const money = (c: number) => formatEur(c).replace(/[\u202f\u00a0]/g, ' ');

export const quoteFilename = (q: Pick<Quote, 'number'>) => `${(q.number || 'Devis').replace(/[^\w.\-]+/g, '_')}.pdf`;

// Contenu de l'e-mail (texte et HTML) accompagnant le PDF du devis.
export function buildQuoteEmail({ quote, company, message }: { quote: Quote; company: Company; message?: string }) {
  const name = oneLine(quote.company.name || company.name) || 'Votre artisan';
  const t = totals(quote.lines, quote.discountPercent);
  const until = fmtDate(addDaysIso(quote.issuedOn, quote.validDays));
  const client = oneLine(quote.client.name);
  const greeting = client ? `Bonjour ${client},` : 'Bonjour,';
  const subjectLine = oneLine(quote.subject);
  const subject = `Devis ${quote.number}${subjectLine ? ` : ${subjectLine}` : ''} - ${name}`.slice(0, 200);
  const note = (message ?? '').trim();
  const intro = `Veuillez trouver ci-joint notre devis n° ${quote.number}${subjectLine ? ` (${subjectLine})` : ''}.`;
  const amount = `Montant total : ${money(t.ttc)} TTC.`;
  const validity = `Ce devis est valable jusqu'au ${until}.`;
  const accept = 'Pour l\'accepter, retournez-le signé avec la mention « Bon pour accord », ou répondez simplement à cet e-mail.';
  const contact = [quote.company.phone, quote.company.email].map((s) => s.trim()).filter(Boolean).join(' - ');

  const text = [greeting, '', ...(note ? [note, ''] : []), intro, amount, validity, '', accept, '', 'Cordialement,', name, ...(contact ? [contact] : [])].join('\n');
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#17202b;max-width:560px">
<p>${esc(greeting)}</p>
${note ? `<p style="white-space:pre-wrap">${esc(note)}</p>` : ''}
<p>${esc(intro)}</p>
<p style="margin:16px 0;padding:12px 16px;background:#f1f3f6;border-left:4px solid #1f3f6b"><strong>${esc(amount)}</strong><br>${esc(validity)}</p>
<p>${esc(accept)}</p>
<p>Cordialement,<br><strong>${esc(name)}</strong>${contact ? `<br>${esc(contact)}` : ''}</p>
</div>`;
  return { subject, text, html };
}

// Message clair pour l'utilisateur à partir d'une réponse d'erreur de Resend.
export function resendErrorMessage(status: number, data: any): string {
  const msg = String(data?.message ?? '').toLowerCase();
  const name = String(data?.name ?? '');
  if (status === 429) return "Trop d'envois en peu de temps : réessayez dans une minute.";
  if (msg.includes('testing emails') || msg.includes('own email'))
    return "Resend est en mode test : tant qu'aucun domaine n'est vérifié, seule l'adresse du propriétaire du compte Resend peut recevoir des e-mails. Vérifiez votre domaine chez Resend.";
  if (msg.includes('domain') && (msg.includes('not verified') || msg.includes('verify')))
    return "Le domaine d'expédition n'est pas vérifié chez Resend. Vérifiez-le, ou corrigez la variable EMAIL_FROM.";
  if (status === 401 || name.includes('api_key') || msg.includes('api key'))
    return "La clé API Resend est refusée. Vérifiez la variable RESEND_API_KEY sur Vercel (clé valide avec droit d'envoi).";
  if (msg.includes('attachment') || status === 413) return 'Le PDF joint est refusé par le service d\'envoi (taille ou format).';
  if (msg.includes('from') && (status === 400 || status === 422)) return "L'adresse d'expédition est invalide : vérifiez la variable EMAIL_FROM (exemple : DevisPro <devis@votredomaine.fr>).";
  return `Le service d'envoi a refusé le message${name ? ` (${name})` : ''}. Réessayez, ou vérifiez la configuration (docs/EMAILS.md).`;
}
