import { NextResponse } from 'next/server';
import { db, isDatabaseConfigured } from '@/lib/supabase/admin';
import { contactSchema, fieldErrors } from '@/lib/validation';
import { sendEmail, simpleNotification } from '@/lib/email';

export async function POST(req: Request) {
  const parsed = contactSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Please check the highlighted fields.', fields: fieldErrors(parsed.error) }, { status: 400 });
  const d = parsed.data;
  if (d.website) return NextResponse.json({ ok: true });
  if (!isDatabaseConfigured()) return NextResponse.json({ error: 'The contact form is not available yet. Please email us instead.' }, { status: 503 });

  const { error } = await db().from('contact_messages').insert({
    topic: d.topic, name: d.name, email: d.email, mobile: d.mobile || null, reg_code: d.reg_code || null, message: d.message
  });
  if (error) {
    console.error('contact insert failed', error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
  if (process.env.ORGANISER_EMAIL) {
    const n = simpleNotification(`New message: ${d.topic}`, { Name: d.name, Email: d.email, Mobile: d.mobile, 'Registration ID': d.reg_code, Message: d.message });
    await sendEmail({ to: process.env.ORGANISER_EMAIL, subject: `[Website] ${d.topic} — ${d.name}`, html: n.html, text: n.text, replyTo: d.email });
  }
  return NextResponse.json({ ok: true });
}
