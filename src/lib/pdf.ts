import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { addDaysIso, fmtDate, formatEur, formatPercent, lineHt, totals, TVA_FRANCHISE_MENTION } from './quotes';
import type { Quote } from './types';

const W = 595.28, H = 841.89, M = 42, FOOT = 48;
const BLUE = rgb(0.122, 0.247, 0.42), INK = rgb(0.09, 0.125, 0.17), MUT = rgb(0.36, 0.4, 0.45);
const RULE = rgb(0.83, 0.85, 0.87), YEL = rgb(0.949, 0.718, 0.02), TINT = rgb(0.945, 0.953, 0.965), WHITE = rgb(1, 1, 1);

function decodeLogo(url: string): { bytes: Uint8Array; png: boolean } | null {
  const m = /^data:image\/(png|jpe?g);base64,([A-Za-z0-9+/=]+)$/i.exec(url);
  if (!m) return null;
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, png: m[1].toLowerCase() === 'png' };
}

// PDF du devis : A4, polices standard (« € » et « œ » inclus), plusieurs pages si besoin.
export async function buildQuotePdf(q: Quote, logoDataUrl = ''): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Devis ${q.number}`.trim());
  pdf.setProducer('DevisPro AI');
  pdf.setCreator('DevisPro AI');
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const known = new Set(reg.getCharacterSet());
  const clean = (s: string) =>
    Array.from((s ?? '').replace(/[\u202f\u00a0]/g, ' ').replace(/\r/g, '').replace(/\t/g, ' '))
      .map((ch) => (ch === '\n' || known.has(ch.codePointAt(0)!) ? ch : '?'))
      .join('');
  const eur = (c: number) => clean(formatEur(c));
  const fr = (n: number) => formatPercent(n);

  const wrap = (text: string, font: PDFFont, size: number, maxW: number): string[] => {
    const out: string[] = [];
    for (const para of clean(text).split('\n')) {
      let line = '';
      for (const word of para.split(' ').filter(Boolean)) {
        const t = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(t, size) <= maxW) line = t;
        else { if (line) out.push(line); line = word; }
      }
      out.push(line);
    }
    return out;
  };

  let page!: PDFPage;
  let y = 0; // distance depuis le haut de la page
  const newPage = () => {
    page = pdf.addPage([W, H]);
    page.drawRectangle({ x: 0, y: H - 6, width: W, height: 6, color: YEL });
    y = M;
  };
  const text = (s: string, x: number, size: number, font = reg, color = INK, right = false) => {
    const t = clean(s);
    const w = font.widthOfTextAtSize(t, size);
    page.drawText(t, { x: right ? x - w : x, y: H - y - size, size, font, color });
  };
  const room = (h: number) => y + h <= H - FOOT;

  newPage();
  y = M + 6;
  const top = y;

  // ----- En-tête : logo et entreprise (gauche), titre du devis (droite)
  const co = q.company;
  if (logoDataUrl) {
    const logo = decodeLogo(logoDataUrl);
    if (logo) {
      try {
        const img = logo.png ? await pdf.embedPng(logo.bytes) : await pdf.embedJpg(logo.bytes);
        const s = Math.min(150 / img.width, 56 / img.height, 1);
        const w = img.width * s, h = img.height * s;
        page.drawImage(img, { x: M, y: H - y - h, width: w, height: h });
        y += h + 8;
      } catch { /* logo illisible : ignoré */ }
    }
  }
  text(co.name || 'Entreprise', M, 15, bold, BLUE);
  y += 21;
  const info: string[] = [];
  if (co.legalForm) info.push(co.legalForm);
  if (co.address) info.push(...wrap(co.address, reg, 8.5, 260));
  const contact = [co.phone && `Tél. ${co.phone}`, co.email].filter(Boolean).join('  -  ');
  if (contact) info.push(contact);
  const ids = [co.siret && `SIRET ${co.siret}`, co.vatNumber && `TVA ${co.vatNumber}`].filter(Boolean).join('  -  ');
  if (ids) info.push(ids);
  if (co.rcs) info.push(...wrap(co.rcs, reg, 8.5, 260));
  if (co.insurance) info.push(...wrap(`Assurance : ${co.insurance}`, reg, 8.5, 260));
  for (const l of info) { text(l, M, 8.5, reg, MUT); y += 11.5; }
  const leftEnd = y;

  y = top;
  text('DEVIS', W - M, 26, bold, BLUE, true);
  y += 34;
  const meta = [q.number ? `N° ${q.number}` : 'Brouillon (non numéroté)', `Date : ${fmtDate(q.issuedOn)}`, `Valable jusqu'au ${fmtDate(addDaysIso(q.issuedOn, q.validDays))}`];
  for (const l of meta) { text(l, W - M, 9.5, reg, INK, true); y += 13; }
  y = Math.max(leftEnd, y) + 16;

  // ----- Client
  const cl = q.client;
  const clLines: string[] = [];
  if (cl.address) clLines.push(...wrap(cl.address, reg, 9, 240));
  const clContact = [cl.phone && `Tél. ${cl.phone}`, cl.email].filter(Boolean).join('  -  ');
  if (clContact) clLines.push(...wrap(clContact, reg, 9, 240));
  const boxH = 16 + 15 + clLines.length * 11.5 + 8;
  page.drawRectangle({ x: M, y: H - y - boxH, width: 260, height: boxH, color: TINT });
  page.drawRectangle({ x: M, y: H - y - boxH, width: 3, height: boxH, color: BLUE });
  y += 8; text('Client', M + 12, 8, reg, MUT); y += 12;
  text(cl.name || '-', M + 12, 11, bold); y += 15;
  for (const l of clLines) { text(l, M + 12, 9, reg, INK); y += 11.5; }
  y += 18;
  if (q.subject.trim()) {
    for (const l of wrap(`Objet : ${q.subject.trim()}`, bold, 10, W - 2 * M)) { text(l, M, 10, bold); y += 14; }
    y += 6;
  }

  // ----- Tableau des lignes
  const X = { desc: M + 8, qty: 335, pu: 410, tva: 462, tot: W - M - 8 };
  const header = () => {
    page.drawRectangle({ x: M, y: H - y - 20, width: W - 2 * M, height: 20, color: BLUE });
    y += 6;
    text('Désignation', X.desc, 8.5, bold, WHITE);
    text('Qté', X.qty, 8.5, bold, WHITE, true);
    text('P.U. HT', X.pu, 8.5, bold, WHITE, true);
    text('TVA', X.tva, 8.5, bold, WHITE, true);
    text('Total HT', X.tot, 8.5, bold, WHITE, true);
    y += 20;
  };
  header();
  for (const l of q.lines) {
    const lines = wrap(l.designation || '-', reg, 9.5, 235);
    const rowH = lines.length * 12 + 10;
    if (!room(rowH + 4)) { newPage(); header(); }
    y += 5;
    const rowTop = y;
    lines.forEach((t, i) => { y = rowTop + i * 12; text(t, X.desc, 9.5); });
    y = rowTop;
    text(`${fr(l.quantity)} ${l.unit}`, X.qty, 9.5, reg, INK, true);
    text(eur(l.unitPriceCents), X.pu, 9.5, reg, INK, true);
    text(`${fr(l.vatRate)} %`, X.tva, 9.5, reg, INK, true);
    text(eur(lineHt(l)), X.tot, 9.5, bold, INK, true);
    y = rowTop + lines.length * 12 + 5;
    page.drawLine({ start: { x: M, y: H - y }, end: { x: W - M, y: H - y }, thickness: 0.5, color: RULE });
  }

  // ----- Totaux
  const t = totals(q.lines, q.discountPercent);
  const onlyZero = t.vat.every((v) => v.rate === 0);
  const rows: [string, string][] = [];
  if (t.discount > 0) {
    rows.push(['Total HT avant remise', eur(t.gross)]);
    rows.push([`Remise (${fr(q.discountPercent)} %)`, `- ${eur(t.discount)}`]);
  }
  rows.push(['Total HT', eur(t.ht)]);
  if (!onlyZero) t.vat.forEach((v) => rows.push([`TVA ${fr(v.rate)} % (base ${eur(v.base)})`, eur(v.amount)]));
  const totH = rows.length * 15 + 34;
  if (!room(totH + 10)) newPage();
  y += 14;
  const bx = W - M - 250;
  for (const [a, b] of rows) { text(a, bx, 9.5, reg, MUT); text(b, W - M - 8, 9.5, reg, INK, true); y += 15; }
  y += 4;
  page.drawRectangle({ x: bx - 8, y: H - y - 26, width: 258, height: 26, color: TINT });
  page.drawRectangle({ x: bx - 8, y: H - y - 26, width: 258, height: 2, color: YEL });
  y += 7;
  text('Total TTC', bx, 12, bold, BLUE);
  text(eur(t.ttc), W - M - 8, 12, bold, BLUE, true);
  y += 30;

  // ----- Conditions et mentions
  const notes: string[] = [];
  if (q.note.trim()) notes.push(q.note.trim());
  if (co.vatExempt) notes.push(TVA_FRANCHISE_MENTION);
  if (notes.length) {
    const ls = wrap(notes.join('\n'), reg, 8.5, W - 2 * M);
    if (!room(ls.length * 11.5 + 24)) newPage();
    text('Conditions', M, 9, bold, BLUE); y += 14;
    for (const l of ls) {
      if (!room(12)) newPage();
      text(l, M, 8.5, reg, MUT); y += 11.5;
    }
    y += 10;
  }

  // ----- Signature
  const sigH = 78;
  if (!room(sigH + 6)) newPage();
  const half = (W - 2 * M - 14) / 2;
  [['Date et lieu', M], ['Signature du client, précédée de « Bon pour accord »', M + half + 14]].forEach(([label, x]) => {
    page.drawRectangle({ x: x as number, y: H - y - sigH, width: half, height: sigH, borderColor: RULE, borderWidth: 0.8 });
    const save = y; y += 7; text(label as string, (x as number) + 8, 8, reg, MUT); y = save;
  });

  // ----- Pied de page sur chaque page
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    page = p;
    y = H - FOOT + 16;
    p.drawLine({ start: { x: M, y: FOOT - 8 }, end: { x: W - M, y: FOOT - 8 }, thickness: 0.5, color: RULE });
    const foot = clean([co.name, co.siret && `SIRET ${co.siret}`, q.number && `Devis ${q.number}`, `Page ${i + 1}/${pages.length}`].filter(Boolean).join('  -  '));
    const w = reg.widthOfTextAtSize(foot, 7.5);
    p.drawText(foot, { x: (W - w) / 2, y: FOOT - 20, size: 7.5, font: reg, color: MUT });
  });
  return pdf.save();
}
