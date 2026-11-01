import 'server-only';
import { db, isDatabaseConfigured } from './supabase/admin';
import type { AnnouncementRow, EventRow, FaqRow, RaceRow, SponsorRow } from './types';
import { site } from './config';

/*
 * Public-site content. Everything comes from the database (editable in /admin).
 * If the database isn't connected yet, sensible defaults are shown so the
 * site still renders — with every unconfirmed detail as "To be announced".
 */

const FALLBACK_EVENT: EventRow = {
  id: 'fallback',
  slug: site.flagshipSlug,
  code_prefix: 'JCR',
  name: 'Jhumka City Run',
  tagline: 'One city. One community. One starting line.',
  description: 'A celebration of running, fitness and community in Bareilly.',
  event_date: null,
  venue: 'Bareilly, Uttar Pradesh',
  start_point: null,
  reporting_time: null,
  bib_collection: null,
  hydration: null,
  medical: null,
  guidelines: null,
  parking: null,
  baggage: null,
  race_kit: null,
  awards: null,
  registration_closes_at: null,
  published: true
};

const r = (code: string, name: string, positioning: string, audience: string, distance: string | null, sort: number, is_kids = false): RaceRow => ({
  id: `fallback-${code}`,
  event_id: 'fallback',
  code,
  name,
  positioning,
  audience,
  distance_label: distance,
  is_kids,
  fee_paise: null,
  capacity: null,
  status: 'coming_soon',
  flag_off: null,
  cut_off: null,
  min_age: null,
  max_age: null,
  route_map_url: null,
  elevation: null,
  start_finish: null,
  sort
});

const FALLBACK_RACES: RaceRow[] = [
  r('5K', '5K', 'Start your running journey', 'Beginners and recreational runners', '5 km', 1),
  r('10K', '10K', 'Push your limits', 'Regular runners and people building endurance', '10 km', 2),
  r('21K', '21K Half Marathon', 'Take on the half-marathon challenge', 'Experienced, prepared runners', '21.1 km', 3),
  r('KID', 'Kids Run', 'Little legs, big finish', 'Children, registered by a parent or guardian', null, 4, true)
];

const FALLBACK_FAQS: FaqRow[] = [
  ['Can beginners take part?', 'Yes. The 5K is designed for first-time and recreational runners, and you can walk-run at your own pace.'],
  ['What is the difference between the 5K, 10K and 21K?', 'The 5K is a welcoming entry point for beginners. The 10K suits regular runners building endurance. The 21K is a half marathon for experienced runners who have trained for the distance.'],
  ['Can my children take part?', 'Yes — the Kids Run is designed for young athletes. Distance, age groups and guardian consent requirements will be announced with registration.'],
  ['Can I cancel or transfer my entry?', 'Please see the cancellation, transfer and refund policy, which will be published before registrations open.']
].map(([question, answer], i) => ({ id: `f${i}`, question, answer, sort: i, published: true }));

export interface EventBundle {
  event: EventRow;
  races: RaceRow[];
  faqs: FaqRow[];
  announcements: AnnouncementRow[];
  live: boolean; // false = showing fallback content
}

export async function getEventBundle(slug = site.flagshipSlug): Promise<EventBundle | null> {
  if (!isDatabaseConfigured()) {
    return { event: FALLBACK_EVENT, races: FALLBACK_RACES, faqs: FALLBACK_FAQS, announcements: [], live: false };
  }
  try {
    const { data: event } = await db().from('events').select('*').eq('slug', slug).eq('published', true).maybeSingle();
    if (!event) return null;
    const [races, faqs, ann] = await Promise.all([
      db().from('races').select('*').eq('event_id', event.id).order('sort'),
      db().from('faqs').select('*').eq('event_id', event.id).eq('published', true).order('sort'),
      db().from('announcements').select('*').eq('event_id', event.id).eq('published', true).order('created_at', { ascending: false }).limit(5)
    ]);
    return {
      event: event as EventRow,
      races: (races.data ?? []) as RaceRow[],
      faqs: (faqs.data ?? []) as FaqRow[],
      announcements: (ann.data ?? []) as AnnouncementRow[],
      live: true
    };
  } catch (e) {
    console.error('getEventBundle failed', e);
    return { event: FALLBACK_EVENT, races: FALLBACK_RACES, faqs: FALLBACK_FAQS, announcements: [], live: false };
  }
}

export async function getSponsors(): Promise<SponsorRow[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const { data } = await db().from('sponsors').select('*').eq('published', true).order('sort');
    return (data ?? []) as SponsorRow[];
  } catch {
    return [];
  }
}

/** Places left per race (paid + unexpired pending holds count as taken). */
export async function getPlacesLeft(raceIds: string[]): Promise<Record<string, number | null>> {
  const out: Record<string, number | null> = {};
  if (!isDatabaseConfigured() || raceIds.length === 0) return out;
  try {
    const { data: races } = await db().from('races').select('id, capacity').in('id', raceIds);
    for (const race of races ?? []) {
      if (race.capacity === null) { out[race.id] = null; continue; }
      const { count } = await db()
        .from('registrations')
        .select('id', { count: 'exact', head: true })
        .eq('race_id', race.id)
        .or(`status.eq.paid,and(status.eq.pending,expires_at.gt.${new Date().toISOString()})`);
      out[race.id] = Math.max(0, race.capacity - (count ?? 0));
    }
  } catch (e) {
    console.error('getPlacesLeft failed', e);
  }
  return out;
}

export function isRaceBookable(race: RaceRow) {
  return race.status === 'open' && race.fee_paise !== null && race.capacity !== null;
}
