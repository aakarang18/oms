import 'server-only';
import { Resend } from 'resend';
import { eventHref, site } from './config';
import { eventDate, inr, TBA } from './format';
import type { EventRow, RaceRow, RegistrationRow } from './types';

let resend: Resend | null = null;

function client() {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

export async function sendEmail(opts: { to: string | string[]; subject: string; html: string; text: string; replyTo?: string }) {
  const c = client();
  const from = process.env.EMAIL_FROM;
  if (!c || !from) {
    console.warn(`[email skipped — RESEND_API_KEY/EMAIL_FROM not set] ${opts.subject}`);
    return false;
  }
  const { error } = await c.emails.send({ from, to: opts.to, subject: opts.subject, html: opts.html, text: opts.text, replyTo: opts.replyTo });
  if (error) {
    console.error('Email failed', error);
    return false;
  }
  return true;
}

const esc = (s: string | null | undefined) =>
  (s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function row(k: string, v: string) {
  return `<tr><td style="padding:10px 16px;border-bottom:1px solid #EEF2EC;color:#4D5A52;font-size:14px">${esc(k)}</td><td style="padding:10px 16px;border-bottom:1px solid #EEF2EC;font-weight:700;font-size:14px;text-align:right">${esc(v)}</td></tr>`;
}

export function confirmationEmail(reg: RegistrationRow, race: RaceRow, event: EventRow) {
  const date = eventDate(event.event_date) ?? TBA;
  const start = event.start_point ?? `${TBA}, Bareilly`;
  const kids = race.is_kids;
  const greeting = kids ? (reg.guardian_name?.split(' ')[0] ?? 'there') : reg.full_name.split(' ')[0];
  const eventUrl = eventHref('/', event.slug);
  const rows = [
    row('Race', race.name),
    row(kids ? 'Child’s name' : 'Participant', reg.full_name),
    kids && reg.guardian_name ? row('Parent / guardian', reg.guardian_name) : row('Mobile', reg.mobile),
    row('T-shirt size', reg.tshirt_size),
    row('Emergency contact', `${reg.emergency_name} · ${reg.emergency_mobile}`),
    row('Race date', date),
    row('Start point', start),
    row('Amount paid', `${inr(reg.amount_paise) ?? '₹0'}${reg.razorpay_payment_id ? ' · Ref ' + reg.razorpay_payment_id : ''}`)
  ].join('');
  const intro = kids
    ? `Your child is registered for the ${esc(event.name)} Kids Run. Thank you for bringing a young athlete to the start line — please stay with them at the event.`
    : `Your place in the ${esc(event.name)} ${esc(race.name)} is confirmed and your payment has been received. Here are your details.`;
  const help = site.whatsapp ? `Reply to this email or WhatsApp us on <b>${esc(site.whatsapp)}</b>` : 'Reply to this email';

  const html = `<!doctype html><html><body style="margin:0;background:#F4F6F0;font-family:Arial,Helvetica,sans-serif;color:#1B1B1F">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F0;padding:24px 0"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:8px;overflow:hidden">
<tr><td style="padding:24px 28px 0"><div style="font-size:12px;font-weight:700;letter-spacing:4px;color:#1E5B49">CASA</div><div style="font-size:30px;font-weight:800;color:#1E5B49;line-height:1;border-bottom:4px solid #E85A3C;display:inline-block;padding-bottom:2px">atleta</div></td></tr>
<tr><td style="padding:22px 28px 0"><div style="font-size:30px;font-weight:800;color:#1E5B49;text-transform:uppercase;line-height:1.05">You’re in, ${esc(greeting)}!</div>
<p style="font-size:16px;line-height:1.6;margin:12px 0 0">${intro}</p></td></tr>
<tr><td style="padding:20px 28px 0"><div style="background:#F4F6F0;border-radius:12px;padding:18px 20px">
<div style="font-size:12px;font-weight:700;letter-spacing:1px;color:#4D5A52;text-transform:uppercase">Registration ID</div>
<div style="font-family:Menlo,Consolas,monospace;font-size:24px;font-weight:700;margin-top:4px">${esc(reg.reg_code)}</div>
<div style="font-size:12px;color:#4D5A52;margin-top:4px">Keep this handy for bib collection and any questions.</div></div></td></tr>
<tr><td style="padding:16px 28px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E2EBDD;border-radius:12px">${rows}</table></td></tr>
<tr><td style="padding:20px 28px 0"><div style="background:#1E5B49;color:#FFFFFF;border-radius:12px;padding:18px 20px;font-size:14px;line-height:1.6"><b style="font-size:16px">Bib collection</b><br>${esc(event.bib_collection ?? 'Dates, venue and the ID you need will be emailed to you and posted on the event page.')}</div></td></tr>
<tr><td style="padding:20px 28px 0;font-size:14px;line-height:1.6"><b style="font-size:16px">What happens next</b><br>1. We’ll share the race date, start point and route maps on the event page and by email.<br>2. Collect your bib and race kit before race day.<br>3. ${kids ? 'On race day, arrive at the reporting time with your child and stay near the kids’ start and finish area.' : 'Arrive at the start area by the reporting time on race day.'}</td></tr>
<tr><td style="padding:22px 28px 0"><a href="${eventUrl}" style="display:inline-block;background:#1E5B49;color:#FFFFFF;padding:13px 22px;border-radius:999px;font-weight:700;text-decoration:none">View event details</a></td></tr>
<tr><td style="padding:22px 28px 0"><div style="background:#FDF1CC;border-radius:10px;padding:14px 16px;font-size:14px;line-height:1.5">Spotted a mistake in your details? ${help} with your registration ID.</div></td></tr>
<tr><td style="padding:22px 28px;font-size:14px">See you at the starting line,<br><b>Team Casa Atleta</b></td></tr>
<tr><td style="background:#E2EBDD;padding:18px 28px;font-size:12px;line-height:1.6;color:#4D5A52">You’re receiving this because you registered for ${esc(event.name)}. This is a service email about your registration.<br>Casa Atleta · ${esc(site.city)}</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    `You're in, ${greeting}!`,
    '',
    kids ? `Your child is registered for the ${event.name} Kids Run.` : `Your place in the ${event.name} ${race.name} is confirmed.`,
    '',
    `Registration ID: ${reg.reg_code}`,
    `Race: ${race.name}`,
    `${kids ? "Child's name" : 'Participant'}: ${reg.full_name}`,
    `T-shirt: ${reg.tshirt_size}`,
    `Race date: ${date}`,
    `Start point: ${start}`,
    `Amount paid: ${inr(reg.amount_paise) ?? '₹0'}`,
    '',
    `Event details: ${eventUrl}`,
    'Spotted a mistake? Reply to this email with your registration ID.',
    '',
    'Team Casa Atleta'
  ].join('\n');

  return { subject: `You’re in! ${race.name} · ${event.name} (${reg.reg_code})`, html, text };
}

export function simpleNotification(title: string, fields: Record<string, string | null | undefined>) {
  const lines = Object.entries(fields).filter(([, v]) => v);
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px"><h2 style="color:#1E5B49">${esc(title)}</h2><table cellpadding="6">${lines
    .map(([k, v]) => `<tr><td style="color:#4D5A52;vertical-align:top">${esc(k)}</td><td style="white-space:pre-wrap">${esc(v)}</td></tr>`)
    .join('')}</table></div>`;
  const text = `${title}\n\n${lines.map(([k, v]) => `${k}: ${v}`).join('\n')}`;
  return { html, text };
}
