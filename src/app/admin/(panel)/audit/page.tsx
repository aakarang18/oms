import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/supabase/admin';
import { dateTime } from '@/lib/format';

export default async function Audit() {
  await requireAdmin('admin');
  const { data } = await db().from('audit_log').select('*').order('created_at', { ascending: false }).limit(300);
  return (
    <div className="stack" style={{ gap: 14, maxWidth: 1100 }}>
      <h1 style={{ margin: 0, fontSize: 26 }}>Audit log</h1>
      <p className="muted" style={{ margin: 0 }}>Every important change made in this admin area — who, what and when. The latest 300 entries are shown.</p>
      <div className="table-wrap">
        <table className="table" style={{ fontSize: 14 }}>
          <thead><tr><th>When</th><th>Who</th><th>What</th><th>Details</th></tr></thead>
          <tbody>
            {(data ?? []).map((a) => (
              <tr key={a.id}>
                <td className="muted" style={{ whiteSpace: 'nowrap' }}>{dateTime(a.created_at)}</td>
                <td>{a.actor_email}</td>
                <td style={{ fontWeight: 600 }}>{a.action}</td>
                <td><code style={{ fontSize: 12, wordBreak: 'break-word' }}>{a.details ? JSON.stringify(a.details) : ''}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
        {(data ?? []).length === 0 && <p className="muted" style={{ padding: 20, textAlign: 'center' }}>No changes recorded yet.</p>}
      </div>
    </div>
  );
}
