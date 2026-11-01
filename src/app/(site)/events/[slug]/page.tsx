import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getEventBundle, getPlacesLeft, getSponsors } from '@/lib/content';
import { eventDate, inr, TBA } from '@/lib/format';
import { site } from '@/lib/config';
import { JhumkaMark } from '@/components/Brand';
import { Countdown } from '@/components/Countdown';
import { RaceCards, raceStatusLabel } from '@/components/RaceCards';
import { Faqs } from '@/components/Faqs';
import { Sponsors } from '@/components/Sponsors';

export const revalidate = 60;

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const b = await getEventBundle(params.slug);
  if (!b) return {};
  const date = eventDate(b.event.event_date, { day: 'numeric', month: 'long', year: 'numeric' });
  return {
    title: `${b.event.name} — 5K, 10K, 21K Half Marathon & Kids Run in Bareilly`,
    description: `${b.event.tagline ?? ''} Register for ${b.event.name} in Bareilly${date ? ` on ${date}` : ''}: 5K, 10K, 21K half marathon and Kids Run.`,
    alternates: { canonical: `/events/${b.event.slug}` }
  };
}

function Info({ title, value, icon }: { title: string; value: string | null; icon: string }) {
  return (
    <div className="card" style={{ padding: 24 }}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#E85A3C" strokeWidth="2" aria-hidden="true"><path d={icon} /></svg>
      <h3 style={{ fontWeight: 800, fontSize: 18, margin: '12px 0 0' }}>{title}</h3>
      <p className={value ? '' : 'muted'} style={{ margin: '6px 0 0', lineHeight: 1.55, whiteSpace: 'pre-line', fontWeight: value ? 500 : 700 }}>{value ?? TBA}</p>
    </div>
  );
}

export default async function EventPage({ params }: { params: { slug: string } }) {
  const bundle = await getEventBundle(params.slug);
  if (!bundle) notFound();
  const { event: ev, races, faqs, announcements } = bundle;
  const [sponsors, placesLeft] = await Promise.all([getSponsors(), bundle.live ? getPlacesLeft(races.map((r) => r.id)) : Promise.resolve({})]);
  const date = eventDate(ev.event_date);
  const anyOpen = races.some((r) => r.status === 'open');
  const countdownTarget = ev.event_date ? `${ev.event_date}T06:00:00+05:30` : null;

  // Structured data for Google — only once the date is confirmed.
  const jsonLd = ev.event_date
    ? {
        '@context': 'https://schema.org',
        '@type': 'SportsEvent',
        name: ev.name,
        description: ev.description,
        startDate: ev.event_date,
        eventStatus: 'https://schema.org/EventScheduled',
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        location: { '@type': 'Place', name: ev.start_point ?? ev.venue ?? 'Bareilly', address: { '@type': 'PostalAddress', addressLocality: 'Bareilly', addressRegion: 'Uttar Pradesh', addressCountry: 'IN' } },
        organizer: { '@type': 'Organization', name: 'Casa Atleta', url: site.url },
        image: [`${site.url}/images/band.jpg`],
        offers: races.filter((r) => r.fee_paise !== null).map((r) => ({
          '@type': 'Offer', name: r.name, price: (r.fee_paise! / 100).toFixed(0), priceCurrency: 'INR',
          availability: r.status === 'open' ? 'https://schema.org/InStock' : 'https://schema.org/PreOrder', url: `${site.url}/register?race=${r.code}`
        }))
      }
    : null;

  return (
    <>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />}

      {/* HERO */}
      <section className="wrap" style={{ paddingTop: 24 }}>
        <nav aria-label="Breadcrumb" className="muted" style={{ fontSize: 14, fontWeight: 600 }}><Link href="/">Home</Link> / {ev.name}</nav>
        <div className="photo" style={{ marginTop: 16, height: 640 }}>
          <img src="/images/band.jpg" alt="Crowd of runners on a city street (stock photo)" className="cover" />
          {announcements[0] && (
            <div className="card hide-m" style={{ position: 'absolute', right: 24, top: 24, width: 300, borderRadius: 20, padding: '18px 20px' }}>
              <div className="label-sm forest">Latest update</div>
              <div style={{ fontWeight: 800, marginTop: 10 }}>{announcements[0].title}</div>
              {announcements[0].body && <div className="muted" style={{ fontSize: 14, marginTop: 4, lineHeight: 1.45 }}>{announcements[0].body}</div>}
            </div>
          )}
          <div className="overlay-card" style={{ maxWidth: 720, display: 'flex', gap: 24, alignItems: 'center', padding: 'clamp(20px,3vw,34px)' }}>
            <span className="hide-m"><JhumkaMark size={86} /></span>
            <div className="stack" style={{ gap: 8 }}>
              <h1 className="d forest" style={{ margin: 0, fontSize: 'clamp(40px,6vw,84px)', lineHeight: 0.9 }}>{ev.name}</h1>
              {ev.tagline && <p style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{ev.tagline}</p>}
              {ev.description && <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>{ev.description}</p>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
                <Countdown target={countdownTarget} />
                {anyOpen && <Link href="/register" className="btn btn-coral" style={{ borderRadius: 12 }}>Enter now →</Link>}
              </div>
            </div>
          </div>
        </div>
        <div className="grid g4" style={{ marginTop: 14, gap: 12 }}>
          {[['Date', date ?? TBA], ['Start / finish', ev.start_point ?? `${TBA}, Bareilly`], ['Organiser', 'Casa Atleta']].map(([k, v]) => (
            <div key={k} className="card" style={{ borderRadius: 18, padding: 20 }}><div className="label-sm">{k}</div><div style={{ fontSize: 19, fontWeight: 800, marginTop: 6 }}>{v}</div></div>
          ))}
          <div style={{ background: 'var(--forest)', color: '#fff', borderRadius: 18, padding: 20 }}>
            <div className="label-sm" style={{ color: '#fff' }}>Registration</div>
            <div style={{ fontSize: 19, fontWeight: 800, marginTop: 6 }}>{anyOpen ? 'Open now' : 'Opening soon'}</div>
          </div>
        </div>
      </section>

      {/* SUB NAV */}
      <nav aria-label="On this page" style={{ position: 'sticky', top: 68, zIndex: 20, marginTop: 40, background: 'rgba(244,246,240,.95)', backdropFilter: 'blur(10px)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        <div className="wrap" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '10px 24px' }}>
          <div style={{ display: 'flex', gap: 4, overflowX: 'auto', fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap' }}>
            {[['distances', 'Distances'], ['schedule', 'Schedule'], ['route', 'Route'], ['raceday', 'Race day'], ['kit', 'Kit & awards'], ['faqs', 'FAQs']].map(([id, l]) => (
              <a key={id} href={`#${id}`} style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 999 }}>{l}</a>
            ))}
          </div>
          {anyOpen && <Link href="/register" className="btn btn-coral btn-sm hide-m">Register now</Link>}
        </div>
      </nav>

      {/* DISTANCES */}
      <section id="distances" className="wrap" style={{ paddingTop: 96, scrollMarginTop: 140 }}>
        <div className="row-between" style={{ marginBottom: 28 }}>
          <h2 className="d h-lg">Choose your <span className="coral">distance</span></h2>
          <p className="muted" style={{ margin: 0, maxWidth: 400, lineHeight: 1.6 }}>Four races, one start line. Details marked “TBA” appear here as soon as they are confirmed.</p>
        </div>
        <RaceCards races={races} placesLeft={placesLeft} />
        <div className="table-wrap" style={{ marginTop: 24 }}>
          <table className="table">
            <caption className="sr-only">Compare distances</caption>
            <thead><tr><th scope="col">Distance</th><th scope="col">Best for</th><th scope="col">Flag-off</th><th scope="col">Cut-off</th><th scope="col">Entry fee</th><th scope="col">Status</th></tr></thead>
            <tbody>
              {races.map((r) => (
                <tr key={r.id}>
                  <td><b>{r.name}</b>{r.distance_label && <div className="muted" style={{ fontSize: 13 }}>{r.distance_label}</div>}</td>
                  <td>{r.audience}{(r.min_age || r.max_age) && <div className="muted" style={{ fontSize: 13 }}>Ages {r.min_age ?? ''}{r.max_age ? `–${r.max_age}` : '+'}</div>}</td>
                  <td>{r.flag_off ?? 'TBA'}</td>
                  <td>{r.cut_off ?? 'TBA'}</td>
                  <td>{inr(r.fee_paise) ?? 'TBA'}</td>
                  <td><span className="chip">{raceStatusLabel(r, (placesLeft as Record<string, number | null>)[r.id])}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* SCHEDULE */}
      <section id="schedule" className="wrap section" style={{ scrollMarginTop: 140 }}>
        <h2 className="d h-lg forest" style={{ marginBottom: 28 }}>Event schedule</h2>
        <ol className="card" style={{ listStyle: 'none', margin: 0, padding: 'clamp(16px,3vw,32px)' }}>
          <li style={{ display: 'flex', gap: 20, padding: '16px 0', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}><b className="coral" style={{ width: 200 }}>Before race day</b><div><b>Bib &amp; race-kit collection</b><div className="muted" style={{ whiteSpace: 'pre-line' }}>{ev.bib_collection ?? TBA}</div></div></li>
          <li style={{ display: 'flex', gap: 20, padding: '16px 0', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}><b className="coral" style={{ width: 200 }}>{ev.reporting_time ?? 'Race morning · TBA'}</b><div><b>Reporting time</b><div className="muted">Arrive at the start area, warm up and drop your bags</div></div></li>
          {races.map((r) => (
            <li key={r.id} style={{ display: 'flex', gap: 20, padding: '16px 0', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}><b className="coral" style={{ width: 200 }}>{r.flag_off ?? 'TBA'}</b><div><b>Flag-off · {r.name}</b>{r.is_kids && <div className="muted">Parents/guardians stay near the kids’ start and finish area</div>}</div></li>
          ))}
          <li style={{ display: 'flex', gap: 20, padding: '16px 0', flexWrap: 'wrap' }}><b className="coral" style={{ width: 200 }}>TBA</b><div><b>Awards ceremony</b><div className="muted" style={{ whiteSpace: 'pre-line' }}>{ev.awards ?? 'Categories and prizes to be announced'}</div></div></li>
        </ol>
      </section>

      {/* ROUTE */}
      <section id="route" className="wrap section" style={{ scrollMarginTop: 140 }}>
        <h2 className="d h-lg" style={{ marginBottom: 28 }}>Course &amp; <span className="coral">route</span></h2>
        <div className="grid g4">
          {races.map((r) => (
            <div key={r.id} style={{ background: r.is_kids ? '#FDF1CC' : 'var(--mint)', borderRadius: 24, padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {r.route_map_url ? (
                <a href={r.route_map_url} target="_blank" rel="noopener" style={{ height: 200, borderRadius: 16, overflow: 'hidden', display: 'block' }}><img src={r.route_map_url} alt={`${r.name} route map`} className="cover" loading="lazy" /></a>
              ) : (
                <div style={{ height: 200, borderRadius: 16, border: '2px dashed #9DB09A', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontWeight: 600, padding: 16 }} className="muted">{r.name} route map<br />published once confirmed</div>
              )}
              <h3 style={{ fontWeight: 800, fontSize: 18, margin: 0 }}>{r.name} course</h3>
              <div className="muted" style={{ fontSize: 14, lineHeight: 1.5 }}>Start / finish: {r.start_finish ?? 'TBA'} · Elevation: {r.elevation ?? 'TBA'}</div>
            </div>
          ))}
        </div>
      </section>

      {/* RACE DAY */}
      <section id="raceday" className="wrap section" style={{ scrollMarginTop: 140 }}>
        <h2 className="d h-lg forest" style={{ marginBottom: 28 }}>Race-day information</h2>
        <div className="grid g3">
          <Info title="Bib collection & ID" value={ev.bib_collection} icon="M4 4h16v16H4zM8 9h8M8 13h5" />
          <Info title="Hydration stations" value={ev.hydration} icon="M12 3c3 4 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-7 6-11z" />
          <Info title="Medical & emergency" value={ev.medical} icon="M12 5v14M5 12h14M3 3h18v18H3z" />
          <Info title="Participant guidelines" value={ev.guidelines} icon="M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9" />
          <Info title="Parking & transport" value={ev.parking} icon="M3 8h18v10H3zM7 18v2M17 18v2M3 13h18" />
          <Info title="Baggage" value={ev.baggage} icon="M5 7h14v13H5zM9 7V5h6v2" />
        </div>
      </section>

      {/* KIT */}
      <section id="kit" className="wrap section" style={{ scrollMarginTop: 140 }}>
        <div className="card" style={{ padding: 'clamp(24px,4vw,56px)', display: 'flex', flexWrap: 'wrap', gap: 40, alignItems: 'center' }}>
          <div style={{ flex: '1 1 420px' }}>
            <h2 className="d h-lg" style={{ marginBottom: 20 }}>Race kit &amp; <span className="coral">awards</span></h2>
            <div className="stack" style={{ gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '14px 0', borderBottom: '1px solid var(--line)' }}><b>Race kit</b><span className="muted" style={{ textAlign: 'right', whiteSpace: 'pre-line' }}>{ev.race_kit ?? 'TBA'}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '14px 0' }}><b>Awards &amp; age categories</b><span className="muted" style={{ textAlign: 'right', whiteSpace: 'pre-line' }}>{ev.awards ?? 'TBA'}</span></div>
            </div>
          </div>
          <div style={{ flex: '0 1 240px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <JhumkaMark size={150} />
            <div className="muted" style={{ fontSize: 13, fontWeight: 700 }}>Medal design — to be revealed</div>
          </div>
        </div>
      </section>

      {/* FAQS */}
      <section id="faqs" className="wrap section" style={{ scrollMarginTop: 140 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 40 }}>
          <div style={{ flex: '1 1 300px' }}>
            <h2 className="d h-lg forest">FAQs</h2>
            <p className="muted" style={{ margin: '16px 0 24px', lineHeight: 1.6, maxWidth: 360 }}>Can’t find your answer? <Link href="/contact">Contact us</Link> and we’ll help.</p>
            <div className="stack" style={{ gap: 10, fontWeight: 700 }}>
              <Link href="/legal/terms">Event terms &amp; conditions</Link>
              <Link href="/legal/waiver">Participant waiver</Link>
              <Link href="/legal/refunds">Cancellation, transfer &amp; refund policy</Link>
            </div>
          </div>
          <div style={{ flex: '2 1 520px' }}><Faqs faqs={faqs} /></div>
        </div>
      </section>

      {/* VOLUNTEER */}
      <section className="wrap section">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 40, alignItems: 'center' }}>
          <div className="photo" style={{ flex: '1 1 440px', height: 440 }}><img src="/images/crew.jpg" alt="Three women smiling together after a race" className="cover" loading="lazy" /></div>
          <div style={{ flex: '1 1 360px' }} className="stack">
            <h2 className="d h-lg forest">Volunteer</h2>
            <p className="muted lead" style={{ margin: '16px 0 20px' }}>Cheer at water stations, guide runners and hand out medals at the finish line.</p>
            <Link href="/contact?topic=Volunteering" className="btn btn-outline" style={{ alignSelf: 'flex-start' }}>Apply to volunteer</Link>
          </div>
        </div>
        <Sponsors sponsors={sponsors} title="Our partners" />
      </section>

      {/* CTA */}
      <section className="wrap section">
        <div style={{ background: 'var(--forest)', color: '#fff', borderRadius: 28, padding: 'clamp(28px,5vw,64px)', display: 'flex', flexWrap: 'wrap', gap: 28, alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 className="d" style={{ margin: 0, fontSize: 'clamp(44px,6vw,92px)', lineHeight: 0.9 }}>See you at the<br /><span style={{ color: 'var(--gold)' }}>starting line.</span></h2>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {anyOpen && <Link href="/register" className="btn btn-coral">Register now</Link>}
            <Link href="/contact" className="btn" style={{ border: '2px solid #fff', color: '#fff' }}>Contact the organiser</Link>
          </div>
        </div>
      </section>

      {anyOpen && (
        <div className="sticky-bar">
          <span style={{ fontWeight: 700, fontSize: 14 }}>{ev.name}</span>
          <Link href="/register" className="btn btn-coral btn-sm">Register</Link>
        </div>
      )}
    </>
  );
}
