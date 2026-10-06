import Link from 'next/link';

export default function Accueil() {
  return (
    <>
      <div className="bar">DevisPro AI</div>
      <main>
        <h1>Décrivez le chantier, le devis est prêt.</h1>
        <p className="lead">
          Des devis chiffrés, clairs et professionnels pour les artisans : vos clients, votre entreprise et vos devis restent
          disponibles sur tous vos appareils, avec un PDF prêt à envoyer.
        </p>
        <Link className="btn pri" href="/connexion">Se connecter</Link>
      </main>
    </>
  );
}
