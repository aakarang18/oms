import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/supabase/admin';
import { razorpay, verifyPaymentSignature } from '@/lib/razorpay';
import { finalisePaidOrder } from '@/lib/registrations';

export const dynamic = 'force-dynamic';

const schema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1)
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = parsed.data;

  if (!verifyPaymentSignature(orderId, paymentId, signature)) {
    return NextResponse.json({ error: 'Payment could not be verified.' }, { status: 400 });
  }

  // Double-check with Razorpay itself — never trust the browser alone.
  const payment = await razorpay().payments.fetch(paymentId);
  if (payment.order_id !== orderId) {
    return NextResponse.json({ error: 'Payment does not match this registration.' }, { status: 400 });
  }

  if (payment.status === 'captured') {
    await finalisePaidOrder(orderId, paymentId, String(payment.method ?? 'online'));
  } else if (payment.status === 'failed') {
    await db().rpc('mark_registration_failed', { p_order_id: orderId, p_payment_id: paymentId, p_reason: payment.error_description ?? 'failed' });
  }
  // "authorized" = bank approved but not yet captured; the webhook will confirm it.

  const { data: reg } = await db().from('registrations').select('status, reg_code').eq('razorpay_order_id', orderId).single();
  return NextResponse.json({ status: reg?.status ?? 'pending', regCode: reg?.reg_code ?? null });
}
