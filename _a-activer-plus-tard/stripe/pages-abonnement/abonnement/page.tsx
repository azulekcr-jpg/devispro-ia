import { supabaseServer } from '@/lib/supabase/server';
import { PLANS, isActive, type PlanKey } from '@/lib/stripe/plans';

export default async function Abonnement({ searchParams }: { searchParams: Promise<{ paiement?: string }> }) {
  const { paiement } = await searchParams;
  const supabase = await supabaseServer();
  const { data: sub } = await supabase.from('subscriptions').select('plan, status, current_period_end, cancel_at_period_end').maybeSingle();
  const stripeReady = !!process.env.STRIPE_SECRET_KEY;
  const active = isActive(sub?.status);

  return (
    <>
      <h1>Abonnement</h1>
      {paiement === 'ok' && <p className="sm" role="status">Paiement reçu. L'abonnement s'active dans quelques instants.</p>}
      {paiement === 'annule' && <p className="sm" role="status">Paiement annulé.</p>}
      <div className="card">
        {active ? (
          <p>
            Formule active : <b>{PLANS[sub!.plan as PlanKey]?.label ?? sub!.plan}</b>
            {sub!.current_period_end && <> — prochaine échéance le {new Date(sub!.current_period_end).toLocaleDateString('fr-FR')}</>}
            {sub!.cancel_at_period_end && <> (résiliation programmée)</>}
          </p>
        ) : (
          <p>Aucun abonnement actif.</p>
        )}
        {!stripeReady && <p className="sm">Le paiement en ligne n'est pas encore activé.</p>}
        {(Object.keys(PLANS) as PlanKey[]).map((k) => (
          <form key={k} action="/api/stripe/checkout" method="post" style={{ marginBottom: 8 }}>
            <input type="hidden" name="plan" value={k} />
            <button className="btn pri" disabled={!stripeReady}>Choisir la {PLANS[k].label}</button>
          </form>
        ))}
        {stripeReady && sub && (
          <form action="/api/stripe/portal" method="post">
            <button className="btn">Gérer mon abonnement</button>
          </form>
        )}
      </div>
    </>
  );
}
