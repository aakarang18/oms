import { NextResponse } from 'next/server';
import { audit, getAdmin } from '@/lib/auth';
import { db } from '@/lib/supabase/admin';
import { participantsQuery, toCsv } from '@/lib/participants';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const user = await getAdmin();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const p = new URL(req.url).searchParams;
  const type = p.get('type') ?? 'participants';
  if (type === 'participants' && user.role !== 'admin') return NextResponse.json({ error: 'Admins only' }, { status: 403 });

  let csv = '';
  const stamp = new Date().toISOString().slice(0, 10);
  if (type === 'participants') {
    const { data, error } = await participantsQuery({ q: p.get('q') ?? '', race: p.get('race') ?? '', status: p.get('status') ?? '', from: p.get('from') ?? '', to: p.get('to') ?? '' }).limit(20000);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const rows = (data as unknown as Record<string, unknown>[]).map((r) => ({
      ...r,
      race: (r.races as { name?: string } | null)?.name,
      amount_rupees: Number(r.amount_paise ?? 0) / 100
    }));
    csv = toCsv(rows, [
      ['reg_code', 'Registration ID'], ['race', 'Race'], ['status', 'Payment status'], ['full_name', 'Full name'], ['dob', 'Date of birth'],
      ['gender', 'Gender'], ['email', 'Email'], ['mobile', 'Mobile'], ['city', 'City'], ['tshirt_size', 'T-shirt'], ['running_club', 'Running club'],
      ['emergency_name', 'Emergency contact'], ['emergency_mobile', 'Emergency mobile'], ['guardian_name', 'Guardian'], ['guardian_relation', 'Guardian relation'],
      ['medical_info', 'Medical info'], ['photo_consent', 'Photo consent'], ['whatsapp_opt_in', 'WhatsApp opt-in'], ['amount_rupees', 'Amount (₹)'],
      ['payment_method', 'Payment method'], ['razorpay_payment_id', 'Payment ID'], ['paid_at', 'Paid at'], ['created_at', 'Registered at']
    ]);
    await audit(user, 'Exported participants', { filters: Object.fromEntries(p.entries()), rows: rows.length });
  } else if (type === 'newsletter') {
    const { data } = await db().from('newsletter_subscribers').select('*').order('created_at', { ascending: false });
    csv = toCsv((data ?? []) as Record<string, unknown>[], [['email', 'Email'], ['source', 'Source'], ['created_at', 'Signed up']]);
  } else if (type === 'contact') {
    const { data } = await db().from('contact_messages').select('*').order('created_at', { ascending: false });
    csv = toCsv((data ?? []) as Record<string, unknown>[], [['created_at', 'Date'], ['topic', 'Topic'], ['name', 'Name'], ['email', 'Email'], ['mobile', 'Mobile'], ['reg_code', 'Registration ID'], ['message', 'Message'], ['handled', 'Handled']]);
  } else if (type === 'partners') {
    const { data } = await db().from('partner_enquiries').select('*').order('created_at', { ascending: false });
    csv = toCsv(((data ?? []) as Record<string, unknown>[]).map((r) => ({ ...r, interests: (r.interests as string[] | null)?.join('; ') })), [['created_at', 'Date'], ['org_type', 'Type'], ['org_name', 'Organisation'], ['contact_name', 'Contact'], ['email', 'Email'], ['mobile', 'Mobile'], ['interests', 'Interests'], ['message', 'Message'], ['handled', 'Handled']]);
  } else {
    return NextResponse.json({ error: 'Unknown export' }, { status: 400 });
  }

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="casa-atleta-${type}-${stamp}.csv"`,
      'Cache-Control': 'no-store'
    }
  });
}
