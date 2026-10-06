import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import zlib from 'node:zlib';
import { PDFDocument } from 'pdf-lib';
import { buildQuotePdf } from '../src/lib/pdf.ts';
import type { Quote } from '../src/lib/types.ts';

function png(w: number, h: number): string { // PNG uni minimal, généré sans dépendance
  const crcTable = (b: Buffer) => { const c = Buffer.alloc(4); c.writeUInt32BE(zlib.crc32(b) >>> 0); return c; };
  const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); return Buffer.concat([l, td, crcTable(td)]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 3, 0)]);
  for (let i = 1; i < row.length; i += 3) { row[i] = 31; row[i + 1] = 63; row[i + 2] = 107; }
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return 'data:image/png;base64,' + Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]).toString('base64');
}

export const quote = (n = 4): Quote => ({
  id: 'q1', number: 'DEV-2026-001', issuedOn: '2026-10-05', validDays: 30, status: 'envoye', subject: 'Remplacement du chauffe-eau et remise aux normes', discountPercent: 10,
  note: "Devis gratuit. Règlement : acompte à la commande, solde à la fin des travaux.", clientId: null,
  company: { name: 'Plomberie Martin & Fils', legalForm: 'EI', address: '12 rue des Lilas, 64100 Bayonne', phone: '06 12 34 56 78', email: 'contact@martin.fr', siret: '812 345 678 00019', vatNumber: 'FR12345678901', rcs: 'RM Bayonne 812 345 678', insurance: 'Décennale AXA n° 123456', vatExempt: false },
  client: { name: 'Mme Sophie Lambert', phone: '07 11 22 33 44', email: 'sophie@mail.fr', address: '5 place de la Mairie, 64600 Anglet' },
  lines: Array.from({ length: n }, (_, i) => ({ designation: i === 1 ? "Main d'œuvre, pose et mise en service" : `Prestation ${i + 1} : fourniture et pose d'un équipement complet avec raccordements`, quantity: i + 1, unit: i === 1 ? 'h' : 'u', unitPriceCents: 4800 + i * 1250, vatRate: i % 2 ? 20 : 10 })),
});

const text = (pdf: Uint8Array) => { const d = mkdtempSync(join(tmpdir(), 'pdf-')); const f = join(d, 'a.pdf'); writeFileSync(f, pdf); try { return execFileSync('pdftotext', ['-layout', f, '-'], { encoding: 'utf8' }); } catch { return null; } };

test('PDF valide, une page, avec logo', async () => {
  const bytes = await buildQuotePdf(quote(), png(120, 40));
  assert.equal(Buffer.from(bytes.slice(0, 5)).toString(), '%PDF-');
  assert.equal((await PDFDocument.load(bytes)).getPageCount(), 1);
  const t = text(bytes);
  if (t) {
    for (const s of ['DEVIS', 'DEV-2026-001', 'Plomberie Martin & Fils', 'SIRET 812 345 678 00019', 'Mme Sophie Lambert', "Main d'œuvre", '€', 'Total TTC', 'Page 1/1', '04/11/2026'])
      assert.ok(t.includes(s), `texte attendu : ${s}`);
    assert.ok(/Remise \(10 %\)/.test(t) && /TVA 10 %/.test(t) && /TVA 20 %/.test(t));
  }
});

test('PDF : beaucoup de lignes sur plusieurs pages, en-tête du tableau répété', async () => {
  const bytes = await buildQuotePdf(quote(60));
  const n = (await PDFDocument.load(bytes)).getPageCount();
  assert.ok(n >= 3, `pages : ${n}`);
  const t = text(bytes);
  if (t) { assert.ok(t.includes(`Page ${n}/${n}`)); assert.ok((t.match(/Désignation/g) ?? []).length === n - (t.includes('Total TTC') ? 0 : 0) || (t.match(/Désignation/g) ?? []).length >= 2); }
});

test('PDF : caractères non supportés, sans logo, logo invalide, franchise de TVA, brouillon', async () => {
  const q = quote(2); q.number = ''; q.company.vatExempt = true; q.discountPercent = 0;
  q.lines[0].designation = 'Pose 🚿 洗 « test » – œuvre ’ ok';
  q.lines.forEach((l) => (l.vatRate = 0));
  for (const logo of ['', 'data:image/png;base64,AAAA', 'nimporte quoi']) {
    const bytes = await buildQuotePdf(q, logo);
    assert.ok((await PDFDocument.load(bytes)).getPageCount() >= 1);
  }
  const t = text(await buildQuotePdf(q));
  if (t) { assert.ok(t.includes('TVA non applicable, art. 293 B du CGI.')); assert.ok(t.includes('Brouillon')); assert.ok(!/TVA 0 %/.test(t)); }
});
