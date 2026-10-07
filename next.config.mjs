// Repère dans le journal de build Vercel : version du code compilée et présence des variables (sans afficher leur valeur).
const etat = (n) => (process.env[n] && process.env[n].trim() ? `présente (${process.env[n].trim().length} caractères)` : 'ABSENTE');
console.log(`[DevisPro] code lazy-client-v3 | NEXT_PUBLIC_SUPABASE_URL ${etat('NEXT_PUBLIC_SUPABASE_URL')} | NEXT_PUBLIC_SUPABASE_ANON_KEY ${etat('NEXT_PUBLIC_SUPABASE_ANON_KEY')} | RESEND_API_KEY ${etat('RESEND_API_KEY')} | EMAIL_FROM ${etat('EMAIL_FROM')}`);

/** @type {import('next').NextConfig} */
const nextConfig = { output: 'standalone' };
export default nextConfig;
