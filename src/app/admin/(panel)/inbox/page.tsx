import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/supabase/admin';
import { dateTime } from '@/lib/format';
import { markHandled } from '../actions';

export default async function Inbox() {
  await requireAdmin();
  const [contact, partners, news] = await Promise.all([
    db().from('contact_messages').select('*').order('created_at', { ascending: false }).limit(100),
    db().from('partner_enquiries').select('*').order('created_at', { ascending: false }).limit(100),
    db().from('newsletter_subscribers').select('id', { count: 'exact', head: true })
  ]);
  const item: React.CSSProperties = { padding: 16, borderRadius: 14, border: '1px solid var(--line)', display: 'grid', gap: 6, fontSize: 14 };
  return (
    <div className="stack" style={{ gap: 24, maxWidth: 980 }}>
      <h1 style={{ margin: 0, fontSize: 26 }}>Inbox</h1>
      <div className="card row-between" style={{ padding: 20, borderRadius: 18, alignItems: 'center' }}>
        <div><b>Newsletter sign-ups</b><div className="muted">{news.count ?? 0} people want race updates</div></div>
        <a href="/api/admin/export?type=newsletter" className="btn btn-outline btn-sm">Download list (CSV)</a>
      </div>

      <section className="card" style={{ padding: 20, borderRadius: 18 }}>
        <div className="row-between" style={{ marginBottom: 12, alignItems: 'center' }}><h2 style={{ margin: 0, fontSize: 20 }}>Contact messages</h2><a href="/api/admin/export?type=contact">Download all (CSV)</a></div>
        <div className="stack" style={{ gap: 10 }}>
          {(contact.data ?? []).length === 0 && <p className="muted">No messages yet.</p>}
          {(contact.data ?? []).map((m) => (
            <div key={m.id} style={{ ...item, opacity: m.handled ? 0.6 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}><b>{m.topic} — {m.name}</b><span className="muted">{dateTime(m.created_at)}</span></div>
              <div><a href={`mailto:${m.email}`}>{m.email}</a>{m.mobile && ` · ${m.mobile}`}{m.reg_code && ` · ${m.reg_code}`}</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{m.message}</div>
              {!m.handled && <form action={markHandled}><input type="hidden" name="id" value={m.id} /><input type="hidden" name="table" value="contact_messages" /><button className="btn btn-outline btn-sm">Mark as handled</button></form>}
            </div>
          ))}
        </div>
      </section>

      <section className="card" style={{ padding: 20, borderRadius: 18 }}>
        <div className="row-between" style={{ marginBottom: 12, alignItems: 'center' }}><h2 style={{ margin: 0, fontSize: 20 }}>Partnership enquiries</h2><a href="/api/admin/export?type=partners">Download all (CSV)</a></div>
        <div className="stack" style={{ gap: 10 }}>
          {(partners.data ?? []).length === 0 && <p className="muted">No enquiries yet.</p>}
          {(partners.data ?? []).map((p) => (
            <div key={p.id} style={{ ...item, opacity: p.handled ? 0.6 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}><b>{p.org_name} ({p.org_type})</b><span className="muted">{dateTime(p.created_at)}</span></div>
              <div>{p.contact_name} · <a href={`mailto:${p.email}`}>{p.email}</a>{p.mobile && ` · ${p.mobile}`}</div>
              {p.interests?.length > 0 && <div className="muted">Interested in: {p.interests.join(', ')}</div>}
              {p.message && <div style={{ whiteSpace: 'pre-wrap' }}>{p.message}</div>}
              {!p.handled && <form action={markHandled}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="table" value="partner_enquiries" /><button className="btn btn-outline btn-sm">Mark as handled</button></form>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
