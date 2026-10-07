# Liste de contrôle avant ouverture au public

## 1. Base de données et comptes (Supabase)
- [ ] Projet en région UE ; migrations `0001` et `0002` exécutées dans l'ordre.
- [ ] Authentication > URL Configuration : URL du site et `https://VOTRE-SITE/auth/callback` en redirection.
- [ ] **E-mails de connexion** (voir `docs/EMAILS.md`) : le service d'envoi par défaut est limité et prévu pour les tests. Configurez un SMTP dédié (Resend, Brevo, Mailjet…) et traduisez les modèles d'e-mail en français.
- [ ] Sauvegardes automatiques activées (offre Pro) ; faites un test de restauration.

## 2. Hébergement
- [ ] GitHub puis Vercel (offre Pro pour un usage commercial) ou un hébergeur Docker (`Dockerfile` fourni).
- [ ] Variables publiques : `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- [ ] Variables secrètes (serveur) pour l'envoi des devis : `RESEND_API_KEY`, `EMAIL_FROM` (voir `docs/EMAILS.md`). Jamais dans GitHub.
- [ ] Nom de domaine, HTTPS, redirection www.

## 3. Juridique (à faire valider par un professionnel)
- [ ] Mentions légales, CGU/CGV, politique de confidentialité.
- [ ] RGPD : les clients des artisans sont des données personnelles (registre, sous-traitants Supabase et hébergeur, durée de conservation, droit d'accès : l'export JSON existe).
- [ ] Mentions obligatoires du devis : l'application les permet (forme juridique, SIRET, TVA, RCS/métiers, assurance, durée de validité, conditions). Chaque artisan doit les renseigner dans « Mon entreprise ».
- [ ] Suppression de compte à la demande : à ajouter (nécessite une clé serveur, donc une route dédiée) ou à traiter manuellement au début.

## 4. Qualité
- [ ] `npm test`, `npm run typecheck`, `npm run build` sans erreur (la CI GitHub le fait).
- [ ] Parcours à tester à la main sur téléphone : inscription par e-mail, Mon entreprise (avec logo), un client, un devis complet, PDF, reconnexion sur un autre appareil.
- [ ] Surveillance : journaux de l'hébergeur, alertes d'erreur.

## 5. Distribution au public
- [ ] Application installable depuis le navigateur (manifeste et icônes fournis). Pour l'usage hors ligne, ajouter un service worker.
- [ ] App Store / Google Play : possible en enveloppant le site (PWABuilder, Capacitor). Les règles des boutiques sur les abonnements sont à étudier avant d'activer les paiements.

## 6. Paiements
Voir `_a-activer-plus-tard/stripe/README.md`.
