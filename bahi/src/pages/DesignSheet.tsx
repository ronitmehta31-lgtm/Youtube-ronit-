import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button, Card, Chip, Empty, Field, Input, Modal, PageHeader, Select, Stat, Toggle } from '../components/ui';

/** The design-system check page: every primitive in every state, at /#/design. */
export default function DesignSheet() {
  const [on, setOn] = useState(true);
  const [open, setOpen] = useState(false);
  const roles = ['bg', 'surface', 'surface-2', 'border', 'border-input', 'text', 'text-muted', 'accent', 'accent-strong', 'accent-soft', 'danger', 'danger-soft', 'success', 'success-soft', 'warning', 'warning-soft', 'nav'];
  return (
    <div className="mx-auto max-w-5xl p-6">
      <PageHeader title="Design sheet" sub="Tokens and components" />
      <Card title="Colour roles" className="mb-4"><div className="grid grid-cols-3 gap-2 p-4 sm:grid-cols-6">
        {roles.map((r) => <div key={r} className="text-xs"><div className="mb-1 h-10 rounded-md border border-border" style={{ background: `var(--c-${r})` }} />{r}</div>)}
      </div></Card>
      <Card title="Buttons" className="mb-4"><div className="flex flex-wrap gap-2 p-4">
        <Button variant="primary" icon={<Plus size={16} />}>Primary</Button><Button>Secondary</Button><Button variant="ghost">Ghost</Button><Button variant="danger">Danger</Button>
        <Button variant="primary" disabled>Disabled</Button><Button size="sm" variant="primary">Small</Button>
      </div></Card>
      <Card title="Inputs" className="mb-4"><div className="grid gap-4 p-4 sm:grid-cols-3">
        <Field label="Default">{(id) => <Input id={id} placeholder="Type here" />}</Field>
        <Field label="With error" error="This GSTIN does not look right">{(id) => <Input id={id} defaultValue="27ABC" />}</Field>
        <Field label="Select" hint="Hint text">{(id) => <Select id={id}><option>One</option><option>Two</option></Select>}</Field>
        <div className="sm:col-span-3"><Toggle checked={on} onChange={setOn} label="Toggle" hint="Switch with a label" /></div>
      </div></Card>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="To receive" value={1234500} tone="success" /><Stat label="To pay" value={98000} tone="danger" /><Stat label="Neutral" value={0} /><Stat label="Negative" value={-5000} />
      </div>
      <Card title="Status chips" className="mb-4"><div className="flex flex-wrap gap-2 p-4">{['paid', 'partial', 'unpaid', 'overdue', 'open', 'converted', 'low'].map((s) => <Chip key={s} status={s} />)}</div></Card>
      <Card title="Empty state and modal" className="mb-4"><Empty title="Nothing here yet" body="Explains what will appear and how to start." action={<Button variant="primary" onClick={() => setOpen(true)}>Open modal</Button>} /></Card>
      <Modal open={open} onClose={() => setOpen(false)} title="Modal title" footer={<><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" onClick={() => setOpen(false)}>Save</Button></>}>
        <Field label="Field in a modal">{(id) => <Input id={id} />}</Field>
      </Modal>
    </div>
  );
}
