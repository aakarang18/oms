import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { db, isDatabaseConfigured } from './supabase/admin';

export type Role = 'admin' | 'editor';
export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
}

export function authClient() {
  const store = cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Called from a Server Component — the middleware refreshes cookies instead.
        }
      }
    }
  });
}

export async function getAdmin(): Promise<AdminUser | null> {
  if (!isDatabaseConfigured() || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return null;
  const { data } = await authClient().auth.getUser();
  if (!data.user) return null;
  const { data: row } = await db().from('admin_users').select('*').eq('user_id', data.user.id).maybeSingle();
  if (!row) return null;
  return { id: data.user.id, email: row.email ?? data.user.email ?? '', name: row.name, role: row.role };
}

/** Use at the top of every admin page / action. Editors can't see payments or change prices. */
export async function requireAdmin(role: Role = 'editor'): Promise<AdminUser> {
  const user = await getAdmin();
  if (!user) redirect('/admin/login');
  if (role === 'admin' && user.role !== 'admin') redirect('/admin?denied=1');
  return user;
}

export async function audit(actor: AdminUser | null, action: string, details?: Record<string, unknown>) {
  try {
    await db().from('audit_log').insert({ actor_email: actor?.email ?? 'system', action, details: details ?? null });
  } catch (e) {
    console.error('audit failed', e);
  }
}
