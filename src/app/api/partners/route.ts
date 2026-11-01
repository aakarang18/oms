import { NextResponse } from 'next/server';
import { db, isDatabaseConfigured } from '@/lib/supabase/admin';
import { fieldErrors, partnerSchema } from '@/lib/validation';
import { sendEmail, simpleNotification } from '@/lib/email';

export async function POST(req: Request) {
  const parsed = partnerSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Please check the highlighted fields.', fields: fieldErrors(parsed.error) }, { status: 400 });
  const d = parsed.data;
  if (d.website) return NextResponse.json({ ok: true });
  if (!isDatabaseConfigured()) return NextResponse.json({ error: 'The enquiry form is not available yet. Please email us instead.' }, { status: 503 });

  const { error } = await db().from('partner_enquiries').insert({
    org_type: d.org_type, org_name: d.org_name, contact_name: d.contact_name, email: d.email,
    mobile: d.mobile || null, interests: d.interests, message: d.message || null
  });
  if (error) {
    console.error('partner insert failed', error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
  if (process.env.ORGANISER_EMAIL) {
    const n = simpleNotification('New partnership enquiry', {
      Organisation: `${d.org_name} (${d.org_type})`, Contact: d.contact_name, Email: d.email, Mobile: d.mobile,
      Interests: d.interests.join(', '), Message: d.message
    });
    await sendEmail({ to: process.env.ORGANISER_EMAIL, subject: `[Partnership] ${d.org_name}`, html: n.html, text: n.text, replyTo: d.email });
  }
  return NextResponse.json({ ok: true });
}
