import { Input, Select } from './ui';
import { todayStr } from '../lib/ledger';

export type RangeKey = 'today' | 'this-month' | 'last-month' | 'this-quarter' | 'this-fy' | 'last-fy' | 'all' | 'custom';

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Indian financial year runs April to March. */
export function rangeFor(k: RangeKey): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const fyStart = m >= 3 ? y : y - 1;
  switch (k) {
    case 'today': return { from: todayStr(), to: todayStr() };
    case 'this-month': return { from: ymd(new Date(y, m, 1)), to: ymd(new Date(y, m + 1, 0)) };
    case 'last-month': return { from: ymd(new Date(y, m - 1, 1)), to: ymd(new Date(y, m, 0)) };
    case 'this-quarter': { const q = Math.floor(m / 3) * 3; return { from: ymd(new Date(y, q, 1)), to: ymd(new Date(y, q + 3, 0)) }; }
    case 'this-fy': return { from: `${fyStart}-04-01`, to: `${fyStart + 1}-03-31` };
    case 'last-fy': return { from: `${fyStart - 1}-04-01`, to: `${fyStart}-03-31` };
    default: return { from: '1900-01-01', to: '2999-12-31' };
  }
}

export function DateRange({ value, onChange, custom, onCustom }: {
  value: RangeKey; onChange: (k: RangeKey) => void; custom: { from: string; to: string }; onCustom: (c: { from: string; to: string }) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select aria-label="Period" value={value} onChange={(e) => onChange(e.target.value as RangeKey)} className="w-44">
        <option value="today">Today</option><option value="this-month">This month</option><option value="last-month">Last month</option>
        <option value="this-quarter">This quarter</option><option value="this-fy">This financial year</option><option value="last-fy">Last financial year</option>
        <option value="all">All time</option><option value="custom">Custom dates</option>
      </Select>
      {value === 'custom' && <>
        <Input type="date" aria-label="From" value={custom.from} onChange={(e) => onCustom({ ...custom, from: e.target.value })} className="w-40" />
        <span className="text-text-muted">to</span>
        <Input type="date" aria-label="To" value={custom.to} onChange={(e) => onCustom({ ...custom, to: e.target.value })} className="w-40" />
      </>}
    </div>
  );
}
