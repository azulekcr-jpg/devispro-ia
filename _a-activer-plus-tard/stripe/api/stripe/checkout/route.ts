import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe/server';
import { priceIdFor } from '@/lib/stripe/plans';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: 'Paiement non configuré.' }, { status: 503 });

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/connexion', req.url), 303);

  const plan = String((await req.formData()).get('plan') ?? '');
  const price = priceIdFor(plan);
  if (!price) return NextResponse.json({ error: 'Formule inconnue ou non configurée.' }, { status: 400 });

  const admin = supabaseAdmin();
  const { data: row } = await admin.from('subscriptions').select('stripe_customer_id').eq('user_id', user.id).maybeSingle();
  let customer: string | null | undefined = row?.stripe_customer_id;
  if (!customer) {
    const c = await stripe.customers.create({ email: user.email ?? undefined, metadata: { user_id: user.id } });
    customer = c.id;
    await admin.from('subscriptions').upsert({ user_id: user.id, stripe_customer_id: customer });
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL!;
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer,
    line_items: [{ price, quantity: 1 }],
    client_reference_id: user.id,
    subscription_data: { metadata: { user_id: user.id, plan } },
    allow_promotion_codes: true,
    locale: 'fr',
    success_url: `${site}/abonnement?paiement=ok`,
    cancel_url: `${site}/abonnement?paiement=annule`,
  });
  return NextResponse.redirect(session.url!, 303);
}
