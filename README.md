# DevisPro AI

Application web pour artisans : devis professionnels, clients, informations de l'entreprise, PDF.
Next.js (TypeScript) + Supabase (comptes et base Postgres). Paiements : pas encore (voir `_a-activer-plus-tard/`).

## Fonctionnalités
- **Mon entreprise** : nom, forme juridique, adresse, téléphone, e-mail, SIRET, TVA intracommunautaire, RCS/métiers, assurance, logo, franchise de TVA, taux de TVA par défaut, validité et conditions par défaut, export des données.
- **Mes clients** : ajouter, modifier, supprimer, rechercher (sans tenir compte des accents), créer un devis pour un client.
- **Mes devis** : liste, recherche, filtre par statut, ouvrir, PDF, supprimer (en deux appuis).
- **Éditeur de devis** : client (choix d'un client enregistré ou saisie), génération des lignes à partir d'une description, lignes (désignation, quantité, unité, prix HT, TVA), remise globale, totaux HT / TVA par taux / TTC, numérotation automatique (DEV-2026-001), statut (brouillon, envoyé, accepté, refusé), PDF, impression, **envoi du devis par e-mail avec le PDF en pièce jointe** (Resend, voir `docs/EMAILS.md`).
- **TVA** : calculée sur le total HT de chaque taux (pas ligne par ligne). Une remise réduit la base de chaque taux avant le calcul.
- Interface adaptée au téléphone, installable (manifeste et icônes fournis).

## Lancer en local
1. Node 22 ou plus, puis `npm install`.
2. Créez un projet Supabase (région UE). Copiez `.env.example` en `.env.local` et renseignez l'URL et la clé publique ("anon" / "publishable").
3. Dans Supabase (SQL Editor), exécutez dans l'ordre `supabase/migrations/0001_init.sql`, `0002_entreprise_et_devis.sql` puis `0003_envoi_devis_email.sql`.
4. Supabase > Authentication > URL Configuration : ajoutez `http://localhost:3000/auth/callback` aux URL de redirection.
5. `npm run dev` puis http://localhost:3000.

## Reproductibilité des installations
Lancez une fois `npm install` sur votre ordinateur et **enregistrez le fichier `package-lock.json`** généré dans GitHub (ou lancez le workflow « Générer package-lock.json » dans l'onglet Actions) : Vercel installera alors exactement les mêmes versions à chaque déploiement.

## Dépannage
Build Vercel, variables d'environnement, versions : `docs/DEPANNAGE.md`.

## Vérifications
- `npm test` : tests de la logique de devis, de la validation, de la couche de données (base simulée) et du PDF.
- `npm run typecheck` et `npm run build`.

## Structure
```
src/app/            pages (connexion, Mes devis, Mes clients, Mon entreprise, éditeur)
src/components/     éditeur de devis, navigation, messages
src/lib/            calculs et lecture de description (quotes.ts), validation, données (data.ts), PDF (pdf.ts)
supabase/migrations schéma, sécurité par ligne, numérotation
tests/              tests automatisés
prototype/          le prototype d'origine (fichier unique) et ses tests de bout en bout
_a-activer-plus-tard/stripe/   paiements, hors de l'application pour l'instant
docs/MISE-EN-LIGNE.md          liste de contrôle avant ouverture au public
```

## Déploiement
Voir `docs/MISE-EN-LIGNE.md`. **E-mails de connexion : `docs/EMAILS.md`** (un SMTP doit être configuré dans Supabase, sinon « Envoi impossible » pour les adresses hors équipe). En bref : dépôt GitHub, Vercel (ou un hébergeur Docker avec le `Dockerfile`), variables d'environnement de `.env.example`, URL de production ajoutée dans Supabase.

## Sécurité
- Aucune clé secrète dans le code. Seules l'URL et la clé publique Supabase sont utilisées dans le navigateur.
- Chaque utilisateur ne lit et n'écrit que ses données (règles RLS dans la base).
