import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { sendQuoteEmail } from '@/lib/send-quote';

export const runtime = 'nodejs';
export const maxDuration = 30;

// POST /api/devis/envoyer  { quoteId, message? }  ->  envoie le devis en PDF à l'adresse e-mail du client.
export async function POST(req: Request) {
  let body: unknown = null;
  try { body = await req.json(); } catch { /* corps invalide : traité comme absent */ }
  try {
    const r = await sendQuoteEmail({ db: await supabaseServer(), env: process.env, fetchImpl: fetch, body });
    return NextResponse.json(r.body, { status: r.status });
  } catch (e) {
    console.error('Envoi devis : erreur inattendue', e);
    return NextResponse.json({ ok: false, code: 'server_error', message: "Erreur inattendue du serveur. Réessayez, ou consultez les journaux Vercel." }, { status: 500 });
  }
}
