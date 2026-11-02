import Link from 'next/link';
import { getEventBundle, getSponsors } from '@/lib/content';
import { eventDate, TBA } from '@/lib/format';
import { eventHref } from '@/lib/config';
import { Arrow } from '@/components/Brand';
import { NotifyButton } from '@/components/NewsletterPopup';
import { Sponsors } from '@/components/Sponsors';

export const revalidate = 60;

export default async function HomePage() {
  const [bundle, sponsors] = await Promise.all([getEventBundle(), getSponsors()]);
  const ev = bundle?.event;
  const anyOpen = bundle?.races.some((r) => r.status === 'open');
  const eventUrl = eventHref('/');

  return (
    <>
      {/* HERO */}
      <section className="wrap" style={{ paddingTop: 56 }}>
        <div className="grid g2" style={{ gap: 48, alignItems: 'center' }}>
          <div className="stack" style={{ gap: 24 }}>
            <span className="chip" style={{ alignSelf: 'flex-start' }}>Endurance events · Bareilly, Uttar Pradesh</span>
            <h1 className="d h-xl forest">Bareilly,<br />it’s time<br />to <span className="coral">run.</span></h1>
            <p className="lead" style={{ margin: 0, maxWidth: 520 }}>Bringing people together through running, movement and unforgettable sporting experiences — starting with our flagship event, Jhumka City Run.</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <a href={anyOpen ? eventHref('/register') : eventUrl} className="btn btn-primary">Register for Jhumka City Run</a>
              <a href={eventUrl} className="btn btn-outline">Explore Our Events</a>
            </div>
          </div>
          <div className="photo" style={{ height: 600 }}>
            <img src="/images/crowd.jpg" alt="Runners racing with motion blur" className="cover" />
            <div className="overlay-card stack" style={{ gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <span className="label-sm forest">Featured event</span>
                <span className="chip chip-coral">{anyOpen ? 'Registrations open' : 'Opening soon'}</span>
              </div>
              <div className="d" style={{ fontSize: 40, lineHeight: 0.95 }}>{ev?.name ?? 'Jhumka City Run'}</div>
              <div className="muted" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 14, fontWeight: 600 }}>
                <span>Date: {eventDate(ev?.event_date, { day: 'numeric', month: 'long', year: 'numeric' }) ?? TBA.toLowerCase()}</span>
                <span>Bareilly, UP</span>
                <span>5K · 10K · 21K · Kids Run</span>
              </div>
              <a href={eventUrl} className="btn btn-white" style={{ justifyContent: 'space-between', background: 'var(--chalk)', paddingRight: 6 }}>
                Choose your distance
                <span style={{ width: 40, height: 40, borderRadius: 99, background: 'var(--coral)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Arrow /></span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* EVENTS */}
      <section className="wrap section" id="events">
        <div className="row-between" style={{ marginBottom: 24 }}>
          <h2 className="d h-lg">Our events</h2>
        </div>
        <div className="grid g3">
          <article className="card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ height: 240, position: 'relative' }}>
              <img src="/images/hero.jpg" alt="Three runners racing along a city street" className="cover" loading="lazy" />
              <span className="chip" style={{ position: 'absolute', left: 16, top: 16, background: 'var(--coral)', color: 'var(--ink)' }}>Flagship · Running</span>
            </div>
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
              <h3 className="d" style={{ margin: 0, fontSize: 34, lineHeight: 0.95 }}>{ev?.name ?? 'Jhumka City Run'}</h3>
              <div className="muted" style={{ fontSize: 14, fontWeight: 600 }}>Date {ev?.event_date ? eventDate(ev.event_date, { day: 'numeric', month: 'short', year: 'numeric' }) : 'TBA'} · Bareilly · 5K / 10K / 21K / Kids Run</div>
              <a href={eventUrl} className="forest" style={{ marginTop: 'auto', fontWeight: 700, minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>View event →</a>
            </div>
          </article>
          <article style={{ background: 'var(--mint)', borderRadius: 24, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#D3E0CD' }}>
              <svg width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="#1E5B49" strokeWidth="1.4" aria-hidden="true"><circle cx="5.5" cy="17" r="3.5" /><circle cx="18.5" cy="17" r="3.5" /><path d="M5.5 17l4-8h6l3 8M9.5 9l3 8h-7M14 5h3" /></svg>
            </div>
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
              <h3 className="d" style={{ margin: 0, fontSize: 34, lineHeight: 0.95 }}>Cycling ride</h3>
              <div className="muted" style={{ fontSize: 14, fontWeight: 600 }}>Coming soon · Route and date to be announced</div>
              <NotifyButton className="forest" style={{ marginTop: 'auto', fontWeight: 700, minHeight: 44, border: 0, background: 'none', padding: 0, textAlign: 'left', cursor: 'pointer' }}>Notify me →</NotifyButton>
            </div>
          </article>
          <article style={{ background: 'var(--coral-tint)', borderRadius: 24, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7D2C6' }}>
              <svg width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="#1B1B1F" strokeWidth="1.4" aria-hidden="true"><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18" /></svg>
            </div>
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
              <h3 className="d" style={{ margin: 0, fontSize: 34, lineHeight: 0.95 }}>Corporate runs</h3>
              <div className="muted" style={{ fontSize: 14, fontWeight: 600 }}>On request · For teams, schools and colleges</div>
              <Link href="/partners" className="forest" style={{ marginTop: 'auto', fontWeight: 700, minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>Enquire →</Link>
            </div>
          </article>
        </div>
      </section>

      {/* WHY */}
      <section className="wrap section">
        <h2 className="d h-lg forest" style={{ marginBottom: 32 }}>Why run with Casa Atleta</h2>
        <div className="grid g3">
          {[
            ['Professionally managed', 'Safe routes, hydration, medical support and clear race-day information.', 'M12 3l7 4v5c0 4.5-3 8-7 9-4-1-7-4.5-7-9V7zM9 12l2 2 4-4'],
            ['Every pace welcome', 'From a Kids Run to a half marathon, there’s a start line for every age.', 'M9 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M17 6.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM14 20c0-2.5 1.5-4.5 3.5-4.5S21 17.5 21 20'],
            ['Built in Bareilly', 'A local community, with the presentation of international races.', 'M3 21h18M6 21V10l6-6 6 6v11M10 21v-5h4v5']
          ].map(([t, d, p]) => (
            <div key={t} style={{ borderTop: '3px solid var(--forest)', paddingTop: 22 }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#E85A3C" strokeWidth="2" aria-hidden="true"><path d={p} /></svg>
              <h3 style={{ fontSize: 22, fontWeight: 800, margin: '14px 0 0' }}>{t}</h3>
              <p className="muted" style={{ margin: '8px 0 0', lineHeight: 1.6 }}>{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* BAND */}
      <section className="section">
        <div style={{ position: 'relative', height: 520, overflow: 'hidden' }}>
          <img src="/images/band.jpg" alt="Crowd of marathon runners on a city street" className="cover" loading="lazy" />
          <div className="wrap" style={{ position: 'absolute', left: 0, right: 0, bottom: 40 }}>
            <div style={{ background: 'var(--chalk)', borderRadius: 24, padding: '28px 32px', maxWidth: 640 }}>
              <div className="d forest" style={{ fontSize: 'clamp(34px,4vw,56px)', lineHeight: 0.95 }}>One city. One community. <span className="coral">One starting line.</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* BEYOND */}
      <section className="wrap section">
        <h2 className="d h-lg" style={{ marginBottom: 28 }}>Beyond race day</h2>
        <div className="grid g3">
          <div style={{ background: 'var(--forest)', color: '#fff', borderRadius: 24, padding: 30, minHeight: 230, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div><h3 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Coaching</h3><p style={{ margin: '10px 0 0', lineHeight: 1.6, color: 'var(--on-forest-muted)' }}>Plans for beginners, 5K, 10K and half-marathon runners.</p></div>
            <Link href="/contact" style={{ color: 'var(--gold)', fontWeight: 700, minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>Enquire →</Link>
          </div>
          <div className="card" style={{ padding: 30, minHeight: 230, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div><h3 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Corporate fitness</h3><p className="muted" style={{ margin: '10px 0 0', lineHeight: 1.6 }}>Corporate runs, team challenges and employee wellness.</p></div>
            <Link href="/partners" className="forest" style={{ fontWeight: 700, minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>Enquire →</Link>
          </div>
          <div className="card" style={{ padding: 30, minHeight: 230, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div><h3 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Race trips</h3><p className="muted" style={{ margin: '10px 0 0', lineHeight: 1.6 }}>Run races across India and abroad, together as a group.</p></div>
            <span className="forest" style={{ fontWeight: 700 }}>Coming soon</span>
          </div>
        </div>
      </section>

      {/* NEWSLETTER + PARTNERS */}
      <section className="wrap section">
        <div style={{ background: 'var(--gold)', borderRadius: 28, padding: 'clamp(28px,4vw,56px)', display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ flex: '1 1 380px' }}>
            <h2 className="d h-md">Be first on the start line</h2>
            <p style={{ margin: '12px 0 0', lineHeight: 1.6 }}>Get race announcements and registration dates. No spam.</p>
          </div>
          <NotifyButton className="btn btn-primary">Notify me</NotifyButton>
        </div>
        <Sponsors sponsors={sponsors} />
      </section>
    </>
  );
}
