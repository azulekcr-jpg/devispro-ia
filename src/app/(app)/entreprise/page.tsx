'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { errMsg, exportAll, getCompany, saveCompany } from '@/lib/data';
import { formatSiret, validateCompany, type Errors } from '@/lib/validation';
import { downloadFile, resizeLogo } from '@/lib/browser';
import { VAT_RATES } from '@/lib/quotes';
import type { Company } from '@/lib/types';
import Field from '@/components/Field';
import { useToast } from '@/components/Toast';
import { useUnsavedWarning } from '@/components/useUnsaved';

export default function MonEntreprise() {
  const db = useMemo(() => supabaseBrowser(), []);
  const { toast, toastNode } = useToast();
  const [c, setC] = useState<Company | null>(null);
  const [days, setDays] = useState('30');
  const [errors, setErrors] = useState<Errors>({});
  const [msg, setMsg] = useState('');
  const [loadErr, setLoadErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  useUnsavedWarning(dirty);

  useEffect(() => {
    getCompany(db).then((x) => { setC(x); setDays(String(x.defaultValidDays)); }).catch((e) => setLoadErr(errMsg(e)));
  }, [db]);

  if (loadErr) return <><h1>Mon entreprise</h1><p className="errs" role="alert">{loadErr}</p></>;
  if (!c) return <><h1>Mon entreprise</h1><p className="sm">Chargement…</p></>;

  const set = (patch: Partial<Company>) => { setC({ ...c, ...patch }); setDirty(true); setMsg(''); };
  const text = (k: keyof Company, props: Record<string, string> = {}) => (
    <input value={String(c[k] ?? '')} onChange={(e) => set({ [k]: e.target.value } as Partial<Company>)} {...props} />
  );

  async function save() {
    if (!c) return;
    const next: Company = { ...c, siret: formatSiret(c.siret), defaultValidDays: Number(days) };
    const e = validateCompany(next);
    setErrors(e);
    if (Object.keys(e).length) { setMsg(''); toast('Corrigez les champs signalés.'); return; }
    setSaving(true);
    try {
      await saveCompany(db, next);
      const fresh = await getCompany(db); // relecture : on affiche ce qui est réellement enregistré
      setC(fresh); setDays(String(fresh.defaultValidDays)); setDirty(false);
      setMsg('✓ Informations enregistrées. Elles apparaîtront sur vos nouveaux devis.');
      toast('Informations enregistrées.');
    } catch (err) { setMsg(''); toast(errMsg(err)); } finally { setSaving(false); }
  }

  async function onLogo(file?: File) {
    if (!file) return;
    try { set({ logoData: await resizeLogo(file) }); } catch (e) { toast(errMsg(e)); }
  }

  async function exportData() {
    try { downloadFile(JSON.stringify(await exportAll(db), null, 2), 'devispro-donnees.json', 'application/json'); } catch (e) { toast(errMsg(e)); }
  }

  return (
    <>
      <h1>Mon entreprise</h1>
      <p className="lead">Ces informations s'ajoutent automatiquement à chaque nouveau devis.</p>

      <div className="card">
        <h2 style={{ fontSize: 18, margin: '0 0 12px' }}>Identité</h2>
        <div className="logo">
          {c.logoData ? <img src={c.logoData} alt="Logo de l'entreprise" /> : <span className="sm">Aucun logo</span>}
          <label className="btn s" style={{ display: 'inline-flex', alignItems: 'center' }}>
            {c.logoData ? 'Changer le logo' : 'Ajouter un logo'}
            <input type="file" accept="image/png,image/jpeg" hidden onChange={(e) => { onLogo(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
          {c.logoData && <button type="button" className="btn s dng" onClick={() => set({ logoData: '' })}>Retirer</button>}
        </div>
        <div className="g">
          <Field label="Nom de l'entreprise" error={errors.name}>{text('name', { autoComplete: 'organization' })}</Field>
          <Field label="Forme juridique (EI, SARL…)">{text('legalForm')}</Field>
        </div>
        <Field label="Adresse">{text('address', { autoComplete: 'street-address' })}</Field>
        <div className="g">
          <Field label="Téléphone" error={errors.phone}>{text('phone', { type: 'tel', inputMode: 'tel', autoComplete: 'tel' })}</Field>
          <Field label="E-mail" error={errors.email}>{text('email', { type: 'email', inputMode: 'email', autoComplete: 'email' })}</Field>
        </div>
      </div>

      <div className="card">
        <h2 style={{ fontSize: 18, margin: '0 0 12px' }}>Informations légales</h2>
        <div className="g">
          <Field label="Numéro SIRET" error={errors.siret}>{text('siret', { inputMode: 'numeric' })}</Field>
          <Field label="Numéro de TVA intracommunautaire" error={errors.vatNumber}>{text('vatNumber')}</Field>
        </div>
        <div className="g">
          <Field label="RCS ou répertoire des métiers">{text('rcs')}</Field>
          <Field label="Assurance (décennale, RC pro)">{text('insurance')}</Field>
        </div>
      </div>

      <div className="card">
        <h2 style={{ fontSize: 18, margin: '0 0 12px' }}>Paramètres des devis</h2>
        <label className="chk">
          <input type="checkbox" checked={c.vatExempt} onChange={(e) => set({ vatExempt: e.target.checked, defaultVatRate: e.target.checked ? 0 : 10 })} />
          <span>TVA non applicable (franchise en base). Les devis sont à 0 % et portent la mention « art. 293 B du CGI ».</span>
        </label>
        <div className="g">
          <Field label="Taux de TVA par défaut">
            <select value={c.defaultVatRate} disabled={c.vatExempt} onChange={(e) => set({ defaultVatRate: Number(e.target.value) })}>
              {VAT_RATES.map((v) => <option key={v} value={v}>{String(v).replace('.', ',')} %</option>)}
            </select>
          </Field>
          <Field label="Validité des devis (jours)" error={errors.defaultValidDays}>
            <input inputMode="numeric" value={days} onChange={(e) => { setDays(e.target.value); setDirty(true); setMsg(''); }} />
          </Field>
        </div>
        <Field label="Conditions affichées sur les devis">
          <textarea rows={3} value={c.defaultNote} onChange={(e) => set({ defaultNote: e.target.value })} />
        </Field>
      </div>

      <div className="bt">
        <button className="btn pri" type="button" onClick={save} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
      </div>
      <p className="ok" role="status" style={{ minHeight: '1.5em' }}>{msg}{dirty && !msg ? <span className="sm">Modifications non enregistrées.</span> : null}</p>

      <div className="card">
        <h2 style={{ fontSize: 18, margin: '0 0 6px' }}>Mes données</h2>
        <p className="sm">Téléchargez une copie de vos informations, clients et devis (fichier JSON).</p>
        <button className="btn s" type="button" onClick={exportData}>Exporter mes données</button>
      </div>
      {toastNode}
    </>
  );
}
