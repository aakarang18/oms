'use client';

import { useEffect, useState } from 'react';
import { JhumkaMark } from './Brand';

const SECTIONS = [['distances', 'Distances'], ['schedule', 'Schedule'], ['route', 'Route'], ['raceday', 'Race day'], ['faqs', 'FAQs']];

export function EventHeader({ name, home, registerHref }: { name: string; home: string; registerHref: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <header className="header">
        <div className="wrap header-inner">
          <a href={home} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }} aria-label={`${name} home`}>
            <JhumkaMark size={34} />
            <span className="d forest" style={{ fontSize: 24, lineHeight: 1 }}>{name}</span>
          </a>
          <nav className="nav" aria-label="Event">
            {SECTIONS.map(([id, label]) => <a key={id} href={`${home}#${id}`}>{label}</a>)}
          </nav>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <a href={registerHref} className="btn btn-coral btn-sm">Register</a>
            <button className="menu-btn" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1B1B1F" strokeWidth="2.4" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            </button>
          </div>
        </div>
      </header>
      {open && (
        <div className="mobile-menu" role="dialog" aria-modal="true" aria-label="Menu">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="d" style={{ fontSize: 24 }}>{name}</span>
            <button className="menu-btn" style={{ display: 'inline-flex', background: '#fff' }} aria-label="Close menu" onClick={() => setOpen(false)} autoFocus>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1B1B1F" strokeWidth="2.6" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
          <nav aria-label="Event" style={{ marginTop: 32 }}>
            {SECTIONS.map(([id, label]) => <a key={id} href={`${home}#${id}`} className="big" onClick={() => setOpen(false)}>{label}</a>)}
          </nav>
          <a href={registerHref} className="btn btn-coral btn-block" style={{ marginTop: 28 }}>Register now</a>
        </div>
      )}
    </>
  );
}
