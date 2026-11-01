import 'server-only';
import { db } from './supabase/admin';

export interface ParticipantFilters {
  q?: string;
  race?: string;
  status?: string;
  from?: string;
  to?: string;
}

/** Builds the participants query shared by the admin list and the CSV export. */
export function participantsQuery(f: ParticipantFilters, select = '*, races(name, code)') {
  let query = db().from('registrations').select(select, { count: 'exact' }).order('created_at', { ascending: false });
  if (f.race) query = query.eq('race_id', f.race);
  if (f.status) query = query.eq('status', f.status);
  if (f.from) query = query.gte('created_at', new Date(f.from + 'T00:00:00+05:30').toISOString());
  if (f.to) query = query.lte('created_at', new Date(f.to + 'T23:59:59+05:30').toISOString());
  const q = (f.q ?? '').replace(/[%,()*]/g, ' ').trim();
  if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,mobile.ilike.%${q}%,reg_code.ilike.%${q}%`);
  return query;
}

export function toCsv(rows: Record<string, unknown>[], columns: [string, string][]) {
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    // Guard against spreadsheet formula injection
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const head = columns.map(([, label]) => cell(label)).join(',');
  const body = rows.map((r) => columns.map(([key]) => cell(r[key])).join(',')).join('\n');
  return '﻿' + head + '\n' + body; // BOM so Excel reads ₹ and Hindi names correctly
}
