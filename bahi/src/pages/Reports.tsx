import { useMemo, useState } from 'react';
import { NavLink, useParams, useSearchParams } from 'react-router-dom';
import { useBook } from '../App';
import { PageHeader, Select, cx } from '../components/ui';
import { DateRange, rangeFor, type RangeKey } from '../components/DateRange';
import { ReportTable } from '../components/ReportTable';
import {
  allParties, balanceSheet, billWiseProfit, cashFlow, dayBook, expenseByCategory, hsnSummary, itemWiseProfit, partyStatement, partyWiseProfit,
  profitLossReport, stockSummary, taxRateReport, txnReport, type Books, type Report,
} from '../lib/reports';
import { todayStr } from '../lib/ledger';

type Def = { key: string; label: string; group: string; dated: boolean; run: (b: Books, from: string, to: string, extra: { party: string }) => Report };

const DEFS: Def[] = [
  { key: 'sale', label: 'Sales', group: 'Transactions', dated: true, run: (b, f, t) => txnReport(b, ['sale'], f, t, todayStr()) },
  { key: 'purchase', label: 'Purchases', group: 'Transactions', dated: true, run: (b, f, t) => txnReport(b, ['purchase'], f, t, todayStr()) },
  { key: 'returns', label: 'Sale and purchase returns', group: 'Transactions', dated: true, run: (b, f, t) => txnReport(b, ['sale_return', 'purchase_return'], f, t, todayStr()) },
  { key: 'orders', label: 'Estimates and orders', group: 'Transactions', dated: true, run: (b, f, t) => txnReport(b, ['estimate', 'sale_order', 'delivery_challan', 'purchase_order'], f, t, todayStr()) },
  { key: 'day-book', label: 'Day book', group: 'Transactions', dated: true, run: (b, f, t) => dayBook(b, f, t) },
  { key: 'profit-loss', label: 'Profit and loss', group: 'Profit', dated: true, run: (b, f, t) => profitLossReport(b, f, t) },
  { key: 'bill-profit', label: 'Bill-wise profit', group: 'Profit', dated: true, run: (b, f, t) => billWiseProfit(b, f, t) },
  { key: 'item-profit', label: 'Item-wise profit', group: 'Profit', dated: true, run: (b, f, t) => itemWiseProfit(b, f, t) },
  { key: 'party-profit', label: 'Party-wise profit', group: 'Profit', dated: true, run: (b, f, t) => partyWiseProfit(b, f, t) },
  { key: 'party-statement', label: 'Party statement', group: 'Parties', dated: true, run: (b, f, t, x) => partyStatement(b, x.party, f, t) },
  { key: 'all-parties', label: 'All parties (to receive / pay)', group: 'Parties', dated: false, run: (b) => allParties(b, todayStr()) },
  { key: 'stock', label: 'Stock summary', group: 'Stock', dated: false, run: (b) => stockSummary(b) },
  { key: 'low-stock', label: 'Low stock', group: 'Stock', dated: false, run: (b) => stockSummary(b, true) },
  { key: 'cash-flow', label: 'Cash flow', group: 'Money', dated: true, run: (b, f, t) => cashFlow(b, f, t) },
  { key: 'balance-sheet', label: 'Balance sheet', group: 'Money', dated: false, run: (b) => balanceSheet(b, todayStr()) },
  { key: 'expenses', label: 'Expenses by category', group: 'Money', dated: true, run: (b, f, t) => expenseByCategory(b, f, t) },
  { key: 'other-income', label: 'Other income by category', group: 'Money', dated: true, run: (b, f, t) => expenseByCategory(b, f, t, 'other_income') },
  { key: 'tax-rate', label: 'Tax by rate', group: 'GST', dated: true, run: (b, f, t) => taxRateReport(b, f, t) },
  { key: 'hsn-sale', label: 'HSN summary (sales)', group: 'GST', dated: true, run: (b, f, t) => hsnSummary(b, f, t, 'sale') },
  { key: 'hsn-purchase', label: 'HSN summary (purchases)', group: 'GST', dated: true, run: (b, f, t) => hsnSummary(b, f, t, 'purchase') },
];

export default function Reports() {
  const b = useBook();
  const { key = 'sale' } = useParams();
  const [sp, setSp] = useSearchParams();
  const [range, setRange] = useState<RangeKey>(key === 'party-statement' ? 'this-fy' : 'this-month');
  const [custom, setCustom] = useState({ from: todayStr().slice(0, 8) + '01', to: todayStr() });
  const def = DEFS.find((d) => d.key === key) ?? DEFS[0];
  const { from, to } = range === 'custom' ? custom : rangeFor(range);
  const party = sp.get('party') ?? b.parties[0]?.id ?? '';
  const report = useMemo(() => def.run(b, from, to, { party }), [def, b, from, to, party]);
  const groups = [...new Set(DEFS.map((d) => d.group))];

  return (
    <>
      <PageHeader title="Reports" />
      <div className="grid gap-4 lg:grid-cols-[230px_1fr]">
        <nav aria-label="Reports" className="no-print rounded-lg border border-border bg-bg p-2 shadow-card">
          <select aria-label="Choose report" className="mb-2 h-10 w-full rounded-md border border-border-input px-2 lg:hidden" value={def.key} onChange={(e) => (window.location.hash = `#/reports/${e.target.value}`)}>
            {DEFS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
          </select>
          <div className="hidden lg:block">
            {groups.map((g) => (
              <div key={g} className="mb-2">
                <div className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">{g}</div>
                {DEFS.filter((d) => d.group === g).map((d) => (
                  <NavLink key={d.key} to={`/reports/${d.key}`} className={() => cx('block rounded-md px-2 py-1.5 text-sm', d.key === def.key ? 'bg-accent-soft font-semibold text-accent-strong' : 'hover:bg-surface')}>{d.label}</NavLink>
                ))}
              </div>
            ))}
          </div>
        </nav>
        <div className="min-w-0">
          <div className="no-print mb-3 flex flex-wrap items-center gap-2">
            {def.dated && <DateRange value={range} onChange={setRange} custom={custom} onCustom={setCustom} />}
            {def.key === 'party-statement' && (
              <Select aria-label="Party" value={party} onChange={(e) => setSp({ party: e.target.value })} className="w-64">
                {b.parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            )}
            {def.dated && <span className="text-xs text-text-muted">{from === '1900-01-01' ? 'All time' : `${from} to ${to}`}</span>}
          </div>
          <ReportTable r={report} file={`${def.key}-${from}-${to}`} />
        </div>
      </div>
    </>
  );
}
