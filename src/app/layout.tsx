import './globals.css';
import type { ReactNode } from 'react';

export const metadata = { title: 'DevisPro AI', description: 'Devis professionnels pour artisans' };
export const viewport = { themeColor: '#1f3f6b', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@700&family=Public+Sans:wght@400;600&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
