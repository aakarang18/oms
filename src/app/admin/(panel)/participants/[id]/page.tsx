import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/supabase/admin';
import { dateTime, inr } from '@/lib/format';
import { cancelRegistration, resendConfirmation, updateRegistration } from '../../actions';

export default async function Participant({ params, searchParams }: { params: { id: string }; searchParams: { saved?: string; resent?: string } }) {
  await requireAdmin('admin');
  const { data: r } = await db().from('registrations').select('*, races(name)').eq('id', params.id).maybeSingle();
  if (!r) notFound();

  const field = (name: string, label: string, value: string | null) => (
    <div className="field"><label htmlFor={name}>{label}</label><input id={name} name={name} className="input" defaultValue={value ?? ''} /></div>
  );
  const info: [string, string | null][] = [
    ['Registration ID', r.reg_code], ['Race', r.races?.name], ['Status', r.status], ['Amount', inr(r.amount_paise)],
    ['Payment ID', r.razorpay_payment_id], ['Payment method', r.payment_method], ['Order ID', r.razorpay_order_id], ['Failure reason', r.failure_reason],
    ['Paid at', dateTime(r.paid_at)], ['Registered at', dateTime(r.created_at)], ['Confirmation email', r.confirmation_sent_at ? `Sent ${dateTime(r.confirmation_sent_at)}` : 'Not sent'],
    ['Date of birth', r.dob], ['Gender', r.gender], ['Running club', r.running_club], ['Guardian', r.guardian_name ? `${r.guardian_name} (${r.guardian_relation})` : null],
    ['Medical info', r.medical_info], ['Consents', [r.accepted_terms && 'terms', r.accepted_waiver && 'waiver', r.accepted_privacy && 'privacy', r.guardian_consent && 'guardian', r.photo_consent && 'photo', r.whatsapp_opt_in && 'WhatsApp'].filter(Boolean).join(', ')]
  ];

  return (
    <div className="stack" style={{ gap: 14, maxWidth: 980 }}>
      <Link href="/admin/participants">← All participants</Link>
      <h1 style={{ margin: 0, fontSize: 26 }}>{r.full_name}</h1>
      {searchParams.saved && <div className="alert alert-info">Saved.</div>}
      {searchParams.resent && <div className="alert alert-info">Confirmation email re-sent (if email is configured).</div>}
      <div className="grid g2" style={{ alignItems: 'start' }}>
        <div className="card" style={{ padding: 20, borderRadius: 18 }}>
          {info.filter(([, v]) => v).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--line)', fontSize: 14 }}><span className="muted">{k}</span><b style={{ textAlign: 'right', wordBreak: 'break-word' }}>{v}</b></div>
          ))}
        </div>
        <form action={updateRegistration} className="card stack" style={{ padding: 20, borderRadius: 18, gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Correct details</h2>
          <input type="hidden" name="id" value={r.id} />
          {field('full_name', 'Full name', r.full_name)}
          {field('email', 'Email', r.email)}
          {field('mobile', 'Mobile', r.mobile)}
          {field('city', 'City', r.city)}
          {field('tshirt_size', 'T-shirt size', r.tshirt_size)}
          {field('emergency_name', 'Emergency contact', r.emergency_name)}
          {field('emergency_mobile', 'Emergency mobile', r.emergency_mobile)}
          <div className="field"><label htmlFor="admin_notes">Internal notes</label><textarea id="admin_notes" name="admin_notes" className="input" defaultValue={r.admin_notes ?? ''} /></div>
          <button className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }}>Save changes</button>
        </form>
      </div>
      <div className="card" style={{ padding: 20, borderRadius: 18, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {r.status === 'paid' && (
          <form action={resendConfirmation}><input type="hidden" name="id" value={r.id} /><button className="btn btn-outline btn-sm">Resend confirmation email</button></form>
        )}
        {r.status !== 'cancelled' && (
          <form action={cancelRegistration} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <input type="hidden" name="id" value={r.id} />
            <div className="field"><label htmlFor="reason">Cancel registration — reason</label><input id="reason" name="reason" className="input" style={{ minHeight: 44 }} /></div>
            <button className="btn btn-sm" style={{ background: '#FDE2DC', color: '#9B2C14' }}>Cancel registration</button>
          </form>
        )}
        <p className="muted" style={{ fontSize: 13, margin: 0, flexBasis: '100%' }}>Payments can only be marked paid by Razorpay. Refunds are issued from the Razorpay dashboard.</p>
      </div>
    </div>
  );
}
