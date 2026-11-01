import Link from 'next/link';
import { Logo } from './Brand';
import { instagramLink, site } from '@/lib/config';

export function Footer() {
  const ig = instagramLink();
  return (
    <footer className="footer">
      <div className="wrap" style={{ paddingBottom: 32 }}>
        <div className="footer-grid">
          <div>
            <Logo width={140} />
            <p style={{ margin: '12px 0 0', maxWidth: 320, lineHeight: 1.55 }}>Running, cycling and endurance events. {site.city}.</p>
          </div>
          <div className="stack" style={{ gap: 10 }}>
            <div className="label-sm">Explore</div>
            <Link href="/about">About</Link>
            <Link href={`/events/${site.flagshipSlug}`}>Events</Link>
            <Link href={`/events/${site.flagshipSlug}#faqs`}>FAQs</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/partners">Partner with us</Link>
            {ig && <a href={ig} rel="noopener">Instagram</a>}
          </div>
          <div className="stack" style={{ gap: 10 }}>
            <div className="label-sm">Legal</div>
            <Link href="/legal/privacy">Privacy Policy</Link>
            <Link href="/legal/terms">Terms</Link>
            <Link href="/legal/waiver">Participant Waiver</Link>
            <Link href="/legal/refunds">Refund Policy</Link>
          </div>
          <div className="stack" style={{ gap: 10 }}>
            <div className="label-sm">Contact</div>
            {site.email && <a href={`mailto:${site.email}`}>{site.email}</a>}
            {site.whatsapp && <span>{site.whatsapp}</span>}
            <span>{site.city}</span>
          </div>
        </div>
        <div style={{ marginTop: 40, fontWeight: 800, fontSize: 'clamp(48px,10vw,150px)', lineHeight: 0.85, letterSpacing: '-.05em', color: 'var(--forest)', position: 'relative', isolation: 'isolate', display: 'inline-block' }} aria-hidden="true">
          casa atleta
          <span style={{ position: 'absolute', left: '-3%', right: '-3%', top: '52%', height: '.06em', background: 'var(--coral)', borderRadius: 99, zIndex: -1 }} />
        </div>
        <p style={{ marginTop: 24, fontSize: 12, lineHeight: 1.6 }} className="muted">
          © {new Date().getFullYear()} Casa Atleta. All rights reserved. · Photos from Unsplash (charlie dt, Pierre-Antoine Franck, Henry Ren, andrew dinh, Jeremy Stewart, Jakob Owens, runarchy id, Retrato Deportivo, McCarthy Beckan, Vitolda Klein). Stock photos — not from a Casa Atleta event.
        </p>
      </div>
    </footer>
  );
}
