import type { FaqRow } from '@/lib/types';

export function Faqs({ faqs }: { faqs: FaqRow[] }) {
  return (
    <div className="stack" style={{ gap: 10 }}>
      {faqs.map((f, i) => (
        <details key={f.id} className="acc" open={i === 0}>
          <summary>
            {f.question}
            <span className="plus" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1B1B1F" strokeWidth="3"><path className="v" d="M12 5v14" /><path d="M5 12h14" /></svg>
            </span>
          </summary>
          <p>{f.answer}</p>
        </details>
      ))}
    </div>
  );
}
