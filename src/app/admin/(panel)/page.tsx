import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/supabase/admin';
import { inrShort } from '@/lib/format';
import { site } from '@/lib/config';

interface RaceStat { id: string; code: string; name: string; capacity: number | null; status: string; paid: number; pending: number; failed: number; revenue_paise: number }
interface Stats { by_race: RaceStat[]; daily: { day: string; count: number }[]; cities: { city: string; count: number }[] }

const STATUS_STYLE: Record<string, [string, string]> = { open: ['#E2EBDD', '#1E5B49'], paused: ['#FDF1CC', '#5A4A12'], closed: ['#FDE2DC', '#9B2C14'], coming_soon: ['#EEF2EC', '#4D5A52'] };

export default async function AdminHome({ searchParams }: { searchParams: { denied?: string } }) {
  const user = await requireAdmin();
  const { data: event } = await db().from('events').select('id, name').eq('slug', site.flagshipSlug).maybeSingle();
  if (!event) return <p>No event found. Run <code>supabase/seed.sql</code> — see the hosting guide.</p>;
  const { data } = await db().rpc('admin_stats', { p_event: event.id });
  const stats = (data ?? { by_race: [], daily: [], cities: [] }) as Stats;

  const paid = stats.by_race.reduce((s, r) => s + Number(r.paid), 0);
  const failed = stats.by_race.reduce((s, r) => s + Number(r.failed), 0);
  const pending = stats.by_race.reduce((s, r) => s + Number(r.pending), 0);
  const revenue = stats.by_race.reduce((s, r) => s + Number(r.revenue_paise), 0);
  const attempts = paid + failed;
  const rate = attempts ? ((paid / attempts) * 100).toFixed(1) + '%' : '—';
  const maxDay = Math.max(1, ...stats.daily.map((d) => Number(d.count)));
  const maxRev = Math.max(1, ...stats.by_race.map((r) => Number(r.revenue_paise)));
  const maxCity = Math.max(1, ...stats.cities.map((c) => Number(c.count)));
  const isAdmin = user.role === 'admin';

  const card: React.CSSProperties = { background: '#fff', borderRadius: 18, padding: 20 };
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="row-between">
        <h1 style={{ margin: 0, fontSize: 26 }}>{event.name} — overview</h1>
        {isAdmin && <a href="/api/admin/export?type=participants&status=paid" className="btn btn-primary btn-sm">Export paid participants (CSV)</a>}
      </div>
      {searchParams.denied && <div className="alert alert-info">That page is for admins only.</div>}

      <div className="grid g4" style={{ gap: 14 }}>
        <div style={card}><div className="label-sm">Total registrations</div><div style={{ fontSize: 34, fontWeight: 800 }}>{paid.toLocaleString('en-IN')}</div><div className="muted" style={{ fontSize: 13 }}>Paid and confirmed</div></div>
        {isAdmin && <div style={card}><div className="label-sm">Revenue</div><div style={{ fontSize: 34, fontWeight: 800 }}>{inrShort(revenue)}</div><div className="muted" style={{ fontSize: 13 }}>Verified payments</div></div>}
        <div style={card}><div className="label-sm">Payment success rate</div><div style={{ fontSize: 34, fontWeight: 800 }}>{rate}</div><div className="muted" style={{ fontSize: 13 }}>{paid} paid of {attempts} completed attempts</div></div>
        <div style={card}><div className="label-sm">Payment issues</div><div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}><span>⏱ Pending (held)</span><b>{pending}</b></div><div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}><span>✕ Failed</span><b>{failed}</b></div></div>
      </div>

      <div className="grid g4" style={{ gap: 14 }}>
        {stats.by_race.map((r) => {
          const [bg, fg] = STATUS_STYLE[r.status] ?? STATUS_STYLE.coming_soon;
          const pct = r.capacity ? Math.min(100, Math.round((Number(r.paid) / r.capacity) * 100)) : 0;
          return (
            <div key={r.id} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><b>{r.name}</b><span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: bg, color: fg }}>{r.status.replace('_', ' ')}</span></div>
              <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8 }}>{r.paid} <span className="muted" style={{ fontSize: 14, fontWeight: 600 }}>/ {r.capacity ?? '—'}</span></div>
              <div role="img" aria-label={`${r.paid} of ${r.capacity ?? 'unset'} places sold`} style={{ height: 8, borderRadius: 99, background: 'var(--mint)', marginTop: 10, overflow: 'hidden' }}><div style={{ height: '100%', width: `${pct}%`, background: 'var(--forest)' }} /></div>
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{r.capacity ? `${Math.max(0, r.capacity - Number(r.paid) - Number(r.pending))} places left` : 'Capacity not set'}</div>
            </div>
          );
        })}
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: 14 }}>
        <section style={card} aria-labelledby="c1">
          <h2 id="c1" style={{ margin: '0 0 14px', fontSize: 16 }}>Registrations per day (last 30 days)</h2>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 180, borderBottom: '1px solid #C9D6C4' }}>
            {stats.daily.map((d) => (
              <div key={d.day} title={`${d.day}: ${d.count}`} aria-label={`${d.day}: ${d.count} registrations`} role="img" style={{ flex: 1, height: `${(Number(d.count) / maxDay) * 100}%`, minHeight: Number(d.count) ? 3 : 0, background: 'var(--forest)', borderRadius: '4px 4px 0 0' }} />
            ))}
          </div>
          <div className="muted" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 6 }}><span>{stats.daily[0]?.day}</span><span>Peak: {maxDay}/day</span><span>{stats.daily.at(-1)?.day}</span></div>
        </section>
        <section style={card}>
          {isAdmin && (
            <>
              <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Revenue by race</h2>
              {stats.by_race.map((r) => (
                <div key={r.id} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span>{r.name}</span><b>{inrShort(Number(r.revenue_paise))}</b></div>
                  <div style={{ height: 10, background: '#EEF2EC', borderRadius: 4, marginTop: 4 }}><div style={{ height: '100%', width: `${(Number(r.revenue_paise) / maxRev) * 100}%`, background: 'var(--forest)', borderRadius: 4 }} /></div>
                </div>
              ))}
            </>
          )}
          <h2 style={{ margin: '18px 0 12px', fontSize: 16 }}>Participants by city</h2>
          {stats.cities.length === 0 && <p className="muted" style={{ margin: 0 }}>No registrations yet.</p>}
          {stats.cities.map((c) => (
            <div key={c.city} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 44px', gap: 10, alignItems: 'center', marginBottom: 6, fontSize: 13 }}>
              <span>{c.city}</span>
              <div style={{ height: 10, background: '#EEF2EC', borderRadius: 4 }}><div style={{ height: '100%', width: `${(Number(c.count) / maxCity) * 100}%`, background: '#3E7C68', borderRadius: 4 }} /></div>
              <b style={{ textAlign: 'right' }}>{c.count}</b>
            </div>
          ))}
        </section>
      </div>
      {isAdmin && <p className="muted" style={{ fontSize: 13 }}>Manage prices and open/close races in <Link href="/admin/races">Races &amp; pricing</Link>.</p>}
    </div>
  );
}
