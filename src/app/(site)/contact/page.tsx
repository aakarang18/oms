import type { Metadata } from 'next';
import Link from 'next/link';
import { ContactForm } from '@/components/Forms';
import { eventHref, instagramLink, site, whatsappLink } from '@/lib/config';

export const metadata: Metadata = { title: 'Contact us', description: 'Contact Casa Atleta in Bareilly about Jhumka City Run, your registration, volunteering or media.' };

export default function ContactPage({ searchParams }: { searchParams: { topic?: string } }) {
  const wa = whatsappLink();
  const ig = instagramLink();
  return (
    <>
      <section className="wrap" style={{ paddingTop: 64 }}>
        <span className="chip">Contact us</span>
        <h1 className="d h-xl forest" style={{ margin: '18px 0 12px' }}>Let’s <span className="coral">talk.</span></h1>
        <p className="lead" style={{ margin: 0, maxWidth: 560 }}>Questions about a race, a correction to your registration, or an idea for working together — we’ll get back to you soon.</p>
      </section>
      <section className="wrap" style={{ paddingTop: 48 }}>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: 24, alignItems: 'start' }}>
          <div className="card" style={{ padding: 'clamp(22px,3vw,40px)', gridColumn: 'span 1' }}><ContactForm initialTopic={searchParams.topic} /></div>
          <div className="stack" style={{ gap: 14 }}>
            {wa && <a href={wa} style={{ background: 'var(--forest)', color: '#fff', borderRadius: 20, padding: 22, textDecoration: 'none' }}><b style={{ display: 'block', fontSize: 17 }}>WhatsApp us</b><span style={{ color: 'var(--on-forest-muted)' }}>{site.whatsapp}</span></a>}
            {site.email && <a href={`mailto:${site.email}`} className="card" style={{ borderRadius: 20, padding: 22, textDecoration: 'none' }}><b style={{ display: 'block', fontSize: 17 }}>Email</b><span className="muted">{site.email}</span></a>}
            {ig && <a href={ig} className="card" style={{ borderRadius: 20, padding: 22, textDecoration: 'none' }} rel="noopener"><b style={{ display: 'block', fontSize: 17 }}>Instagram</b><span className="muted">@{site.instagram.replace(/^@/, '')}</span></a>}
            <div className="card" style={{ borderRadius: 20, padding: 22 }}><b style={{ display: 'block', fontSize: 17 }}>Based in</b><span className="muted">{site.city}</span></div>
            <div style={{ background: 'var(--mint)', borderRadius: 20, padding: 22 }}>
              <b style={{ fontSize: 17 }}>Quick answers</b>
              <p className="muted" style={{ margin: '6px 0 12px', lineHeight: 1.5 }}>Race dates, bib collection, refunds and more.</p>
              <a href={`${eventHref('/')}#faqs`} className="forest" style={{ fontWeight: 700 }}>Read the FAQs →</a>
            </div>
          </div>
        </div>
      </section>
      <section className="wrap" style={{ paddingTop: 80 }}>
        <div className="photo" style={{ height: 300 }}>
          <img src="/images/band.jpg" alt="Crowd of runners on a city street" className="cover" loading="lazy" />
          <div className="overlay-card" style={{ maxWidth: 560, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
            <div><b style={{ fontSize: 20 }}>Business, school or club?</b><div className="muted">Sponsorship and partnership enquiries have their own page.</div></div>
            <Link href="/partners" className="btn btn-coral">Partner with us</Link>
          </div>
        </div>
      </section>
    </>
  );
}
