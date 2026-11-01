'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { audit, authClient, requireAdmin } from '@/lib/auth';
import { db } from '@/lib/supabase/admin';
import { sendConfirmation } from '@/lib/registrations';

const str = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? '').trim();
  return v === '' ? null : v;
};
const int = (f: FormData, k: string) => {
  const v = str(f, k);
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
};
const bool = (f: FormData, k: string) => f.get(k) === 'on';

function refreshPublic() {
  revalidatePath('/', 'layout');
}

export async function signOut() {
  await authClient().auth.signOut();
  redirect('/admin/login');
}

// ---------- Races (admin only) ----------
export async function updateRace(f: FormData) {
  const user = await requireAdmin('admin');
  const id = String(f.get('id'));
  const fee = str(f, 'fee_rupees');
  const patch = {
    fee_paise: fee === null ? null : Math.round(Number(fee) * 100),
    capacity: int(f, 'capacity'),
    status: String(f.get('status')),
    flag_off: str(f, 'flag_off'),
    cut_off: str(f, 'cut_off'),
    min_age: int(f, 'min_age'),
    max_age: int(f, 'max_age'),
    start_finish: str(f, 'start_finish'),
    elevation: str(f, 'elevation'),
    route_map_url: str(f, 'route_map_url'),
    positioning: str(f, 'positioning'),
    audience: str(f, 'audience')
  };
  if (patch.status === 'open' && (patch.fee_paise === null || patch.capacity === null)) {
    redirect(`/admin/races?error=${encodeURIComponent('Set both the entry fee and the capacity before opening a race.')}`);
  }
  const { data: before } = await db().from('races').select('name, fee_paise, capacity, status').eq('id', id).single();
  const { error } = await db().from('races').update(patch).eq('id', id);
  if (error) redirect(`/admin/races?error=${encodeURIComponent(error.message)}`);
  await audit(user, `Updated race ${before?.name}`, { before, after: { fee_paise: patch.fee_paise, capacity: patch.capacity, status: patch.status } });
  refreshPublic();
  redirect('/admin/races?saved=1');
}

// ---------- Event details ----------
export async function updateEvent(f: FormData) {
  const user = await requireAdmin();
  const id = String(f.get('id'));
  const keys = ['name', 'tagline', 'description', 'event_date', 'venue', 'start_point', 'reporting_time', 'bib_collection', 'hydration', 'medical', 'guidelines', 'parking', 'baggage', 'race_kit', 'awards'];
  const patch: Record<string, string | null> = {};
  for (const k of keys) patch[k] = str(f, k);
  const closes = str(f, 'registration_closes_at');
  const update = { ...patch, name: patch.name ?? 'Untitled event', registration_closes_at: closes ? new Date(closes + '+05:30').toISOString() : null };
  const { error } = await db().from('events').update(update).eq('id', id);
  if (error) redirect(`/admin/event?error=${encodeURIComponent(error.message)}`);
  await audit(user, 'Updated event details', { event_date: patch.event_date, start_point: patch.start_point });
  refreshPublic();
  redirect('/admin/event?saved=1');
}

// ---------- FAQs, announcements, sponsors ----------
export async function saveFaq(f: FormData) {
  const user = await requireAdmin();
  const id = str(f, 'id');
  const row = { question: str(f, 'question') ?? '', answer: str(f, 'answer') ?? '', sort: int(f, 'sort') ?? 0, published: bool(f, 'published'), event_id: str(f, 'event_id') };
  if (id) await db().from('faqs').update(row).eq('id', id);
  else await db().from('faqs').insert(row);
  await audit(user, id ? 'Edited FAQ' : 'Added FAQ', { question: row.question });
  refreshPublic();
  redirect('/admin/content?saved=1#faqs');
}

export async function deleteFaq(f: FormData) {
  const user = await requireAdmin();
  const id = String(f.get('id'));
  await db().from('faqs').delete().eq('id', id);
  await audit(user, 'Deleted FAQ', { id });
  refreshPublic();
  redirect('/admin/content?saved=1#faqs');
}

export async function saveAnnouncement(f: FormData) {
  const user = await requireAdmin();
  const id = str(f, 'id');
  const row = { title: str(f, 'title') ?? '', body: str(f, 'body'), published: bool(f, 'published'), event_id: str(f, 'event_id') };
  if (id) await db().from('announcements').update(row).eq('id', id);
  else await db().from('announcements').insert(row);
  await audit(user, id ? 'Edited announcement' : 'Posted announcement', { title: row.title });
  refreshPublic();
  redirect('/admin/content?saved=1#updates');
}

export async function deleteAnnouncement(f: FormData) {
  const user = await requireAdmin();
  await db().from('announcements').delete().eq('id', String(f.get('id')));
  await audit(user, 'Deleted announcement');
  refreshPublic();
  redirect('/admin/content?saved=1#updates');
}

export async function saveSponsor(f: FormData) {
  const user = await requireAdmin();
  const id = str(f, 'id');
  const row = { name: str(f, 'name') ?? '', logo_url: str(f, 'logo_url'), website_url: str(f, 'website_url'), tier: str(f, 'tier') ?? 'partner', sort: int(f, 'sort') ?? 0, published: bool(f, 'published') };
  if (id) await db().from('sponsors').update(row).eq('id', id);
  else await db().from('sponsors').insert(row);
  await audit(user, id ? 'Edited sponsor' : 'Added sponsor', { name: row.name });
  refreshPublic();
  redirect('/admin/content?saved=1#sponsors');
}

export async function deleteSponsor(f: FormData) {
  const user = await requireAdmin();
  await db().from('sponsors').delete().eq('id', String(f.get('id')));
  await audit(user, 'Deleted sponsor');
  refreshPublic();
  redirect('/admin/content?saved=1#sponsors');
}

// ---------- Registrations (admin only) ----------
export async function updateRegistration(f: FormData) {
  const user = await requireAdmin('admin');
  const id = String(f.get('id'));
  const patch = {
    full_name: str(f, 'full_name') ?? undefined,
    email: str(f, 'email')?.toLowerCase() ?? undefined,
    mobile: str(f, 'mobile') ?? undefined,
    city: str(f, 'city') ?? undefined,
    tshirt_size: str(f, 'tshirt_size') ?? undefined,
    emergency_name: str(f, 'emergency_name') ?? undefined,
    emergency_mobile: str(f, 'emergency_mobile') ?? undefined,
    admin_notes: str(f, 'admin_notes')
  };
  const { data: before } = await db().from('registrations').select('reg_code, full_name, email, mobile, city, tshirt_size').eq('id', id).single();
  await db().from('registrations').update(patch).eq('id', id);
  await audit(user, `Edited registration ${before?.reg_code ?? id}`, { before, after: patch });
  redirect(`/admin/participants/${id}?saved=1`);
}

export async function cancelRegistration(f: FormData) {
  const user = await requireAdmin('admin');
  const id = String(f.get('id'));
  const reason = str(f, 'reason');
  const { data: reg } = await db().from('registrations').select('reg_code, status').eq('id', id).single();
  await db().from('registrations').update({ status: 'cancelled', admin_notes: reason ? `Cancelled: ${reason}` : 'Cancelled' }).eq('id', id);
  await audit(user, `Cancelled registration ${reg?.reg_code ?? id}`, { previous_status: reg?.status, reason });
  refreshPublic();
  redirect(`/admin/participants/${id}?saved=1`);
}

export async function resendConfirmation(f: FormData) {
  const user = await requireAdmin('admin');
  const id = String(f.get('id'));
  await db().from('registrations').update({ confirmation_sent_at: null }).eq('id', id);
  await sendConfirmation(id);
  await audit(user, 'Resent confirmation email', { id });
  redirect(`/admin/participants/${id}?resent=1`);
}

// ---------- Inbox ----------
export async function markHandled(f: FormData) {
  await requireAdmin();
  const table = f.get('table') === 'partner_enquiries' ? 'partner_enquiries' : 'contact_messages';
  await db().from(table).update({ handled: true }).eq('id', String(f.get('id')));
  revalidatePath('/admin/inbox');
}
