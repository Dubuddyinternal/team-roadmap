'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/help', label: 'Help' },
  { href: '/dashboard', label: 'Dashboard' },
];

export default function SiteNav() {
  const path = usePathname();
  return (
    <div className="nav">
      <Link href="/" className="logo">
        <svg className="dblogo" viewBox="0 0 164 40">
          <use href="#dblogo" />
        </svg>
        <b>Maverick</b>
      </Link>
      <div className="links">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} style={path === l.href ? { color: 'var(--coral)' } : undefined}>
            {l.label}
          </Link>
        ))}
      </div>
      <div className="right">
        <Link href="/login" className="linkbtn">
          Log in
        </Link>
        <Link href="/login" className="btn sm">
          Start earning
        </Link>
      </div>
    </div>
  );
}
