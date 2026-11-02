import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getEventBundle } from '@/lib/content';
import { eventDomainFor, eventHref, mainHref } from '@/lib/config';
import { EventHeader } from '@/components/EventHeader';
import { Logo, JhumkaMark } from '@/components/Brand';
import { NewsletterPopup, NotifyButton } from '@/components/NewsletterPopup';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const b = await getEventBundle(params.slug);
  const domain = eventDomainFor(params.slug);
  return {
    ...(domain ? { metadataBase: new URL(`https://${domain}`) } : {}),
    title: { default: b?.event.name ?? 'Event', template: `%s | ${b?.event.name ?? 'Event'}` },
    icons: { icon: '/icon.svg' }
  };
}

/** Chrome for an event's own website — event branding first, Casa Atleta as the organiser. */
export default async function EventLayout({ children, params }: { children: React.ReactNode; params: { slug: string } }) {
  const bundle = await getEventBundle(params.slug);
  if (!bundle) notFound();
  const { event: ev } = bundle;
  const anyOpen = bundle.races.some((r) => r.status === 'open');
  const home = eventHref('/', ev.slug);

  return (
    <>
      <a href="#main" className="sr-only">Skip to content</a>
      <div style={{ background: 'var(--forest)', color: '#fff', fontSize: 13 }}>
        <div className="wrap" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, minHeight: 40 }}>
          <a href={mainHref('/')} style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: '#fff' }}>
            <span style={{ opacity: 0.85 }}>An event by</span>
            <Logo width={64} light label={false} />
            <span className="sr-only">Casa Atleta</span>
          </a>
          {!anyOpen && (
            <span className="hide-m">Registrations opening soon — <NotifyButton style={{ border: 0, background: 'none', padding: 0, color: 'var(--gold)', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}>get notified</NotifyButton></span>
          )}
        </div>
      </div>
      <EventHeader name={ev.name} home={home} registerHref={eventHref('/register', ev.slug)} />
      <main id="main">{children}</main>

      <footer className="footer">
        <div className="wrap" style={{ paddingBottom: 32 }}>
          <div className="footer-grid">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <JhumkaMark size={44} />
                <span className="d forest" style={{ fontSize: 28, lineHeight: 1 }}>{ev.name}</span>
              </div>
              <p style={{ margin: '12px 0 0', maxWidth: 320, lineHeight: 1.55 }}>{ev.tagline}</p>
            </div>
            <div className="stack" style={{ gap: 10 }}>
              <div className="label-sm">Race</div>
              <a href={`${home}#distances`}>Distances</a>
              <a href={`${home}#schedule`}>Schedule</a>
              <a href={`${home}#raceday`}>Race-day info</a>
              <a href={`${home}#faqs`}>FAQs</a>
              <a href={eventHref('/register', ev.slug)}>Register</a>
            </div>
            <div className="stack" style={{ gap: 10 }}>
              <div className="label-sm">Legal</div>
              <a href={mainHref('/legal/terms')}>Event terms</a>
              <a href={mainHref('/legal/waiver')}>Participant waiver</a>
              <a href={mainHref('/legal/refunds')}>Refund policy</a>
              <a href={mainHref('/legal/privacy')}>Privacy policy</a>
            </div>
            <div className="stack" style={{ gap: 10 }}>
              <div className="label-sm">Organised by</div>
              <a href={mainHref('/')} aria-label="Casa Atleta website"><Logo width={110} label={false} /></a>
              <a href={mainHref('/contact')}>Contact the organiser</a>
              <a href={mainHref('/partners')}>Partner with us</a>
            </div>
          </div>
          <p style={{ marginTop: 32, fontSize: 12, lineHeight: 1.6 }} className="muted">
            © {new Date().getFullYear()} Casa Atleta. All rights reserved. · Photos from Unsplash — stock photos, not from a {ev.name} event.
          </p>
        </div>
      </footer>
      <NewsletterPopup />
    </>
  );
}
