import type { Metadata } from 'next';
import { PartnerForm } from '@/components/Forms';
import { getSponsors } from '@/lib/content';
import { Sponsors } from '@/components/Sponsors';

export const revalidate = 300;
export const metadata: Metadata = { title: 'Partner with us', description: 'Sponsorship and partnership opportunities with Casa Atleta and Jhumka City Run in Bareilly.' };

const WHO = [
  ['Corporate sponsors', 'Title and associate partners'],
  ['Local businesses', 'Shops, cafés, gyms, clinics'],
  ['Running clubs', 'Club codes, pacers, group entries'],
  ['Schools & colleges', 'Student teams and Kids Run groups'],
  ['Institutions', 'Hospitals, NGOs, civic bodies']
];

export default async function PartnersPage() {
  const sponsors = await getSponsors();
  return (
    <>
      <section className="wrap" style={{ paddingTop: 28 }}>
        <div className="photo" style={{ height: 540 }}>
          <img src="/images/band.jpg" alt="Crowd of runners on a city street" className="cover" />
          <div className="overlay-card stack" style={{ maxWidth: 680, gap: 16, padding: 'clamp(22px,3vw,40px)' }}>
            <span className="chip" style={{ alignSelf: 'flex-start' }}>Partnerships &amp; sponsorship</span>
            <h1 className="d forest" style={{ margin: 0, fontSize: 'clamp(48px,6vw,92px)', lineHeight: 0.88 }}>Run with the <span className="coral">city.</span></h1>
            <p style={{ margin: 0, fontSize: 18, lineHeight: 1.6 }}>Put your name on Bareilly’s new running movement — at the start line, on every bib, and in front of a community that’s just getting started.</p>
            <a href="#enquire" className="btn btn-coral" style={{ alignSelf: 'flex-start' }}>Become a partner</a>
          </div>
        </div>
      </section>

      <section className="wrap section">
        <h2 className="d h-lg" style={{ marginBottom: 28 }}>Who we <span className="coral">partner with</span></h2>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          {WHO.map(([t, d], i) => (
            <div key={t} style={{ background: i === 0 ? 'var(--forest)' : '#fff', color: i === 0 ? '#fff' : 'var(--ink)', borderRadius: 22, padding: 24, minHeight: 150, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <h3 style={{ fontWeight: 800, fontSize: 18, margin: 0 }}>{t}</h3>
              <div style={{ fontSize: 14, marginTop: 4, color: i === 0 ? 'var(--on-forest-muted)' : 'var(--muted)' }}>{d}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="wrap section">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 40, alignItems: 'center' }}>
          <div style={{ flex: '1 1 420px' }}>
            <h2 className="d h-lg forest" style={{ marginBottom: 20 }}>Where your<br />brand shows up</h2>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12, fontSize: 17 }}>
              {['Start / finish arch and route banners', 'Race bibs, T-shirts and medal ribbons', 'Website, registration emails and social media', 'Stalls at bib collection and the race-day village', 'Team entries for your employees'].map((t) => (
                <li key={t} style={{ display: 'flex', gap: 12, alignItems: 'center' }}><span style={{ width: 28, height: 28, borderRadius: 99, background: 'var(--coral)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1B1B1F" strokeWidth="3" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg></span>{t}</li>
              ))}
            </ul>
          </div>
          <div className="photo" style={{ flex: '1 1 420px', height: 440 }}><img src="/images/hero.jpg" alt="Three runners racing on a city street" className="cover" loading="lazy" /></div>
        </div>
      </section>

      <section className="wrap section">
        <div className="row-between" style={{ marginBottom: 28 }}>
          <h2 className="d h-lg">Partnership <span className="coral">levels</span></h2>
          <p className="muted" style={{ margin: 0 }}>Pricing on request — every package can be tailored.</p>
        </div>
        <div className="grid g3">
          {[
            ['Title partner', '1 available', 'Your name in the event title, on the finish arch, every bib and medal ribbon, plus team entries.', true],
            ['Associate partner', 'Limited', 'Logo on route banners, T-shirts and website, a race-day stall and social media features.', false],
            ['Community partner', 'Open', 'For clubs, schools and local businesses — hydration stations, cheer zones, group codes.', false]
          ].map(([t, tag, d, dark]) => (
            <div key={String(t)} style={{ background: dark ? 'var(--forest)' : '#fff', color: dark ? '#fff' : 'var(--ink)', borderRadius: 24, padding: 28, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <span className={dark ? 'chip chip-gold' : 'chip'} style={{ alignSelf: 'flex-start' }}>{tag}</span>
              <h3 className="d" style={{ fontSize: 40, lineHeight: 0.95, margin: 0 }}>{t}</h3>
              <p style={{ margin: 0, lineHeight: 1.6, color: dark ? 'var(--on-forest-muted)' : 'var(--muted)' }}>{d}</p>
              <a href="#enquire" style={{ marginTop: 'auto', color: dark ? 'var(--gold)' : 'var(--forest)', fontWeight: 700 }}>Enquire →</a>
            </div>
          ))}
        </div>
      </section>

      <section id="enquire" className="wrap section" style={{ scrollMarginTop: 90 }}>
        <div className="card" style={{ padding: 'clamp(22px,4vw,56px)', display: 'flex', flexWrap: 'wrap', gap: 40 }}>
          <div style={{ flex: '1 1 280px' }}>
            <h2 className="d h-lg forest">Partnership<br /><span className="coral">enquiry</span></h2>
            <p className="muted" style={{ margin: '16px 0 0', lineHeight: 1.6 }}>Tell us a little about your organisation and we’ll be in touch.</p>
          </div>
          <div style={{ flex: '2 1 520px' }}><PartnerForm /></div>
        </div>
        <Sponsors sponsors={sponsors} title="Current partners" />
      </section>
    </>
  );
}
