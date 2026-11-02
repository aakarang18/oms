'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Logo } from './Brand';
import { eventHref, whatsappLink } from '@/lib/config';

const links = [
  { href: eventHref('/'), label: 'Jhumka City Run' },
  { href: '/partners', label: 'Partner with us' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' }
];

export function Header() {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const wa = whatsappLink();

  return (
    <>
      <header className="header">
        <div className="wrap header-inner">
          <Link href="/" aria-label="Casa Atleta home" style={{ display: 'flex' }}>
            <Logo width={120} label={false} />
          </Link>
          <nav className="nav" aria-label="Main">
            {links.map((l) => (
              <Link key={l.href} href={l.href} aria-current={path.startsWith(l.href) ? 'page' : undefined}>
                {l.label}
              </Link>
            ))}
          </nav>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <a href={eventHref('/register')} className="btn btn-primary btn-sm">Register</a>
            <button className="menu-btn" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1B1B1F" strokeWidth="2.4" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            </button>
          </div>
        </div>
      </header>
      {open && (
        <div className="mobile-menu" role="dialog" aria-modal="true" aria-label="Menu">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Logo width={100} light label={false} />
            <button className="menu-btn" style={{ display: 'inline-flex', background: '#fff' }} aria-label="Close menu" onClick={() => setOpen(false)} autoFocus>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1B1B1F" strokeWidth="2.6" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
          <nav aria-label="Main" style={{ marginTop: 32 }}>
            <Link href="/" className="big">Home</Link>
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="big">{l.label}</Link>
            ))}
          </nav>
          <a href={eventHref('/register')} className="btn btn-coral btn-block" style={{ marginTop: 28 }}>Register for Jhumka City Run</a>
          {wa && <a href={wa} style={{ display: 'block', marginTop: 20, color: '#DCE7E1' }}>WhatsApp us</a>}
        </div>
      )}
    </>
  );
}
