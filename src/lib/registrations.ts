import 'server-only';
import { db } from './supabase/admin';
import { confirmationEmail, sendEmail } from './email';
import type { EventRow, RaceRow, RegistrationRow } from './types';

/**
 * Marks an order as paid (only after the payment was verified with Razorpay)
 * and sends the confirmation email once. Safe to call from both the browser
 * callback and the webhook — whichever arrives first wins.
 */
export async function finalisePaidOrder(orderId: string, paymentId: string, method: string) {
  const { data, error } = await db().rpc('mark_registration_paid', {
    p_order_id: orderId,
    p_payment_id: paymentId,
    p_method: method
  });
  if (error) throw error;
  const result = (data as { reg_id: string; newly_paid: boolean }[])[0];
  if (result?.newly_paid) await sendConfirmation(result.reg_id);
  return result?.reg_id as string;
}

export async function sendConfirmation(regId: string) {
  const { data: reg } = await db().from('registrations').select('*').eq('id', regId).single();
  if (!reg || reg.status !== 'paid' || reg.confirmation_sent_at) return;
  const [{ data: race }, { data: event }] = await Promise.all([
    db().from('races').select('*').eq('id', reg.race_id).single(),
    db().from('events').select('*').eq('id', reg.event_id).single()
  ]);
  if (!race || !event) return;
  const mail = confirmationEmail(reg as RegistrationRow, race as RaceRow, event as EventRow);
  const sent = await sendEmail({ to: reg.email, subject: mail.subject, html: mail.html, text: mail.text, replyTo: process.env.ORGANISER_EMAIL });
  if (sent) await db().from('registrations').update({ confirmation_sent_at: new Date().toISOString() }).eq('id', regId);
}

export const DB_ERRORS: Record<string, string> = {
  RACE_NOT_FOUND: 'That race could not be found. Please refresh and try again.',
  RACE_NOT_OPEN: 'Registrations for this race are not open right now.',
  REGISTRATION_CLOSED: 'Registrations for this event have closed.',
  FEE_NOT_SET: 'Registrations for this race are not open yet.',
  CAPACITY_NOT_SET: 'Registrations for this race are not open yet.',
  RACE_FULL: 'Sorry — this race is full. Please choose another race or contact us about the waitlist.',
  DUPLICATE: 'It looks like this person is already registered for this race. Check your email for the confirmation, or contact us.'
};

export function friendlyDbError(message: string | undefined) {
  if (!message) return null;
  const key = Object.keys(DB_ERRORS).find((k) => message.includes(k));
  return key ? DB_ERRORS[key] : null;
}
