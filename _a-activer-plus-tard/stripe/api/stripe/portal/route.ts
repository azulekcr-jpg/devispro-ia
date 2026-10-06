import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe/server';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// Portail client Stripe : changer de formule, moyen de paiement, factures, résiliation.
export async function POST(req: Request) {
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: 'Paiement non configuré.' }, { status: 503 });

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/connexion', req.url), 303);

  const { data: row } = await supabaseAdmin().from('subscriptions').select('stripe_customer_id').eq('user_id', user.id).maybeSingle();
  if (!row?.stripe_customer_id) return NextResponse.redirect(new URL('/abonnement', req.url), 303);

  const session = await stripe.billingPortal.sessions.create({
    customer: row.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/abonnement`,
  });
  return NextResponse.redirect(session.url, 303);
}
