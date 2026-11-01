/** Casa Atleta finish-tape logo (stacked). */
export function Logo({ width = 140, light = false, label = true }: { width?: number; light?: boolean; label?: boolean }) {
  const ink = light ? '#FFFFFF' : '#1E5B49';
  return (
    <svg viewBox="0 0 320 150" width={width} height={Math.round((width * 150) / 320)} role={label ? 'img' : undefined} aria-label={label ? 'Casa Atleta' : undefined} aria-hidden={label ? undefined : true}>
      <text x="160" y="38" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="700" fontSize="34" letterSpacing="16" fill={ink}>CASA</text>
      <path d="M0 100 C 70 90, 130 110, 196 98" stroke="#E85A3C" strokeWidth="9" fill="none" strokeLinecap="round" />
      <path d="M212 96 C 250 90, 290 102, 320 94" stroke="#E85A3C" strokeWidth="9" fill="none" strokeLinecap="round" />
      <text x="160" y="124" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="800" fontSize="88" letterSpacing="-4" fill={ink}>atleta</text>
    </svg>
  );
}

/** Jhumka City Run event mark (a jhumka earring). */
export function JhumkaMark({ size = 86, onDark = false }: { size?: number; onDark?: boolean }) {
  const stroke = onDark ? '#FFFFFF' : '#1E5B49';
  return (
    <svg viewBox="0 0 120 140" width={size} height={Math.round((size * 140) / 120)} aria-hidden="true">
      <circle cx="60" cy="14" r="9" fill="#F2C94C" stroke={stroke} strokeWidth="3" />
      <rect x="57" y="22" width="6" height="18" fill={stroke} />
      <path d="M22 92 C 22 44, 98 44, 98 92 Z" fill="#E85A3C" />
      <rect x="18" y="88" width="84" height="10" rx="5" fill={stroke} />
      {[28, 44, 60, 76, 92].map((x, i) => (
        <circle key={x} cx={x} cy={[112, 116, 118, 116, 112][i]} r="6" fill="#F2C94C" />
      ))}
    </svg>
  );
}

export function Arrow({ size = 18, color = 'currentColor', diagonal = false }: { size?: number; color?: string; diagonal?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.6" aria-hidden="true">
      <path d={diagonal ? 'M6 18L18 6M8 6h10v10' : 'M4 12h16M14 6l6 6-6 6'} />
    </svg>
  );
}
