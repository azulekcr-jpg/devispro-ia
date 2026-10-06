import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'DevisPro AI',
    short_name: 'DevisPro',
    description: 'Devis professionnels pour artisans',
    start_url: '/devis',
    display: 'standalone',
    lang: 'fr',
    background_color: '#eceeec',
    theme_color: '#1f3f6b',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}
