import { useState } from 'react';
import { Button, Field, Input, Select, Textarea, Toggle, useToast } from '../components/ui';
import { setupFirm } from '../lib/db';
import { STATES, gstinState, validGstin } from '../lib/gst';
import { loadSample } from '../lib/seed';
import type { Firm } from '../lib/types';

export default function Setup() {
  const toast = useToast();
  const [f, setF] = useState<Firm>({ name: '', stateCode: '27', gstEnabled: true });
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Firm, v: unknown) => setF((x) => ({ ...x, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!f.name.trim()) er.name = 'Enter your business name';
    if (f.gstin && !validGstin(f.gstin)) er.gstin = 'This GSTIN does not look right. Check the 15 characters.';
    setErr(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    await setupFirm({ ...f, name: f.name.trim(), gstin: f.gstin?.toUpperCase() || undefined });
    toast('Your books are ready');
  };

  const onLogo = (file?: File) => {
    if (!file) return;
    if (file.size > 300_000) return setErr((e) => ({ ...e, logo: 'Logo must be under 300 KB' }));
    const r = new FileReader();
    r.onload = () => set('logo', r.result as string);
    r.readAsDataURL(file);
  };

  return (
    <div className="min-h-full bg-surface px-4 py-8">
      <div className="mx-auto max-w-xl">
        <div className="mb-6 flex items-center gap-3">
          <img src="./icon.svg" alt="" className="h-11 w-11" />
          <div>
            <h1 className="text-xl font-bold">Set up Bahi</h1>
            <p className="text-sm text-text-muted">Bills, stock and accounts for your business. Your data stays on this device.</p>
          </div>
        </div>
        <form onSubmit={submit} className="rounded-lg border border-border bg-bg p-5 shadow-card" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Business name" error={err.name} className="sm:col-span-2">{(id) => <Input id={id} value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus />}</Field>
            <Field label="GSTIN (optional)" error={err.gstin} hint="Leave empty if you are not GST registered">
              {(id) => <Input id={id} value={f.gstin ?? ''} maxLength={15} className="uppercase"
                onChange={(e) => { const g = e.target.value.toUpperCase(); set('gstin', g); if (g.length >= 2 && STATES.some(([c]) => c === gstinState(g))) set('stateCode', gstinState(g)); }} />}
            </Field>
            <Field label="State">{(id) => (
              <Select id={id} value={f.stateCode} onChange={(e) => set('stateCode', e.target.value)}>
                {STATES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
              </Select>)}
            </Field>
            <Field label="Phone">{(id) => <Input id={id} type="tel" value={f.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />}</Field>
            <Field label="UPI id for payments" hint="Printed as a QR code on bills">{(id) => <Input id={id} value={f.upiId ?? ''} placeholder="name@bank" onChange={(e) => set('upiId', e.target.value)} />}</Field>
            <Field label="Address" className="sm:col-span-2">{(id) => <Textarea id={id} value={f.address ?? ''} onChange={(e) => set('address', e.target.value)} />}</Field>
            <Field label="Logo (optional)" error={err.logo} className="sm:col-span-2">
              {(id) => <div className="flex items-center gap-3">{f.logo && <img src={f.logo} alt="Logo preview" className="h-10 w-10 rounded object-contain" />}
                <input id={id} type="file" accept="image/*" onChange={(e) => onLogo(e.target.files?.[0])} className="text-sm" /></div>}
            </Field>
          </div>
          <div className="mt-2 border-t border-border"><Toggle checked={f.gstEnabled} onChange={(v) => set('gstEnabled', v)} label="Charge GST on bills" hint="Turn off if you are not registered for GST" /></div>
          <div className="mt-4 flex flex-wrap justify-between gap-2">
            <Button variant="ghost" disabled={busy} onClick={async () => { setBusy(true); await loadSample(); toast('Sample business loaded'); }}>Try with sample data</Button>
            <Button type="submit" variant="primary" disabled={busy}>Start using Bahi</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
