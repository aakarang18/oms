import { NextResponse } from 'next/server';
import { db, isDatabaseConfigured } from '@/lib/supabase/admin';
import { fieldErrors, newsletterSchema } from '@/lib/validation';

export async function POST(req: Request) {
  const parsed = newsletterSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Please check the form.', fields: fieldErrors(parsed.error) }, { status: 400 });
  if (!isDatabaseConfigured()) return NextResponse.json({ error: 'Sign-ups are not available yet.' }, { status: 503 });
  const { error } = await db()
    .from('newsletter_subscribers')
    .upsert({ email: parsed.data.email, consent: true, source: parsed.data.source }, { onConflict: 'email', ignoreDuplicates: true });
  if (error) {
    console.error('newsletter insert failed', error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
