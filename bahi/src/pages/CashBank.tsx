import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftRight, Landmark, Plus } from 'lucide-react';
import { useBook } from '../App';
import { Button, Card, Field, Input, Modal, PageHeader, Select, cx, useToast } from '../components/ui';
import { db, saveTxn, uid } from '../lib/db';
import { accountBalance, accountEffect, todayStr } from '../lib/ledger';
import { fmt, toPaise } from '../lib/money';
import { TXN } from '../lib/types';

export default function CashBank() {
  const b = useBook();
  const toast = useToast();
  const [sel, setSel] = useState('cash');
  const [acct, setAcct] = useState({ open: false, name: '', accountNo: '', ifsc: '', upiId: '', opening: '' });
  const [mv, setMv] = useState({ open: false, kind: 'transfer' as 'transfer' | 'add' | 'reduce', from: 'cash', to: '', amount: '', date: todayStr(), note: '' });

  const balances = useMemo(() => new Map(b.accounts.map((a) => [a.id, accountBalance(a, b.txns)])), [b]);
  const account = b.accounts.find((a) => a.id === sel) ?? b.accounts[0];
  const ledger = useMemo(() => {
    if (!account) return [];
    let run = account.openingBalance || 0;
    return b.txns.map((t) => ({ t, e: accountEffect(t, account.id) })).filter((x) => x.e !== 0)
      .sort((a, c) => a.t.date.localeCompare(c.t.date) || a.t.createdAt.localeCompare(c.t.createdAt))
      .map((x) => ({ ...x, run: (run += x.e) })).reverse();
  }, [b.txns, account]);
  const cheques = b.txns.filter((t) => t.payMode === 'cheque');

  const addAccount = async () => {
    if (!acct.name.trim()) return toast('Enter an account name', 'danger');
    const id = uid();
    await db.accounts.add({ id, kind: 'bank', name: acct.name.trim(), accountNo: acct.accountNo || undefined, ifsc: acct.ifsc || undefined, upiId: acct.upiId || undefined, openingBalance: toPaise(acct.opening || 0) });
    toast('Account added'); setSel(id); setAcct({ open: false, name: '', accountNo: '', ifsc: '', upiId: '', opening: '' });
  };
  const saveMove = async () => {
    const amount = toPaise(mv.amount || 0);
    if (amount <= 0) return toast('Enter an amount', 'danger');
    if (mv.kind === 'transfer' && (!mv.to || mv.to === mv.from)) return toast('Pick two different accounts', 'danger');
    await saveTxn({ type: 'transfer', date: mv.date, total: amount, notes: mv.note || (mv.kind === 'add' ? 'Money added' : mv.kind === 'reduce' ? 'Money taken out' : 'Transfer'),
      accountId: mv.kind === 'add' ? undefined : mv.from, toAccountId: mv.kind === 'reduce' ? undefined : mv.kind === 'add' ? mv.from : mv.to,
      lines: [], billDiscount: 0, charges: [], paid: amount });
    toast('Saved'); setMv({ ...mv, open: false, amount: '', note: '' });
  };

  return (
    <>
      <PageHeader title="Cash and bank" sub="Every rupee in and out, by account"
        actions={<><Button icon={<ArrowLeftRight size={16} />} onClick={() => setMv({ ...mv, open: true, from: sel })}>Move money</Button>
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setAcct({ ...acct, open: true })}>Add bank account</Button></>} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {b.accounts.map((a) => (
          <button key={a.id} onClick={() => setSel(a.id)} className={cx('rounded-lg border bg-bg p-4 text-left shadow-card', a.id === account?.id ? 'border-accent ring-1 ring-accent' : 'border-border hover:border-accent')}>
            <div className="flex items-center gap-2 text-xs font-medium text-text-muted"><Landmark size={14} aria-hidden />{a.name}</div>
            <div className={cx('mt-1 text-xl font-bold num', (balances.get(a.id) ?? 0) < 0 && 'text-danger')}>{fmt(balances.get(a.id) ?? 0)}</div>
            {a.accountNo && <div className="text-xs text-text-muted">{a.accountNo}</div>}
          </button>
        ))}
      </div>
      {account && (
        <Card title={`${account.name}: entries`}>
          {ledger.length === 0 ? <p className="p-4 text-sm text-text-muted">No money has moved through this account yet. Opening balance {fmt(account.openingBalance)}.</p> : (
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead className="bg-surface text-left text-xs text-text-muted"><tr><th className="px-4 py-2 font-medium">Date</th><th className="px-2 py-2 font-medium">Entry</th><th className="px-2 py-2 font-medium">Party / note</th>
                <th className="px-2 py-2 text-right font-medium">In</th><th className="px-2 py-2 text-right font-medium">Out</th><th className="px-4 py-2 text-right font-medium">Balance</th></tr></thead>
              <tbody className="divide-y divide-border">{ledger.map(({ t, e, run }) => (
                <tr key={t.id}>
                  <td className="whitespace-nowrap px-4 py-2">{t.date}</td>
                  <td className="px-2 py-2"><Link to={`/txn/${t.id}`} className="hover:underline">{TXN[t.type].label} {t.number}</Link></td>
                  <td className="max-w-[240px] truncate px-2 py-2 text-text-muted">{b.parties.find((p) => p.id === t.partyId)?.name ?? t.partyName ?? t.notes ?? ''}</td>
                  <td className="num px-2 py-2 text-right text-success">{e > 0 ? fmt(e) : ''}</td><td className="num px-2 py-2 text-right text-danger">{e < 0 ? fmt(-e) : ''}</td>
                  <td className={cx('num px-4 py-2 text-right font-semibold', run < 0 && 'text-danger')}>{fmt(run)}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
          <p className="border-t border-border px-4 py-2.5 text-xs text-text-muted">A negative bank balance is shown as overdrawn. Use it for an overdraft or cash-credit account.</p>
        </Card>
      )}
      {cheques.length > 0 && (
        <Card title="Cheques" className="mt-4">
          <ul className="divide-y divide-border text-sm">{cheques.map((t) => (
            <li key={t.id} className="flex justify-between px-4 py-2.5"><Link to={`/txn/${t.id}`} className="hover:underline">{t.date} · {TXN[t.type].label} {t.number} · {b.parties.find((p) => p.id === t.partyId)?.name ?? ''}{t.payRef ? ` · cheque ${t.payRef}` : ''}</Link>
              <span className="num font-semibold">{fmt(t.type === 'payment_in' || t.type === 'payment_out' ? t.total : t.paid)}</span></li>
          ))}</ul>
        </Card>
      )}
      <Modal open={acct.open} onClose={() => setAcct({ ...acct, open: false })} title="Add bank account"
        footer={<><Button onClick={() => setAcct({ ...acct, open: false })}>Cancel</Button><Button variant="primary" onClick={addAccount}>Add</Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" className="sm:col-span-2">{(id) => <Input id={id} value={acct.name} placeholder="e.g. HDFC current" onChange={(e) => setAcct({ ...acct, name: e.target.value })} />}</Field>
          <Field label="Account no.">{(id) => <Input id={id} value={acct.accountNo} onChange={(e) => setAcct({ ...acct, accountNo: e.target.value })} />}</Field>
          <Field label="IFSC">{(id) => <Input id={id} value={acct.ifsc} onChange={(e) => setAcct({ ...acct, ifsc: e.target.value.toUpperCase() })} />}</Field>
          <Field label="UPI id">{(id) => <Input id={id} value={acct.upiId} onChange={(e) => setAcct({ ...acct, upiId: e.target.value })} />}</Field>
          <Field label="Opening balance" hint="Negative for an overdraft">{(id) => <Input id={id} inputMode="decimal" value={acct.opening} onChange={(e) => setAcct({ ...acct, opening: e.target.value })} />}</Field>
        </div>
      </Modal>
      <Modal open={mv.open} onClose={() => setMv({ ...mv, open: false })} title="Move money"
        footer={<><Button onClick={() => setMv({ ...mv, open: false })}>Cancel</Button><Button variant="primary" onClick={saveMove}>Save</Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="What happened" className="sm:col-span-2">{(id) => <Select id={id} value={mv.kind} onChange={(e) => setMv({ ...mv, kind: e.target.value as typeof mv.kind })}>
            <option value="transfer">Moved between accounts (deposit, withdrawal)</option><option value="add">Added money (capital, loan received)</option><option value="reduce">Took money out (drawings, loan repaid)</option></Select>}</Field>
          <Field label={mv.kind === 'add' ? 'Into' : 'From'}>{(id) => <Select id={id} value={mv.from} onChange={(e) => setMv({ ...mv, from: e.target.value })}>{b.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>}</Field>
          {mv.kind === 'transfer' && <Field label="To">{(id) => <Select id={id} value={mv.to} onChange={(e) => setMv({ ...mv, to: e.target.value })}><option value="">Choose…</option>{b.accounts.filter((a) => a.id !== mv.from).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>}</Field>}
          <Field label="Amount">{(id) => <Input id={id} inputMode="decimal" value={mv.amount} onChange={(e) => setMv({ ...mv, amount: e.target.value })} />}</Field>
          <Field label="Date">{(id) => <Input id={id} type="date" value={mv.date} onChange={(e) => setMv({ ...mv, date: e.target.value })} />}</Field>
          <Field label="Note" className="sm:col-span-2">{(id) => <Input id={id} value={mv.note} onChange={(e) => setMv({ ...mv, note: e.target.value })} />}</Field>
        </div>
      </Modal>
    </>
  );
}
