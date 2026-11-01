import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/supabase/admin';
import type { RaceRow } from '@/lib/types';
import { updateRace } from '../actions';

export default async function Races({ searchParams }: { searchParams: { saved?: string; error?: string } }) {
  await requireAdmin('admin');
  const { data } = await db().from('races').select('*').order('sort');
  const races = (data ?? []) as RaceRow[];
  const f = (race: RaceRow, name: keyof RaceRow | 'fee_rupees', label: string, opts: { type?: string; hint?: string; value?: string | number | null } = {}) => (
    <div className="field">
      <label htmlFor={`${race.id}-${name}`}>{label}</label>
      <input id={`${race.id}-${name}`} name={name} type={opts.type ?? 'text'} className="input" defaultValue={String(opts.value ?? (race[name as keyof RaceRow] ?? ''))} />
      {opts.hint && <span className="hint">{opts.hint}</span>}
    </div>
  );
  return (
    <div className="stack" style={{ gap: 14, maxWidth: 1100 }}>
      <h1 style={{ margin: 0, fontSize: 26 }}>Races, pricing &amp; capacity</h1>
      <p className="muted" style={{ margin: 0 }}>Each race is controlled separately. A race can only be <b>Open</b> once its fee and capacity are set. Registrations stop automatically when a race is full. Leave a box empty to show “To be announced”.</p>
      {searchParams.saved && <div className="alert alert-info">Saved — the website updates within a minute.</div>}
      {searchParams.error && <div className="alert alert-error">{searchParams.error}</div>}
      {races.map((race) => (
        <form key={race.id} action={updateRace} className="card" style={{ padding: 20, borderRadius: 18 }}>
          <input type="hidden" name="id" value={race.id} />
          <div className="row-between" style={{ marginBottom: 14, alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>{race.name}</h2>
            <div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <label htmlFor={`${race.id}-status`}>Registration</label>
              <select id={`${race.id}-status`} name="status" className="input" style={{ minHeight: 44, width: 'auto' }} defaultValue={race.status}>
                <option value="coming_soon">Opening soon</option>
                <option value="open">Open</option>
                <option value="paused">Paused</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {f(race, 'fee_rupees', 'Entry fee (₹)', { type: 'number', value: race.fee_paise === null ? '' : race.fee_paise / 100, hint: '0 = free entry' })}
            {f(race, 'capacity', 'Capacity (places)', { type: 'number' })}
            {f(race, 'flag_off', 'Flag-off time', { hint: 'e.g. 5:30 AM' })}
            {f(race, 'cut_off', 'Cut-off time', { hint: 'e.g. 3 hours' })}
            {f(race, 'min_age', 'Minimum age on race day', { type: 'number' })}
            {f(race, 'max_age', 'Maximum age on race day', { type: 'number', hint: 'Mainly for Kids Run' })}
            {f(race, 'start_finish', 'Start / finish point')}
            {f(race, 'elevation', 'Elevation profile', { hint: 'e.g. Flat, 40 m gain' })}
            {f(race, 'route_map_url', 'Route map image link', { hint: 'Upload to Supabase Storage and paste the link' })}
            {f(race, 'positioning', 'Short tagline')}
            {f(race, 'audience', 'Who it’s for')}
          </div>
          <button className="btn btn-primary btn-sm" style={{ marginTop: 16 }}>Save {race.name}</button>
        </form>
      ))}
    </div>
  );
}
