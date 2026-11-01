'use client';

import Link from 'next/link';
import { useState } from 'react';

const TOPICS = ['Race question', 'My registration', 'Volunteering', 'Media', 'Something else'] as const;
const ORG_TYPES = ['Business', 'Running club', 'School / college', 'Institution / NGO', 'Other'] as const;
const INTERESTS = ['Title partner', 'Associate partner', 'Community partner', 'Team / group entries', 'Corporate run'];

function Done({ title, text, onReset }: { title: string; text: string; onReset: () => void }) {
  return (
    <div style={{ textAlign: 'center', padding: '30px 10px' }} aria-live="polite">
      <div style={{ width: 80, height: 80, borderRadius: 99, background: 'var(--mint)', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#1E5B49" strokeWidth="2.6" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg></div>
      <h2 className="d forest" style={{ margin: '18px 0 8px', fontSize: 44 }}>{title}</h2>
      <p className="muted" style={{ margin: '0 auto 20px', maxWidth: 420, lineHeight: 1.6 }}>{text}</p>
      <button className="btn btn-outline" onClick={onReset}>Send another</button>
    </div>
  );
}

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, json };
}

export function ContactForm({ initialTopic }: { initialTopic?: string }) {
  const [topic, setTopic] = useState<string>(TOPICS.includes(initialTopic as never) ? initialTopic! : 'Race question');
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setState('sending'); setError(''); setErrors({});
    const { ok, json } = await post('/api/contact', {
      topic, name: f.get('name'), email: f.get('email'), mobile: f.get('mobile'), reg_code: f.get('reg_code') ?? '',
      message: f.get('message'), consent: f.get('consent') === 'on', website: f.get('website')
    });
    if (ok) return setState('done');
    setState('idle'); setError(json.error ?? 'Something went wrong.'); setErrors(json.fields ?? {});
  }

  if (state === 'done') return <Done title="Message sent" text="Thanks! We’ll get back to you soon." onReset={() => setState('idle')} />;
  const e = (k: string) => errors[k] && <span className="err">{errors[k]}</span>;
  return (
    <form onSubmit={submit} noValidate>
      <span className="lbl" id="topic-l" style={{ fontWeight: 700, fontSize: 14 }}>What’s it about?</span>
      <div className="pill-group" role="group" aria-labelledby="topic-l" style={{ margin: '8px 0 22px' }}>
        {TOPICS.map((t) => <button key={t} type="button" className="pill" aria-pressed={topic === t} onClick={() => setTopic(t)}>{t}</button>)}
      </div>
      <div className="grid g2">
        <div className="field"><label htmlFor="c-name">Full name</label><input id="c-name" name="name" className="input" autoComplete="name" required />{e('name')}</div>
        <div className="field"><label htmlFor="c-email">Email</label><input id="c-email" name="email" type="email" className="input" autoComplete="email" required />{e('email')}</div>
        <div className="field"><label htmlFor="c-mob">Mobile / WhatsApp <span className="muted" style={{ fontWeight: 500 }}>(optional)</span></label><input id="c-mob" name="mobile" type="tel" className="input" /></div>
        {topic === 'My registration' && <div className="field"><label htmlFor="c-reg">Registration ID</label><input id="c-reg" name="reg_code" className="input" placeholder="e.g. JCR-21K-000123" /></div>}
        <div className="field" style={{ gridColumn: '1/-1' }}><label htmlFor="c-msg">Message</label><textarea id="c-msg" name="message" className="input" rows={5} required />{e('message')}</div>
        <label className="check" style={{ gridColumn: '1/-1', background: 'transparent', padding: 0 }}><input type="checkbox" name="consent" required /><span className="muted" style={{ fontSize: 14 }}>I agree that Casa Atleta can use these details to reply to me, as described in the <Link href="/legal/privacy">privacy policy</Link>.</span></label>
        {e('consent')}
      </div>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', left: -9999 }} />
      {error && <div className="alert alert-error" role="alert" style={{ marginTop: 16 }}>{error}</div>}
      <button className="btn btn-primary" style={{ marginTop: 22 }} disabled={state === 'sending'}>{state === 'sending' ? 'Sending…' : 'Send message'}</button>
    </form>
  );
}

export function PartnerForm() {
  const [org, setOrg] = useState<string>('Business');
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setState('sending'); setError(''); setErrors({});
    const { ok, json } = await post('/api/partners', {
      org_type: org, org_name: f.get('org_name'), contact_name: f.get('contact_name'), email: f.get('email'),
      mobile: f.get('mobile'), interests: f.getAll('interests'), message: f.get('message'), website: f.get('website')
    });
    if (ok) return setState('done');
    setState('idle'); setError(json.error ?? 'Something went wrong.'); setErrors(json.fields ?? {});
  }

  if (state === 'done') return <Done title="Thank you!" text="Your enquiry is with our partnerships team. We’ll be in touch soon with next steps." onReset={() => setState('idle')} />;
  const e = (k: string) => errors[k] && <span className="err">{errors[k]}</span>;
  return (
    <form onSubmit={submit} noValidate>
      <span className="lbl" id="org-l" style={{ fontWeight: 700, fontSize: 14 }}>You are a…</span>
      <div className="pill-group" role="group" aria-labelledby="org-l" style={{ margin: '8px 0 20px' }}>
        {ORG_TYPES.map((t) => <button key={t} type="button" className="pill" aria-pressed={org === t} onClick={() => setOrg(t)}>{t}</button>)}
      </div>
      <div className="grid g2">
        <div className="field"><label htmlFor="p-org">Organisation name</label><input id="p-org" name="org_name" className="input" required />{e('org_name')}</div>
        <div className="field"><label htmlFor="p-name">Your name</label><input id="p-name" name="contact_name" className="input" autoComplete="name" required />{e('contact_name')}</div>
        <div className="field"><label htmlFor="p-email">Work email</label><input id="p-email" name="email" type="email" className="input" autoComplete="email" required />{e('email')}</div>
        <div className="field"><label htmlFor="p-mob">Mobile</label><input id="p-mob" name="mobile" type="tel" className="input" /></div>
        <fieldset style={{ gridColumn: '1/-1', border: 0, margin: 0, padding: 0 }}>
          <legend style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Interested in <span className="muted" style={{ fontWeight: 500 }}>(choose any)</span></legend>
          <div className="pill-group">
            {INTERESTS.map((i) => <label key={i} className="check" style={{ padding: '12px 14px', fontWeight: 600 }}><input type="checkbox" name="interests" value={i} />{i}</label>)}
          </div>
        </fieldset>
        <div className="field" style={{ gridColumn: '1/-1' }}><label htmlFor="p-msg">Anything else?</label><textarea id="p-msg" name="message" className="input" rows={4} /></div>
      </div>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', left: -9999 }} />
      {error && <div className="alert alert-error" role="alert" style={{ marginTop: 16 }}>{error}</div>}
      <button className="btn btn-primary" style={{ marginTop: 22 }} disabled={state === 'sending'}>{state === 'sending' ? 'Sending…' : 'Send enquiry'}</button>
    </form>
  );
}
