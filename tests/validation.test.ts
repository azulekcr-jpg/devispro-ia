import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateCompany, validateClient, validateQuoteForm, isSiret, isVatNumber, formatSiret } from '../src/lib/validation.ts';
import { blankLine } from '../src/lib/quotes.ts';

const co = { id: 'c', name: 'Martin', legalForm: '', address: '', phone: '06 12 34 56 78', email: 'a@b.fr', siret: '812 345 678 00019', vatNumber: 'FR12345678901', rcs: '', insurance: '', vatExempt: false, defaultVatRate: 10, defaultValidDays: 30, defaultNote: '', logoData: '' };

test('entreprise valide / invalide', () => {
  assert.deepEqual(validateCompany(co), {});
  const e = validateCompany({ ...co, name: ' ', email: 'x', phone: 'abc', siret: '123', vatNumber: '12', defaultValidDays: 0 });
  assert.deepEqual(Object.keys(e).sort(), ['defaultValidDays', 'email', 'name', 'phone', 'siret', 'vatNumber']);
});
test('SIRET, TVA, formatage', () => {
  assert.ok(isSiret('81234567800019') && isSiret('') && !isSiret('8123456780001') && !isSiret('8123456780001A'));
  assert.ok(isVatNumber('fr 12 345678901') && !isVatNumber('F'));
  assert.equal(formatSiret('81234567800019'), '812 345 678 00019');
});
test('client', () => {
  assert.deepEqual(validateClient({ name: 'Dupont', phone: '', email: '', address: '' }), {});
  assert.deepEqual(Object.keys(validateClient({ name: '', phone: '', email: 'zz', address: '' })).sort(), ['email', 'name']);
});
test('devis : erreurs à corriger', () => {
  const ok = { client: { name: 'Dupont', phone: '', email: '', address: '' }, issuedOn: '2026-10-05', validDays: 30, discount: '', lines: [{ ...blankLine(10), designation: 'Lavabo', price: '120,50' }] };
  assert.deepEqual(validateQuoteForm(ok), []);
  assert.equal(validateQuoteForm({ ...ok, lines: [] })[0], 'Ajoutez au moins une ligne au devis.');
  const bad = validateQuoteForm({ ...ok, client: { ...ok.client, name: '' }, discount: '150', validDays: 0, lines: [{ ...blankLine(10), qty: '0', price: 'abc' }] });
  assert.ok(bad.includes('Indiquez le nom du client.') && bad.includes('Ligne 1 : indiquez une désignation.') && bad.includes('Ligne 1 : la quantité doit être supérieure à 0.') && bad.includes('Ligne 1 : prix unitaire invalide.'));
  assert.ok(bad.some((m) => m.startsWith('La remise')) && bad.some((m) => m.startsWith('La validité')));
});
