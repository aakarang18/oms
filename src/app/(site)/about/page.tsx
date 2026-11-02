import type { Metadata } from 'next';
import Link from 'next/link';
import { eventHref } from '@/lib/config';

export const metadata: Metadata = { title: 'About us', description: 'Casa Atleta is a sports and endurance-events company from Bareilly — a home for every athlete.' };

export default function AboutPage() {
  return (
    <>
      <section className="wrap" style={{ paddingTop: 64 }}>
        <div className="grid g2" style={{ gap: 48, alignItems: 'center' }}>
          <div className="stack" style={{ gap: 22 }}>
            <span className="chip" style={{ alignSelf: 'flex-start' }}>About us</span>
            <h1 className="d h-xl forest">A home for<br />every <span className="coral">athlete.</span></h1>
            <p className="lead" style={{ margin: 0, maxWidth: 540 }}>“Casa” means home. Casa Atleta is a sports and endurance-events company from Bareilly, built to give everyone — first-timers, weekend joggers and serious racers — a place to start, belong and keep going.</p>
          </div>
          <div className="photo" style={{ height: 520 }}><img src="/images/friends.jpg" alt="Four friends embracing after finishing a race" className="cover" /></div>
        </div>
      </section>

      <section className="wrap section">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 48 }}>
          <h2 className="d h-lg" style={{ flex: '1 1 300px' }}>Our <span className="coral">story</span></h2>
          <div style={{ flex: '2 1 560px', fontSize: 18, lineHeight: 1.7 }} className="stack">
            {/* EDIT ME: replace this paragraph with the founder story. */}
            <p style={{ margin: 0 }}>Casa Atleta is a Bareilly-based company set up to bring professionally organised, welcoming endurance events to the city — and, over time, to the rest of Uttar Pradesh and India.</p>
            <p style={{ margin: '18px 0 0' }}>We believe a city run can do more than hand out medals. It can get a family moving together, give a student their first finish line, and bring a whole city out onto its streets. That’s why our first event is <b>Jhumka City Run</b> — and why it won’t be our last.</p>
          </div>
        </div>
      </section>

      <section className="wrap section">
        <h2 className="d h-lg forest" style={{ marginBottom: 28 }}>What we stand for</h2>
        <div className="grid g4">
          {[
            ['Open to everyone', 'Every age, every pace. From a Kids Run to a half marathon, there’s a start line for you.'],
            ['Run properly', 'Safe routes, timing, hydration and medical support — organised to international standards.'],
            ['Rooted in Bareilly', 'Local clubs, local businesses, local pride — the jhumka city, on the move.'],
            ['Keep going', 'One finish line leads to the next — running today, cycling and swimming tomorrow.']
          ].map(([t, d], i) => (
            <div key={t} style={{ background: i === 3 ? 'var(--forest)' : '#fff', color: i === 3 ? '#fff' : 'var(--ink)', borderRadius: 24, padding: 28 }}>
              <h3 style={{ fontSize: 21, fontWeight: 800, margin: 0 }}>{t}</h3>
              <p style={{ margin: '10px 0 0', lineHeight: 1.6, color: i === 3 ? 'var(--on-forest-muted)' : 'var(--muted)' }}>{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="wrap section">
        <div className="panel" style={{ padding: 'clamp(28px,4vw,56px)' }}>
          <h2 className="d h-lg forest" style={{ marginBottom: 28 }}>Where we’re heading</h2>
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            {[
              ['Now', 'Jhumka City Run', '5K · 10K · 21K · Kids Run in Bareilly'],
              ['Next', 'More sports', 'Cycling rides, swimming challenges and coaching programmes'],
              ['Then', 'Across Uttar Pradesh', 'Bringing city runs to more cities in UP'],
              ['Dream', 'India’s endurance home', 'A national community of runners, riders and swimmers']
            ].map(([k, t, d], i) => (
              <li key={k} style={{ background: i === 0 ? 'var(--forest)' : '#fff', color: i === 0 ? '#fff' : 'var(--ink)', borderRadius: 20, padding: 22 }}>
                <div className="label-sm" style={{ color: i === 0 ? 'var(--gold)' : undefined }}>{k}</div>
                <div style={{ fontSize: 20, fontWeight: 800, marginTop: 8 }}>{t}</div>
                <div style={{ marginTop: 6, lineHeight: 1.5, color: i === 0 ? 'var(--on-forest-muted)' : 'var(--muted)' }}>{d}</div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="wrap section">
        <div style={{ background: 'var(--forest)', color: '#fff', borderRadius: 28, padding: 'clamp(28px,5vw,64px)', display: 'flex', flexWrap: 'wrap', gap: 28, alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 className="d" style={{ margin: 0, fontSize: 'clamp(44px,6vw,88px)', lineHeight: 0.9 }}>Come run<br /><span style={{ color: 'var(--gold)' }}>with us.</span></h2>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <a href={eventHref('/')} className="btn btn-coral">See Jhumka City Run</a>
            <Link href="/partners" className="btn" style={{ border: '2px solid #fff', color: '#fff' }}>Partner with us</Link>
          </div>
        </div>
      </section>
    </>
  );
}
