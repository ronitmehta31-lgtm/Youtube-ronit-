import { useEffect, useState } from 'react';
import { Button, Field, Input, Modal, Select, Textarea, useToast } from './ui';
import { db, saveItem, uid } from '../lib/db';
import { GST_RATES } from '../lib/gst';
import { rupeeInput, toPaise } from '../lib/money';
import type { Category, Item } from '../lib/types';

export const UNITS = ['Pcs', 'Nos', 'Kg', 'Gm', 'Ltr', 'Ml', 'Mtr', 'Box', 'Bag', 'Btl', 'Pack', 'Dozen', 'Pair', 'Set', 'Roll', 'Sqft'];

export function ItemForm({ open, onClose, item, initialName, onSaved, categories, defaultInclusive }: {
  open: boolean; onClose: () => void; item?: Item; initialName?: string; onSaved?: (i: Item) => void; categories: Category[]; defaultInclusive: boolean;
}) {
  const toast = useToast();
  const empty = () => ({ kind: 'product', name: initialName ?? '', code: '', barcode: '', hsn: '', unit: 'Pcs', categoryId: '', salePrice: '', saleInclusive: defaultInclusive ? 'yes' : 'no',
    purchasePrice: '', purchaseInclusive: 'no', taxRate: '18', cessRate: '0', openingStock: '', minStock: '', mrp: '', location: '', description: '' });
  const [f, setF] = useState<Record<string, string>>(empty());
  const [newCat, setNewCat] = useState('');
  const [err, setErr] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setErr({}); setNewCat('');
    if (item) setF({ kind: item.kind, name: item.name, code: item.code ?? '', barcode: item.barcode ?? '', hsn: item.hsn ?? '', unit: item.unit, categoryId: item.categoryId ?? '',
      salePrice: rupeeInput(item.salePrice), saleInclusive: item.saleInclusive ? 'yes' : 'no', purchasePrice: rupeeInput(item.purchasePrice), purchaseInclusive: item.purchaseInclusive ? 'yes' : 'no',
      taxRate: String(item.taxRate), cessRate: String(item.cessRate), openingStock: String(item.openingStock || ''), minStock: String(item.minStock || ''), mrp: rupeeInput(item.mrp ?? 0),
      location: item.location ?? '', description: item.description ?? '' });
    else setF(empty());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item, initialName]);

  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));
  const product = f.kind === 'product';

  const save = async () => {
    const er: Record<string, string> = {};
    if (!f.name.trim()) er.name = 'Enter a name';
    if (f.hsn && !/^\d{4,8}$/.test(f.hsn)) er.hsn = 'HSN/SAC is 4 to 8 digits';
    if (isNaN(Number(f.openingStock || 0))) er.openingStock = 'Enter a number';
    setErr(er);
    if (Object.keys(er).length) return;
    let categoryId = f.categoryId || undefined;
    if (newCat.trim()) { categoryId = uid(); await db.categories.add({ id: categoryId, kind: 'item', name: newCat.trim() }); }
    try {
      const saved = await saveItem({
        ...item, kind: f.kind as Item['kind'], name: f.name, code: f.code || undefined, barcode: f.barcode || undefined, hsn: f.hsn || undefined, unit: f.unit, categoryId,
        salePrice: toPaise(f.salePrice || 0), saleInclusive: f.saleInclusive === 'yes', purchasePrice: toPaise(f.purchasePrice || 0), purchaseInclusive: f.purchaseInclusive === 'yes',
        taxRate: Number(f.taxRate), cessRate: Number(f.cessRate || 0), openingStock: product ? Number(f.openingStock || 0) : 0, minStock: product ? Number(f.minStock || 0) : 0,
        mrp: f.mrp ? toPaise(f.mrp) : undefined, location: f.location || undefined, description: f.description || undefined,
      });
      toast(item ? 'Item updated' : 'Item added');
      onSaved?.(saved);
      onClose();
    } catch (e) { setErr({ code: (e as Error).message }); }
  };

  return (
    <Modal open={open} onClose={onClose} title={item ? 'Edit item' : 'Add item'} wide
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Save item</Button></>}>
      <form onSubmit={(e) => { e.preventDefault(); save(); }} className="grid gap-4 sm:grid-cols-3" noValidate>
        <div className="flex gap-2 sm:col-span-3" role="radiogroup" aria-label="Item type">
          {(['product', 'service'] as const).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={f.kind === k} onClick={() => set('kind', k)}
              className={'h-9 rounded-md border px-4 text-sm font-semibold ' + (f.kind === k ? 'border-accent bg-accent-soft text-accent-strong' : 'border-border-input')}>
              {k === 'product' ? 'Product (has stock)' : 'Service'}
            </button>
          ))}
        </div>
        <Field label="Name" error={err.name} className="sm:col-span-2">{(id) => <Input id={id} value={f.name} onChange={(e) => set('name', e.target.value)} />}</Field>
        <Field label="Item code" error={err.code} hint="Type it on a bill and press Enter">{(id) => <Input id={id} value={f.code} onChange={(e) => set('code', e.target.value)} />}</Field>
        <Field label="HSN / SAC" error={err.hsn}>{(id) => <Input id={id} inputMode="numeric" value={f.hsn} onChange={(e) => set('hsn', e.target.value.replace(/\D/g, ''))} />}</Field>
        <Field label="Unit">{(id) => <Select id={id} value={f.unit} onChange={(e) => set('unit', e.target.value)}>{UNITS.map((u) => <option key={u}>{u}</option>)}</Select>}</Field>
        <Field label="Barcode" hint="Scan with a barcode gun into this box">{(id) => <Input id={id} value={f.barcode} onChange={(e) => set('barcode', e.target.value)} />}</Field>

        <Field label="Sale price">{(id) => (
          <div className="flex gap-2"><Input id={id} inputMode="decimal" value={f.salePrice} onChange={(e) => set('salePrice', e.target.value)} placeholder="0" />
            <Select aria-label="Sale price includes GST" value={f.saleInclusive} onChange={(e) => set('saleInclusive', e.target.value)} className="w-28"><option value="no">+ GST</option><option value="yes">incl. GST</option></Select></div>)}
        </Field>
        <Field label="Purchase price">{(id) => (
          <div className="flex gap-2"><Input id={id} inputMode="decimal" value={f.purchasePrice} onChange={(e) => set('purchasePrice', e.target.value)} placeholder="0" />
            <Select aria-label="Purchase price includes GST" value={f.purchaseInclusive} onChange={(e) => set('purchaseInclusive', e.target.value)} className="w-28"><option value="no">+ GST</option><option value="yes">incl. GST</option></Select></div>)}
        </Field>
        <Field label="GST rate">{(id) => <Select id={id} value={f.taxRate} onChange={(e) => set('taxRate', e.target.value)}>{GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}</Select>}</Field>
        <Field label="Cess %" hint="Usually 0">{(id) => <Input id={id} inputMode="decimal" value={f.cessRate} onChange={(e) => set('cessRate', e.target.value)} />}</Field>
        <Field label="MRP (optional)">{(id) => <Input id={id} inputMode="decimal" value={f.mrp} onChange={(e) => set('mrp', e.target.value)} />}</Field>
        <Field label="Category">{(id) => (
          <Select id={id} value={f.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
            <option value="">None</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>)}
        </Field>
        {product && <>
          <Field label="Opening stock" error={err.openingStock}>{(id) => <Input id={id} inputMode="decimal" value={f.openingStock} onChange={(e) => set('openingStock', e.target.value)} placeholder="0" />}</Field>
          <Field label="Low stock alert at">{(id) => <Input id={id} inputMode="decimal" value={f.minStock} onChange={(e) => set('minStock', e.target.value)} placeholder="0" />}</Field>
          <Field label="Location (optional)" hint="Shelf, rack or godown">{(id) => <Input id={id} value={f.location} onChange={(e) => set('location', e.target.value)} />}</Field>
        </>}
        <Field label="Or add a new category">{(id) => <Input id={id} value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="e.g. Grocery" />}</Field>
        <Field label="Description (optional)" className="sm:col-span-2">{(id) => <Textarea id={id} value={f.description} onChange={(e) => set('description', e.target.value)} />}</Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
