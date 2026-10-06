import type { Client, Company, Quote, QuoteStatus, QuoteSummary } from './types';
import { totals, type Line } from './quotes';

// Accès aux données. `db` est un client Supabase (la sécurité par ligne est appliquée par la base).
type DB = any;
function check<T extends { error: any }>(r: T): T {
  if (r.error) throw new Error(r.error.message || 'Erreur de base de données.');
  return r;
}

// ---------- Entreprise ----------
const companyFromRow = (r: any): Company => ({
  id: r.id, name: r.name ?? '', legalForm: r.legal_form ?? '', address: r.address ?? '', phone: r.phone ?? '', email: r.email ?? '',
  siret: r.siret ?? '', vatNumber: r.vat_number ?? '', rcs: r.rcs ?? '', insurance: r.insurance ?? '', vatExempt: !!r.vat_exempt,
  defaultVatRate: Number(r.default_vat_rate ?? 10), defaultValidDays: Number(r.default_valid_days ?? 30),
  defaultNote: r.default_note ?? '', logoData: r.logo_data ?? '',
});

export async function getCompany(db: DB): Promise<Company> {
  const r = check(await db.from('companies').select('*').maybeSingle());
  if (r.data) return companyFromRow(r.data);
  // Compte antérieur à la création automatique de la fiche : on la crée.
  const u = check(await db.auth.getUser());
  if (!u.data?.user) throw new Error('Session expirée : reconnectez-vous.');
  const ins = check(await db.from('companies').insert({ owner_id: u.data.user.id, email: u.data.user.email ?? '' }).select('*').single());
  return companyFromRow(ins.data);
}

export async function saveCompany(db: DB, c: Company): Promise<void> {
  check(await db.from('companies').update({
    name: c.name.trim(), legal_form: c.legalForm.trim(), address: c.address.trim(), phone: c.phone.trim(), email: c.email.trim(),
    siret: c.siret.trim(), vat_number: c.vatNumber.trim().toUpperCase(), rcs: c.rcs.trim(), insurance: c.insurance.trim(),
    vat_exempt: c.vatExempt, default_vat_rate: c.vatExempt ? 0 : c.defaultVatRate, default_valid_days: c.defaultValidDays,
    default_note: c.defaultNote, logo_data: c.logoData,
  }).eq('id', c.id));
}

// ---------- Clients ----------
const clientFromRow = (r: any): Client => ({ id: r.id, name: r.name, phone: r.phone ?? '', email: r.email ?? '', address: r.address ?? '' });

export async function listClients(db: DB): Promise<Client[]> {
  const r = check(await db.from('clients').select('*').order('name', { ascending: true }));
  return (r.data ?? []).map(clientFromRow);
}

export async function saveClient(db: DB, companyId: string, c: Omit<Client, 'id'> & { id?: string }): Promise<Client> {
  const row = { name: c.name.trim(), phone: c.phone.trim(), email: c.email.trim(), address: c.address.trim() };
  const r = c.id
    ? check(await db.from('clients').update(row).eq('id', c.id).select('*').single())
    : check(await db.from('clients').insert({ ...row, company_id: companyId }).select('*').single());
  return clientFromRow(r.data);
}

export async function deleteClient(db: DB, id: string): Promise<void> {
  check(await db.from('clients').delete().eq('id', id)); // les devis existants gardent leur copie des coordonnées
}

// ---------- Devis ----------
const lineFromRow = (r: any): Line => ({
  designation: r.designation, quantity: Number(r.quantity), unit: r.unit, unitPriceCents: Number(r.unit_price_cents), vatRate: Number(r.vat_rate),
});

function quoteFromRow(r: any): Quote {
  const lines = [...(r.quote_lines ?? [])].sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0)).map(lineFromRow);
  const cl = r.client_snapshot ?? {};
  return {
    id: r.id, number: r.number, issuedOn: r.issued_on, validDays: Number(r.valid_days), status: r.status as QuoteStatus, subject: r.subject ?? '',
    discountPercent: Number(r.discount_percent ?? 0), note: r.note ?? '', company: r.company_snapshot ?? {}, clientId: r.client_id ?? null,
    client: { name: cl.name ?? '', phone: cl.phone ?? '', email: cl.email ?? '', address: cl.address ?? '' }, lines,
  };
}

export async function listQuotes(db: DB): Promise<QuoteSummary[]> {
  const r = check(await db.from('quotes')
    .select('id, number, issued_on, status, subject, discount_percent, client_snapshot, created_at, quote_lines(quantity, unit_price_cents, vat_rate)')
    .order('created_at', { ascending: false }));
  return (r.data ?? []).map((q: any) => {
    const lines = (q.quote_lines ?? []).map((l: any) => ({ designation: '', unit: 'u', quantity: Number(l.quantity), unitPriceCents: Number(l.unit_price_cents), vatRate: Number(l.vat_rate) }));
    return { id: q.id, number: q.number, issuedOn: q.issued_on, status: q.status, subject: q.subject ?? '', clientName: q.client_snapshot?.name ?? '', ttc: totals(lines, Number(q.discount_percent ?? 0)).ttc };
  });
}

export async function getQuote(db: DB, id: string): Promise<Quote | null> {
  const r = check(await db.from('quotes').select('*, quote_lines(*)').eq('id', id).maybeSingle());
  return r.data ? quoteFromRow(r.data) : null;
}

// Création (id vide : numéro attribué par la base, sans doublon) ou mise à jour.
export async function saveQuote(db: DB, companyId: string, q: Quote): Promise<{ id: string; number: string }> {
  const row = {
    company_id: companyId, client_id: q.clientId, issued_on: q.issuedOn, valid_days: q.validDays, status: q.status, subject: q.subject.trim(),
    discount_percent: q.discountPercent, note: q.note, company_snapshot: q.company,
    client_snapshot: { name: q.client.name.trim(), phone: q.client.phone.trim(), email: q.client.email.trim(), address: q.client.address.trim() },
  };
  let id = q.id;
  let number = q.number;
  let oldLineIds: string[] = [];
  if (!id) {
    number = check(await db.rpc('next_quote_number', { p_company: companyId })).data;
    id = check(await db.from('quotes').insert({ ...row, number }).select('id').single()).data.id;
  } else {
    check(await db.from('quotes').update(row).eq('id', id));
    oldLineIds = (check(await db.from('quote_lines').select('id').eq('quote_id', id)).data ?? []).map((l: any) => l.id);
  }
  // Nouvelles lignes d'abord, anciennes ensuite : jamais de devis sans lignes en cas d'erreur.
  if (q.lines.length) {
    check(await db.from('quote_lines').insert(q.lines.map((l, i) => ({
      quote_id: id, position: i, designation: l.designation, quantity: l.quantity, unit: l.unit, unit_price_cents: l.unitPriceCents, vat_rate: l.vatRate,
    }))));
  }
  if (oldLineIds.length) check(await db.from('quote_lines').delete().in('id', oldLineIds));
  return { id, number };
}

export async function deleteQuote(db: DB, id: string): Promise<void> {
  check(await db.from('quotes').delete().eq('id', id));
}

// Export complet des données de l'utilisateur (portabilité).
export async function exportAll(db: DB) {
  const company = await getCompany(db);
  const clients = await listClients(db);
  const summaries = await listQuotes(db);
  const quotes = (await Promise.all(summaries.map((s) => getQuote(db, s.id)))).filter(Boolean);
  return { exportedAt: new Date().toISOString(), company: { ...company, logoData: company.logoData ? '[logo présent]' : '' }, clients, quotes };
}

export const errMsg = (e: unknown): string => (e instanceof Error && e.message ? e.message : 'Une erreur est survenue.');
