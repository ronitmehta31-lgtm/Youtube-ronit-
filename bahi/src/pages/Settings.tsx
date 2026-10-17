import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useBook } from '../App';
import { Button, Card, Field, Input, PageHeader, Select, Textarea, Toggle, useToast } from '../components/ui';
import { db, setMeta, uid, wipeAll } from '../lib/db';
import { STATES, validGstin } from '../lib/gst';
import type { Firm, Prefs, TxnType } from '../lib/types';
import { TXN } from '../lib/types';

export default function Settings() {
  const b = useBook();
  const toast = useToast();
  const [firm, setFirm] = useState<Firm>(b.firm);
  const [prefs, setPrefs] = useState<Prefs>(b.prefs);
  const [newCat, setNewCat] = useState({ kind: 'expense' as 'expense' | 'income' | 'item', name: '' });
  useEffect(() => { setFirm(b.firm); setPrefs(b.prefs); }, [b.firm, b.prefs]);

  const saveFirm = async () => {
    if (!firm.name.trim()) return toast('Business name is required', 'danger');
    if (firm.gstin && !validGstin(firm.gstin)) return toast('GSTIN does not look right', 'danger');
    await setMeta('firm', { ...firm, gstin: firm.gstin?.toUpperCase() || undefined });
    toast('Business details saved');
  };
  const savePrefs = async (p: Prefs) => { setPrefs(p); await setMeta('prefs', p); };
  const onLogo = (file?: File) => {
    if (!file) return;
    if (file.size > 300_000) return toast('Logo must be under 300 KB', 'danger');
    const r = new FileReader(); r.onload = () => setFirm({ ...firm, logo: r.result as string }); r.readAsDataURL(file);
  };
  const addCat = async () => {
    if (!newCat.name.trim()) return;
    await db.categories.add({ id: uid(), kind: newCat.kind, name: newCat.name.trim() });
    setNewCat({ ...newCat, name: '' });
  };
  const delCat = async (id: string) => {
    const used = b.txns.some((t) => t.categoryId === id) || b.items.some((i) => i.categoryId === id);
    if (used) return toast('This category is in use', 'danger');
    await db.categories.delete(id);
  };
  const prefixTypes: TxnType[] = ['sale', 'sale_return', 'estimate', 'sale_order', 'delivery_challan', 'purchase_order', 'purchase_return', 'payment_in', 'payment_out', 'expense'];

  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Business details" action={<Button size="sm" variant="primary" onClick={saveFirm}>Save</Button>}>
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <Field label="Business name" className="sm:col-span-2">{(id) => <Input id={id} value={firm.name} onChange={(e) => setFirm({ ...firm, name: e.target.value })} />}</Field>
            <Field label="GSTIN">{(id) => <Input id={id} className="uppercase" maxLength={15} value={firm.gstin ?? ''} onChange={(e) => setFirm({ ...firm, gstin: e.target.value.toUpperCase() })} />}</Field>
            <Field label="State">{(id) => <Select id={id} value={firm.stateCode} onChange={(e) => setFirm({ ...firm, stateCode: e.target.value })}>{STATES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</Select>}</Field>
            <Field label="Phone">{(id) => <Input id={id} value={firm.phone ?? ''} onChange={(e) => setFirm({ ...firm, phone: e.target.value })} />}</Field>
            <Field label="Email">{(id) => <Input id={id} value={firm.email ?? ''} onChange={(e) => setFirm({ ...firm, email: e.target.value })} />}</Field>
            <Field label="UPI id" hint="QR code on unpaid bills">{(id) => <Input id={id} value={firm.upiId ?? ''} onChange={(e) => setFirm({ ...firm, upiId: e.target.value })} />}</Field>
            <Field label="Logo">{(id) => <div className="flex items-center gap-2">{firm.logo && <img src={firm.logo} alt="Logo" className="h-9 w-9 object-contain" />}
              <input id={id} type="file" accept="image/*" className="text-xs" onChange={(e) => onLogo(e.target.files?.[0])} />
              {firm.logo && <Button size="sm" variant="ghost" onClick={() => setFirm({ ...firm, logo: undefined })}>Remove</Button>}</div>}</Field>
            <Field label="Address" className="sm:col-span-2">{(id) => <Textarea id={id} value={firm.address ?? ''} onChange={(e) => setFirm({ ...firm, address: e.target.value })} />}</Field>
            <Field label="Bank details on bills">{(id) => <Textarea id={id} value={firm.bankDetails ?? ''} placeholder={'A/c 1234567890\nIFSC SBIN0000001'} onChange={(e) => setFirm({ ...firm, bankDetails: e.target.value })} />}</Field>
            <Field label="Terms on bills">{(id) => <Textarea id={id} value={firm.terms ?? ''} onChange={(e) => setFirm({ ...firm, terms: e.target.value })} />}</Field>
            <div className="sm:col-span-2"><Toggle checked={firm.gstEnabled} onChange={(v) => setFirm({ ...firm, gstEnabled: v })} label="Charge GST" hint="Off for businesses not registered under GST" /></div>
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card title="Bills">
            <div className="divide-y divide-border px-4">
              <Toggle checked={prefs.roundOff} onChange={(v) => savePrefs({ ...prefs, roundOff: v })} label="Round off bill totals to the rupee" />
              <Toggle checked={prefs.defaultInclusive} onChange={(v) => savePrefs({ ...prefs, defaultInclusive: v })} label="New items: sale price includes GST" />
              <Toggle checked={prefs.showUpiQr} onChange={(v) => savePrefs({ ...prefs, showUpiQr: v })} label="Print UPI QR on unpaid bills" hint="Needs your UPI id above" />
              <Toggle checked={prefs.showProfitOnSale} onChange={(v) => savePrefs({ ...prefs, showProfitOnSale: v })} label="Show profit while making a sale" hint="Only on your screen, never printed" />
              <div className="grid gap-4 py-3 sm:grid-cols-2">
                <Field label="Paper">{(id) => <Select id={id} value={prefs.printSize} onChange={(e) => savePrefs({ ...prefs, printSize: e.target.value as Prefs['printSize'] })}>
                  <option value="a4">A4</option><option value="a5">A5</option><option value="thermal80">Thermal 80mm</option><option value="thermal58">Thermal 58mm</option></Select>}</Field>
                <Field label="Bill colour">{(id) => <Input id={id} type="color" value={prefs.invoiceColor} onChange={(e) => savePrefs({ ...prefs, invoiceColor: e.target.value })} className="h-10 p-1" />}</Field>
              </div>
            </div>
          </Card>
          <Card title="Number prefixes">
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              {prefixTypes.map((t) => (
                <Field key={t} label={TXN[t].label}>{(id) => <Input id={id} value={prefs.prefixes[t] ?? ''} onChange={(e) => savePrefs({ ...prefs, prefixes: { ...prefs.prefixes, [t]: e.target.value } })} />}</Field>
              ))}
            </div>
            <p className="border-t border-border px-4 py-2.5 text-xs text-text-muted">A new financial year? Change the prefix (e.g. INV/26-27/) and numbering starts again at 1.</p>
          </Card>
          <Card title="Categories">
            <div className="p-4">
              <div className="mb-3 flex gap-2">
                <Select aria-label="Category kind" value={newCat.kind} onChange={(e) => setNewCat({ ...newCat, kind: e.target.value as typeof newCat.kind })} className="w-36">
                  <option value="expense">Expense</option><option value="income">Other income</option><option value="item">Item</option></Select>
                <Input aria-label="New category" value={newCat.name} placeholder="Name" onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && addCat()} />
                <Button onClick={addCat}>Add</Button>
              </div>
              {(['expense', 'income', 'item'] as const).map((k) => {
                const list = b.categories.filter((c) => c.kind === k);
                return list.length ? <div key={k} className="mb-2"><div className="mb-1 text-xs font-semibold text-text-muted">{k === 'income' ? 'Other income' : k[0].toUpperCase() + k.slice(1)}</div>
                  <div className="flex flex-wrap gap-1.5">{list.map((c) => <span key={c.id} className="inline-flex items-center gap-1 rounded-full bg-surface-2 py-1 pl-3 pr-1 text-xs">{c.name}
                    <button aria-label={`Delete ${c.name}`} onClick={() => delCat(c.id)} className="grid h-5 w-5 place-items-center rounded-full hover:bg-danger-soft hover:text-danger"><Trash2 size={11} /></button></span>)}</div></div> : null;
              })}
            </div>
          </Card>
          <Card title="Start over">
            <div className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
              <span className="text-text-muted">Deletes every party, item, bill and setting on this device.</span>
              <Button variant="danger" onClick={async () => {
                if (prompt('Type DELETE to erase all data on this device. Download a backup first.') !== 'DELETE') return;
                await wipeAll(); toast('All data erased');
              }}>Erase all data</Button>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
