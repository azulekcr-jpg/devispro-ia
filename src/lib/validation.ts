import type { ClientInfo, Company } from './types';
import { isIsoDate, toNumber, type EditLine } from './quotes';

export const isEmail = (s: string) => !s || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
export const isPhone = (s: string) => !s || /^[+()\d\s.\-]{6,20}$/.test(s.trim());
export const isSiret = (s: string) => !s || (/^[\d\s]+$/.test(s) && s.replace(/\s/g, '').length === 14);
export const isVatNumber = (s: string) => !s || /^[A-Z]{2}[0-9A-Z]{2,12}$/.test(s.replace(/\s/g, '').toUpperCase());
export const formatSiret = (s: string) => {
  const d = s.replace(/\s/g, '');
  return d.length === 14 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 9)} ${d.slice(9)}` : s.trim();
};

export type Errors = Record<string, string>;

export function validateCompany(c: Company): Errors {
  const e: Errors = {};
  if (!c.name.trim()) e.name = "Indiquez le nom de l'entreprise.";
  if (!isEmail(c.email)) e.email = 'Adresse e-mail invalide.';
  if (!isPhone(c.phone)) e.phone = 'Numéro de téléphone invalide.';
  if (!isSiret(c.siret)) e.siret = 'Le SIRET doit comporter 14 chiffres.';
  if (!isVatNumber(c.vatNumber)) e.vatNumber = 'Numéro de TVA invalide (exemple : FR12345678901).';
  if (!(c.defaultValidDays >= 1 && c.defaultValidDays <= 365)) e.defaultValidDays = 'Entre 1 et 365 jours.';
  return e;
}

export function validateClient(c: ClientInfo): Errors {
  const e: Errors = {};
  if (!c.name.trim()) e.name = 'Indiquez le nom du client.';
  if (!isEmail(c.email)) e.email = 'Adresse e-mail invalide.';
  if (!isPhone(c.phone)) e.phone = 'Numéro de téléphone invalide.';
  return e;
}

// Renvoie la liste des erreurs à corriger avant l'enregistrement d'un devis.
export function validateQuoteForm(f: { client: ClientInfo; issuedOn: string; validDays: number; discount: string; lines: EditLine[] }): string[] {
  const out: string[] = [];
  if (!f.client.name.trim()) out.push('Indiquez le nom du client.');
  if (!isEmail(f.client.email)) out.push('Adresse e-mail du client invalide.');
  if (!isIsoDate(f.issuedOn)) out.push('Date du devis invalide.');
  if (!(f.validDays >= 1 && f.validDays <= 365)) out.push('La validité doit être comprise entre 1 et 365 jours.');
  const d = f.discount.trim() === '' ? 0 : toNumber(f.discount);
  if (d < 0 || d > 100 || (f.discount.trim() !== '' && Number.isNaN(Number(f.discount.replace(',', '.'))))) out.push('La remise doit être comprise entre 0 et 100 %.');
  if (!f.lines.length) out.push('Ajoutez au moins une ligne au devis.');
  f.lines.forEach((l, i) => {
    const n = i + 1;
    if (!l.designation.trim()) out.push(`Ligne ${n} : indiquez une désignation.`);
    if (!(toNumber(l.qty) > 0)) out.push(`Ligne ${n} : la quantité doit être supérieure à 0.`);
    if (l.price.trim() !== '' && Number.isNaN(Number(l.price.replace(/\s/g, '').replace(',', '.')))) out.push(`Ligne ${n} : prix unitaire invalide.`);
    else if (toNumber(l.price) < 0) out.push(`Ligne ${n} : le prix ne peut pas être négatif.`);
  });
  return out;
}
