// Les deux abonnements. Noms, prix et limites à définir : seuls les identifiants Stripe (price_...) sont lus ici.
export const PLANS = {
  plan_a: { label: 'Formule A', priceEnv: 'STRIPE_PRICE_PLAN_A' },
  plan_b: { label: 'Formule B', priceEnv: 'STRIPE_PRICE_PLAN_B' },
} as const;
export type PlanKey = keyof typeof PLANS;

export const priceIdFor = (plan: string): string | undefined =>
  plan in PLANS ? process.env[PLANS[plan as PlanKey].priceEnv] || undefined : undefined;

export const planForPrice = (priceId?: string): PlanKey | null =>
  (Object.keys(PLANS) as PlanKey[]).find((k) => !!priceId && process.env[PLANS[k].priceEnv] === priceId) ?? null;

export const isActive = (status?: string | null) => status === 'active' || status === 'trialing';
