import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDescription, totals, toCents, formatEur } from '../src/lib/quotes.ts';

const D = { quantity: 1, unitPriceCents: 0, vatRate: 10 };

test('exemple plombier : lignes, quantités, unités, prix', () => {
  const l = parseDescription("Remplacement du chauffe-eau 200 L à 480 €\n3 h main d'œuvre à 55 €\n2 raccords flexibles à 18 €\nÉvacuation de l'ancien ballon à 40 €", D);
  assert.deepEqual(l.map((x) => [x.designation, x.quantity, x.unit, x.unitPriceCents]), [
    ['Remplacement du chauffe-eau 200 L', 1, 'u', 48000],
    ["Main d'œuvre", 3, 'h', 5500],
    ['Raccords flexibles', 2, 'u', 1800],
    ["Évacuation de l'ancien ballon", 1, 'u', 4000],
  ]);
  const t = totals(l);
  assert.equal(t.ht, 72100); assert.equal(t.vatTotal, 7210); assert.equal(t.ttc, 79310);
});

test('exemple peintre : unités m² et forfait', () => {
  const l = parseDescription('Peinture salon et couloir 45 m² à 22 €\nPréparation et rebouchage des murs 1 forfait à 180 €', D);
  assert.equal(l[0].quantity, 45); assert.equal(l[0].unit, 'm²'); assert.equal(l[0].designation, 'Peinture salon et couloir');
  assert.equal(l[1].unit, 'forfait'); assert.equal(l[1].unitPriceCents, 18000);
});

test('valeurs par défaut quand quantité et prix sont absents', () => {
  const l = parseDescription('Dépannage fuite', { quantity: 2, unitPriceCents: 8000, vatRate: 20 });
  assert.deepEqual(l[0], { designation: 'Dépannage fuite', quantity: 2, unit: 'u', unitPriceCents: 8000, vatRate: 20 });
});

test('saisie manuelle : deux taux de TVA (même résultat que le prototype)', () => {
  const t = totals([
    { designation: 'Lavabo', quantity: 2, unit: 'u', unitPriceCents: 15050, vatRate: 20 },
    { designation: "Main d'œuvre", quantity: 3, unit: 'h', unitPriceCents: 5500, vatRate: 10 },
  ]);
  assert.equal(t.ht, 46600);
  assert.deepEqual(t.vat.map((v) => [v.rate, v.amount]), [[20, 6020], [10, 1650]]);
  assert.equal(t.ttc, 54270);
});

test('TVA calculée par taux sur le total, pas ligne par ligne', () => {
  const l = { designation: 'x', quantity: 1, unit: 'u', unitPriceCents: 33, vatRate: 20 };
  assert.equal(totals([l, l, l]).vatTotal, 20); // 99 c x 20 % = 19,8 -> 20 (et non 3 x 7 = 21)
});

test('conversions et formatage', () => {
  assert.equal(toCents('35,5'), 3550); assert.equal(toCents('1 234,56'), 123456); assert.equal(toCents('abc'), 0);
  assert.match(formatEur(54270).replace(/[\u202f\u00a0]/g, ' '), /542,70/);
});

test('liste vide', () => assert.deepEqual(totals([]), { gross: 0, discount: 0, ht: 0, vat: [], vatTotal: 0, ttc: 0 }));

test('remise globale : appliquée à la base de chaque taux avant la TVA', () => {
  const t = totals([
    { designation: 'a', quantity: 1, unit: 'u', unitPriceCents: 10000, vatRate: 20 },
    { designation: 'b', quantity: 1, unit: 'u', unitPriceCents: 20000, vatRate: 10 },
  ], 10);
  assert.equal(t.gross, 30000); assert.equal(t.discount, 3000); assert.equal(t.ht, 27000);
  assert.deepEqual(t.vat.map((v) => [v.rate, v.base, v.amount]), [[20, 9000, 1800], [10, 18000, 1800]]);
  assert.equal(t.ttc, 30600);
  assert.equal(totals([{ designation: 'a', quantity: 1, unit: 'u', unitPriceCents: 5000, vatRate: 0 }], 150).ttc, 0); // remise plafonnée à 100 %
});

test('lignes éditables : aller-retour texte <-> nombres', async () => {
  const { toEditLine, fromEditLine, addDaysIso, fmtDate } = await import('../src/lib/quotes.ts');
  const l = { designation: 'Lavabo', quantity: 2.5, unit: 'h', unitPriceCents: 15050, vatRate: 20 };
  assert.deepEqual(toEditLine(l), { designation: 'Lavabo', qty: '2,5', unit: 'h', price: '150,50', vatRate: 20 });
  assert.deepEqual(fromEditLine(toEditLine(l)), l);
  assert.equal(addDaysIso('2026-12-15', 30), '2027-01-14'); assert.equal(fmtDate('2026-10-05'), '05/10/2026');
});
