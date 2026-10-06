'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase/client';
import { deleteQuote, errMsg, getCompany, getQuote, listQuotes } from '@/lib/data';
import { fmtDate, formatEur, normalize } from '@/lib/quotes';
import { downloadFile, safeFilename } from '@/lib/browser';
import { STATUSES, STATUS_LABELS, type QuoteSummary } from '@/lib/types';
import ConfirmButton from '@/components/ConfirmButton';
import { useToast } from '@/components/Toast';

export default function MesDevis() {
  const db = useMemo(() => supabaseBrowser(), []);
  const { toast, toastNode } = useToast();
  const [items, setItems] = useState<QuoteSummary[] | null>(null);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const load = useCallback(async () => {
    try { setErr(''); setItems(await listQuotes(db)); } catch (e) { setErr(errMsg(e)); }
  }, [db]);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const s = normalize(search.trim());
    return (items ?? []).filter((q) => (!status || q.status === status) && (!s || normalize(`${q.number} ${q.clientName} ${q.subject}`).includes(s)));
  }, [items, search, status]);

  async function pdf(id: string) {
    try {
      const [q, c] = await Promise.all([getQuote(db, id), getCompany(db)]);
      if (!q) throw new Error('Devis introuvable.');
      const { buildQuotePdf } = await import('@/lib/pdf');
      downloadFile(await buildQuotePdf(q, c.logoData), `${safeFilename(q.number || 'Devis')}.pdf`, 'application/pdf');
    } catch (e) { toast(errMsg(e)); }
  }
  async function remove(id: string) {
    try { await deleteQuote(db, id); toast('Devis supprimé.'); await load(); } catch (e) { toast(errMsg(e)); }
  }

  return (
    <>
      <div className="top">
        <h1>Mes devis</h1>
        <Link className="btn pri" href="/devis/nouveau">Nouveau devis</Link>
      </div>
      <div className="g" style={{ gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)', marginBottom: 14 }}>
        <input type="search" placeholder="Rechercher par client, numéro ou objet" aria-label="Rechercher un devis" value={search} onChange={(e) => setSearch(e.target.value)} style={{ margin: 0 }} />
        <select aria-label="Filtrer par statut" value={status} onChange={(e) => setStatus(e.target.value)} style={{ margin: 0 }}>
          <option value="">Tous les statuts</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
      </div>
      {err && <p className="errs" role="alert">{err} <button className="btn s" onClick={load}>Réessayer</button></p>}
      {!err && items === null && <p className="sm">Chargement…</p>}
      {items && !items.length && <p className="sm">Aucun devis pour le moment. Créez le premier avec « Nouveau devis ».</p>}
      {items && items.length > 0 && !shown.length && <p className="sm">Aucun résultat.</p>}
      {shown.map((q) => (
        <div className="row" key={q.id}>
          <div className="rm">
            <b>{q.clientName || 'Sans client'}</b>
            <small>{q.number}, {fmtDate(q.issuedOn)}{q.subject ? `, ${q.subject}` : ''}</small>
            <span><span className={`badge ${q.status}`}>{STATUS_LABELS[q.status]}</span></span>
          </div>
          <div className="rt">{formatEur(q.ttc)}<small>TTC</small></div>
          <div className="ra">
            <Link className="btn s" href={`/devis/${q.id}`}>Ouvrir</Link>
            <button className="btn s" type="button" onClick={() => pdf(q.id)}>PDF</button>
            <ConfirmButton label="Supprimer" onConfirm={() => remove(q.id)} />
          </div>
        </div>
      ))}
      {toastNode}
    </>
  );
}
