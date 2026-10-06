'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/devis', label: 'Mes devis', match: (p: string) => p === '/devis' || (p.startsWith('/devis/') && p !== '/devis/nouveau') },
  { href: '/devis/nouveau', label: 'Nouveau devis', match: (p: string) => p === '/devis/nouveau', nw: true },
  { href: '/clients', label: 'Mes clients', match: (p: string) => p.startsWith('/clients') },
  { href: '/entreprise', label: 'Mon entreprise', match: (p: string) => p.startsWith('/entreprise') },
];

export default function Nav() {
  const path = usePathname() ?? '';
  return (
    <div className="bar noprint">
      <span>DevisPro AI</span>
      <nav aria-label="Navigation principale">
        {ITEMS.map((i) => (
          <Link key={i.href} href={i.href} className={i.match(path) ? 'on' : ''} data-go={i.nw ? 'new' : undefined} aria-current={i.match(path) ? 'page' : undefined}>
            {i.label}
          </Link>
        ))}
      </nav>
      <form className="so" action="/auth/signout" method="post">
        <button className="btn">Se déconnecter</button>
      </form>
    </div>
  );
}
