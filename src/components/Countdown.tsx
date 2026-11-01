'use client';

import { useEffect, useState } from 'react';

/** Counts down to race day. Shows "--" until the date is confirmed in admin. */
export function Countdown({ target }: { target: string | null }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    if (!target) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [target]);

  let parts: [string, string][] = [['--', 'Days'], ['--', 'Hours'], ['--', 'Min'], ['--', 'Sec']];
  if (target && now !== null) {
    const diff = Math.max(0, new Date(target).getTime() - now);
    const s = Math.floor(diff / 1000);
    parts = [
      [String(Math.floor(s / 86400)), 'Days'],
      [String(Math.floor((s % 86400) / 3600)).padStart(2, '0'), 'Hours'],
      [String(Math.floor((s % 3600) / 60)).padStart(2, '0'), 'Min'],
      [String(s % 60).padStart(2, '0'), 'Sec']
    ];
  }
  return (
    <div role="timer" aria-label={target ? 'Countdown to race day' : 'Countdown starts once the race date is confirmed'} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {parts.map(([v, l]) => (
        <span key={l} style={{ background: 'var(--forest)', color: '#fff', borderRadius: 12, padding: '8px 12px', textAlign: 'center', minWidth: 58 }}>
          <b style={{ fontSize: 22, display: 'block', fontVariantNumeric: 'tabular-nums' }}>{v}</b>
          <span style={{ fontSize: 11 }}>{l}</span>
        </span>
      ))}
    </div>
  );
}
