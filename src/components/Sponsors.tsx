import Link from 'next/link';
import type { SponsorRow } from '@/lib/types';

export function Sponsors({ sponsors, title = 'Sponsors & partners' }: { sponsors: SponsorRow[]; title?: string }) {
  return (
    <div style={{ marginTop: 72 }}>
      <div className="row-between" style={{ marginBottom: 24, alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>{title}</h2>
        <Link href="/partners" className="btn btn-outline btn-sm">Become a Partner</Link>
      </div>
      {sponsors.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>Partner announcements coming soon. Interested? <Link href="/partners">Get in touch</Link>.</p>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
          {sponsors.map((s) => {
            const inner = s.logo_url ? (
              <img src={s.logo_url} alt={s.name} style={{ maxHeight: 64, maxWidth: '80%', objectFit: 'contain' }} />
            ) : (
              <span style={{ fontWeight: 700 }}>{s.name}</span>
            );
            return (
              <div key={s.id} className="card" style={{ height: 110, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
                {s.website_url ? <a href={s.website_url} rel="noopener sponsored" target="_blank">{inner}</a> : inner}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
