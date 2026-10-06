// Logique de devis, sans dépendance : portée du prototype, montants en centimes entiers.
export type Line = { designation: string; quantity: number; unit: string; unitPriceCents: number; vatRate: number };
export type Defaults = { quantity: number; unitPriceCents: number; vatRate: number };
export const VAT_RATES = [20, 10, 5.5, 2.1, 0];

export function toNumber(v: string | number): number {
  const n = parseFloat(String(v).replace(',', '.').replace(/\s/g, ''));
  return Number.isFinite(n) ? n : 0;
}
export const toCents = (v: string | number): number => Math.round(toNumber(v) * 100);
export const lineHt = (l: Line): number => Math.round(l.quantity * l.unitPriceCents);

export const TVA_FRANCHISE_MENTION = 'TVA non applicable, art. 293 B du CGI.';

// La TVA est calculée par taux sur le total HT de ce taux (et non ligne par ligne).
// Une remise globale (%) réduit la base de chaque taux avant calcul de la TVA.
export function totals(lines: Line[], discountPercent = 0) {
  const d = Math.min(100, Math.max(0, discountPercent || 0));
  const bases = new Map<number, number>();
  let gross = 0;
  for (const l of lines) {
    const h = lineHt(l);
    gross += h;
    bases.set(l.vatRate, (bases.get(l.vatRate) ?? 0) + h);
  }
  const vat = [...bases.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([rate, base]) => {
      const net = Math.round((base * (100 - d)) / 100);
      return { rate, base: net, amount: Math.round((net * rate) / 100) };
    });
  const ht = vat.reduce((s, v) => s + v.base, 0);
  const vatTotal = vat.reduce((s, v) => s + v.amount, 0);
  return { gross, discount: gross - ht, ht, vat, vatTotal, ttc: ht + vatTotal };
}

export const formatEur = (cents: number): string =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);

const UNIT_ALIAS: Record<string, string> = { heure: 'h', heures: 'h', m2: 'm²', jour: 'j', jours: 'j', 'unité': 'u', 'unités': 'u', forfaits: 'forfait' };
const UNIT_RE = /(\d+(?:[.,]\d+)?)\s*(h|heures?|m²|m2|ml|jours?|j|u|unités?|forfaits?)(?=[\s,;.]|$)/i;

// « Génération par description » : une prestation par ligne, quantité et prix repérés si présents.
export function parseDescription(text: string, d: Defaults): Line[] {
  return text
    .split(/\n|;|\.(?=\s|$)/)
    .map((s) => s.replace(/^[\s\-•*]+/, '').trim())
    .filter((s) => s.length > 2)
    .map((raw) => {
      let s = raw;
      let price = d.unitPriceCents;
      let quantity = d.quantity;
      let unit = 'u';
      const prices = [...s.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:€|euros?)(?:\s*HT)?/gi)];
      if (prices.length) {
        const p = prices[prices.length - 1];
        price = toCents(p[1]);
        s = s.replace(p[0], ' ');
      }
      s = s.replace(/\s+(?:à|pour|de|:|au prix de)\s*$/i, '');
      let m = s.match(UNIT_RE);
      if (m) {
        quantity = toNumber(m[1]);
        const u = m[2].toLowerCase();
        unit = UNIT_ALIAS[u] ?? u;
        s = s.replace(m[0], ' ');
      } else if ((m = s.match(/^(\d+(?:[.,]\d+)?)\s*x?\s+(?=\D)/i))) {
        quantity = toNumber(m[1]);
        s = s.slice(m[0].length);
      }
      s = s.replace(/\s{2,}/g, ' ').trim();
      return { designation: s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Prestation', quantity, unit, unitPriceCents: price, vatRate: d.vatRate };
    });
}

// ---------- Édition : les montants sont saisis sous forme de texte ----------
export type EditLine = { designation: string; qty: string; unit: string; price: string; vatRate: number };
const frNum = (n: number) => String(n).replace('.', ',');
const frPrice = (c: number) => (c % 100 === 0 ? String(c / 100) : (c / 100).toFixed(2).replace('.', ','));
export const blankLine = (vatRate: number): EditLine => ({ designation: '', qty: '1', unit: 'u', price: '', vatRate });
export const toEditLine = (l: Line): EditLine => ({ designation: l.designation, qty: frNum(l.quantity), unit: l.unit, price: frPrice(l.unitPriceCents), vatRate: l.vatRate });
export const fromEditLine = (e: EditLine): Line => ({ designation: e.designation.trim(), quantity: toNumber(e.qty), unit: e.unit.trim() || 'u', unitPriceCents: toCents(e.price), vatRate: e.vatRate });
export const formatPercent = (n: number) => frNum(n);

// ---------- Dates (format ISO AAAA-MM-JJ, sans décalage de fuseau) ----------
const pad = (n: number) => String(n).padStart(2, '0');
export const todayIso = (): string => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const isIsoDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}
export const fmtDate = (iso: string) => (isIsoDate(iso) ? iso.split('-').reverse().join('/') : iso);

// Recherche insensible à la casse et aux accents.
export const normalize = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
