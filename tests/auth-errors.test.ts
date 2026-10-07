import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loginErrorMessage } from '../src/lib/auth-errors.ts';

test('chaque cause connue donne un message précis', () => {
  assert.match(loginErrorMessage({ code: 'email_address_not_authorized', status: 400 }), /SMTP/);
  assert.match(loginErrorMessage({ code: 'over_email_send_rate_limit', status: 429 }), /Trop de demandes/);
  assert.match(loginErrorMessage({ status: 429, message: 'For security purposes, you can only request this after 56 seconds.' }), /Trop de demandes/);
  assert.match(loginErrorMessage({ code: 'email_address_invalid' }), /invalide/);
  assert.match(loginErrorMessage({ code: 'unexpected_failure', status: 500, message: 'Error sending magic link email' }), /SMTP/);
  assert.match(loginErrorMessage({ code: 'signup_disabled' }), /désactivées/);
});
test('cause inconnue : le code est affiché pour faciliter le diagnostic', () => {
  assert.equal(loginErrorMessage({ code: 'weird_code', status: 400 }), 'Envoi impossible (weird_code). Réessayez dans un instant.');
  assert.equal(loginErrorMessage(null), 'Envoi impossible. Réessayez dans un instant.');
});
