import { useState } from 'react';
import { fmt } from '../lib/money';

/** Daily sales, one series. Bars anchored at the baseline, rounded data-end, tooltip on hover and focus, table for screen readers. */
export function SalesChart({ days }: { days: { date: string; total: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = 180, padL = 8, padR = 8, padT = 24, padB = 22;
  const max = Math.max(1, ...days.map((d) => d.total));
  const slot = (W - padL - padR) / days.length;
  const bw = Math.max(4, Math.min(28, slot - 6));
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / max);
  const label = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const h = hover !== null ? days[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-44 w-full" role="img" aria-label="Sales per day, last 14 days" onMouseLeave={() => setHover(null)}>
        <line x1={padL} x2={W - padR} y1={H - padB} y2={H - padB} stroke="var(--c-border)" strokeWidth={1} />
        {days.map((d, i) => {
          const x = padL + i * slot + (slot - bw) / 2;
          const top = y(d.total);
          const hgt = H - padB - top;
          const r = Math.min(4, hgt / 2, bw / 2);
          const path = hgt <= 0 ? '' : `M${x},${H - padB} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${H - padB} Z`;
          return (
            <g key={d.date} role="img" onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0}
              aria-label={`${label(d.date)}: ${fmt(d.total)}`} className="outline-none">
              <rect x={padL + i * slot} y={padT} width={slot} height={H - padT - padB} fill="transparent" />
              {path && <path d={path} fill="var(--c-accent)" opacity={hover === null || hover === i ? 1 : 0.45} />}
              {(i === 0 || i === days.length - 1 || i === Math.floor(days.length / 2)) && (
                <text x={padL + i * slot + slot / 2} y={H - 6} textAnchor="middle" fontSize={11} fill="var(--c-text-muted)">{label(d.date)}</text>
              )}
            </g>
          );
        })}
      </svg>
      {h && hover !== null && (
        <div className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-md bg-nav px-2.5 py-1.5 text-xs text-on-nav shadow-pop"
          style={{ left: `${((padL + hover * slot + slot / 2) / W) * 100}%` }}>
          <div className="text-on-nav-muted">{label(h.date)}</div>
          <div className="font-semibold num">{fmt(h.total)}</div>
        </div>
      )}
      <table className="sr-only">
        <caption>Sales per day</caption>
        <tbody>{days.map((d) => <tr key={d.date}><th scope="row">{label(d.date)}</th><td>{fmt(d.total)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
