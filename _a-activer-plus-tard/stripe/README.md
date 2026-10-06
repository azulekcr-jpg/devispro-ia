# Paiements Stripe : préparés, non actifs

Ce dossier est **hors de l'application** (exclu du build). Il contient l'étape préparée plus tôt : Checkout, portail client, webhook, page d'abonnement. La table `subscriptions` existe déjà dans la base (`0001_init.sql`).

## Pour l'activer
1. `npm install stripe server-only`
2. Copiez : `lib/*` vers `src/lib/stripe/` (déplacez `admin.ts` dans `src/lib/supabase/`), `api/stripe` vers `src/app/api/stripe`, `pages-abonnement/abonnement` vers `src/app/(app)/abonnement`.
3. Ajoutez `'/abonnement'` à la liste `PROTECTED` de `src/middleware.ts` et un lien dans `src/components/Nav.tsx`.
4. Ajoutez les variables serveur dans `.env.example` et chez l'hébergeur : `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PLAN_A`, `STRIPE_PRICE_PLAN_B`. **Jamais dans le code ni dans une variable `NEXT_PUBLIC_`.**
5. Stripe (mode test d'abord) : 2 produits avec prix récurrent, portail client activé, webhook vers `https://VOTRE-SITE/api/stripe/webhook` pour `checkout.session.completed`, `customer.subscription.created|updated|deleted`, `invoice.paid`, `invoice.payment_failed`.
6. Définissez les noms, prix et limites des deux formules.
