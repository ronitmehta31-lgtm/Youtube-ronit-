import { useEffect, useState } from 'react';
import { Button, Field, Input, Modal, Select, Textarea, useToast } from './ui';
import { saveParty } from '../lib/db';
import { STATES, gstinState, validGstin } from '../lib/gst';
import { rupeeInput, toPaise } from '../lib/money';
import type { Party } from '../lib/types';
import { todayStr } from '../lib/ledger';

export function PartyForm({ open, onClose, party, initialName, onSaved, defaultState }: {
  open: boolean; onClose: () => void; party?: Party; initialName?: string; onSaved?: (p: Party) => void; defaultState: string;
}) {
  const toast = useToast();
  const blank = { name: initialName ?? '', phone: '', email: '', gstin: '', stateCode: defaultState, billingAddress: '', shippingAddress: '', group: '' };
  const [f, setF] = useState<Record<string, string>>(blank);
  const [side, setSide] = useState<'receive' | 'pay'>('receive');
  const [opening, setOpening] = useState('');
  const [limit, setLimit] = useState('');
  const [err, setErr] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setErr({});
    if (party) {
      setF({ name: party.name, phone: party.phone ?? '', email: party.email ?? '', gstin: party.gstin ?? '', stateCode: party.stateCode ?? defaultState,
        billingAddress: party.billingAddress ?? '', shippingAddress: party.shippingAddress ?? '', group: party.group ?? '' });
      setSide(party.openingBalance < 0 ? 'pay' : 'receive');
      setOpening(rupeeInput(Math.abs(party.openingBalance)));
      setLimit(rupeeInput(party.creditLimit ?? 0));
    } else { setF({ ...blank, name: initialName ?? '' }); setOpening(''); setLimit(''); setSide('receive'); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, party, initialName]);

  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));

  const save = async () => {
    const er: Record<string, string> = {};
    if (!f.name.trim()) er.name = 'Enter a name';
    if (f.gstin && !validGstin(f.gstin)) er.gstin = 'This GSTIN does not look right';
    if (f.phone && !/^[0-9+\-\s]{7,15}$/.test(f.phone)) er.phone = 'Enter a valid phone number';
    setErr(er);
    if (Object.keys(er).length) return;
    const ob = toPaise(opening || 0) * (side === 'pay' ? -1 : 1);
    try {
      const p = await saveParty({ ...party, name: f.name, phone: f.phone || undefined, email: f.email || undefined, gstin: f.gstin.toUpperCase() || undefined,
        stateCode: f.stateCode, billingAddress: f.billingAddress || undefined, shippingAddress: f.shippingAddress || undefined, group: f.group || undefined,
        openingBalance: ob, openingDate: party?.openingDate ?? todayStr(), creditLimit: limit ? toPaise(limit) : undefined });
      toast(party ? 'Party updated' : 'Party added');
      onSaved?.(p);
      onClose();
    } catch (e) { toast((e as Error).message, 'danger'); }
  };

  return (
    <Modal open={open} onClose={onClose} title={party ? 'Edit party' : 'Add party'} wide
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Save party</Button></>}>
      <form onSubmit={(e) => { e.preventDefault(); save(); }} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label="Name" error={err.name}>{(id) => <Input id={id} value={f.name} onChange={(e) => set('name', e.target.value)} />}</Field>
        <Field label="Phone" error={err.phone} hint="Used for WhatsApp bills and reminders">{(id) => <Input id={id} type="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} />}</Field>
        <Field label="GSTIN" error={err.gstin} hint="Fills the state for you">
          {(id) => <Input id={id} value={f.gstin} maxLength={15} className="uppercase" onChange={(e) => {
            const g = e.target.value.toUpperCase(); set('gstin', g);
            if (g.length >= 2 && STATES.some(([c]) => c === gstinState(g))) set('stateCode', gstinState(g));
          }} />}
        </Field>
        <Field label="State" hint="Decides CGST + SGST or IGST">{(id) => (
          <Select id={id} value={f.stateCode} onChange={(e) => set('stateCode', e.target.value)}>{STATES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</Select>)}
        </Field>
        <Field label="Email">{(id) => <Input id={id} type="email" value={f.email} onChange={(e) => set('email', e.target.value)} />}</Field>
        <Field label="Group" hint="Optional, e.g. Retail, Wholesale">{(id) => <Input id={id} value={f.group} onChange={(e) => set('group', e.target.value)} />}</Field>
        <Field label="Billing address">{(id) => <Textarea id={id} value={f.billingAddress} onChange={(e) => set('billingAddress', e.target.value)} />}</Field>
        <Field label="Shipping address">{(id) => <Textarea id={id} value={f.shippingAddress} onChange={(e) => set('shippingAddress', e.target.value)} />}</Field>
        <Field label="Opening balance">{(id) => (
          <div className="flex gap-2">
            <Input id={id} inputMode="decimal" value={opening} onChange={(e) => setOpening(e.target.value)} placeholder="0" />
            <Select aria-label="Opening balance direction" value={side} onChange={(e) => setSide(e.target.value as 'receive' | 'pay')} className="w-40">
              <option value="receive">They owe me</option><option value="pay">I owe them</option>
            </Select>
          </div>)}
        </Field>
        <Field label="Credit limit (optional)" hint="Warns you before billing past it">{(id) => <Input id={id} inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} />}</Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
