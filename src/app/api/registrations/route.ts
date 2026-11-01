import { NextResponse } from 'next/server';
import { db, isDatabaseConfigured } from '@/lib/supabase/admin';
import { isPaymentsConfigured, razorpay } from '@/lib/razorpay';
import { fieldErrors, KIDS_TSHIRT_SIZES, registrationSchema, TSHIRT_SIZES } from '@/lib/validation';
import { friendlyDbError, sendConfirmation } from '@/lib/registrations';
import { ageOn } from '@/lib/format';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Registrations are not available yet.' }, { status: 503 });
  }
  const body = await req.json().catch(() => null);
  const parsed = registrationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Please check the highlighted fields.', fields: fieldErrors(parsed.error) }, { status: 400 });
  }
  const input = parsed.data;
  if (input.website) return NextResponse.json({ error: 'Something went wrong.' }, { status: 400 });

  const { data: race } = await db().from('races').select('*, events(*)').eq('id', input.race_id).maybeSingle();
  if (!race) return NextResponse.json({ error: 'Please choose a race.' }, { status: 400 });

  // Race-specific checks
  const fields: Record<string, string> = {};
  if (race.is_kids) {
    if (!input.guardian_name) fields.guardian_name = 'Parent / guardian name is required';
    if (!input.guardian_relation) fields.guardian_relation = 'Please choose your relationship to the child';
    if (!input.guardian_consent) fields.guardian_consent = 'A parent or guardian must give permission';
    if (!(KIDS_TSHIRT_SIZES as readonly string[]).includes(input.tshirt_size)) fields.tshirt_size = 'Choose a kids T-shirt size';
  } else if (!(TSHIRT_SIZES as readonly string[]).includes(input.tshirt_size)) {
    fields.tshirt_size = 'Choose a T-shirt size';
  }
  const raceDay = race.events?.event_date ? new Date(race.events.event_date + 'T06:00:00+05:30') : new Date();
  const age = ageOn(input.dob, raceDay);
  if (age < 0 || age > 100) fields.dob = 'Please check the date of birth';
  else if (race.min_age !== null && age < race.min_age) fields.dob = `Participants must be at least ${race.min_age} on race day`;
  else if (race.max_age !== null && age > race.max_age) fields.dob = `This race is for ages up to ${race.max_age}`;
  if (Object.keys(fields).length) {
    return NextResponse.json({ error: 'Please check the highlighted fields.', fields }, { status: 400 });
  }

  if (race.fee_paise && race.fee_paise > 0 && !isPaymentsConfigured()) {
    return NextResponse.json({ error: 'Online payment is not available yet. Please try again later.' }, { status: 503 });
  }

  // Reserve the place (checks capacity, status, duplicates inside the database)
  const { website: _honeypot, ...payload } = input;
  const { data, error } = await db().rpc('create_registration', { p: payload });
  if (error) {
    const msg = friendlyDbError(error.message);
    if (!msg) console.error('create_registration failed', error);
    return NextResponse.json({ error: msg ?? 'We could not save your registration. Please try again.' }, { status: msg ? 409 : 500 });
  }
  const created = (data as { reg_id: string; amount: number; reg_status: string }[])[0];

  if (created.reg_status === 'paid') {
    await sendConfirmation(created.reg_id);
    const { data: reg } = await db().from('registrations').select('reg_code').eq('id', created.reg_id).single();
    return NextResponse.json({ status: 'paid', regCode: reg?.reg_code });
  }

  try {
    const order = await razorpay().orders.create({
      amount: created.amount,
      currency: 'INR',
      receipt: created.reg_id.slice(0, 40),
      notes: { registration_id: created.reg_id, race: race.name, event: race.events?.name ?? '' }
    });
    await db().from('registrations').update({ razorpay_order_id: order.id }).eq('id', created.reg_id);
    return NextResponse.json({
      status: 'pending',
      orderId: order.id,
      amount: created.amount,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      description: `${race.events?.name ?? 'Registration'} — ${race.name}`,
      prefill: { name: race.is_kids ? input.guardian_name : input.full_name, email: input.email, contact: input.mobile }
    });
  } catch (e) {
    console.error('Razorpay order failed', e);
    await db().from('registrations').update({ status: 'failed', failure_reason: 'order_create_failed' }).eq('id', created.reg_id);
    return NextResponse.json({ error: 'We could not start the payment. Please try again in a moment.' }, { status: 502 });
  }
}
