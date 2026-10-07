export type AuthErrorLike = { code?: string; status?: number; message?: string } | null | undefined;

export const CONFIG_MISSING_MESSAGE =
  "L'application n'est pas configurée : les variables NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY sont absentes (Vercel > Settings > Environment Variables, puis redéployer).";

// Traduit une erreur de Supabase Auth en message clair (au lieu d'un « Envoi impossible » unique).
export function loginErrorMessage(e: AuthErrorLike): string {
  const code = e?.code ?? '';
  const msg = (e?.message ?? '').toLowerCase();
  const status = e?.status;
  if (code === 'email_address_invalid' || code === 'validation_failed' || msg.includes('invalid format') || msg.includes('unable to validate email'))
    return 'Adresse e-mail invalide : vérifiez-la.';
  if (code === 'email_address_not_authorized' || msg.includes('not authorized'))
    return "Cette adresse ne peut pas recevoir d'e-mail : le service d'envoi n'est pas encore configuré pour le public (SMTP dans Supabase). Voir docs/EMAILS.md.";
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || status === 429 || msg.includes('rate limit') || msg.includes('only request this after'))
    return 'Trop de demandes : patientez quelques minutes puis réessayez.';
  if (code === 'signup_disabled' || code === 'otp_disabled' || msg.includes('signups not allowed'))
    return 'Les inscriptions sont désactivées pour ce site.';
  if (code === 'unexpected_failure' || (status !== undefined && status >= 500) || msg.includes('error sending'))
    return "Le service d'envoi d'e-mails ne répond pas correctement (configuration SMTP à vérifier dans Supabase). Voir docs/EMAILS.md.";
  return `Envoi impossible${code ? ` (${code})` : ''}. Réessayez dans un instant.`;
}
