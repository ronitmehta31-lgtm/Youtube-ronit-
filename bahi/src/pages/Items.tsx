import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Boxes, Merge, Pencil, Plus, Search, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useBook } from '../App';
import { Button, Card, Chip, Empty, Field, Input, Modal, PageHeader, Select, cx, useToast } from '../components/ui';
import { ItemForm } from '../components/ItemForm';
import { db, deleteItem, mergeItems, uid } from '../lib/db';
import { costPrice, stockMovements, stockOf, todayStr } from '../lib/ledger';
import { fmt } from '../lib/money';
import { itemDetail } from '../lib/reports';

export default function Items() {
  const b = useBook();
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [form, setForm] = useState<{ open: boolean; edit?: boolean }>({ open: false });
  const [adj, setAdj] = useState({ open: false, mode: 'add' as 'add' | 'reduce', qty: '', reason: '', date: todayStr() });
  const [mergeOpen, setMergeOpen] = useState(false);
  const [merge, setMerge] = useState('');

  const moves = useMemo(() => stockMovements(b.txns), [b.txns]);
  const cats = b.categories.filter((c) => c.kind === 'item');
  const list = b.items.filter((i) => {
    const s = q.trim().toLowerCase();
    return (!s || i.name.toLowerCase().includes(s) || i.code?.toLowerCase() === s || i.barcode === s || i.hsn?.startsWith(s)) && (!cat || i.categoryId === cat);
  });
  const sel = b.items.find((i) => i.id === id);
  const history = useMemo(() => (sel ? itemDetail(b, sel.id) : null), [b, sel]);
  const qty = sel ? stockOf(sel, moves) : 0;

  const saveAdj = async () => {
    const n = Number(adj.qty);
    if (!sel || !n || n <= 0) return toast('Enter a quantity', 'danger');
    const signed = adj.mode === 'add' ? n : -n;
    await db.txns.add({ id: uid(), type: 'stock_adj', number: '', date: adj.date, notes: adj.reason || (adj.mode === 'add' ? 'Stock added' : 'Stock reduced'),
      lines: [{ itemId: sel.id, name: sel.name, unit: sel.unit, qty: signed, freeQty: 0, rate: 0, inclusive: false, discPct: 0, taxRate: 0, cessRate: 0, gross: 0, discount: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, cess: 0, amount: 0 }],
      billDiscount: 0, charges: [], roundOff: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, cess: 0, total: 0, paid: 0, createdAt: new Date().toISOString() });
    toast('Stock adjusted');
    setAdj({ ...adj, open: false, qty: '', reason: '' });
  };

  const remove = async () => {
    if (!sel || !confirm(`Delete ${sel.name}?`)) return;
    try { await deleteItem(sel.id); toast('Item deleted'); nav('/items'); } catch (e) { toast((e as Error).message, 'danger'); }
  };
  const doMerge = async () => {
    if (!sel || !merge) return;
    const into = b.items.find((i) => i.id === merge)!;
    if (!confirm(`Move every bill line and stock entry of "${sel.name}" to "${into.name}", then remove "${sel.name}"?`)) return;
    await mergeItems(sel.id, merge);
    toast('Items merged'); setMergeOpen(false); nav(`/items/${merge}`);
  };

  return (
    <>
      <PageHeader title="Items" sub="Products and services you sell or buy" actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setForm({ open: true })}>Add item</Button>} />
      {b.items.length === 0 ? (
        <Card><Empty icon={<Boxes size={22} />} title="No items yet" body="Add what you sell. Stock goes down when you bill and up when you buy." action={<Button variant="primary" onClick={() => setForm({ open: true })}>Add item</Button>} /></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
          <Card className={cx('flex flex-col', sel && 'hidden lg:flex')}>
            <div className="flex gap-2 border-b border-border p-3">
              <div className="relative flex-1"><Search size={16} className="absolute left-3 top-3 text-text-muted" aria-hidden />
                <Input aria-label="Search items" placeholder="Name, code, barcode, HSN" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" /></div>
              {cats.length > 0 && <Select aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value)} className="w-32"><option value="">All</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>}
            </div>
            {list.length === 0 ? <p className="p-4 text-sm text-text-muted">No item matches.</p> : (
              <ul className="max-h-[70vh] divide-y divide-border overflow-y-auto">
                {list.map((i) => {
                  const s = stockOf(i, moves);
                  const low = i.kind === 'product' && i.minStock > 0 && s <= i.minStock;
                  return (
                    <li key={i.id}><Link to={`/items/${i.id}`} className={cx('flex items-center gap-3 px-4 py-3 hover:bg-surface', i.id === id && 'bg-accent-soft')}>
                      <div className="min-w-0 flex-1"><div className="truncate font-medium">{i.name}</div><div className="text-xs text-text-muted">{fmt(i.salePrice)}{i.code ? ` · ${i.code}` : ''}</div></div>
                      {i.kind === 'service' ? <span className="text-xs text-text-muted">Service</span> : <div className="text-right"><div className={cx('num text-sm font-semibold', low && 'text-danger')}>{s} {i.unit}</div>{low && <div className="text-[11px] text-danger">low</div>}</div>}
                    </Link></li>
                  );
                })}
              </ul>
            )}
          </Card>
          {sel ? (
            <div className="flex min-w-0 flex-col gap-4">
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <Link to="/items" className="mb-1 inline-block text-xs font-semibold text-accent lg:hidden">← All items</Link>
                    <h2 className="text-lg font-bold">{sel.name}</h2>
                    <p className="text-sm text-text-muted">{[sel.code && `Code ${sel.code}`, sel.hsn && `HSN ${sel.hsn}`, `GST ${sel.taxRate}%`, sel.location].filter(Boolean).join(' · ')}</p>
                  </div>
                  {sel.kind === 'product' && <div className="text-right"><div className="text-xs text-text-muted">In stock</div>
                    <div className={cx('num text-xl font-bold', sel.minStock > 0 && qty <= sel.minStock && 'text-danger')}>{qty} {sel.unit}</div>
                    {sel.minStock > 0 && qty <= sel.minStock && <Chip status="low" />}</div>}
                </div>
                <dl className="grid grid-cols-2 gap-px border-t border-border bg-border sm:grid-cols-4">
                  {[['Sale price', fmt(sel.salePrice) + (sel.saleInclusive ? ' incl. GST' : ' + GST')], ['Purchase price', fmt(sel.purchasePrice) + (sel.purchaseInclusive ? ' incl.' : ' + GST')],
                    ['Stock value', fmt(Math.max(0, qty) * costPrice(sel))], ['Low stock at', sel.kind === 'product' ? `${sel.minStock} ${sel.unit}` : '—']].map(([k, v]) => (
                    <div key={k} className="bg-bg px-4 py-3"><dt className="text-xs text-text-muted">{k}</dt><dd className="num text-sm font-semibold">{v}</dd></div>
                  ))}
                </dl>
                <div className="flex flex-wrap gap-2 border-t border-border p-3">
                  {sel.kind === 'product' && <Button size="sm" icon={<SlidersHorizontal size={15} />} onClick={() => setAdj({ ...adj, open: true })}>Adjust stock</Button>}
                  {sel.kind === 'product' && sel.minStock > 0 && qty <= sel.minStock && <Button size="sm" onClick={() => nav(`/purchase/orders/new?item=${sel.id}`)}>Make purchase order</Button>}
                  <span className="flex-1" />
                  <Button size="sm" variant="ghost" icon={<Pencil size={15} />} onClick={() => setForm({ open: true, edit: true })}>Edit</Button>
                  <Button size="sm" variant="ghost" icon={<Merge size={15} />} onClick={() => setMergeOpen(true)}>Merge</Button>
                  <Button size="sm" variant="ghost" icon={<Trash2 size={15} />} onClick={remove} aria-label="Delete item" />
                </div>
              </Card>
              {sel.kind === 'product' && history && (
                <Card title="Stock history">
                  <div className="overflow-x-auto"><table className="w-full text-sm">
                    <thead className="bg-surface text-left text-xs text-text-muted"><tr>{history.columns.map((c) => <th key={c.key} className={cx('px-3 py-2 font-medium', c.kind === 'num' && 'text-right')}>{c.label}</th>)}</tr></thead>
                    <tbody className="divide-y divide-border">{[...history.rows].reverse().map((r, k) => (
                      <tr key={k}>{history.columns.map((c) => <td key={c.key} className={cx('px-3 py-2', c.kind === 'num' && 'num text-right', c.key === 'change' && Number(r.change) < 0 && 'text-danger')}>{c.key === 'change' && Number(r.change) > 0 ? '+' + r.change : r[c.key]}</td>)}</tr>
                    ))}</tbody>
                  </table></div>
                </Card>
              )}
            </div>
          ) : <Card className="hidden lg:block"><Empty title="Pick an item" body="Its stock, prices and history appear here." /></Card>}
        </div>
      )}
      <ItemForm open={form.open} onClose={() => setForm({ open: false })} item={form.edit ? sel : undefined} categories={cats} defaultInclusive={b.prefs.defaultInclusive} onSaved={(i) => nav(`/items/${i.id}`)} />
      <Modal open={adj.open} onClose={() => setAdj({ ...adj, open: false })} title={`Adjust stock: ${sel?.name ?? ''}`}
        footer={<><Button onClick={() => setAdj({ ...adj, open: false })}>Cancel</Button><Button variant="primary" onClick={saveAdj}>Save</Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Add or reduce">{(fid) => <Select id={fid} value={adj.mode} onChange={(e) => setAdj({ ...adj, mode: e.target.value as 'add' | 'reduce' })}><option value="add">Add stock</option><option value="reduce">Reduce stock</option></Select>}</Field>
          <Field label="Quantity">{(fid) => <Input id={fid} inputMode="decimal" value={adj.qty} onChange={(e) => setAdj({ ...adj, qty: e.target.value })} />}</Field>
          <Field label="Date">{(fid) => <Input id={fid} type="date" value={adj.date} onChange={(e) => setAdj({ ...adj, date: e.target.value })} />}</Field>
          <Field label="Reason">{(fid) => <Input id={fid} value={adj.reason} placeholder="Damaged, counted, gift…" onChange={(e) => setAdj({ ...adj, reason: e.target.value })} />}</Field>
        </div>
      </Modal>
      <Modal open={mergeOpen} onClose={() => setMergeOpen(false)} title={`Merge ${sel?.name ?? ''} into…`}
        footer={<><Button onClick={() => setMergeOpen(false)}>Cancel</Button><Button variant="primary" disabled={!merge} onClick={doMerge}>Merge</Button></>}>
        <p className="mb-3 text-sm text-text-muted">For duplicates: every bill line and stock entry moves to the item you pick, opening stock is added, and this one is removed.</p>
        <Select aria-label="Merge into" value={merge} onChange={(e) => setMerge(e.target.value)}><option value="">Choose an item</option>
          {b.items.filter((i) => i.id !== sel?.id).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</Select>
      </Modal>
    </>
  );
}
