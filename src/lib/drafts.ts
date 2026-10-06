import type { Client, Company, CompanySnapshot, Quote } from './types';
import { todayIso } from './quotes';

export const snapshotOf = (c: Company): CompanySnapshot => ({
  name: c.name, legalForm: c.legalForm, address: c.address, phone: c.phone, email: c.email, siret: c.siret,
  vatNumber: c.vatNumber, rcs: c.rcs, insurance: c.insurance, vatExempt: c.vatExempt,
});

// Nouveau devis : les paramètres de « Mon entreprise » sont repris automatiquement.
export function newQuote(c: Company, client?: Client): Quote {
  return {
    id: '', number: '', issuedOn: todayIso(), validDays: c.defaultValidDays, status: 'brouillon', subject: '',
    discountPercent: 0, note: c.defaultNote, company: snapshotOf(c), clientId: client?.id ?? null,
    client: { name: client?.name ?? '', phone: client?.phone ?? '', email: client?.email ?? '', address: client?.address ?? '' }, lines: [],
  };
}
