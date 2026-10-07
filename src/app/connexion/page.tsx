'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { isSupabaseConfigured, supabaseBrowser } from '@/lib/supabase/client';
import { CONFIG_MISSING_MESSAGE, loginErrorMessage } from '@/lib/auth-errors';
import { isEmail } from '@/lib/validation';

export default function Connexion() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(location.search).get('erreur')) setMsg('Le lien de connexion est invalide ou expiré. Demandez-en un nouveau.');
  }, []);

  async function envoyer(e: FormEvent) {
    e.preventDefault();
    setMsg(''); setSent(false);
    const addr = email.trim();
    if (!addr || !isEmail(addr)) { setMsg('Adresse e-mail invalide : vérifiez-la.'); return; }
    if (!isSupabaseConfigured()) { setMsg(CONFIG_MISSING_MESSAGE); return; }
    setBusy(true);
    try {
      const { error } = await supabaseBrowser().auth.signInWithOtp({
        email: addr,
        options: { emailRedirectTo: `${location.origin}/auth/callback` },
      });
      if (error) {
        console.error('Connexion : erreur Supabase Auth', { code: error.code, status: error.status, message: error.message });
        setMsg(loginErrorMessage(error));
      } else {
        setSent(true);
        setMsg('Lien envoyé. Ouvrez votre e-mail sur cet appareil (pensez aux courriers indésirables) et cliquez sur le lien.');
      }
    } catch (x) {
      console.error('Connexion : erreur inattendue', x);
      setMsg(loginErrorMessage(null));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="bar">DevisPro AI</div>
      <main>
        <h1>Connexion</h1>
        <form className="card" onSubmit={envoyer} noValidate>
          <label>
            Adresse e-mail
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <button className="btn pri" disabled={busy}>{busy ? 'Envoi…' : 'Recevoir un lien de connexion'}</button>
          <p className={sent ? 'ok' : 'err'} role="status">{msg}</p>
        </form>
      </main>
    </>
  );
}
