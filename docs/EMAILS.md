# E-mails de l'application (connexion) : configuration

## Ce que le projet envoie
Un seul type d'e-mail : le **lien de connexion**, envoyé par **Supabase Auth** quand on saisit son adresse sur la page de connexion.
Le projet ne contient aucun autre service d'e-mail, aucun mot de passe d'e-mail et aucune clé d'e-mail : **aucune variable d'environnement e-mail n'est à créer dans Vercel**. Les identifiants du service d'envoi se saisissent uniquement dans le tableau de bord Supabase.

## Pourquoi « Envoi impossible » sur le site en ligne
Sans service d'envoi personnalisé, Supabase n'envoie qu'aux membres de votre équipe Supabase, avec une limite très basse (2 e-mails par heure), et refuse toute autre adresse. C'est prévu pour les tests, pas pour un site public. Il faut brancher un service d'envoi (SMTP).

## À faire, dans l'ordre

### 1. Un service d'envoi SMTP (exemple : Resend, gratuit pour démarrer ; Brevo et Mailjet conviennent aussi)
1. Créez un compte, **ajoutez et vérifiez votre nom de domaine** (enregistrements DNS demandés par le service). Sans cela, les e-mails sont refusés ou classés en indésirables.
2. Créez une clé d'API / des identifiants SMTP. Ne les copiez nulle part ailleurs que dans Supabase (étape 2).

### 2. Supabase : Authentication > Emails > SMTP Settings (le libellé du menu peut varier légèrement)
Activez « Enable custom SMTP » et renseignez :
- Sender email : une adresse de votre domaine, par exemple `no-reply@votredomaine.fr`
- Sender name : `DevisPro AI`
- Host, Port (587 ou 465), Username, Password : ceux de votre service. Pour Resend : hôte `smtp.resend.com`, identifiant `resend`, mot de passe = votre clé API Resend.
Puis Authentication > Rate Limits : relevez la limite d'e-mails si besoin (elle démarre bas après l'activation).

### 3. Supabase : Authentication > URL Configuration
- Site URL : `https://VOTRE-DOMAINE`
- Redirect URLs : `https://VOTRE-DOMAINE/auth/callback` et `http://localhost:3000/auth/callback` (et, si vous utilisez les déploiements d'aperçu Vercel, `https://*-VOTRE-EQUIPE.vercel.app/**`).

### 4. Vercel : Project > Settings > Environment Variables (Production, et Preview si besoin)
| Nom | Valeur |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet (Supabase > Project Settings > API) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clé publique « anon » / « publishable » |
| `NEXT_PUBLIC_SITE_URL` | `https://VOTRE-DOMAINE` |
Ces variables sont intégrées au site à la compilation : après les avoir créées ou modifiées, **redéployez** (Deployments > Redeploy).

### 5. En local
Copiez `.env.example` en `.env.local` (ce fichier est ignoré par Git, ne le publiez jamais) et renseignez les mêmes variables.

### 6. Tester
Sur le site en ligne, demandez un lien avec une adresse extérieure à votre équipe, puis ouvrez le lien **dans le même navigateur et sur le même appareil** que la demande.

## Messages affichés et que faire
| Message | Cause | Action |
|---|---|---|
| « L'application n'est pas configurée… » | variables absentes sur Vercel | étape 4, puis redéployer |
| « …service d'envoi n'est pas encore configuré… » | SMTP par défaut de Supabase | étapes 1 et 2 |
| « Le service d'envoi d'e-mails ne répond pas correctement » | SMTP mal renseigné (hôte, port, identifiants, domaine non vérifié) | vérifier l'étape 2 ; détail dans Supabase > Logs > Auth |
| « Trop de demandes » | limite d'envoi atteinte | attendre ; relever la limite (étape 2) |
| « Le lien… est invalide ou expiré » | lien déjà utilisé, trop ancien, ou ouvert sur un autre appareil | redemander un lien et l'ouvrir sur le même appareil |
| « Envoi impossible (code) » | autre cause | le code indique la cause ; voir Supabase > Logs > Auth |

## Envoi d'un devis par e-mail à un client (Resend)

Dans l'éditeur de devis, le bouton **Envoyer par e-mail** envoie le devis, avec le **PDF en pièce jointe**, à l'adresse e-mail du client saisie dans le devis. Le client peut répondre directement à l'e-mail de « Mon entreprise ».
Ce service est indépendant du lien de connexion ci-dessus : il passe par l'API de Resend, appelée depuis le serveur (`src/app/api/devis/envoyer/route.ts`).

### Variables d'environnement à créer dans Vercel (Settings > Environment Variables)
| Nom | Valeur | Remarque |
|---|---|---|
| `RESEND_API_KEY` | votre clé API Resend (commence par `re_`) | secret, serveur uniquement |
| `EMAIL_FROM` | `DevisPro <devis@votredomaine.fr>` | adresse d'un domaine **vérifié** chez Resend |
Cochez Production (et Preview si vous testez les aperçus). Aucune autre variable n'est nécessaire. Puis **redéployez**.

### Étapes
1. Compte sur resend.com, puis Domains > Add Domain : ajoutez votre domaine et créez chez votre registrar les enregistrements DNS demandés. Attendez « Verified ».
2. API Keys > Create API Key (droit « Sending access ») : copiez la clé, une seule fois.
3. Vercel : créez `RESEND_API_KEY` et `EMAIL_FROM`, puis Deployments > Redeploy.
4. Supabase > SQL Editor : exécutez `supabase/migrations/0003_envoi_devis_email.sql` (journal des envois et limite de 20 e-mails par heure). Sans cette étape, l'envoi fonctionne mais sans journal ni limite.
5. Test : ouvrez un devis enregistré dont le client a une adresse e-mail, cliquez « Envoyer par e-mail ».

### Mode test de Resend
Sans domaine vérifié, Resend n'accepte que l'expéditeur `onboarding@resend.dev` et n'envoie qu'à l'adresse e-mail de votre compte Resend. Pour essayer avant d'avoir un domaine : `EMAIL_FROM` = `DevisPro <onboarding@resend.dev>` et mettez l'adresse de votre compte Resend comme e-mail du client.

### Messages d'erreur
| Message | Action |
|---|---|
| « …variables RESEND_API_KEY et EMAIL_FROM à ajouter dans Vercel… » | créer les 2 variables puis redéployer |
| « La clé API Resend est refusée » | recréer la clé, corriger `RESEND_API_KEY`, redéployer |
| « Le domaine d'expédition n'est pas vérifié » / « Resend est en mode test » | vérifier le domaine ; `EMAIL_FROM` doit en venir |
| « Ce devis n'a pas d'adresse e-mail client valide » | renseigner l'e-mail du client dans le devis |
| « Limite atteinte : 20 e-mails par heure » | patienter |
Le détail technique de chaque échec est dans Vercel > Logs (recherchez « Envoi devis »).
