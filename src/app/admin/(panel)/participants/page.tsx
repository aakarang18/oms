import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/supabase/admin';
import { participantsQuery } from '@/lib/participants';
import { dateTime, maskMobile } from '@/lib/format';

const PAGE = 50;
const STATUS: Record<string, [string, string, string]> = {
  paid: ['#E2EBDD', '#1E5B49', '✓ Paid'],
  pending: ['#FDF1CC', '#5A4A12', '⏱ Pending'],
  failed: ['#FDE2DC', '#9B2C14', '✕ Failed'],
  expired: ['#EEF2EC', '#4D5A52', 'Expired'],
  cancelled: ['#EEF2EC', '#4D5A52', 'Cancelled']
};

export default async function Participants({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  await requireAdmin('admin');
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const filters = { q: searchParams.q, race: searchParams.race, status: searchParams.status, from: searchParams.from, to: searchParams.to };
  const [{ data: races }, { data, count }] = await Promise.all([
    db().from('races').select('id, name').order('sort'),
    participantsQuery(filters).range((page - 1) * PAGE, page * PAGE - 1)
  ]);
  const rows = (data ?? []) as unknown as Array<Record<string, string | null> & { races: { name: string } | null; expires_at: string | null }>;
  const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]);
  const total = count ?? 0;

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="row-between">
        <h1 style={{ margin: 0, fontSize: 26 }}>Participants</h1>
        <a href={`/api/admin/export?type=participants&${qs.toString()}`} className="btn btn-primary btn-sm">Export this list (CSV / Excel)</a>
      </div>
      <form className="card" style={{ padding: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', borderRadius: 18 }}>
        <div className="field" style={{ flex: '2 1 240px' }}><label htmlFor="q">Search</label><input id="q" name="q" className="input" defaultValue={filters.q} placeholder="Name, mobile, email or reg. ID" /></div>
        <div className="field" style={{ flex: '1 1 150px' }}><label htmlFor="race">Race</label><select id="race" name="race" className="input" defaultValue={filters.race ?? ''}><option value="">All races</option>{(races ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
        <div className="field" style={{ flex: '1 1 140px' }}><label htmlFor="status">Payment</label><select id="status" name="status" className="input" defaultValue={filters.status ?? ''}><option value="">All</option><option value="paid">Paid</option><option value="pending">Pending</option><option value="failed">Failed</option><option value="cancelled">Cancelled</option></select></div>
        <div className="field" style={{ flex: '1 1 140px' }}><label htmlFor="from">From</label><input id="from" name="from" type="date" className="input" defaultValue={filters.from} /></div>
        <div className="field" style={{ flex: '1 1 140px' }}><label htmlFor="to">To</label><input id="to" name="to" type="date" className="input" defaultValue={filters.to} /></div>
        <button className="btn btn-primary btn-sm">Filter</button>
        <Link href="/admin/participants" className="btn btn-outline btn-sm">Clear</Link>
      </form>
      <div className="table-wrap">
        <table className="table" style={{ fontSize: 14 }}>
          <thead><tr><th>Reg. ID</th><th>Name</th><th>Race</th><th>Mobile</th><th>City</th><th>T-shirt</th><th>Payment</th><th>Registered</th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const expired = r.status === 'pending' && r.expires_at && new Date(r.expires_at) < new Date();
              const [bg, fg, label] = STATUS[expired ? 'expired' : String(r.status)] ?? STATUS.pending;
              return (
                <tr key={String(r.id)}>
                  <td style={{ fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 13 }}><Link href={`/admin/participants/${r.id}`}>{r.reg_code ?? '—'}</Link></td>
                  <td><Link href={`/admin/participants/${r.id}`} style={{ fontWeight: 600 }}>{r.full_name}</Link></td>
                  <td>{r.races?.name}</td>
                  <td>{maskMobile(String(r.mobile))}</td>
                  <td>{r.city}</td>
                  <td>{r.tshirt_size}</td>
                  <td><span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 99, background: bg, color: fg, whiteSpace: 'nowrap' }}>{label}</span></td>
                  <td className="muted">{dateTime(r.created_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <p className="muted" style={{ padding: 20, textAlign: 'center' }}>No participants match these filters.</p>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} className="muted">
        <span>{total.toLocaleString('en-IN')} records · page {page} of {Math.max(1, Math.ceil(total / PAGE))}</span>
        <span style={{ display: 'flex', gap: 8 }}>
          {page > 1 && <Link className="btn btn-outline btn-sm" href={`?${qs.toString()}&page=${page - 1}`}>← Previous</Link>}
          {page * PAGE < total && <Link className="btn btn-outline btn-sm" href={`?${qs.toString()}&page=${page + 1}`}>Next →</Link>}
        </span>
      </div>
    </div>
  );
}
