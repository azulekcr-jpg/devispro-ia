// Journal de build : quelles variables le build voit-il ? (aucune valeur n'est affichée)
const vue = (n) => (process.env[n] && process.env[n].trim() ? 'présente' : 'ABSENTE');
console.log(`[DevisPro] variables vues par le build : NEXT_PUBLIC_SUPABASE_URL ${vue('NEXT_PUBLIC_SUPABASE_URL')} | NEXT_PUBLIC_SUPABASE_ANON_KEY ${vue('NEXT_PUBLIC_SUPABASE_ANON_KEY')} | RESEND_API_KEY ${vue('RESEND_API_KEY')} | EMAIL_FROM ${vue('EMAIL_FROM')}`);

/** @type {import('next').NextConfig} */
const nextConfig = { output: 'standalone' };
export default nextConfig;
