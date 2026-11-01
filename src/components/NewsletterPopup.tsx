'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

const KEY = 'ca_newsletter_dismissed';
export const OPEN_EVENT = 'open-newsletter';

function dismissed() {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}
function remember() {
  try { localStorage.setItem(KEY, '1'); } catch { /* storage blocked — fine */ }
}

/** Shows once, ~12s after arrival (never on registration or admin pages), or when "get notified" is clicked. */
export function NewsletterPopup() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState('');
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, show);
    let t: ReturnType<typeof setTimeout> | undefined;
    if (!path.startsWith('/register') && !path.startsWith('/admin') && !dismissed()) {
      t = setTimeout(show, 12000);
    }
    return () => { window.removeEventListener(OPEN_EVENT, show); if (t) clearTimeout(t); };
  }, [path]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  function close() { setOpen(false); remember(); }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setState('sending'); setError('');
    const res = await fetch('/api/newsletter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: f.get('email'), consent: f.get('consent') === 'on', source: 'popup' })
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) { setState('done'); remember(); }
    else { setState('idle'); setError(json.fields?.email || json.fields?.consent || json.error || 'Something went wrong.'); }
  }

  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="nl-title" onClick={(e) => e.target === e.currentTarget && close()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(27,27,31,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 70 }}>
      <div className="card" style={{ overflow: 'hidden', width: '100%', maxWidth: 520 }}>
        <div style={{ position: 'relative', height: 170 }}>
          <img src="/images/band.jpg" alt="" className="cover" />
          <button ref={closeRef} onClick={close} aria-label="Close" className="menu-btn" style={{ display: 'inline-flex', position: 'absolute', right: 14, top: 14, background: '#fff' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1B1B1F" strokeWidth="2.6" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
          <span className="chip" style={{ position: 'absolute', left: 16, bottom: 16, background: 'var(--coral)', color: 'var(--ink)' }}>Jhumka City Run</span>
        </div>
        <div style={{ padding: 28 }}>
          {state === 'done' ? (
            <>
              <h2 id="nl-title" className="d forest" style={{ margin: 0, fontSize: 40, lineHeight: 0.95 }}>You’re on the list!</h2>
              <p className="muted" style={{ margin: '10px 0 18px', lineHeight: 1.55 }}>We’ll email you as soon as the race date and registrations are announced.</p>
              <button className="btn btn-coral" onClick={() => setOpen(false)}>Back to the site</button>
            </>
          ) : (
            <form onSubmit={submit} noValidate>
              <h2 id="nl-title" className="d forest" style={{ margin: 0, fontSize: 40, lineHeight: 0.95 }}>Be first on the start line</h2>
              <p className="muted" style={{ margin: '10px 0 18px', lineHeight: 1.55 }}>Get the race date, registration opening and early-bird news from Casa Atleta.</p>
              <div className="field">
                <label htmlFor="nl-email">Email address</label>
                <input id="nl-email" name="email" type="email" required autoComplete="email" className="input" placeholder="you@example.com" />
              </div>
              <label className="check" style={{ marginTop: 12, background: 'transparent', padding: 0 }}>
                <input type="checkbox" name="consent" required />
                <span className="muted" style={{ fontSize: 13 }}>I agree to receive emails from Casa Atleta. Unsubscribe anytime. <Link href="/legal/privacy">Privacy Policy</Link></span>
              </label>
              {error && <p className="err" role="alert">{error}</p>}
              <button className="btn btn-primary btn-block" style={{ marginTop: 14 }} disabled={state === 'sending'}>{state === 'sending' ? 'Signing you up…' : 'Notify me'}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export function NotifyButton({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <button className={className} style={style} onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}>{children}</button>
  );
}
