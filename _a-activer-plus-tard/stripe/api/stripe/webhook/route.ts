import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe/server';
import { planForPrice } from '@/lib/stripe/plans';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

// Source de vérité des abonnements : on ne se fie jamais à la page de retour après paiement.
// Chaque événement relit l'abonnement chez Stripe puis l'enregistre (idempotent, ordre sans importance).
async function syncSubscription(stripe: Stripe, subscriptionId: string) {
  const admin = supabaseAdmin();
  const sub: any = await stripe.subscriptions.retrieve(subscriptionId);
  const customerId: string = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  let userId: string | undefined = sub.metadata?.user_id;
  if (!userId) {
    const { data } = await admin.from('subscriptions').select('user_id').eq('stripe_customer_id', customerId).maybeSingle();
    userId = data?.user_id;
  }
  if (!userId) throw new Error(`Aucun utilisateur pour l'abonnement ${subscriptionId}`);

  const item = sub.items?.data?.[0];
  const end = item?.current_period_end ?? sub.current_period_end;
  const { error } = await admin.from('subscriptions').upsert({
    user_id: userId,
    stripe_customer_id: customerId,
    stripe_subscription_id: sub.id,
    plan: planForPrice(item?.price?.id) ?? sub.metadata?.plan ?? null,
    status: sub.status,
    current_period_end: end ? new Date(end * 1000).toISOString() : null,
    cancel_at_period_end: !!sub.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return new Response('Stripe non configuré', { status: 503 });

  const signature = req.headers.get('stripe-signature');
  if (!signature) return new Response('Signature manquante', { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await req.text(), signature, secret); // corps brut obligatoire
  } catch {
    return new Response('Signature invalide', { status: 400 });
  }

  try {
    const obj: any = event.data.object;
    switch (event.type) {
      case 'checkout.session.completed':
        if (obj.subscription) await syncSubscription(stripe, String(obj.subscription));
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await syncSubscription(stripe, obj.id);
        break;
      case 'invoice.paid':
      case 'invoice.payment_failed': {
        const id = obj.subscription ?? obj.parent?.subscription_details?.subscription;
        if (id) await syncSubscription(stripe, String(id));
        break;
      }
    }
    await supabaseAdmin().from('stripe_events').upsert({ id: event.id, type: event.type });
    return new Response('ok');
  } catch (e) {
    console.error('Webhook Stripe', event.type, e);
    return new Response('Erreur de traitement', { status: 500 }); // Stripe réessaiera
  }
}
