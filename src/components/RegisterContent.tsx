import Link from 'next/link';
import { getEventBundle, getPlacesLeft } from '@/lib/content';
import { eventDate } from '@/lib/format';
import { RegisterForm, type RaceOption } from '@/components/RegisterForm';
import { NotifyButton } from '@/components/NewsletterPopup';
import { eventHref, whatsappLink } from '@/lib/config';

export async function RegisterContent({ slug, race }: { slug: string; race?: string }) {
  const bundle = await getEventBundle(slug);
  const races = bundle?.races ?? [];
  const left = bundle?.live ? await getPlacesLeft(races.map((r) => r.id)) : {};
  const options: RaceOption[] = races.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    positioning: r.positioning ?? '',
    audience: r.audience ?? '',
    isKids: r.is_kids,
    feePaise: r.fee_paise,
    placesLeft: (left as Record<string, number | null>)[r.id] ?? null,
    available: r.status === 'open' && r.fee_paise !== null && r.capacity !== null && (left as Record<string, number | null>)[r.id] !== 0,
    statusLabel: r.status === 'open' ? ((left as Record<string, number | null>)[r.id] === 0 ? 'Sold out' : 'Open') : { coming_soon: 'Opening soon', paused: 'Paused', closed: 'Closed', open: 'Open' }[r.status]
  }));
  const anyOpen = options.some((o) => o.available);

  return (
    <section className="wrap" style={{ paddingTop: 32, paddingBottom: 40 }}>
      <div className="label-sm coral" style={{ color: 'var(--coral)' }}>{bundle?.event.name ?? 'Jhumka City Run'} · Registration</div>
      {anyOpen ? (
        <RegisterForm
          races={options}
          initialCode={race}
          eventName={bundle?.event.name ?? 'Jhumka City Run'}
          eventDate={eventDate(bundle?.event.event_date ?? null, { day: 'numeric', month: 'short', year: 'numeric' })}
          whatsapp={whatsappLink('Hi, I need help with my registration') }
        />
      ) : (
        <div className="card" style={{ marginTop: 20, padding: 'clamp(24px,4vw,48px)', textAlign: 'center' }}>
          <h1 className="d h-md forest">Registrations open soon</h1>
          <p className="muted lead" style={{ maxWidth: 520, margin: '14px auto 24px' }}>We’re finalising the race date, prices and routes. Leave your email and we’ll tell you the moment entries open.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <NotifyButton className="btn btn-primary">Notify me</NotifyButton>
            <Link href={eventHref('/', slug)} className="btn btn-outline">See the event</Link>
          </div>
        </div>
      )}
    </section>
  );
}
