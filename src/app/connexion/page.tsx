'use client';
import { useState, type FormEvent } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function Connexion() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function envoyer(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    setBusy(false);
    setMsg(error ? "Envoi impossible : vérifiez l'adresse e-mail." : 'Lien envoyé. Ouvrez votre e-mail pour vous connecter.');
  }

  return (
    <>
      <div className="bar">DevisPro AI</div>
      <main>
        <h1>Connexion</h1>
        <form className="card" onSubmit={envoyer}>
          <label>
            Adresse e-mail
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <button className="btn pri" disabled={busy}>Recevoir un lien de connexion</button>
          <p className="sm" role="status">{msg}</p>
        </form>
      </main>
    </>
  );
}
