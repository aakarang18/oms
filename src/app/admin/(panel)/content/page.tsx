import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/supabase/admin';
import { site } from '@/lib/config';
import type { AnnouncementRow, FaqRow, SponsorRow } from '@/lib/types';
import { deleteAnnouncement, deleteFaq, deleteSponsor, saveAnnouncement, saveFaq, saveSponsor } from '../actions';

const box: React.CSSProperties = { padding: 16, borderRadius: 16, border: '1px solid var(--line)', display: 'grid', gap: 10 };

export default async function Content({ searchParams }: { searchParams: { saved?: string } }) {
  await requireAdmin();
  const { data: ev } = await db().from('events').select('id').eq('slug', site.flagshipSlug).maybeSingle();
  const [faqs, anns, sponsors] = await Promise.all([
    db().from('faqs').select('*').order('sort'),
    db().from('announcements').select('*').order('created_at', { ascending: false }),
    db().from('sponsors').select('*').order('sort')
  ]);
  const eventId = ev?.id ?? '';

  return (
    <div className="stack" style={{ gap: 28, maxWidth: 980 }}>
      <h1 style={{ margin: 0, fontSize: 26 }}>FAQs, updates &amp; sponsors</h1>
      {searchParams.saved && <div className="alert alert-info">Saved — the website updates within a minute.</div>}

      <section id="updates" className="card" style={{ padding: 20, borderRadius: 18 }}>
        <h2 style={{ marginTop: 0, fontSize: 20 }}>Announcements</h2>
        <p className="muted" style={{ marginTop: 0 }}>The newest published announcement appears as “Latest update” on the event page.</p>
        <div className="stack" style={{ gap: 12 }}>
          {((anns.data ?? []) as AnnouncementRow[]).map((a) => (
            <div key={a.id} style={box}>
              <form action={saveAnnouncement} style={{ display: 'grid', gap: 10 }}>
                <input type="hidden" name="id" value={a.id} /><input type="hidden" name="event_id" value={eventId} />
                <input name="title" className="input" defaultValue={a.title} aria-label="Title" required />
                <textarea name="body" className="input" defaultValue={a.body ?? ''} aria-label="Text" rows={2} />
                <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" name="published" defaultChecked={a.published} /> Published</label>
                <button className="btn btn-primary btn-sm" style={{ justifySelf: 'start' }}>Save</button>
              </form>
              <form action={deleteAnnouncement}><input type="hidden" name="id" value={a.id} /><button className="btn btn-sm" style={{ background: '#FDE2DC', color: '#9B2C14' }}>Delete</button></form>
            </div>
          ))}
          <form action={saveAnnouncement} style={{ ...box, background: 'var(--chalk)' }}>
            <b>New announcement</b><input type="hidden" name="event_id" value={eventId} />
            <input name="title" className="input" placeholder="Title" aria-label="Title" required />
            <textarea name="body" className="input" placeholder="Text (optional)" aria-label="Text" rows={2} />
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" name="published" defaultChecked /> Publish now</label>
            <button className="btn btn-coral btn-sm" style={{ justifySelf: 'start' }}>Post announcement</button>
          </form>
        </div>
      </section>

      <section id="faqs" className="card" style={{ padding: 20, borderRadius: 18 }}>
        <h2 style={{ marginTop: 0, fontSize: 20 }}>FAQs</h2>
        <div className="stack" style={{ gap: 12 }}>
          {((faqs.data ?? []) as FaqRow[]).map((q) => (
            <div key={q.id} style={box}>
              <form action={saveFaq} style={{ display: 'grid', gap: 10 }}>
                <input type="hidden" name="id" value={q.id} /><input type="hidden" name="event_id" value={eventId} />
                <input name="question" className="input" defaultValue={q.question} aria-label="Question" required />
                <textarea name="answer" className="input" defaultValue={q.answer} aria-label="Answer" rows={3} required />
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>Order <input name="sort" type="number" className="input" style={{ width: 90, minHeight: 40 }} defaultValue={q.sort} /></label>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" name="published" defaultChecked={q.published} /> Published</label>
                  <button className="btn btn-primary btn-sm">Save</button>
                </div>
              </form>
              <form action={deleteFaq}><input type="hidden" name="id" value={q.id} /><button className="btn btn-sm" style={{ background: '#FDE2DC', color: '#9B2C14' }}>Delete</button></form>
            </div>
          ))}
          <form action={saveFaq} style={{ ...box, background: 'var(--chalk)' }}>
            <b>New FAQ</b><input type="hidden" name="event_id" value={eventId} />
            <input name="question" className="input" placeholder="Question" aria-label="Question" required />
            <textarea name="answer" className="input" placeholder="Answer" aria-label="Answer" rows={3} required />
            <input type="hidden" name="sort" value="99" />
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" name="published" defaultChecked /> Publish now</label>
            <button className="btn btn-coral btn-sm" style={{ justifySelf: 'start' }}>Add FAQ</button>
          </form>
        </div>
      </section>

      <section id="sponsors" className="card" style={{ padding: 20, borderRadius: 18 }}>
        <h2 style={{ marginTop: 0, fontSize: 20 }}>Sponsors &amp; partners</h2>
        <p className="muted" style={{ marginTop: 0 }}>Upload logos to Supabase Storage (public bucket) and paste the image link here.</p>
        <div className="stack" style={{ gap: 12 }}>
          {((sponsors.data ?? []) as SponsorRow[]).map((s) => (
            <div key={s.id} style={box}>
              <form action={saveSponsor} className="grid g2" style={{ gap: 10 }}>
                <input type="hidden" name="id" value={s.id} />
                <input name="name" className="input" defaultValue={s.name} aria-label="Name" required />
                <select name="tier" className="input" defaultValue={s.tier} aria-label="Level"><option value="title">Title partner</option><option value="associate">Associate partner</option><option value="community">Community partner</option><option value="partner">Partner</option></select>
                <input name="logo_url" className="input" defaultValue={s.logo_url ?? ''} placeholder="Logo image link" aria-label="Logo link" />
                <input name="website_url" className="input" defaultValue={s.website_url ?? ''} placeholder="Website" aria-label="Website" />
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>Order <input name="sort" type="number" className="input" style={{ width: 90, minHeight: 40 }} defaultValue={s.sort} /></label>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" name="published" defaultChecked={s.published} /> Show</label>
                  <button className="btn btn-primary btn-sm">Save</button>
                </div>
              </form>
              <form action={deleteSponsor}><input type="hidden" name="id" value={s.id} /><button className="btn btn-sm" style={{ background: '#FDE2DC', color: '#9B2C14' }}>Delete</button></form>
            </div>
          ))}
          <form action={saveSponsor} className="grid g2" style={{ ...box, background: 'var(--chalk)' }}>
            <b style={{ gridColumn: '1/-1' }}>New sponsor</b>
            <input name="name" className="input" placeholder="Name" aria-label="Name" required />
            <select name="tier" className="input" aria-label="Level" defaultValue="partner"><option value="title">Title partner</option><option value="associate">Associate partner</option><option value="community">Community partner</option><option value="partner">Partner</option></select>
            <input name="logo_url" className="input" placeholder="Logo image link" aria-label="Logo link" />
            <input name="website_url" className="input" placeholder="Website (optional)" aria-label="Website" />
            <input type="hidden" name="sort" value="99" />
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" name="published" defaultChecked /> Show on website</label>
            <button className="btn btn-coral btn-sm" style={{ justifySelf: 'start' }}>Add sponsor</button>
          </form>
        </div>
      </section>
    </div>
  );
}
