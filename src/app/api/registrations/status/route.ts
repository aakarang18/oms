import { NextResponse } from 'next/server';
import { db, isDatabaseConfigured } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// Used by the "payment pending" screen to check if the bank has confirmed yet.
export async function GET(req: Request) {
  const order = new URL(req.url).searchParams.get('order');
  if (!order || !/^order_[A-Za-z0-9]+$/.test(order) || !isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const { data } = await db().from('registrations').select('status, reg_code').eq('razorpay_order_id', order).maybeSingle();
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ status: data.status, regCode: data.reg_code });
}
