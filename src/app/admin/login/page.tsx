'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { Logo } from '@/components/Brand';

export default function AdminLogin() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setError('');
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { error } = await supabase.auth.signInWithPassword({ email: String(f.get('email')), password: String(f.get('password')) });
    setBusy(false);
    if (error) return setError('Email or password is incorrect.');
    router.replace('/admin');
    router.refresh();
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <form onSubmit={submit} className="card" style={{ width: '100%', maxWidth: 420, padding: 32 }}>
        <Logo width={130} />
        <h1 style={{ fontSize: 22, margin: '20px 0 4px' }}>Organiser admin</h1>
        <p className="muted" style={{ margin: '0 0 20px' }}>Sign in to manage events and registrations.</p>
        {!configured && <div className="alert alert-info" style={{ marginBottom: 16 }}>The database isn’t connected yet. See the hosting guide.</div>}
        <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" className="input" autoComplete="username" required /></div>
        <div className="field" style={{ marginTop: 14 }}><label htmlFor="password">Password</label><input id="password" name="password" type="password" className="input" autoComplete="current-password" required /></div>
        {error && <div className="alert alert-error" role="alert" style={{ marginTop: 14 }}>{error}</div>}
        <button className="btn btn-primary btn-block" style={{ marginTop: 20 }} disabled={busy || !configured}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </main>
  );
}
