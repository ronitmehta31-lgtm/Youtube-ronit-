import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { useBook } from '../App';
import { Button, Card, Field, Input, PageHeader, Select, Textarea, cx, useToast } from '../components/ui';
import { Combobox } from '../components/Combobox';
import { PartyForm } from '../components/PartyForm';
import { ItemForm } from '../components/ItemForm';
import { compute, convertDraft, db, markConverted, numberFor, returnDraft, saveTxn, type DraftLine, type DraftTxn } from '../lib/db';
import { STATES, GST_RATES, lineTax } from '../lib/gst';
import { costPrice, partyBalances, stockMovements, stockOf, todayStr } from '../lib/ledger';
import { fmt, rupeeInput, toPaise } from '../lib/money';
import type { Item, Txn, TxnType } from '../lib/types';
import { TXN } from '../lib/types';

interface Row { key: string; itemText: string; itemId?: string; name: string; hsn?: string; unit?: string; qty: string; freeQty: string; rate: string; inclusive: boolean; discPct: string; taxRate: number; cessRate: number }

const newRow = (): Row => ({ key: Math.random().toString(36).slice(2), itemText: '', name: '', qty: '', freeQty: '', rate: '', inclusive: false, discPct: '', taxRate: 0, cessRate: 0 });

const rowFromLine = (l: DraftLine): Row => ({ key: Math.random().toString(36).slice(2), itemText: l.name, itemId: l.itemId, name: l.name, hsn: l.hsn, unit: l.unit,
  qty: String(l.qty || ''), freeQty: l.freeQty ? String(l.freeQty) : '', rate: rupeeInput(l.rate), inclusive: l.inclusive, discPct: l.discPct ? String(l.discPct) : '', taxRate: l.taxRate, cessRate: l.cessRate });

/** Remount on every new URL so "Save and new" starts from a clean form. */
export default function TxnFormRoute(props: { type?: TxnType }) {
  const loc = useLocation();
  return <TxnForm key={loc.pathname + loc.search} {...props} />;
}

function TxnForm({ type: typeProp }: { type?: TxnType }) {
  const b = useBook();
  const nav = useNavigate();
  const toast = useToast();
  const { id: editId } = useParams();
  const [sp] = useSearchParams();
  const [loaded, setLoaded] = useState(false);
  const [type, setType] = useState<TxnType>(typeProp ?? 'sale');
  const meta = TXN[type];
  const isPurchaseSide = meta.side === 'purchase';
  const isExpense = type === 'expense' || type === 'other_income';

  const [existing, setExisting] = useState<Txn | null>(null);
  const [number, setNumber] = useState('');
  const [date, setDate] = useState(todayStr());
  const [dueDate, setDueDate] = useState('');
  const [partyId, setPartyId] = useState<string | undefined>();
  const [partyText, setPartyText] = useState('');
  const [partyPhone, setPartyPhone] = useState('');
  const [supply, setSupply] = useState(b.firm.stateCode);
  const [rows, setRows] = useState<Row[]>([newRow()]);
  const [billDiscount, setBillDiscount] = useState('');
  const [charge, setCharge] = useState({ label: 'Shipping', amount: '' });
  const [paid, setPaid] = useState('');
  const [fullPaid, setFullPaid] = useState(typeProp === 'expense' || typeProp === 'other_income');
  const [accountId, setAccountId] = useState('cash');
  const [payMode, setPayMode] = useState<Txn['payMode']>('cash');
  const [categoryId, setCategoryId] = useState('');
  const [notes, setNotes] = useState('');
  const [extra, setExtra] = useState({ poNumber: '', ewayBill: '', vehicleNo: '', reverseCharge: false });
  const [sourceId, setSourceId] = useState<string | undefined>();
  const [partyModal, setPartyModal] = useState<{ open: boolean; name?: string }>({ open: false });
  const [itemModal, setItemModal] = useState<{ open: boolean; name?: string; rowKey?: string }>({ open: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const itemRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const qtyRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const focusNext = useRef<string | null>(null);

  // Load: edit, convert, return, or blank with optional ?party= / ?item=
  useEffect(() => {
    (async () => {
      let d: DraftTxn | null = null;
      if (editId) {
        const t = await db.txns.get(editId);
        if (!t) { nav('/'); return; }
        setExisting(t); d = t;
        setNumber(t.number);
      } else if (sp.get('from')) d = await convertDraft(sp.get('from')!);
      else if (sp.get('return')) d = await returnDraft(sp.get('return')!);
      else if (sp.get('copy')) {
        const src = await db.txns.get(sp.get('copy')!);
        if (src) { const { id: _i, number: _n, createdAt: _c, updatedAt: _u, status: _s, links: _l, sourceId: _so, ...rest } = src; d = { ...rest, date: todayStr(), paid: 0, dueDate: undefined }; }
      }
      if (d) {
        setType(d.type);
        setDate(d.date); setDueDate(d.dueDate ?? ''); setPartyId(d.partyId);
        const p = b.parties.find((x) => x.id === d!.partyId);
        setPartyText(p?.name ?? d.partyName ?? ''); setPartyPhone(d.partyPhone ?? '');
        setSupply(d.stateOfSupply ?? b.firm.stateCode);
        setRows([...d.lines.map(rowFromLine), newRow()]);
        setBillDiscount(rupeeInput(d.billDiscount)); setCharge(d.charges[0] ? { label: d.charges[0].label, amount: rupeeInput(d.charges[0].amount) } : { label: 'Shipping', amount: '' });
        setPaid(rupeeInput(d.paid)); setAccountId(d.accountId ?? 'cash'); setPayMode(d.payMode ?? 'cash'); setCategoryId(d.categoryId ?? ''); setNotes(d.notes ?? '');
        setExtra({ poNumber: d.poNumber ?? '', ewayBill: d.ewayBill ?? '', vehicleNo: d.vehicleNo ?? '', reverseCharge: !!d.reverseCharge });
        setSourceId(d.sourceId);
        if (!editId) setNumber(await numberFor(d.type));
      } else {
        setNumber(await numberFor(typeProp ?? 'sale'));
        const pid = sp.get('party');
        if (pid) pickParty(pid);
        const iid = sp.get('item');
        if (iid) { const r = newRow(); setRows([r, newRow()]); setTimeout(() => pickItem(r.key, iid), 0); }
        if (typeProp === 'expense') setCategoryId(b.categories.find((c) => c.kind === 'expense')?.id ?? '');
        if (typeProp === 'other_income') setCategoryId(b.categories.find((c) => c.kind === 'income')?.id ?? '');
      }
      setLoaded(true);
    })().catch((e) => { toast(e.message, 'danger'); nav(-1); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const moves = useMemo(() => stockMovements(b.txns.filter((t) => t.id !== editId)), [b.txns, editId]);
  const balances = useMemo(() => partyBalances(b.parties, b.txns), [b.parties, b.txns]);
  const party = b.parties.find((p) => p.id === partyId);

  function pickParty(id: string) {
    const p = b.parties.find((x) => x.id === id);
    if (!p) return;
    setPartyId(id); setPartyText(p.name); setPartyPhone(p.phone ?? '');
    if (p.stateCode) setSupply(p.stateCode);
  }

  function priceFor(item: Item) {
    // Remember the last price this party paid for this item.
    if (partyId) {
      const last = [...b.txns].filter((t) => t.partyId === partyId && t.type === type).sort((a, c) => c.date.localeCompare(a.date))
        .flatMap((t) => t.lines).find((l) => l.itemId === item.id);
      if (last) return { rate: last.rate, inclusive: last.inclusive };
    }
    return isPurchaseSide ? { rate: item.purchasePrice, inclusive: item.purchaseInclusive } : { rate: item.salePrice, inclusive: item.saleInclusive };
  }

  function pickItem(rowKey: string, itemId: string) {
    const item = b.items.find((i) => i.id === itemId) ?? null;
    if (!item) return;
    const { rate, inclusive } = priceFor(item);
    setRows((rs) => {
      const next = rs.map((r) => (r.key === rowKey ? { ...r, itemId: item.id, itemText: item.name, name: item.name, hsn: item.hsn, unit: item.unit,
        qty: r.qty || '1', rate: rupeeInput(rate), inclusive, taxRate: item.taxRate, cessRate: item.cessRate } : r));
      return next[next.length - 1].itemId || next[next.length - 1].name ? [...next, newRow()] : next;
    });
    focusNext.current = 'qty:' + rowKey;
  }

  useEffect(() => {
    const f = focusNext.current;
    if (!f) return;
    focusNext.current = null;
    const [kind, key] = f.split(':');
    const el = kind === 'qty' ? qtyRefs.current[key] : itemRefs.current[key];
    el?.focus(); el?.select?.();
  });

  const setRow = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const removeRow = (key: string) => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== key) : [newRow()]));
  const nextRow = (key: string) => {
    const i = rows.findIndex((r) => r.key === key);
    if (i === rows.length - 1) { const r = newRow(); setRows((rs) => [...rs, r]); focusNext.current = 'item:' + r.key; }
    else focusNext.current = 'item:' + rows[i + 1].key;
    // trigger effect
    setRows((rs) => [...rs]);
  };

  const draft: DraftTxn = {
    type, number, date, dueDate: dueDate || undefined, partyId, partyName: partyId ? undefined : partyText.trim() || undefined, partyPhone: partyId ? undefined : partyPhone || undefined,
    stateOfSupply: supply, reverseCharge: extra.reverseCharge || undefined,
    lines: rows.filter((r) => r.name.trim() || r.itemText.trim()).map((r) => ({
      itemId: r.itemId, name: (r.name || r.itemText).trim(), hsn: r.hsn, unit: r.unit, qty: Number(r.qty) || (isExpense && !r.itemId ? 1 : 0), freeQty: Number(r.freeQty) || 0,
      rate: toPaise(r.rate || 0), inclusive: r.inclusive, discPct: Number(r.discPct) || 0, taxRate: r.taxRate, cessRate: r.cessRate,
    })),
    billDiscount: toPaise(billDiscount || 0), charges: charge.amount ? [{ label: charge.label || 'Charges', amount: toPaise(charge.amount) }] : [],
    paid: 0, accountId, payMode, categoryId: categoryId || undefined, notes: notes || undefined,
    poNumber: extra.poNumber || undefined, ewayBill: extra.ewayBill || undefined, vehicleNo: extra.vehicleNo || undefined, sourceId,
    status: meta.isDoc ? existing?.status ?? 'open' : undefined, id: existing?.id, createdAt: existing?.createdAt,
  };
  const preview = compute(draft, b.firm, b.prefs);
  const paidP = fullPaid ? preview.total : toPaise(paid || 0);
  const balance = preview.total - paidP;
  const inter = supply !== b.firm.stateCode;
  const canPay = !meta.isDoc;
  const payLabel = meta.side === 'purchase' || type === 'expense' || type === 'sale_return' ? 'Paid' : 'Received';

  const profit = preview.lines.reduce((s, l) => { const it = b.items.find((i) => i.id === l.itemId); return s + l.taxable - (it ? (l.qty + l.freeQty) * costPrice(it) : 0); }, 0);
  const partyBal = party ? balances.get(party.id) ?? 0 : 0;
  const overLimit = !!party?.creditLimit && type === 'sale' && partyBal - (existing ? existing.total - existing.paid : 0) + balance > party.creditLimit;
  const shortStock = (type === 'sale' || type === 'purchase_return') ? preview.lines.filter((l) => {
    const it = b.items.find((i) => i.id === l.itemId);
    return it && it.kind === 'product' && stockOf(it, moves) < l.qty + l.freeQty;
  }) : [];

  async function save(then: 'view' | 'new' | 'print') {
    setError('');
    if (!partyId && partyText.trim() && !['sale', 'estimate', 'sale_order', 'delivery_challan', 'expense', 'other_income'].includes(type)) {
      setError(`"${partyText}" is not a saved party. Pick one from the list or add it.`); return;
    }
    if (type === 'sale' && !partyId && canPay && balance > 0) {
      setError('A sale without a saved party must be received in full. Tick "Received in full", or pick or add the customer as a party.'); return;
    }
    setBusy(true);
    try {
      const saved = await saveTxn({ ...draft, paid: canPay ? paidP : 0 });
      if (sourceId && !existing && TXN[saved.type].isDoc === false) {
        const src = await db.txns.get(sourceId);
        if (src && TXN[src.type].isDoc) await markConverted(sourceId);
      }
      toast(`${meta.label} ${saved.number} saved`);
      if (then === 'new') nav(`/${meta.path}/new?again=${Date.now()}`, { replace: true });
      else nav(`/txn/${saved.id}${then === 'print' ? '?print=1' : '?saved=1'}`, { replace: true });
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }

  // Ctrl+S save, Ctrl+P save and print
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save('view'); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') { e.preventDefault(); save('print'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!loaded) return <p className="text-text-muted">Loading…</p>;

  const partyOptions = b.parties.map((p) => {
    const v = balances.get(p.id) ?? 0;
    return { id: p.id, label: p.name, sub: [p.phone, p.gstin].filter(Boolean).join(' · '), exact: [p.phone ?? ''].filter(Boolean),
      right: v ? <span className={v > 0 ? 'text-success' : 'text-danger'}>{fmt(Math.abs(v))}</span> : null };
  });
  const itemOptions = b.items.map((i) => ({ id: i.id, label: i.name, sub: [i.code, fmt(isPurchaseSide ? i.purchasePrice : i.salePrice)].filter(Boolean).join(' · '),
    exact: [i.code ?? '', i.barcode ?? ''].filter(Boolean), right: i.kind === 'product' ? <span className="text-text-muted">{stockOf(i, moves)} {i.unit}</span> : null }));
  const cats = b.categories.filter((c) => c.kind === (type === 'other_income' ? 'income' : 'expense'));
  const cellIn = 'h-9 w-full rounded-md border border-border-input bg-bg px-2 text-sm text-right num focus:outline-none focus:ring-2 focus:ring-accent';

  return (
    <>
      <PageHeader title={`${existing ? 'Edit' : 'New'} ${meta.label.toLowerCase()}`} sub={sourceId && !existing ? 'Prefilled from an earlier document. Check and save.' : undefined}
        actions={<Button variant="ghost" onClick={() => nav(-1)}>Cancel</Button>} />
      <form onSubmit={(e) => { e.preventDefault(); save('view'); }} noValidate>
        <Card className="mb-4">
          <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
            {isExpense ? (
              <Field label="Category">{(id) => (
                <Select id={id} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">Choose…</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>)}
              </Field>
            ) : null}
            <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-1">
              <span className="text-xs font-medium text-text-muted">{meta.partyLabel}</span>
              <Combobox label={meta.partyLabel} options={partyOptions} value={partyText} placeholder={type === 'sale' ? 'Search, or type a name for a cash sale' : 'Search name or phone'}
                onText={(t) => { setPartyText(t); setPartyId(undefined); }} onPick={pickParty}
                onCreate={(t) => setPartyModal({ open: true, name: t })} createLabel={(t) => `+ Add "${t}" as a new party`} />
              {party ? <span className={cx('text-xs', partyBal > 0 ? 'text-success' : partyBal < 0 ? 'text-danger' : 'text-text-muted')}>
                Balance: {fmt(Math.abs(partyBal))} {partyBal > 0 ? 'to receive' : partyBal < 0 ? 'to pay' : ''}</span>
                : partyText && type === 'sale' ? <span className="text-xs text-text-muted">Cash sale to "{partyText}"</span> : null}
            </div>
            {!party && partyText && type === 'sale' && (
              <Field label="Customer phone (optional)">{(id) => <Input id={id} type="tel" value={partyPhone} onChange={(e) => setPartyPhone(e.target.value)} />}</Field>
            )}
            <Field label={`${meta.label} no.`}>{(id) => <Input id={id} value={number} onChange={(e) => setNumber(e.target.value)} />}</Field>
            <Field label="Date">{(id) => <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
            {(type === 'sale' || type === 'purchase' || type === 'sale_order' || type === 'purchase_order') && (
              <Field label={type.endsWith('order') ? 'Delivery by' : 'Due date'}>{(id) => <Input id={id} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />}</Field>
            )}
            {b.firm.gstEnabled && !isExpense && (
              <Field label="Place of supply" hint={inter ? 'Other state: IGST' : 'Same state: CGST + SGST'}>{(id) => (
                <Select id={id} value={supply} onChange={(e) => setSupply(e.target.value)}>{STATES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</Select>)}
              </Field>
            )}
          </div>
          {!isExpense && (
            <details className="border-t border-border px-4 py-2 text-sm">
              <summary className="cursor-pointer py-1 font-medium text-text-muted">More details: PO number, e-way bill, vehicle{isPurchaseSide ? ', reverse charge' : ''}</summary>
              <div className="grid gap-4 py-3 sm:grid-cols-4">
                <Field label="Customer PO no.">{(id) => <Input id={id} value={extra.poNumber} onChange={(e) => setExtra({ ...extra, poNumber: e.target.value })} />}</Field>
                <Field label="E-way bill no.">{(id) => <Input id={id} value={extra.ewayBill} onChange={(e) => setExtra({ ...extra, ewayBill: e.target.value })} />}</Field>
                <Field label="Vehicle no.">{(id) => <Input id={id} value={extra.vehicleNo} onChange={(e) => setExtra({ ...extra, vehicleNo: e.target.value.toUpperCase() })} />}</Field>
                {isPurchaseSide && <label className="flex items-center gap-2 pt-6 text-sm"><input type="checkbox" checked={extra.reverseCharge} onChange={(e) => setExtra({ ...extra, reverseCharge: e.target.checked })} /> Reverse charge applies</label>}
              </div>
            </details>
          )}
        </Card>

        <Card className="mb-4">
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-surface text-left text-xs text-text-muted">
                <tr>
                  <th className="w-8 px-3 py-2 font-medium">#</th>
                  <th className="px-2 py-2 font-medium">{isExpense ? 'Item or description' : 'Item (name, code or barcode)'}</th>
                  <th className="w-20 px-2 py-2 text-right font-medium">Qty</th>
                  {!isExpense && <th className="w-16 px-2 py-2 text-right font-medium">Free</th>}
                  <th className="w-28 px-2 py-2 text-right font-medium">Price</th>
                  {!isExpense && <th className="w-16 px-2 py-2 text-right font-medium">Disc %</th>}
                  {b.firm.gstEnabled && <th className="w-24 px-2 py-2 text-right font-medium">GST</th>}
                  <th className="w-28 px-2 py-2 text-right font-medium">Amount</th>
                  <th className="w-10 px-2 py-2"><span className="sr-only">Remove</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r, idx) => {
                  const line = r.name.trim() || r.itemText.trim() ? lineTax({ qty: Number(r.qty) || (isExpense && !r.itemId ? 1 : 0), rate: toPaise(r.rate || 0), inclusive: r.inclusive,
                    discPct: Number(r.discPct) || 0, taxRate: b.firm.gstEnabled ? r.taxRate : 0, cessRate: b.firm.gstEnabled ? r.cessRate : 0 }, inter) : null;
                  return (
                    <tr key={r.key} className="align-top">
                      <td className="px-3 py-2 text-text-muted">{idx + 1}</td>
                      <td className="px-2 py-1.5">
                        <Combobox ref={(el) => { itemRefs.current[r.key] = el; }} label={`Item, row ${idx + 1}`} options={itemOptions} value={r.itemText} inputClassName="h-9"
                          placeholder={idx === 0 ? 'Type to search, Enter to add' : ''}
                          onText={(t) => setRow(r.key, { itemText: t, name: t, itemId: undefined })} onPick={(iid) => pickItem(r.key, iid)}
                          onCreate={isExpense ? undefined : (t) => setItemModal({ open: true, name: t, rowKey: r.key })} createLabel={(t) => `+ Add "${t}" as a new item`} />
                        {r.unit && <div className="mt-0.5 text-[11px] text-text-muted">{r.hsn ? `HSN ${r.hsn} · ` : ''}{r.unit}{r.inclusive ? ' · price incl. GST' : ''}</div>}
                      </td>
                      <td className="px-2 py-1.5"><input ref={(el) => { qtyRefs.current[r.key] = el; }} aria-label={`Quantity, row ${idx + 1}`} inputMode="decimal" className={cellIn} value={r.qty}
                        onChange={(e) => setRow(r.key, { qty: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); nextRow(r.key); } }} /></td>
                      {!isExpense && <td className="px-2 py-1.5"><input aria-label={`Free quantity, row ${idx + 1}`} inputMode="decimal" className={cellIn} value={r.freeQty}
                        onChange={(e) => setRow(r.key, { freeQty: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); nextRow(r.key); } }} /></td>}
                      <td className="px-2 py-1.5"><input aria-label={`Price, row ${idx + 1}`} inputMode="decimal" className={cellIn} value={r.rate}
                        onChange={(e) => setRow(r.key, { rate: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); nextRow(r.key); } }} /></td>
                      {!isExpense && <td className="px-2 py-1.5"><input aria-label={`Discount percent, row ${idx + 1}`} inputMode="decimal" className={cellIn} value={r.discPct}
                        onChange={(e) => setRow(r.key, { discPct: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); nextRow(r.key); } }} /></td>}
                      {b.firm.gstEnabled && <td className="px-2 py-1.5">
                        <select aria-label={`GST rate, row ${idx + 1}`} className="h-9 w-full rounded-md border border-border-input bg-bg px-1 text-right text-sm" value={r.taxRate}
                          onChange={(e) => setRow(r.key, { taxRate: Number(e.target.value) })}>{GST_RATES.map((x) => <option key={x} value={x}>{x}%</option>)}</select>
                        {line && (line.cgst + line.sgst + line.igst) > 0 && <div className="mt-0.5 text-right text-[11px] text-text-muted num">{fmt(line.cgst + line.sgst + line.igst)}</div>}
                      </td>}
                      <td className="num px-2 py-2.5 text-right font-semibold">{line ? fmt(line.amount) : ''}</td>
                      <td className="px-2 py-1.5"><button type="button" aria-label={`Remove row ${idx + 1}`} onClick={() => removeRow(r.key)} className="grid h-9 w-9 place-items-center rounded-md text-text-muted hover:bg-danger-soft hover:text-danger"><Trash2 size={16} /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-border p-3">
            <Button size="sm" variant="ghost" icon={<Plus size={15} />} onClick={() => { const r = newRow(); setRows((rs) => [...rs, r]); focusNext.current = 'item:' + r.key; }}>Add row</Button>
            <span className="text-xs text-text-muted">Enter moves to the next row · Ctrl+S saves · Ctrl+P saves and prints</span>
          </div>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
          <Card>
            <div className="grid gap-4 p-4">
              <Field label="Notes (printed on the bill)">{(id) => <Textarea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} />}</Field>
              {shortStock.length > 0 && <p className="flex items-start gap-2 rounded-md bg-warning-soft p-3 text-sm text-warning"><AlertTriangle size={16} className="mt-0.5 shrink-0" />
                Not enough stock for {shortStock.map((l) => l.name).join(', ')}. You can still save; stock will go negative.</p>}
              {overLimit && <p className="flex items-start gap-2 rounded-md bg-danger-soft p-3 text-sm text-danger"><AlertTriangle size={16} className="mt-0.5 shrink-0" />
                This bill takes {party!.name} past their credit limit of {fmt(party!.creditLimit!)}.</p>}
              {type === 'sale' && b.prefs.showProfitOnSale && preview.lines.length > 0 && <p className="text-sm text-text-muted">Profit on this bill (before tax): <b className={profit < 0 ? 'text-danger' : 'text-success'}>{fmt(profit)}</b></p>}
            </div>
          </Card>
          <Card>
            <dl className="divide-y divide-border text-sm">
              <div className="flex justify-between px-4 py-2"><dt className="text-text-muted">Items total</dt><dd className="num">{fmt(preview.lines.reduce((s, l) => s + l.amount, 0))}</dd></div>
              {b.firm.gstEnabled && (preview.cgst + preview.sgst + preview.igst + preview.cess) > 0 && (
                <div className="flex justify-between px-4 py-2 text-xs text-text-muted"><dt>Includes {inter ? `IGST ${fmt(preview.igst)}` : `CGST ${fmt(preview.cgst)} + SGST ${fmt(preview.sgst)}`}{preview.cess ? ` + cess ${fmt(preview.cess)}` : ''}</dt><dd className="num">on {fmt(preview.taxable)}</dd></div>
              )}
              {!isExpense && <div className="flex items-center justify-between gap-2 px-4 py-1.5"><dt className="text-text-muted">Discount on bill (₹)</dt>
                <dd><Input aria-label="Discount on bill" inputMode="decimal" value={billDiscount} onChange={(e) => setBillDiscount(e.target.value)} className="h-9 w-28 text-right num" /></dd></div>}
              {!isExpense && <div className="flex items-center justify-between gap-2 px-4 py-1.5">
                <dt><Input aria-label="Charge name" value={charge.label} onChange={(e) => setCharge({ ...charge, label: e.target.value })} className="h-9 w-36" /></dt>
                <dd><Input aria-label="Charge amount" inputMode="decimal" value={charge.amount} onChange={(e) => setCharge({ ...charge, amount: e.target.value })} className="h-9 w-28 text-right num" placeholder="0" /></dd></div>}
              {preview.roundOff !== 0 && <div className="flex justify-between px-4 py-2 text-text-muted"><dt>Round off</dt><dd className="num">{fmt(preview.roundOff)}</dd></div>}
              <div className="flex justify-between bg-surface px-4 py-3 text-base font-bold"><dt>Total</dt><dd className="num">{fmt(preview.total)}</dd></div>
              {canPay && <>
                <div className="flex items-center justify-between gap-2 px-4 py-1.5">
                  <dt className="flex items-center gap-2"><label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={fullPaid} onChange={(e) => setFullPaid(e.target.checked)} /> {payLabel} in full</label></dt>
                  <dd><Input aria-label={`${payLabel} amount`} inputMode="decimal" value={fullPaid ? rupeeInput(preview.total) : paid} disabled={fullPaid} onChange={(e) => setPaid(e.target.value)} className="h-9 w-28 text-right num" placeholder="0" /></dd>
                </div>
                {paidP > 0 && <div className="flex items-center justify-between gap-2 px-4 py-1.5">
                  <dt className="text-text-muted">Into / from</dt>
                  <dd className="flex gap-2">
                    <Select aria-label="Payment mode" value={payMode} onChange={(e) => setPayMode(e.target.value as Txn['payMode'])} className="h-9 w-24"><option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option><option value="bank">Bank</option><option value="cheque">Cheque</option></Select>
                    <Select aria-label="Account" value={accountId} onChange={(e) => setAccountId(e.target.value)} className="h-9 w-32">{b.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>
                  </dd>
                </div>}
                <div className="flex justify-between px-4 py-2 font-semibold"><dt>Balance</dt><dd className={cx('num', balance > 0 && 'text-danger')}>{fmt(balance)}</dd></div>
              </>}
            </dl>
            {error && <p role="alert" className="mx-4 mb-2 rounded-md bg-danger-soft p-2.5 text-sm text-danger">{error}</p>}
            <div className="flex flex-wrap justify-end gap-2 border-t border-border p-3">
              {!existing && <Button disabled={busy} onClick={() => save('new')}>Save and new</Button>}
              <Button disabled={busy} onClick={() => save('print')}>Save and print</Button>
              <Button type="submit" variant="primary" disabled={busy}>Save</Button>
            </div>
          </Card>
        </div>
      </form>
      <PartyForm open={partyModal.open} initialName={partyModal.name} defaultState={b.firm.stateCode} onClose={() => setPartyModal({ open: false })} onSaved={(p) => {
        setPartyId(p.id); setPartyText(p.name); setPartyPhone(p.phone ?? ''); if (p.stateCode) setSupply(p.stateCode);
      }} />
      <ItemForm open={itemModal.open} initialName={itemModal.name} categories={b.categories.filter((c) => c.kind === 'item')} defaultInclusive={b.prefs.defaultInclusive}
        onClose={() => setItemModal({ open: false })} onSaved={(i) => { if (itemModal.rowKey) setTimeout(() => pickItemDirect(itemModal.rowKey!, i), 0); }} />
    </>
  );

  function pickItemDirect(rowKey: string, item: Item) {
    const rate = isPurchaseSide ? item.purchasePrice : item.salePrice;
    const inclusive = isPurchaseSide ? item.purchaseInclusive : item.saleInclusive;
    setRows((rs) => {
      const next = rs.map((r) => (r.key === rowKey ? { ...r, itemId: item.id, itemText: item.name, name: item.name, hsn: item.hsn, unit: item.unit, qty: r.qty || '1', rate: rupeeInput(rate), inclusive, taxRate: item.taxRate, cessRate: item.cessRate } : r));
      return next[next.length - 1].name ? [...next, newRow()] : next;
    });
    focusNext.current = 'qty:' + rowKey;
  }
}
