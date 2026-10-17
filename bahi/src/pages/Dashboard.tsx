import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, FileText, Receipt } from 'lucide-react';
import { useBook } from '../App';
import { Card, Chip, Empty, PageHeader, Stat, Button } from '../components/ui';
import { SalesChart } from '../components/SalesChart';
import { accountBalance, partyBalances, payStatus, stockMovements, stockOf, todayStr, costPrice } from '../lib/ledger';
import { fmt } from '../lib/money';
import { TXN } from '../lib/types';

export default function Dashboard() {
  const b = useBook();
  const nav = useNavigate();
  const today = todayStr();

  const d = useMemo(() => {
    const bal = partyBalances(b.parties, b.txns);
    let receivable = 0, payable = 0;
    for (const v of bal.values()) v > 0 ? (receivable += v) : (payable -= v);
    const accounts = b.accounts.map((a) => ({ a, bal: accountBalance(a, b.txns) }));
    const moves = stockMovements(b.txns);
    const stock = b.items.filter((i) => i.kind === 'product').map((i) => ({ i, qty: stockOf(i, moves) }));
    const stockValue = stock.reduce((s, x) => s + Math.max(0, x.qty) * costPrice(x.i), 0);
    const low = stock.filter((x) => x.qty <= (x.i.minStock || 0) && (x.i.minStock || 0) > 0);
    const month = today.slice(0, 7);
    const sales = b.txns.filter((t) => t.type === 'sale');
    const monthSales = sales.filter((t) => t.date.startsWith(month)).reduce((s, t) => s + t.total, 0)
      - b.txns.filter((t) => t.type === 'sale_return' && t.date.startsWith(month)).reduce((s, t) => s + t.total, 0);
    const days = Array.from({ length: 14 }, (_, k) => {
      const dt = new Date(); dt.setDate(dt.getDate() - (13 - k));
      const ds = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      return { date: ds, total: sales.filter((t) => t.date === ds).reduce((s, t) => s + t.total, 0) };
    });
    const unpaid = sales.map((t) => ({ t, s: payStatus(t, b.txns, today) })).filter((x) => x.s.due > 0)
      .sort((a, c) => (a.s.status === 'overdue' ? -1 : 0) - (c.s.status === 'overdue' ? -1 : 0) || a.t.date.localeCompare(c.t.date));
    const openDocs = b.txns.filter((t) => TXN[t.type].isDoc && t.status !== 'converted');
    return { receivable, payable, accounts, stockValue, low, monthSales, days, unpaid, openDocs };
  }, [b, today]);

  const pname = (id?: string, fallback?: string) => b.parties.find((p) => p.id === id)?.name ?? fallback ?? 'Cash sale';

  if (b.txns.length === 0 && b.parties.length === 0 && b.items.length === 0)
    return (
      <>
        <PageHeader title={`Welcome, ${b.firm.name}`} />
        <Card>
          <Empty icon={<Receipt size={22} />} title="Make your first bill" body="Add a customer and an item right inside the bill. Everything else, stock, balances and reports, fills in by itself."
            action={<Button variant="primary" onClick={() => nav('/sale/invoices/new')}>New sale invoice</Button>} />
        </Card>
      </>
    );

  return (
    <>
      <PageHeader title="Home" sub={new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="To receive" value={d.receivable} tone="success" onClick={() => nav('/reminders')} sub="from customers" />
        <Stat label="To pay" value={d.payable} tone="danger" onClick={() => nav('/reports/all-parties')} sub="to suppliers" />
        <Stat label="Sales this month" value={d.monthSales} onClick={() => nav('/sale/invoices')} sub="after returns, with GST" />
        <Stat label="Stock value" value={d.stockValue} onClick={() => nav('/reports/stock')} sub="at purchase price" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Sales, last 14 days" className="lg:col-span-2"><div className="p-4"><SalesChart days={d.days} /></div></Card>
        <Card title="Cash and bank" action={<Link to="/cash-bank" className="text-xs font-semibold text-accent">Open</Link>}>
          <ul className="divide-y divide-border">
            {d.accounts.map(({ a, bal }) => (
              <li key={a.id} className="flex justify-between px-4 py-2.5"><span>{a.name}</span><span className={'num font-semibold ' + (bal < 0 ? 'text-danger' : '')}>{fmt(bal)}</span></li>
            ))}
            <li className="flex justify-between px-4 py-2.5 font-semibold"><span>Total</span><span className="num">{fmt(d.accounts.reduce((s, x) => s + x.bal, 0))}</span></li>
          </ul>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Unpaid bills" className="lg:col-span-2" action={<Link to="/reminders" className="text-xs font-semibold text-accent">Send reminders</Link>}>
          {d.unpaid.length === 0 ? <Empty title="Nothing pending" body="Every sale invoice is fully paid." /> : (
            <ul className="divide-y divide-border">
              {d.unpaid.slice(0, 6).map(({ t, s }) => (
                <li key={t.id}>
                  <Link to={`/txn/${t.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface">
                    <div className="min-w-0 flex-1"><div className="truncate font-medium">{pname(t.partyId, t.partyName)}</div><div className="text-xs text-text-muted">{t.number} · {t.date}</div></div>
                    <Chip status={s.status} /><span className="num w-28 text-right font-semibold">{fmt(s.due)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <div className="flex flex-col gap-4">
          <Card title="Low stock" action={<Link to="/reports/low-stock" className="text-xs font-semibold text-accent">All</Link>}>
            {d.low.length === 0 ? <p className="px-4 py-4 text-sm text-text-muted">All items are above their minimum.</p> : (
              <ul className="divide-y divide-border">
                {d.low.slice(0, 5).map(({ i, qty }) => (
                  <li key={i.id} className="flex items-center gap-2 px-4 py-2.5">
                    <AlertTriangle size={15} className="shrink-0 text-danger" aria-hidden />
                    <Link to={`/items/${i.id}`} className="flex-1 truncate hover:underline">{i.name}</Link>
                    <span className="num text-sm"><b className="text-danger">{qty}</b> / {i.minStock} {i.unit}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Open estimates and orders">
            {d.openDocs.length === 0 ? <p className="px-4 py-4 text-sm text-text-muted">None open.</p> : (
              <ul className="divide-y divide-border">
                {d.openDocs.slice(0, 5).map((t) => (
                  <li key={t.id}><Link to={`/txn/${t.id}`} className="flex items-center gap-2 px-4 py-2.5 hover:bg-surface">
                    <FileText size={15} className="text-text-muted" aria-hidden /><span className="flex-1 truncate">{TXN[t.type].label} {t.number} · {pname(t.partyId, t.partyName)}</span>
                    <ArrowRight size={14} className="text-text-muted" aria-hidden /></Link></li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
