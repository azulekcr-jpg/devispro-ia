import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildQuoteEmail, quoteFilename, resendErrorMessage } from '../src/lib/email.ts';
import { quote } from './pdf.test.ts';

const company: any = { name: 'Plomberie Martin & Fils', email: 'contact@martin.fr' };

test("contenu de l'e-mail : objet, montant, validité, message", () => {
  const m = buildQuoteEmail({ quote: quote(), company, message: 'Merci pour votre confiance.' });
  assert.equal(m.subject, 'Devis DEV-2026-001 : Remplacement du chauffe-eau et remise aux normes - Plomberie Martin & Fils');
  for (const s of ['Bonjour Mme Sophie Lambert,', 'Merci pour votre confiance.', 'n° DEV-2026-001', '764,37', 'jusqu\'au 04/11/2026', 'Bon pour accord', 'contact@martin.fr']) assert.ok(m.text.includes(s), s);
  assert.ok(m.html.includes('Plomberie Martin &amp; Fils'));
});
test('le HTML échappe les contenus saisis (pas d\'injection)', () => {
  const q = quote(); q.client.name = '<script>alert(1)</script>'; q.subject = 'a"b\r\nBcc: x@y.z';
  const m = buildQuoteEmail({ quote: q, company, message: '<img src=x onerror=alert(1)>' });
  assert.ok(!m.html.includes('<script>') && !m.html.includes('<img'));
  assert.ok(!/[\r\n]/.test(m.subject));
});
test('nom du fichier joint', () => { assert.equal(quoteFilename({ number: 'DEV-2026-001' }), 'DEV-2026-001.pdf'); assert.equal(quoteFilename({ number: '' }), 'Devis.pdf'); assert.equal(quoteFilename({ number: 'a/b c' }), 'a_b_c.pdf'); });
test('messages d\'erreur Resend', () => {
  assert.match(resendErrorMessage(403, { name: 'validation_error', message: 'You can only send testing emails to your own email address (a@b.fr).' }), /mode test/);
  assert.match(resendErrorMessage(403, { message: 'The martin.fr domain is not verified.' }), /domaine/);
  assert.match(resendErrorMessage(401, { name: 'missing_api_key', message: 'Missing API key' }), /RESEND_API_KEY/);
  assert.match(resendErrorMessage(422, { message: 'Invalid `from` field.' }), /EMAIL_FROM/);
  assert.match(resendErrorMessage(429, {}), /Trop d'envois/);
  assert.match(resendErrorMessage(500, { name: 'application_error' }), /application_error/);
});
