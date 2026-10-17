import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, Plus, Search } from 'lucide-react';
import { useBook } from '../App';
import { Button, Card, Chip, Empty, Input, PageHeader, Select, cx } from '../components/ui';
import { payStatus, todayStr } from '../lib/ledger';
import { fmt } from '../lib/money';
import type { TxnType } from '../lib/types';
import { TXN } from '../lib/types';
import { DateRange, rangeFor, type RangeKey } from '../components/DateRange';

const BLURB: Partial<Record<TxnType, string>> = {
  sale: 'Bills you give customers. Stock goes down, the customer owes you the balance.',
  sale_return: 'Credit notes for goods customers send back.',
  estimate: 'Quotes. They change nothing until you turn them into an invoice.',
  sale_order: 'Orders taken from customers, to be billed later.',
  delivery_challan: 'Goods sent before billing. Convert to an invoice when you bill.',
  purchase: 'Bills from your suppliers. Stock goes up.',
  purchase_return: 'Debit notes for goods you send back to suppliers.',
  purchase_order: 'Orders you place with suppliers.',
  payment_in: 'Money received from customers.',
  payment_out: 'Money paid to suppliers.',
  expense: 'Rent, salaries, bills and other running costs.',
  other_income: 'Money earned outside your main sales, like interest or commission.',
};

export default function TxnList({ type }: { type: TxnType }) {
  const b = useBook();
  const nav = useNavigate();
  const meta = TXN[type];
  const [range, setRange] = useState<RangeKey>('this-month');
  const [custom, setCustom] = useState({ from: todayStr().slice(0, 8) + '01', to: todayStr() });
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const today = todayStr();
  const { from, to } = range === 'custom' ? custom : rangeFor(range);
  const hasStatus = type === 'sale' || type === 'purchase';

  const rows = useMemo(() => b.txns.filter((t) => t.type === type && t.date >= from && t.date <= to).map((t) => {
    const party = b.parties.find((p) => p.id === t.partyId);
    const st = hasStatus ? payStatus(t, b.txns, today) : null;
    return { t, partyName: party?.name ?? t.partyName ?? (type === 'expense' ? b.categories.find((c) => c.id === t.categoryId)?.name ?? '' : 'Cash sale'), st };
  }).filter((r) => {
    const s = q.trim().toLowerCase();
    return (!s || r.partyName.toLowerCase().includes(s) || r.t.number.toLowerCase().includes(s))
      && (!status || (r.st ? r.st.status === status : r.t.status === status));
  }).sort((a, c) => c.t.date.localeCompare(a.t.date) || c.t.number.localeCompare(a.t.number, undefined, { numeric: true })), [b, type, from, to, q, status, today, hasStatus]);

  const total = rows.reduce((s, r) => s + r.t.total, 0);
  const due = rows.reduce((s, r) => s + (r.st?.due ?? 0), 0);
  const newPath = meta.hasLines ? `/${meta.path}/new` : `/${meta.path}/new`;

  return (
    <>
      <PageHeader title={meta.plural} sub={BLURB[type]} actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => nav(newPath)}>New {meta.label.toLowerCase()}</Button>} />
      <Card>
        <div className="flex flex-wrap items-end gap-2 border-b border-border p-3">
          <DateRange value={range} onChange={setRange} custom={custom} onCustom={setCustom} />
          <div className="relative min-w-[200px] flex-1"><Search size={16} className="absolute left-3 top-3 text-text-muted" aria-hidden />
            <Input aria-label="Search" placeholder="Party or number" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" /></div>
          {(hasStatus || meta.isDoc) && (
            <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className="w-36">
              <option value="">Any status</option>
              {hasStatus ? <><option value="unpaid">Unpaid</option><option value="partial">Part paid</option><option value="overdue">Overdue</option><option value="paid">Paid</option></>
                : <><option value="open">Open</option><option value="converted">Converted</option></>}
            </Select>
          )}
        </div>
        <div className="flex flex-wrap gap-6 border-b border-border px-4 py-3 text-sm">
          <div><span className="text-text-muted">Count </span><b className="num">{rows.length}</b></div>
          <div><span className="text-text-muted">Total </span><b className="num">{fmt(total)}</b></div>
          {hasStatus && <div><span className="text-text-muted">{type === 'sale' ? 'Still to receive' : 'Still to pay'} </span><b className="num text-danger">{fmt(due)}</b></div>}
        </div>
        {rows.length === 0 ? (
          <Empty icon={<FileText size={22} />} title={b.txns.some((t) => t.type === type) ? 'Nothing in this period' : `No ${meta.plural.toLowerCase()} yet`}
            body={b.txns.some((t) => t.type === type) ? 'Try a wider date range.' : BLURB[type]}
            action={<Button variant="primary" onClick={() => nav(newPath)}>New {meta.label.toLowerCase()}</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface text-left text-xs text-text-muted">
                <tr><th className="px-4 py-2 font-medium">Date</th><th className="px-2 py-2 font-medium">No.</th><th className="px-2 py-2 font-medium">{type === 'expense' ? 'Category / party' : 'Party'}</th>
                  <th className="px-2 py-2 text-right font-medium">Total</th>{hasStatus && <th className="px-2 py-2 text-right font-medium">Balance</th>}
                  {(hasStatus || meta.isDoc) && <th className="px-4 py-2 font-medium">Status</th>}</tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map(({ t, partyName, st }) => (
                  <tr key={t.id} className="cursor-pointer hover:bg-surface" onClick={() => nav(`/txn/${t.id}`)}>
                    <td className="whitespace-nowrap px-4 py-2.5">{t.date}</td>
                    <td className="px-2 py-2.5"><Link to={`/txn/${t.id}`} onClick={(e) => e.stopPropagation()} className="font-medium hover:underline">{t.number || '—'}</Link></td>
                    <td className="max-w-[260px] truncate px-2 py-2.5">{partyName}</td>
                    <td className="num px-2 py-2.5 text-right font-semibold">{fmt(t.total)}</td>
                    {hasStatus && <td className={cx('num px-2 py-2.5 text-right', st!.due > 0 && 'text-danger')}>{fmt(st!.due)}</td>}
                    {(hasStatus || meta.isDoc) && <td className="px-4 py-2.5"><Chip status={st?.status ?? t.status ?? 'open'} /></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
