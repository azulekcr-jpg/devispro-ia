'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { deleteQuote, errMsg, getCompany, getQuote, listClients, saveClient, saveQuote } from '@/lib/data';
import { newQuote, snapshotOf } from '@/lib/drafts';
import {
  addDaysIso, blankLine, fmtDate, formatEur, fromEditLine, lineHt, normalize, parseDescription, toCents, toEditLine, toNumber, totals,
  TVA_FRANCHISE_MENTION, VAT_RATES, type EditLine,
} from '@/lib/quotes';
import { validateClient, validateQuoteForm } from '@/lib/validation';
import { downloadFile, safeFilename } from '@/lib/browser';
import { STATUSES, STATUS_LABELS, type Client, type Company, type Quote, type QuoteStatus } from '@/lib/types';
import { useToast } from './Toast';
import ConfirmButton from './ConfirmButton';
import { useUnsavedWarning } from './useUnsaved';

const EXAMPLES: Record<string, { label: string; client: string; text: string; qty: string; price: string }> = {
  plomb: { label: 'Plombier', client: 'Mme Sophie Lambert', qty: '1', price: '80', text: "Remplacement du chauffe-eau 200 L à 480 €\n3 h main d'œuvre à 55 €\n2 raccords flexibles à 18 €\nÉvacuation de l'ancien ballon à 40 €" },
  elec: { label: 'Électricien', client: 'M. Karim Benali', qty: '1', price: '60', text: 'Remplacement du tableau électrique 2 rangées à 650 €\n6 prises 16 A à 38 €\n4 h main d\'œuvre à 60 €\nContrôle et mise en conformité à 120 €' },
  pein: { label: 'Peintre', client: 'Mme Claire Fontaine', qty: '1', price: '20', text: 'Peinture salon et couloir 45 m² à 22 €\nPréparation et rebouchage des murs 1 forfait à 180 €\nProtection du sol et du mobilier 1 forfait à 60 €' },
};
const rateLabel = (v: number) => String(v).replace('.', ',');

export default function QuoteEditor({ id }: { id?: string }) {
  const db = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();
  const { toast, toastNode } = useToast();
  const [company, setCompany] = useState<Company | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [q, setQ] = useState<Quote | null>(null);
  const [lines, setLines] = useState<EditLine[]>([]);
  const [discount, setDiscount] = useState('');
  const [days, setDays] = useState('30');
  const [desc, setDesc] = useState({ text: '', qty: '1', price: '' });
  const [genErr, setGenErr] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [loadErr, setLoadErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  useUnsavedWarning(dirty);

  useEffect(() => {
    let off = false;
    (async () => {
      try {
        const [c, cl] = await Promise.all([getCompany(db), listClients(db)]);
        const quote = id ? await getQuote(db, id) : null;
        if (id && !quote) throw new Error('Devis introuvable.');
        if (off) return;
        setCompany(c); setClients(cl);
        if (quote) {
          setQ(quote); setLines(quote.lines.map(toEditLine)); setDays(String(quote.validDays));
          setDiscount(quote.discountPercent ? rateLabel(quote.discountPercent) : '');
          if (new URLSearchParams(location.search).get('enregistre')) toast('Devis enregistré.');
        } else {
          const pre = new URLSearchParams(location.search).get('client');
          setQ(newQuote(c, cl.find((x) => x.id === pre)));
          setLines([blankLine(c.vatExempt ? 0 : c.defaultVatRate)]);
          setDays(String(c.defaultValidDays));
        }
      } catch (e) { if (!off) setLoadErr(errMsg(e)); }
    })();
    return () => { off = true; };
  }, [db, id, toast]);

  if (loadErr) return <><h1>Devis</h1><p className="errs" role="alert">{loadErr}</p><Link className="btn" href="/devis">Retour à Mes devis</Link></>;
  if (!q || !company) return <><h1>Devis</h1><p className="sm">Chargement…</p></>;

  const exempt = q.company.vatExempt;
  const defaultRate = exempt ? 0 : company.defaultVatRate;
  const current = (): Quote => ({
    ...q, validDays: Number(days), discountPercent: toNumber(discount),
    lines: lines.map((l) => fromEditLine(exempt ? { ...l, vatRate: 0 } : l)),
  });
  const t = totals(current().lines, toNumber(discount));
  const onlyZero = t.vat.every((v) => v.rate === 0);
  const co = q.company;

  const patch = (p: Partial<Quote>) => { setQ({ ...q, ...p }); setDirty(true); };
  const patchClient = (p: Partial<Quote['client']>) => patch({ client: { ...q.client, ...p } });
  const setLine = (i: number, p: Partial<EditLine>) => { setLines(lines.map((l, k) => (k === i ? { ...l, ...p } : l))); setDirty(true); };
  const addLine = () => {
    setLines([...lines, blankLine(defaultRate)]); setDirty(true);
    setTimeout(() => { const a = document.querySelectorAll<HTMLTextAreaElement>('#lines .d'); a[a.length - 1]?.focus(); }, 0);
  };
  const delLine = (i: number) => { setLines(lines.filter((_, k) => k !== i)); setDirty(true); };

  function generate() {
    const text = desc.text.trim();
    if (!text) { setGenErr('Décrivez au moins une prestation pour générer le devis.'); return; }
    const gen = parseDescription(text, { quantity: toNumber(desc.qty) || 1, unitPriceCents: toCents(desc.price), vatRate: defaultRate });
    if (!gen.length) { setGenErr('Aucune prestation reconnue. Écrivez une prestation par ligne.'); return; }
    setGenErr('');
    setLines([...lines.filter((l) => l.designation.trim() || toNumber(l.price) > 0), ...gen.map(toEditLine)]);
    setDirty(true);
    toast(`${gen.length} ligne${gen.length > 1 ? 's' : ''} ajoutée${gen.length > 1 ? 's' : ''} au devis.`);
  }
  function example(k: string) {
    const e = EXAMPLES[k];
    setDesc({ text: e.text, qty: e.qty, price: e.price });
    if (!q!.client.name.trim()) patchClient({ name: e.client });
  }
  function pick(cid: string) {
    const c = clients.find((x) => x.id === cid);
    if (!c) { patch({ clientId: null }); return; }
    patch({ clientId: c.id, client: { name: c.name, phone: c.phone, email: c.email, address: c.address } });
  }
  async function saveAsClient() {
    const e = validateClient(q!.client);
    if (Object.keys(e).length) { toast(Object.values(e)[0]); return; }
    try {
      const c = await saveClient(db, company!.id, q!.client);
      setClients((await listClients(db)));
      patch({ clientId: c.id });
      toast('Client ajouté à Mes clients.');
    } catch (x) { toast(errMsg(x)); }
  }
  async function refreshCompany() {
    try {
      const c = await getCompany(db);
      setCompany(c);
      patch({ company: snapshotOf(c) });
      if (c.vatExempt) setLines(lines.map((l) => ({ ...l, vatRate: 0 })));
      toast('Informations de l’entreprise actualisées sur ce devis.');
    } catch (x) { toast(errMsg(x)); }
  }

  async function save() {
    const quote = current();
    const errs = validateQuoteForm({ client: quote.client, issuedOn: quote.issuedOn, validDays: quote.validDays, discount, lines });
    setErrors(errs);
    if (errs.length) { toast('Corrigez les erreurs avant d’enregistrer.'); window.scrollTo(0, 0); return; }
    setSaving(true);
    try {
      const r = await saveQuote(db, company!.id, quote);
      setDirty(false);
      if (!quote.id) router.replace(`/devis/${r.id}?enregistre=1`);
      else { setQ({ ...q!, number: r.number }); toast('Devis enregistré.'); }
    } catch (x) { toast(errMsg(x)); } finally { setSaving(false); }
  }
  async function pdf() {
    try {
      const { buildQuotePdf } = await import('@/lib/pdf');
      const quote = current();
      downloadFile(await buildQuotePdf(quote, company!.logoData), `${safeFilename(quote.number || 'Devis-brouillon')}.pdf`, 'application/pdf');
    } catch (x) { toast(`Le PDF n’a pas pu être généré : ${errMsg(x)}`); }
  }
  async function remove() {
    try { await deleteQuote(db, q!.id); setDirty(false); router.push('/devis'); } catch (x) { toast(errMsg(x)); }
  }

  const visibleClients = clients.filter((c) => c.id === q.clientId || !clientSearch.trim() || normalize(`${c.name} ${c.phone} ${c.email}`).includes(normalize(clientSearch.trim())));
  const validUntil = q.issuedOn && Number(days) > 0 ? fmtDate(addDaysIso(q.issuedOn, Number(days))) : '';

  return (
    <>
      <div className="top noprint">
        <h1>{q.id ? `Devis ${q.number}` : 'Nouveau devis'}</h1>
        {dirty && <span className="sm" role="status">Modifications non enregistrées</span>}
      </div>

      {errors.length > 0 && (
        <div className="errs noprint" role="alert"><b>À corriger :</b><ul>{errors.map((e) => <li key={e}>{e}</li>)}</ul></div>
      )}

      <details className="card noprint" open={!q.id}>
        <summary>Décrire les travaux (génération automatique des lignes)</summary>
        <div className="chips" style={{ marginTop: 12 }}>
          <span className="sm">Charger un exemple :</span>
          {Object.entries(EXAMPLES).map(([k, e]) => <button key={k} className="chip" type="button" onClick={() => example(k)}>{e.label}</button>)}
        </div>
        <label className="f"><span>Description des travaux</span>
          <textarea rows={5} value={desc.text} onChange={(e) => setDesc({ ...desc, text: e.target.value })} />
          <small className="sm">Une prestation par ligne. Indiquez quantité et prix unitaire HT quand vous les avez, par exemple « 2 prises à 35 € » ou « 3 h main d'œuvre à 55 € ». Sinon, les valeurs par défaut ci-dessous s'appliquent.</small>
        </label>
        <div className="g" style={{ marginBottom: 14 }}>
          <label className="f"><span>Quantité par défaut</span><input inputMode="decimal" value={desc.qty} onChange={(e) => setDesc({ ...desc, qty: e.target.value })} /></label>
          <label className="f"><span>Prix unitaire HT par défaut (€)</span><input inputMode="decimal" value={desc.price} onChange={(e) => setDesc({ ...desc, price: e.target.value })} /></label>
        </div>
        <button className="btn pri" type="button" onClick={generate}>Générer les lignes</button>
        <p className="err" role="alert">{genErr}</p>
      </details>

      <div className="card noprint">
        <h2 style={{ fontSize: 18, margin: '0 0 12px' }}>Client</h2>
        {clients.length > 0 && (
          <div className="g" style={{ marginBottom: 6 }}>
            <label className="f"><span>Rechercher un client enregistré</span>
              <input type="search" value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} placeholder="Nom, téléphone, e-mail" />
            </label>
            <label className="f"><span>Choisir un client</span>
              <select value={q.clientId ?? ''} onChange={(e) => pick(e.target.value)}>
                <option value="">Nouveau client (saisie ci-dessous)</option>
                {visibleClients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          </div>
        )}
        <p className="sm" style={{ margin: '0 0 8px' }}>Les coordonnées se modifient directement dans le devis ci-dessous.</p>
        {!q.clientId && q.client.name.trim() && <button className="btn s" type="button" onClick={saveAsClient}>Enregistrer ce client dans Mes clients</button>}
      </div>

      <div className="tb noprint">
        <Link className="btn" href="/devis">Mes devis</Link>
        <button className="btn pri" type="button" onClick={save} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
        <button className="btn" type="button" onClick={pdf}>Télécharger le PDF</button>
        <button className="btn" type="button" onClick={() => window.print()}>Imprimer</button>
        {q.id && <button className="btn" type="button" onClick={refreshCompany}>Actualiser mes informations</button>}
        {q.id && <ConfirmButton label="Supprimer" className="btn dng" onConfirm={remove} />}
      </div>

      <div className="paper" id="paper">
        <div className="ph">
          <div className="co">
            {company.logoData && <img className="logo-img" src={company.logoData} alt="Logo" />}
            <b className="big" style={{ display: 'block' }}>{co.name || 'Votre entreprise'}</b>
            <div className="coi">
              {co.legalForm && <div>{co.legalForm}</div>}
              {co.address && <div>{co.address}</div>}
              {(co.phone || co.email) && <div>{[co.phone && `Tél. ${co.phone}`, co.email].filter(Boolean).join(' - ')}</div>}
              {(co.siret || co.vatNumber) && <div>{[co.siret && `SIRET ${co.siret}`, co.vatNumber && `TVA ${co.vatNumber}`].filter(Boolean).join(' - ')}</div>}
              {co.rcs && <div>{co.rcs}</div>}
              {co.insurance && <div>Assurance : {co.insurance}</div>}
              {!co.name && <div className="noprint">Renseignez « Mon entreprise » pour compléter cet en-tête.</div>}
            </div>
          </div>
          <div className="dn">
            <h2>Devis</h2>
            <label>N° <input readOnly value={q.number || 'Attribué à l’enregistrement'} aria-label="Numéro du devis" /></label>
            <label>Date <input type="date" value={q.issuedOn} onChange={(e) => patch({ issuedOn: e.target.value })} /></label>
            <label>Validité, en jours <input inputMode="numeric" value={days} onChange={(e) => { setDays(e.target.value); setDirty(true); }} /></label>
            {validUntil && <div className="fine">Valable jusqu'au {validUntil}</div>}
            <label className="noprint">Statut
              <select value={q.status} onChange={(e) => patch({ status: e.target.value as QuoteStatus })}>
                {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </label>
          </div>
        </div>

        <div className="cl">
          <span className="sm">Client</span>
          <input className="big" aria-label="Nom du client" placeholder="Nom du client" value={q.client.name} onChange={(e) => patchClient({ name: e.target.value })} />
          <input aria-label="Adresse du client" placeholder="Adresse" value={q.client.address} onChange={(e) => patchClient({ address: e.target.value })} />
          <input inputMode="tel" aria-label="Téléphone du client" placeholder="Téléphone" value={q.client.phone} onChange={(e) => patchClient({ phone: e.target.value })} />
          <input inputMode="email" aria-label="E-mail du client" placeholder="E-mail" value={q.client.email} onChange={(e) => patchClient({ email: e.target.value })} />
        </div>
        <input className="big" style={{ marginBottom: 14 }} aria-label="Objet du devis" placeholder="Objet du devis (facultatif)" value={q.subject} onChange={(e) => patch({ subject: e.target.value })} />

        <div className="lh"><span>Désignation</span><span>Qté</span><span>Unité</span><span>P.U. HT</span><span>TVA</span><span>Total HT</span><span></span></div>
        <div id="lines">
          {lines.map((l, i) => (
            <div className="ln" key={i}>
              <textarea className="d" rows={1} aria-label="Désignation" value={l.designation} onChange={(e) => setLine(i, { designation: e.target.value })} />
              <label className="c"><span className="l">Qté</span><input inputMode="decimal" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} /></label>
              <label className="c"><span className="l">Unité</span><input value={l.unit} onChange={(e) => setLine(i, { unit: e.target.value })} /></label>
              <label className="c"><span className="l">P.U. HT</span><input inputMode="decimal" value={l.price} onChange={(e) => setLine(i, { price: e.target.value })} /></label>
              <label className="c"><span className="l">TVA</span>
                <select aria-label="TVA" value={exempt ? 0 : l.vatRate} disabled={exempt} onChange={(e) => setLine(i, { vatRate: Number(e.target.value) })}>
                  {VAT_RATES.map((v) => <option key={v} value={v}>{rateLabel(v)} %</option>)}
                </select>
              </label>
              <span className="c"><span className="l">Total HT</span><output>{formatEur(lineHt(fromEditLine(l)))}</output></span>
              <button className="del noprint" type="button" aria-label="Supprimer la ligne" onClick={() => delLine(i)}>×</button>
            </div>
          ))}
          {!lines.length && <p className="sm">Aucune ligne. Ajoutez-en une.</p>}
        </div>
        <button className="btn noprint" id="add" type="button" onClick={addLine}>Ajouter une ligne</button>

        <div className="tot" aria-live="polite">
          <div className={toNumber(discount) > 0 ? '' : 'noprint'}>
            <span>Remise (%)</span>
            <input style={{ width: 90, textAlign: 'right' }} inputMode="decimal" aria-label="Remise en pourcentage" value={discount} onChange={(e) => { setDiscount(e.target.value); setDirty(true); }} />
          </div>
          {t.discount > 0 && <div><span>Total HT avant remise</span><span>{formatEur(t.gross)}</span></div>}
          {t.discount > 0 && <div><span>Remise</span><span>- {formatEur(t.discount)}</span></div>}
          <div><span>Total HT</span><b>{formatEur(t.ht)}</b></div>
          {!onlyZero && t.vat.map((v) => <div key={v.rate}><span>TVA {rateLabel(v.rate)} %</span><span>{formatEur(v.amount)}</span></div>)}
          <div className="ttc"><span>Total TTC</span><span>{formatEur(t.ttc)}</span></div>
        </div>
        {exempt && <p className="sm">{TVA_FRANCHISE_MENTION}</p>}
        <textarea aria-label="Conditions" value={q.note} onChange={(e) => patch({ note: e.target.value })} />
        <div className="sig">Bon pour accord, date et signature du client</div>
      </div>
      {toastNode}
    </>
  );
}
