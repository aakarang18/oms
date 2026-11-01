'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { GENDERS, KIDS_TSHIRT_SIZES, TSHIRT_SIZES } from '@/lib/validation';
import { JhumkaMark } from './Brand';

export interface RaceOption {
  id: string;
  code: string;
  name: string;
  positioning: string;
  audience: string;
  isKids: boolean;
  feePaise: number | null;
  placesLeft: number | null;
  available: boolean;
  statusLabel: string;
}

type Data = Record<string, string | boolean>;
type Result = { kind: 'paid' | 'pending' | 'failed' | 'dismissed'; regCode?: string | null; orderId?: string };

const STEPS = ['Race', 'Details', 'Consent', 'Payment', 'Done'];
const DETAIL_FIELDS = ['full_name', 'dob', 'gender', 'email', 'mobile', 'city', 'tshirt_size', 'emergency_name', 'emergency_mobile', 'guardian_name', 'guardian_relation', 'medical_consent', 'running_club', 'medical_info'];
const CONSENT_FIELDS = ['accepted_terms', 'accepted_waiver', 'accepted_privacy', 'guardian_consent'];

const rupees = (p: number | null) => (p === null ? '—' : '₹' + (p / 100).toLocaleString('en-IN'));

declare global {
  interface Window { Razorpay?: new (opts: Record<string, unknown>) => { open: () => void; on: (e: string, cb: (r: unknown) => void) => void } }
}

function loadCheckout(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export function RegisterForm({ races, initialCode, eventName, eventDate, whatsapp }: { races: RaceOption[]; initialCode?: string; eventName: string; eventDate: string | null; whatsapp: string | null }) {
  const initial = races.find((r) => r.code === initialCode && r.available);
  const [step, setStep] = useState(initial ? 1 : 0);
  const [raceId, setRaceId] = useState<string | null>(initial?.id ?? null);
  const [data, setData] = useState<Data>({ tshirt_size: '', gender: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [order, setOrder] = useState<Record<string, unknown> | null>(null);

  const race = useMemo(() => races.find((r) => r.id === raceId) ?? null, [races, raceId]);
  const kids = !!race?.isKids;
  const sizes: readonly string[] = kids ? KIDS_TSHIRT_SIZES : TSHIRT_SIZES;

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [step]);
  useEffect(() => {
    if (data.tshirt_size && !sizes.includes(String(data.tshirt_size))) setData((d) => ({ ...d, tshirt_size: '' }));
  }, [kids]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const v = e.target instanceof HTMLInputElement && e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setData((d) => ({ ...d, [k]: v }));
    setErrors((er) => { const n = { ...er }; delete n[k]; return n; });
  };
  const val = (k: string) => String(data[k] ?? '');
  const err = (k: string) => (errors[k] ? <span className="err" id={`${k}-err`}>{errors[k]}</span> : null);
  const aria = (k: string) => ({ 'aria-invalid': errors[k] ? true : undefined, 'aria-describedby': errors[k] ? `${k}-err` : undefined });

  function checkDetails() {
    const e: Record<string, string> = {};
    const req = ['full_name', 'dob', 'gender', 'email', 'mobile', 'city', 'tshirt_size', 'emergency_name', 'emergency_mobile'];
    if (kids) req.push('guardian_name', 'guardian_relation');
    for (const k of req) if (!val(k).trim()) e[k] = 'This is required';
    if (val('email') && !/^\S+@\S+\.\S+$/.test(val('email'))) e.email = 'Enter a valid email address';
    for (const k of ['mobile', 'emergency_mobile']) if (val(k) && !/^(\+91)?[6-9]\d{9}$/.test(val(k).replace(/[\s-]/g, ''))) e[k] = 'Enter a valid 10-digit mobile number';
    if (val('medical_info').trim() && !data.medical_consent) e.medical_consent = 'Please consent, or leave the medical box empty';
    setErrors(e);
    return Object.keys(e).length === 0;
  }
  function checkConsent() {
    const e: Record<string, string> = {};
    for (const k of ['accepted_terms', 'accepted_waiver', 'accepted_privacy']) if (!data[k]) e[k] = 'Required';
    if (kids && !data.guardian_consent) e.guardian_consent = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function next() {
    setFormError('');
    if (step === 0 && !race) return;
    if (step === 1 && !checkDetails()) return setFormError('Please fix the highlighted fields.');
    if (step === 2 && !checkConsent()) return setFormError('Please accept the required items.');
    if (step === 3) return pay();
    setStep((s) => s + 1);
  }

  async function verify(resp: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) {
    setBusy(true);
    const res = await fetch('/api/payments/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(resp) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (json.status === 'paid') setResult({ kind: 'paid', regCode: json.regCode });
    else if (json.status === 'failed') setResult({ kind: 'failed', orderId: resp.razorpay_order_id });
    else setResult({ kind: 'pending', orderId: resp.razorpay_order_id });
    setStep(4);
  }

  async function openCheckout(o: Record<string, unknown>) {
    const ok = await loadCheckout();
    if (!ok || !window.Razorpay) { setFormError('The payment window could not load. Check your internet connection and try again.'); return; }
    const rzp = new window.Razorpay({
      key: o.keyId,
      amount: o.amount,
      currency: 'INR',
      name: 'Casa Atleta',
      description: o.description,
      order_id: o.orderId,
      prefill: o.prefill,
      theme: { color: '#1E5B49' },
      handler: (resp: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => verify(resp),
      modal: { ondismiss: () => { setResult({ kind: 'dismissed', orderId: String(o.orderId) }); setStep(4); } }
    });
    rzp.open();
  }

  async function pay() {
    if (!race) return;
    setBusy(true); setFormError('');
    if (order) { setBusy(false); return openCheckout(order); }
    const payload: Data = { ...data, race_id: race.id, mobile: val('mobile').replace(/[\s-]/g, ''), emergency_mobile: val('emergency_mobile').replace(/[\s-]/g, '') };
    for (const k of ['accepted_terms', 'accepted_waiver', 'accepted_privacy', 'guardian_consent', 'photo_consent', 'whatsapp_opt_in', 'medical_consent']) payload[k] = !!data[k];
    const res = await fetch('/api/registrations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setFormError(json.error ?? 'Something went wrong. Please try again.');
      if (json.fields) {
        setErrors(json.fields);
        const keys = Object.keys(json.fields);
        if (keys.some((k) => DETAIL_FIELDS.includes(k))) setStep(1);
        else if (keys.some((k) => CONSENT_FIELDS.includes(k))) setStep(2);
      }
      return;
    }
    if (json.status === 'paid') { setResult({ kind: 'paid', regCode: json.regCode }); setStep(4); return; }
    setOrder(json);
    openCheckout(json);
  }

  // Poll while the bank confirms a pending payment.
  useEffect(() => {
    if (result?.kind !== 'pending' || !result.orderId) return;
    let tries = 0;
    const t = setInterval(async () => {
      tries++;
      const res = await fetch(`/api/registrations/status?order=${result.orderId}`);
      const json = await res.json().catch(() => ({}));
      if (json.status === 'paid') { setResult({ kind: 'paid', regCode: json.regCode }); clearInterval(t); }
      else if (json.status === 'failed') { setResult({ kind: 'failed', orderId: result.orderId }); clearInterval(t); }
      if (tries > 24) clearInterval(t);
    }, 5000);
    return () => clearInterval(t);
  }, [result]);

  const title = ['Choose your race', 'Your details', 'Consent & declarations', 'Review & pay', 'Registration status'][step];

  return (
    <div>
      <h1 className="d forest" style={{ margin: '6px 0 22px', fontSize: 'clamp(36px,4.5vw,56px)', lineHeight: 0.95 }}>{title}</h1>
      <ol aria-label="Registration progress" style={{ listStyle: 'none', margin: '0 0 28px', padding: 0, display: 'flex', gap: 8 }}>
        {STEPS.map((l, i) => (
          <li key={l} aria-current={i === step ? 'step' : undefined} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ height: 6, borderRadius: 99, background: i < step ? 'var(--forest)' : i === step ? 'var(--coral)' : '#DCE5D7' }} />
            <span className="hide-m" style={{ fontSize: 12, fontWeight: 700, color: i <= step ? 'var(--ink)' : 'var(--muted)' }}>{i + 1}. {l}</span>
          </li>
        ))}
      </ol>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 24 }} className="reg-layout">
        <div className="card" style={{ padding: 'clamp(20px,3vw,36px)' }}>
          {step === 0 && (
            <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
              <legend style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>Which race are you running?</legend>
              <div className="grid g2" style={{ gap: 14 }}>
                {races.map((r) => {
                  const sel = r.id === raceId;
                  return (
                    <button key={r.id} type="button" disabled={!r.available} aria-pressed={sel} onClick={() => setRaceId(r.id)}
                      style={{ textAlign: 'left', cursor: r.available ? 'pointer' : 'not-allowed', borderRadius: 18, padding: 20, border: `2px solid ${sel ? 'var(--forest)' : 'var(--line)'}`, background: sel ? 'var(--mint)' : r.isKids ? '#FDF8E6' : '#fff', opacity: r.available ? 1 : 0.6, display: 'flex', flexDirection: 'column', gap: 6, color: 'var(--ink)' }}>
                      <span style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <span className="d forest" style={{ fontSize: 36, lineHeight: 0.95 }}>{r.name}</span>
                        <span style={{ width: 24, height: 24, borderRadius: 99, border: '2px solid var(--forest)', background: sel ? 'var(--forest)' : '#fff', flex: 'none' }} />
                      </span>
                      <span style={{ fontWeight: 700 }}>{r.positioning}</span>
                      <span className="muted" style={{ fontSize: 14 }}>{r.audience}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>
                        {rupees(r.feePaise)} · <span className="forest">{r.available ? (r.placesLeft !== null && r.placesLeft <= 50 ? `Only ${r.placesLeft} places left` : 'Places available') : r.statusLabel}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          {step === 1 && (
            <div>
              {kids && (
                <>
                  <div className="alert alert-info" style={{ marginBottom: 22 }}><b>Kids Run:</b> a parent or guardian must register on the child’s behalf and stay at the event.</div>
                  <h2 style={{ margin: '0 0 14px', fontSize: 20, fontWeight: 800 }}>Parent / guardian</h2>
                  <div className="grid g2" style={{ marginBottom: 28 }}>
                    <div className="field"><label htmlFor="guardian_name">Full name</label><input id="guardian_name" className="input" autoComplete="name" value={val('guardian_name')} onChange={set('guardian_name')} {...aria('guardian_name')} />{err('guardian_name')}</div>
                    <div className="field"><label htmlFor="guardian_relation">Relationship to child</label><select id="guardian_relation" className="input" value={val('guardian_relation')} onChange={set('guardian_relation')} {...aria('guardian_relation')}><option value="">Select…</option><option>Parent</option><option>Legal guardian</option></select>{err('guardian_relation')}</div>
                  </div>
                  <h2 style={{ margin: '0 0 14px', fontSize: 20, fontWeight: 800 }}>Child’s details</h2>
                </>
              )}
              <div className="grid g2">
                <div className="field" style={{ gridColumn: '1/-1' }}><label htmlFor="full_name">{kids ? 'Child’s full name (as on ID)' : 'Full name (as on ID)'}</label><input id="full_name" className="input" autoComplete={kids ? 'off' : 'name'} value={val('full_name')} onChange={set('full_name')} {...aria('full_name')} />{err('full_name')}</div>
                <div className="field"><label htmlFor="dob">Date of birth</label><input id="dob" type="date" className="input" value={val('dob')} onChange={set('dob')} max={new Date().toISOString().slice(0, 10)} {...aria('dob')} /><span className="hint">Used to check age eligibility.</span>{err('dob')}</div>
                <div className="field"><label htmlFor="gender">Gender</label><select id="gender" className="input" value={val('gender')} onChange={set('gender')} {...aria('gender')}><option value="">Select…</option>{GENDERS.map((g) => <option key={g}>{g}</option>)}</select>{err('gender')}</div>
                <div className="field"><label htmlFor="email">{kids ? 'Parent’s email' : 'Email'}</label><input id="email" type="email" className="input" autoComplete="email" value={val('email')} onChange={set('email')} {...aria('email')} /><span className="hint">Your confirmation is sent here.</span>{err('email')}</div>
                <div className="field"><label htmlFor="mobile">{kids ? 'Parent’s mobile' : 'Mobile number'}</label><input id="mobile" type="tel" inputMode="tel" className="input" autoComplete="tel" placeholder="10-digit mobile" value={val('mobile')} onChange={set('mobile')} {...aria('mobile')} />{err('mobile')}</div>
                <div className="field"><label htmlFor="city">City</label><input id="city" className="input" autoComplete="address-level2" placeholder="e.g. Bareilly" value={val('city')} onChange={set('city')} {...aria('city')} />{err('city')}</div>
                <div className="field"><label htmlFor="running_club">Running club <span className="muted" style={{ fontWeight: 500 }}>(optional)</span></label><input id="running_club" className="input" value={val('running_club')} onChange={set('running_club')} /></div>
                <div className="field" style={{ gridColumn: '1/-1' }}>
                  <span className="lbl" id="size-l">T-shirt size</span>
                  <div className="pill-group" role="group" aria-labelledby="size-l">
                    {sizes.map((z) => (
                      <button key={z} type="button" className="pill" aria-pressed={val('tshirt_size') === z} onClick={() => { setData((d) => ({ ...d, tshirt_size: z })); setErrors((e) => { const n = { ...e }; delete n.tshirt_size; return n; }); }}>{z}</button>
                    ))}
                  </div>
                  {err('tshirt_size')}
                </div>
              </div>
              <h2 style={{ margin: '28px 0 14px', fontSize: 20, fontWeight: 800 }}>Emergency contact</h2>
              <div className="grid g2">
                <div className="field"><label htmlFor="emergency_name">Contact name</label><input id="emergency_name" className="input" value={val('emergency_name')} onChange={set('emergency_name')} {...aria('emergency_name')} />{err('emergency_name')}</div>
                <div className="field"><label htmlFor="emergency_mobile">Contact mobile</label><input id="emergency_mobile" type="tel" inputMode="tel" className="input" value={val('emergency_mobile')} onChange={set('emergency_mobile')} {...aria('emergency_mobile')} />{err('emergency_mobile')}</div>
              </div>
              <details style={{ marginTop: 24, border: '1.5px solid var(--line)', borderRadius: 14, padding: '14px 16px' }}>
                <summary style={{ fontWeight: 700, cursor: 'pointer' }}>Medical information <span className="muted" style={{ fontWeight: 500 }}>(optional)</span></summary>
                <p className="muted" style={{ fontSize: 14, lineHeight: 1.5 }}>Only share what our medical team should know on race day (e.g. asthma, allergies). It is kept confidential.</p>
                <div className="field"><label htmlFor="medical_info">Conditions or allergies</label><textarea id="medical_info" className="input" rows={3} value={val('medical_info')} onChange={set('medical_info')} /></div>
                <label className="check" style={{ marginTop: 12 }}><input type="checkbox" checked={!!data.medical_consent} onChange={set('medical_consent')} />I consent to Casa Atleta’s medical team using this information on race day.</label>
                {err('medical_consent')}
              </details>
            </div>
          )}

          {step === 2 && (
            <div className="stack" style={{ gap: 10 }}>
              <p className="muted" style={{ margin: '0 0 8px' }}>Required items are marked. You can open each document before agreeing.</p>
              <label className="check"><input type="checkbox" checked={!!data.accepted_terms} onChange={set('accepted_terms')} /><span>I accept the <Link href="/legal/terms" target="_blank">event terms &amp; conditions</Link>. <b>Required</b> {err('accepted_terms')}</span></label>
              <label className="check"><input type="checkbox" checked={!!data.accepted_waiver} onChange={set('accepted_waiver')} /><span>I have read and agree to the <Link href="/legal/waiver" target="_blank">participant waiver &amp; declaration</Link>, and {kids ? 'my child is' : 'I am'} fit to take part. <b>Required</b> {err('accepted_waiver')}</span></label>
              <label className="check"><input type="checkbox" checked={!!data.accepted_privacy} onChange={set('accepted_privacy')} /><span>I agree to the <Link href="/legal/privacy" target="_blank">privacy policy</Link> and the <Link href="/legal/refunds" target="_blank">cancellation &amp; refund policy</Link>. <b>Required</b> {err('accepted_privacy')}</span></label>
              {kids && <label className="check" style={{ background: 'var(--gold-tint)' }}><input type="checkbox" checked={!!data.guardian_consent} onChange={set('guardian_consent')} /><span>As the parent/guardian, I give permission for my child to take part and will stay at the event. <b>Required</b> {err('guardian_consent')}</span></label>}
              <label className="check"><input type="checkbox" checked={!!data.photo_consent} onChange={set('photo_consent')} /><span>Casa Atleta may use race-day photos and videos that include {kids ? 'my child' : 'me'} for event coverage. <span className="muted">Optional</span></span></label>
              <label className="check"><input type="checkbox" checked={!!data.whatsapp_opt_in} onChange={set('whatsapp_opt_in')} /><span>Send me race updates on WhatsApp / SMS. <span className="muted">Optional</span></span></label>
              <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', left: -9999 }} value={val('website')} onChange={set('website')} />
            </div>
          )}

          {step === 3 && race && (
            <div>
              <div style={{ border: '1.5px solid var(--line)', borderRadius: 16, overflow: 'hidden', marginBottom: 20 }}>
                {[['Race', race.name], [kids ? 'Child' : 'Participant', val('full_name')], ['T-shirt', val('tshirt_size')], ['Email', val('email')]].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--line)' }}><span className="muted">{k}</span><b style={{ textAlign: 'right' }}>{v}</b></div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 18px', background: 'var(--chalk)' }}><b>Total</b><b>{rupees(race.feePaise)}</b></div>
              </div>
              <p className="muted" style={{ fontSize: 14, lineHeight: 1.55, margin: 0 }}>You’ll pay on Razorpay’s secure window — UPI, debit/credit cards and net banking are supported. Casa Atleta never sees or stores your card details. Your place is confirmed only after the payment is verified.</p>
            </div>
          )}

          {step === 4 && result && (
            <div style={{ textAlign: 'center', padding: '12px 0' }} aria-live="polite">
              {result.kind === 'paid' && (
                <>
                  <div style={{ width: 84, height: 84, borderRadius: 99, background: 'var(--mint)', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#1E5B49" strokeWidth="2.6" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg></div>
                  <h2 className="d forest" style={{ margin: '18px 0 6px', fontSize: 48 }}>You’re in!</h2>
                  <p className="muted" style={{ margin: '0 0 20px' }}>Payment received. See you at the starting line.</p>
                  {result.regCode && <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, background: 'var(--chalk)', borderRadius: 16, padding: '16px 28px' }}><span className="label-sm">Your registration ID</span><span style={{ fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 26, fontWeight: 700 }}>{result.regCode}</span></div>}
                  <p className="muted" style={{ maxWidth: 460, margin: '20px auto 0', fontSize: 14, lineHeight: 1.55 }}>A confirmation with your race, registration ID and details has been emailed to {val('email')}. Please check your spam folder if you can’t see it.</p>
                  <Link href="/" className="btn btn-primary" style={{ marginTop: 22 }}>Back to the website</Link>
                </>
              )}
              {result.kind === 'pending' && (
                <>
                  <div style={{ width: 84, height: 84, borderRadius: 99, background: 'var(--gold-tint)', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#8A6A00" strokeWidth="2.4" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg></div>
                  <h2 className="d forest" style={{ margin: '18px 0 6px', fontSize: 44 }}>Payment pending</h2>
                  <p className="muted" style={{ maxWidth: 460, margin: '0 auto', lineHeight: 1.55 }}>We’re waiting for your bank to confirm. <b>Please don’t pay again</b> — this page updates automatically and we’ll email you as soon as it’s verified.</p>
                </>
              )}
              {(result.kind === 'failed' || result.kind === 'dismissed') && (
                <>
                  <div style={{ width: 84, height: 84, borderRadius: 99, background: '#FDE2DC', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#B8391F" strokeWidth="2.6" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg></div>
                  <h2 className="d forest" style={{ margin: '18px 0 6px', fontSize: 44 }}>{result.kind === 'failed' ? 'Payment didn’t go through' : 'Payment not completed'}</h2>
                  <p className="muted" style={{ maxWidth: 460, margin: '0 auto', lineHeight: 1.55 }}>No money was taken, or any amount deducted will be refunded automatically by your bank. Your details are saved — your place is held for 30 minutes.</p>
                  <button className="btn btn-coral" style={{ marginTop: 22 }} onClick={() => { setResult(null); setStep(3); }}>Try payment again</button>
                </>
              )}
            </div>
          )}

          {formError && <div className="alert alert-error" role="alert" style={{ marginTop: 20 }}>{formError}</div>}

          {step < 4 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 30, paddingTop: 22, borderTop: '1px solid var(--line)' }}>
              {step > 0 ? <button type="button" onClick={() => { setFormError(''); setStep((s) => s - 1); }} style={{ minHeight: 52, border: 0, background: 'none', fontWeight: 700, color: 'var(--forest)', cursor: 'pointer' }}>← Back</button> : <span />}
              <button type="button" className={`btn ${step === 3 ? 'btn-coral' : 'btn-primary'}`} disabled={(step === 0 && !race) || busy} onClick={next}>
                {busy ? 'Please wait…' : step === 3 ? `Pay ${rupees(race?.feePaise ?? null)} securely →` : 'Continue →'}
              </button>
            </div>
          )}
        </div>

        <aside style={{ background: 'var(--forest)', color: '#fff', borderRadius: 24, padding: 26, display: 'flex', flexDirection: 'column', gap: 14, alignSelf: 'start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <JhumkaMark size={44} onDark />
            <div><div className="d" style={{ fontSize: 26, lineHeight: 1 }}>{eventName}</div><div style={{ fontSize: 13, color: 'var(--on-forest-muted)', marginTop: 4 }}>Bareilly · {eventDate ?? 'Date TBA'}</div></div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,.2)', paddingTop: 14, display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--on-forest-muted)' }}>Race</span><b>{race?.name ?? 'Not selected'}</b></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--on-forest-muted)' }}>Entry fee</span><b>{rupees(race?.feePaise ?? null)}</b></div>
          <div style={{ background: 'rgba(255,255,255,.1)', borderRadius: 14, padding: 14, fontSize: 13, lineHeight: 1.5, color: 'var(--on-forest-muted)' }}>
            Takes about 2–3 minutes. Need help? {whatsapp ? <a href={whatsapp} style={{ color: 'var(--gold)', fontWeight: 700 }}>WhatsApp us</a> : <Link href="/contact" style={{ color: 'var(--gold)', fontWeight: 700 }}>Contact us</Link>}
          </div>
        </aside>
      </div>
      <style>{`@media (min-width: 901px){ .reg-layout{ grid-template-columns: minmax(0,1fr) 340px !important; } }`}</style>
    </div>
  );
}
