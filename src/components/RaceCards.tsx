import Link from 'next/link';
import type { RaceRow } from '@/lib/types';
import { inr } from '@/lib/format';

const PHOTOS: Record<string, { src: string; alt: string }> = {
  '5K': { src: '/images/run5k.jpg', alt: 'Smiling woman jogging on a sunny road' },
  '10K': { src: '/images/run10k.jpg', alt: 'Woman running along a lakeside path' },
  '21K': { src: '/images/run21k.jpg', alt: 'Crowd of marathon runners on a city street' },
  KID: { src: '/images/kids.jpg', alt: 'Children in colourful raincoats running and laughing' }
};

const TAGS: Record<string, string> = { '5K': 'Beginner friendly', '10K': 'Regular runners', '21K': 'Half Marathon', KID: 'Kids Run' };

export function raceStatusLabel(race: RaceRow, placesLeft?: number | null) {
  if (race.status === 'open' && placesLeft === 0) return 'Sold out';
  return { coming_soon: 'Opening soon', open: 'Open', paused: 'Paused', closed: 'Closed' }[race.status];
}

export function RaceCards({ races, placesLeft = {} }: { races: RaceRow[]; placesLeft?: Record<string, number | null> }) {
  return (
    <div className="grid g4">
      {races.map((race) => {
        const photo = PHOTOS[race.code] ?? PHOTOS['5K'];
        const flagship = race.code === '21K';
        const kids = race.is_kids;
        const bg = flagship ? 'var(--forest)' : kids ? 'var(--gold)' : '#fff';
        const fg = flagship ? '#fff' : 'var(--ink)';
        const left = placesLeft[race.id];
        const bookable = race.status === 'open' && race.fee_paise !== null && left !== 0;
        return (
          <article key={race.id} style={{ background: bg, color: fg, borderRadius: 24, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ height: 180 }}><img src={photo.src} alt={photo.alt} className="cover" loading="lazy" /></div>
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <h3 className="d" style={{ margin: 0, fontSize: kids ? 48 : 60, lineHeight: 0.9, color: flagship ? 'var(--gold)' : kids ? 'var(--forest)' : 'inherit' }}>{kids ? 'Kids' : race.code}</h3>
                <span className={flagship ? 'chip chip-gold' : kids ? 'chip' : 'chip chip-coral'} style={kids ? { background: '#fff', color: 'var(--ink)' } : undefined}>{TAGS[race.code] ?? race.name}</span>
              </div>
              <div style={{ fontSize: 19, fontWeight: 800 }}>{race.positioning}</div>
              <p style={{ margin: 0, lineHeight: 1.55, color: flagship ? 'var(--on-forest-muted)' : 'inherit', opacity: flagship ? 1 : 0.85 }}>{race.audience}</p>
              <div style={{ fontSize: 14, fontWeight: 700 }}>
                {inr(race.fee_paise) ?? '₹ To be announced'} · {raceStatusLabel(race, left)}
                {typeof left === 'number' && left > 0 && left <= 50 && <span> · only {left} left</span>}
              </div>
              {bookable ? (
                <Link href={`/register?race=${race.code}`} className={`btn btn-block ${flagship ? 'btn-gold' : kids ? 'btn-primary' : 'btn-coral'}`} style={{ marginTop: 'auto' }}>
                  {kids ? 'Register a child' : `Register for ${race.code}`}
                </Link>
              ) : (
                <span className="btn btn-block" style={{ marginTop: 'auto', background: flagship ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.06)', cursor: 'default' }}>
                  {raceStatusLabel(race, left)}
                </span>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
