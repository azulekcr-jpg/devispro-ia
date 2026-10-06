// Utilitaires navigateur (téléchargement de fichiers, redimensionnement du logo).
export function downloadFile(data: Uint8Array | string, filename: string, mime: string) {
  const blob = new Blob([data as unknown as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export const safeFilename = (s: string) => s.replace(/[^\w.\-]+/g, '_');

export const MAX_LOGO_CHARS = 250_000;

// Réduit l'image (400 px max) et renvoie une data URL PNG/JPEG de moins de MAX_LOGO_CHARS caractères.
export async function resizeLogo(file: File): Promise<string> {
  if (!/^image\/(png|jpe?g)$/i.test(file.type)) throw new Error('Format non pris en charge : utilisez une image PNG ou JPEG.');
  if (file.size > 8_000_000) throw new Error('Image trop lourde (8 Mo maximum).');
  const src = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, ko) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => ko(new Error("Impossible de lire l'image."));
      i.src = src;
    });
    const png = /png/i.test(file.type);
    for (const max of [400, 300, 200, 120]) {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * s));
      c.height = Math.max(1, Math.round(img.height * s));
      const ctx = c.getContext('2d');
      if (!ctx) throw new Error('Traitement de l’image indisponible.');
      if (!png) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const url = png ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.85);
      if (url.length <= MAX_LOGO_CHARS) return url;
    }
    throw new Error('Logo trop complexe : choisissez une image plus simple.');
  } finally {
    URL.revokeObjectURL(src);
  }
}
