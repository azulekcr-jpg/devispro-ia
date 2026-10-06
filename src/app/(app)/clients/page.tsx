'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase/client';
import { deleteClient, errMsg, getCompany, listClients, saveClient } from '@/lib/data';
import { normalize } from '@/lib/quotes';
import { validateClient, type Errors } from '@/lib/validation';
import type { Client } from '@/lib/types';
import Field from '@/components/Field';
import ConfirmButton from '@/components/ConfirmButton';
import { useToast } from '@/components/Toast';

const EMPTY = { name: '', phone: '', email: '', address: '' };

export default function MesClients() {
  const db = useMemo(() => supabaseBrowser(), []);
  const { toast, toastNode } = useToast();
  const [companyId, setCompanyId] = useState('');
  const [clients, setClients] = useState<Client[] | null>(null);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { setErr(''); const [co, list] = await Promise.all([getCompany(db), listClients(db)]); setCompanyId(co.id); setClients(list); } catch (e) { setErr(errMsg(e)); }
  }, [db]);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const s = normalize(search.trim());
    return (clients ?? []).filter((c) => !s || normalize([c.name, c.phone, c.email, c.address].join(' ')).includes(s));
  }, [clients, search]);

  async function submit() {
    const e = validateClient(form);
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      await saveClient(db, companyId, { ...form, id: editing ?? undefined });
      toast(editing ? 'Client modifié.' : 'Client ajouté.');
      setForm(EMPTY); setEditing(null); setErrors({});
      await load();
    } catch (x) { toast(errMsg(x)); } finally { setSaving(false); }
  }
  function edit(c: Client) {
    setEditing(c.id); setForm({ name: c.name, phone: c.phone, email: c.email, address: c.address }); setErrors({}); window.scrollTo(0, 0);
  }
  function cancel() { setEditing(null); setForm(EMPTY); setErrors({}); }
  async function remove(c: Client) {
    try { await deleteClient(db, c.id); if (editing === c.id) cancel(); toast('Client supprimé.'); await load(); } catch (x) { toast(errMsg(x)); }
  }
  const f = (k: keyof typeof EMPTY, props: Record<string, string> = {}) => (
    <input value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} {...props} />
  );

  return (
    <>
      <h1>Mes clients</h1>
      <div className="card">
        <h2 style={{ fontSize: 18, margin: '0 0 12px' }}>{editing ? 'Modifier le client' : 'Nouveau client'}</h2>
        <div className="g">
          <Field label="Nom" error={errors.name}>{f('name', { autoComplete: 'off' })}</Field>
          <Field label="Téléphone" error={errors.phone}>{f('phone', { type: 'tel', inputMode: 'tel' })}</Field>
          <Field label="E-mail" error={errors.email}>{f('email', { type: 'email', inputMode: 'email' })}</Field>
          <Field label="Adresse">{f('address')}</Field>
        </div>
        <div className="bt">
          <button className="btn pri" type="button" onClick={submit} disabled={saving || !companyId}>{editing ? 'Enregistrer' : 'Ajouter le client'}</button>
          {editing && <button className="btn" type="button" onClick={cancel}>Annuler</button>}
        </div>
      </div>

      <input type="search" placeholder="Rechercher un client (nom, téléphone, e-mail, adresse)" aria-label="Rechercher un client" value={search} onChange={(e) => setSearch(e.target.value)} style={{ marginBottom: 14 }} />
      {err && <p className="errs" role="alert">{err} <button className="btn s" onClick={load}>Réessayer</button></p>}
      {!err && clients === null && <p className="sm">Chargement…</p>}
      {clients && !clients.length && <p className="sm">Aucun client enregistré. Ajoutez le premier ci-dessus.</p>}
      {clients && clients.length > 0 && !shown.length && <p className="sm">Aucun résultat pour cette recherche.</p>}
      {shown.map((c) => (
        <div className="row" key={c.id}>
          <div className="rm">
            <b>{c.name}</b>
            {(c.phone || c.email) && <span>{[c.phone, c.email].filter(Boolean).join(', ')}</span>}
            {c.address && <small>{c.address}</small>}
          </div>
          <div className="ra">
            <Link className="btn s pri" href={`/devis/nouveau?client=${c.id}`}>Nouveau devis</Link>
            <button className="btn s" type="button" onClick={() => edit(c)}>Modifier</button>
            <ConfirmButton label="Supprimer" onConfirm={() => remove(c)} />
          </div>
        </div>
      ))}
      {toastNode}
    </>
  );
}
