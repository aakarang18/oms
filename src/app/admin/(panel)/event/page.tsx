import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/supabase/admin';
import { site } from '@/lib/config';
import type { EventRow } from '@/lib/types';
import { updateEvent } from '../actions';

export default async function EventDetails({ searchParams }: { searchParams: { saved?: string; error?: string } }) {
  await requireAdmin();
  const { data } = await db().from('events').select('*').eq('slug', site.flagshipSlug).maybeSingle();
  if (!data) return <p>No event found. Run supabase/seed.sql.</p>;
  const ev = data as EventRow;
  const closes = ev.registration_closes_at ? new Date(new Date(ev.registration_closes_at).getTime() + 5.5 * 3600e3).toISOString().slice(0, 16) : '';
  const input = (name: keyof EventRow, label: string, hint?: string, type = 'text') => (
    <div className="field"><label htmlFor={name}>{label}</label><input id={name} name={name} type={type} className="input" defaultValue={String(ev[name] ?? '')} />{hint && <span className="hint">{hint}</span>}</div>
  );
  const area = (name: keyof EventRow, label: string, hint?: string) => (
    <div className="field" style={{ gridColumn: '1/-1' }}><label htmlFor={name}>{label}</label><textarea id={name} name={name} className="input" rows={3} defaultValue={String(ev[name] ?? '')} />{hint && <span className="hint">{hint}</span>}</div>
  );
  return (
    <form action={updateEvent} className="stack" style={{ gap: 14, maxWidth: 980 }}>
      <input type="hidden" name="id" value={ev.id} />
      <h1 style={{ margin: 0, fontSize: 26 }}>Event details</h1>
      <p className="muted" style={{ margin: 0 }}>Anything left empty shows as “To be announced” on the website. Only publish details once they are confirmed.</p>
      {searchParams.saved && <div className="alert alert-info">Saved — the website updates within a minute.</div>}
      {searchParams.error && <div className="alert alert-error">{searchParams.error}</div>}
      <div className="card grid g2" style={{ padding: 20, borderRadius: 18 }}>
        {input('name', 'Event name')}
        {input('tagline', 'Tagline')}
        {area('description', 'Short description')}
        {input('event_date', 'Race date', 'Starts the countdown and adds the event to Google results', 'date')}
        <div className="field"><label htmlFor="registration_closes_at">Registrations close at (IST)</label><input id="registration_closes_at" name="registration_closes_at" type="datetime-local" className="input" defaultValue={closes} /><span className="hint">Optional</span></div>
        {input('venue', 'City / venue')}
        {input('start_point', 'Start / finish point')}
        {input('reporting_time', 'Reporting time', 'e.g. 4:45 AM')}
      </div>
      <div className="card grid g2" style={{ padding: 20, borderRadius: 18 }}>
        <h2 style={{ margin: 0, fontSize: 18, gridColumn: '1/-1' }}>Race-day information</h2>
        {area('bib_collection', 'Bib collection & ID', 'Dates, venue and which ID to bring')}
        {area('hydration', 'Hydration stations')}
        {area('medical', 'Medical & emergency')}
        {area('guidelines', 'Participant guidelines')}
        {area('parking', 'Parking & transport')}
        {area('baggage', 'Baggage')}
        {area('race_kit', 'Race kit contents', 'e.g. T-shirt, bib with timing chip, finisher medal')}
        {area('awards', 'Awards & age categories')}
      </div>
      <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>Save event details</button>
    </form>
  );
}
