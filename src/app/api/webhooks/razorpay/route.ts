import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase/admin';
import { verifyWebhookSignature } from '@/lib/razorpay';
import { finalisePaidOrder } from '@/lib/registrations';

export const dynamic = 'force-dynamic';

/*
 * Razorpay calls this URL when a payment succeeds or fails — even if the
 * runner closed their browser. Set it up in Razorpay → Webhooks with events:
 * payment.captured, payment.failed, order.paid.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyWebhookSignature(raw, req.headers.get('x-razorpay-signature'))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }
  const body = JSON.parse(raw);
  const eventId = req.headers.get('x-razorpay-event-id') ?? `${body.event}:${body.payload?.payment?.entity?.id ?? body.created_at}`;

  // Ignore repeats (Razorpay may send the same event more than once)
  const { error: dupe } = await db().from('payment_events').insert({ id: eventId, event_type: body.event, payload: body });
  if (dupe) return NextResponse.json({ ok: true, duplicate: true });

  const payment = body.payload?.payment?.entity;
  try {
    if ((body.event === 'payment.captured' || body.event === 'order.paid') && payment?.order_id) {
      await finalisePaidOrder(payment.order_id, payment.id, String(payment.method ?? 'online'));
    } else if (body.event === 'payment.failed' && payment?.order_id) {
      await db().rpc('mark_registration_failed', {
        p_order_id: payment.order_id,
        p_payment_id: payment.id,
        p_reason: payment.error_description ?? 'failed'
      });
    }
  } catch (e) {
    console.error('Webhook handling failed', e);
    // Remove the idempotency record so Razorpay's retry can be processed.
    await db().from('payment_events').delete().eq('id', eventId);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
