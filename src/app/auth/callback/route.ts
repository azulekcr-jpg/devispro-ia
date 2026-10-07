import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

// Retour du lien de connexion envoyé par e-mail.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/devis`);
    console.error('Callback : échange du code impossible', error.message);
  }
  return NextResponse.redirect(`${origin}/connexion?erreur=lien`);
}
