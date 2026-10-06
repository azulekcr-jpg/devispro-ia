import 'server-only';
import Stripe from 'stripe';

// Renvoie null tant que STRIPE_SECRET_KEY n'est pas défini : Stripe reste désactivé.
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  return key ? new Stripe(key) : null;
}
