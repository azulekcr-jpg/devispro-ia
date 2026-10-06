import type { Line } from './quotes';

export type Company = {
  id: string; name: string; legalForm: string; address: string; phone: string; email: string;
  siret: string; vatNumber: string; rcs: string; insurance: string; vatExempt: boolean;
  defaultVatRate: number; defaultValidDays: number; defaultNote: string; logoData: string;
};
// Copie des infos entreprise figée dans chaque devis (le logo est lu sur la fiche entreprise).
export type CompanySnapshot = Pick<Company, 'name' | 'legalForm' | 'address' | 'phone' | 'email' | 'siret' | 'vatNumber' | 'rcs' | 'insurance' | 'vatExempt'>;
export type Client = { id: string; name: string; phone: string; email: string; address: string };
export type ClientInfo = Omit<Client, 'id'>;

export const STATUSES = ['brouillon', 'envoye', 'accepte', 'refuse'] as const;
export type QuoteStatus = (typeof STATUSES)[number];
export const STATUS_LABELS: Record<QuoteStatus, string> = { brouillon: 'Brouillon', envoye: 'Envoyé', accepte: 'Accepté', refuse: 'Refusé' };

export type Quote = {
  id: string; number: string; issuedOn: string; validDays: number; status: QuoteStatus; subject: string;
  discountPercent: number; note: string; company: CompanySnapshot; clientId: string | null; client: ClientInfo; lines: Line[];
};
export type QuoteSummary = { id: string; number: string; issuedOn: string; status: QuoteStatus; subject: string; clientName: string; ttc: number };
