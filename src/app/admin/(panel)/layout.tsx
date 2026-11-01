import Link from 'next/link';
import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { Logo } from '@/components/Brand';
import { signOut } from './actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin', robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const links: [string, string, boolean][] = [
    ['/admin', 'Overview', true],
    ['/admin/participants', 'Participants', user.role === 'admin'],
    ['/admin/races', 'Races & pricing', user.role === 'admin'],
    ['/admin/event', 'Event details', true],
    ['/admin/content', 'FAQs, updates & sponsors', true],
    ['/admin/inbox', 'Inbox', true],
    ['/admin/audit', 'Audit log', user.role === 'admin']
  ];
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', minHeight: '100vh' }}>
      <aside style={{ flex: '0 0 240px', background: '#fff', borderRight: '1px solid var(--line)', padding: '20px 16px' }}>
        <Link href="/" aria-label="View website"><Logo width={120} /></Link>
        <div className="label-sm" style={{ margin: '8px 0 18px' }}>Organiser admin</div>
        <nav aria-label="Admin" className="stack" style={{ gap: 2 }}>
          {links.filter(([, , show]) => show).map(([href, label]) => (
            <Link key={href} href={href} style={{ padding: '10px 12px', borderRadius: 10, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>{label}</Link>
          ))}
        </nav>
        <div style={{ marginTop: 24, fontSize: 13 }} className="muted">
          {user.email}<br />Role: <b>{user.role}</b>
          <form action={signOut}><button style={{ marginTop: 10, border: 0, background: 'none', color: 'var(--forest)', fontWeight: 700, padding: 0, cursor: 'pointer' }}>Sign out</button></form>
        </div>
      </aside>
      <main style={{ flex: '999 1 640px', minWidth: 0, padding: '24px clamp(14px,3vw,32px) 56px' }}>{children}</main>
    </div>
  );
}
