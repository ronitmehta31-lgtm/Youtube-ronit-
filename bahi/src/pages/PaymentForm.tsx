import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useBook } from '../App';
import { Button, Card, Field, Input, PageHeader, Select, Textarea, cx, useToast } from '../components/ui';
import { Combobox } from '../components/Combobox';
import { db, numberFor, saveTxn } from '../lib/db';
import { autoAllocate, partyBalances, payStatus, settledOn, todayStr } from '../lib/ledger';
import { fmt, rupeeInput, toPaise } from '../lib/money';
import type { Txn } from '../lib/types';
import { TXN } from '../lib/types';

export default function PaymentFormRoute(props: { type: 'payment_in' | 'payment_out' }) {
  const loc = useLocation();
  return <PaymentForm key={loc.pathname + loc.search} {...props} />;
}

function PaymentForm({ type }: { type: 'payment_in' | 'payment_out' }) {
  const b = useBook();
  const nav = useNavigate();
  const toast = useToast();
  const [sp] = useSearchParams();
  const meta = TXN[type];
  const billType = type === 'payment_in' ? 'sale' : 'purchase';
  const [existing, setExisting] = useState<Txn | null>(null);
  const [partyId, setPartyId] = useState<string | undefined>(sp.get('party') || undefined);
  const [partyText, setPartyText] = useState(b.parties.find((p) => p.id === sp.get('party'))?.name ?? '');
  const [number, setNumber] = useState('');
  const [date, setDate] = useState(todayStr());
  const [amount, setAmount] = useState('');
  const [discount, setDiscount] = useState('');
  const [accountId, setAccountId] = useState('cash');
  const [payMode, setPayMode] = useState<Txn['payMode']>('cash');
  const [ref, setRef] = useState('');
  const [notes, setNotes] = useState('');
  const [alloc, setAlloc] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const editId = sp.get('edit');
      if (editId) {
        const t = await db.txns.get(editId);
        if (!t) return;
        setExisting(t); setNumber(t.number); setDate(t.date); setPartyId(t.partyId); setPartyText(b.parties.find((p) => p.id === t.partyId)?.name ?? '');
        setAmount(rupeeInput(t.total)); setDiscount(rupeeInput(t.payDiscount ?? 0)); setAccountId(t.accountId ?? 'cash'); setPayMode(t.payMode ?? 'cash');
        setRef(t.payRef ?? ''); setNotes(t.notes ?? '');
        setAlloc(Object.fromEntries((t.links ?? []).map((l) => [l.txnId, rupeeInput(l.amount)])));
      } else {
        setNumber(await numberFor(type));
        const inv = sp.get('invoice');
        if (inv) {
          const t = b.txns.find((x) => x.id === inv);
          if (t) { const due = payStatus(t, b.txns, todayStr()).due; setAmount(rupeeInput(due)); setAlloc({ [inv]: rupeeInput(due) }); }
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bal = useMemo(() => partyBalances(b.parties, b.txns.filter((t) => t.id !== existing?.id)), [b, existing]);
  // Open bills of this party, with what is still due ignoring this payment's own links.
  const open = useMemo(() => {
    if (!partyId) return [];
    const others = b.txns.filter((t) => t.id !== existing?.id);
    return b.txns.filter((t) => t.type === billType && t.partyId === partyId)
      .map((t) => ({ t, due: Math.max(0, t.total - settledOn(t, others)) }))
      .filter((x) => x.due > 0 || alloc[x.t.id])
      .sort((a, c) => a.t.date.localeCompare(c.t.date));
  }, [b.txns, partyId, billType, existing, alloc]);

  const amt = toPaise(amount || 0);
  const disc = toPaise(discount || 0);
  const allocated = Object.values(alloc).reduce((s, v) => s + toPaise(v || 0), 0);
  const pv = partyId ? bal.get(partyId) ?? 0 : 0;

  const autoLink = () => {
    const a = autoAllocate(amt + disc, open.map((x) => ({ id: x.t.id, due: x.due, date: x.t.date })));
    setAlloc(Object.fromEntries(a.map((x) => [x.txnId, rupeeInput(x.amount)])));
  };

  const save = async () => {
    setError('');
    if (!partyId) return setError(`Choose who this is ${type === 'payment_in' ? 'from' : 'to'}`);
    if (amt <= 0) return setError('Enter the amount');
    if (allocated > amt + disc) return setError(`You linked ${fmt(allocated)} to bills but the payment is ${fmt(amt + disc)}`);
    for (const x of open) if (toPaise(alloc[x.t.id] || 0) > x.due) return setError(`${x.t.number} only has ${fmt(x.due)} due`);
    setBusy(true);
    try {
      const links = Object.entries(alloc).map(([txnId, v]) => ({ txnId, amount: toPaise(v || 0) })).filter((l) => l.amount > 0);
      const saved = await saveTxn({ type, id: existing?.id, createdAt: existing?.createdAt, number, date, partyId, total: amt, payDiscount: disc || undefined, accountId, payMode,
        payRef: ref || undefined, notes: notes || undefined, links, lines: [], billDiscount: 0, charges: [], paid: amt });
      toast(`${meta.label} ${saved.number} saved`);
      nav(`/txn/${saved.id}?saved=1`, { replace: true });
    } catch (e) { setError((e as Error).message); setBusy(false); }
  };

  return (
    <>
      <PageHeader title={existing ? `Edit ${meta.label.toLowerCase()}` : meta.label} actions={<Button variant="ghost" onClick={() => nav(-1)}>Cancel</Button>} />
      <form onSubmit={(e) => { e.preventDefault(); save(); }} noValidate className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <Card>
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-xs font-medium text-text-muted">{meta.partyLabel}</span>
              <Combobox label={meta.partyLabel} value={partyText} placeholder="Search name or phone"
                options={b.parties.map((p) => ({ id: p.id, label: p.name, sub: p.phone, exact: [p.phone ?? ''].filter(Boolean),
                  right: (() => { const v = bal.get(p.id) ?? 0; return v ? <span className={v > 0 ? 'text-success' : 'text-danger'}>{fmt(Math.abs(v))}</span> : null; })() }))}
                onText={(t) => { setPartyText(t); setPartyId(undefined); setAlloc({}); }}
                onPick={(id) => { setPartyId(id); setPartyText(b.parties.find((p) => p.id === id)!.name); setAlloc({}); }} />
              {partyId && <span className={cx('text-xs', pv > 0 ? 'text-success' : pv < 0 ? 'text-danger' : 'text-text-muted')}>
                Balance before this payment: {fmt(Math.abs(pv))} {pv > 0 ? 'they owe you' : pv < 0 ? 'you owe them' : ''}</span>}
            </div>
            <Field label="Amount">{(id) => <Input id={id} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="text-lg font-semibold num" />}</Field>
            <Field label={type === 'payment_in' ? 'Discount given (optional)' : 'Discount received (optional)'} hint="Settles the bill without the money">{(id) => <Input id={id} inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} />}</Field>
            <Field label="Receipt no.">{(id) => <Input id={id} value={number} onChange={(e) => setNumber(e.target.value)} />}</Field>
            <Field label="Date">{(id) => <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
            <Field label="Mode">{(id) => <Select id={id} value={payMode} onChange={(e) => setPayMode(e.target.value as Txn['payMode'])}>
              <option value="cash">Cash</option><option value="upi">UPI</option><option value="bank">Bank transfer</option><option value="cheque">Cheque</option><option value="card">Card</option></Select>}</Field>
            <Field label="Account">{(id) => <Select id={id} value={accountId} onChange={(e) => setAccountId(e.target.value)}>{b.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>}</Field>
            <Field label="Reference (UPI ref, cheque no.)">{(id) => <Input id={id} value={ref} onChange={(e) => setRef(e.target.value)} />}</Field>
            <Field label="Notes">{(id) => <Textarea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} />}</Field>
          </div>
        </Card>
        <Card title="Settle bills" action={open.length > 0 ? <Button size="sm" onClick={autoLink}>Oldest first</Button> : undefined}>
          {!partyId ? <p className="p-4 text-sm text-text-muted">Pick a party to see their unpaid bills.</p>
            : open.length === 0 ? <p className="p-4 text-sm text-text-muted">No unpaid {billType === 'sale' ? 'invoices' : 'bills'}. This will be saved as an advance.</p> : (
              <ul className="divide-y divide-border">
                {open.map(({ t, due }) => (
                  <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1 text-sm"><div className="font-medium">{t.number}</div><div className="text-xs text-text-muted">{t.date} · due {fmt(due)}</div></div>
                    <Input aria-label={`Amount for ${t.number}`} inputMode="decimal" value={alloc[t.id] ?? ''} placeholder="0" className="h-9 w-28 text-right num"
                      onChange={(e) => setAlloc({ ...alloc, [t.id]: e.target.value })} />
                  </li>
                ))}
              </ul>
            )}
          <div className="border-t border-border px-4 py-3 text-sm">
            <div className="flex justify-between"><span className="text-text-muted">Linked to bills</span><span className="num">{fmt(allocated)}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Left as advance</span><span className="num">{fmt(Math.max(0, amt + disc - allocated))}</span></div>
          </div>
          {error && <p role="alert" className="mx-4 mb-3 rounded-md bg-danger-soft p-2.5 text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2 border-t border-border p-3"><Button type="submit" variant="primary" disabled={busy}>Save payment</Button></div>
        </Card>
      </form>
    </>
  );
}
