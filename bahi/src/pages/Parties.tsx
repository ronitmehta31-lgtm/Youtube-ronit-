import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MessageCircle, Pencil, Plus, Search, Trash2, Users, Merge } from 'lucide-react';
import { useBook } from '../App';
import { Button, Card, Empty, Input, Modal, PageHeader, Select, cx, useToast, Money } from '../components/ui';
import { PartyForm } from '../components/PartyForm';
import { deleteParty, mergeParties } from '../lib/db';
import { partyBalances, partyEffect } from '../lib/ledger';
import { fmt } from '../lib/money';
import { TXN } from '../lib/types';
import { reminderText, whatsappUrl } from '../lib/share';
import { stateName } from '../lib/gst';

export default function Parties() {
  const b = useBook();
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'receive' | 'pay'>('all');
  const [form, setForm] = useState<{ open: boolean; edit?: boolean }>({ open: false });
  const [merge, setMerge] = useState<string>('');
  const [mergeOpen, setMergeOpen] = useState(false);

  const bal = useMemo(() => partyBalances(b.parties, b.txns), [b.parties, b.txns]);
  const list = b.parties.filter((p) => {
    const s = q.trim().toLowerCase();
    const v = bal.get(p.id) ?? 0;
    return (!s || p.name.toLowerCase().includes(s) || p.phone?.includes(s) || p.gstin?.toLowerCase().includes(s))
      && (filter === 'all' || (filter === 'receive' ? v > 0 : v < 0));
  });
  const sel = b.parties.find((p) => p.id === id);
  const selTxns = useMemo(() => b.txns.filter((t) => t.partyId === id).sort((a, c) => c.date.localeCompare(a.date) || c.createdAt.localeCompare(a.createdAt)), [b.txns, id]);
  const v = sel ? bal.get(sel.id) ?? 0 : 0;

  const remove = async () => {
    if (!sel || !confirm(`Delete ${sel.name}?`)) return;
    try { await deleteParty(sel.id); toast('Party deleted'); nav('/parties'); } catch (e) { toast((e as Error).message, 'danger'); }
  };
  const doMerge = async () => {
    if (!sel || !merge) return;
    const into = b.parties.find((p) => p.id === merge)!;
    if (!confirm(`Move every bill and payment of "${sel.name}" to "${into.name}", then remove "${sel.name}"?`)) return;
    await mergeParties(sel.id, merge);
    toast('Parties merged');
    setMergeOpen(false);
    nav(`/parties/${merge}`);
  };

  return (
    <>
      <PageHeader title="Parties" sub="Customers and suppliers" actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setForm({ open: true })}>Add party</Button>} />
      {b.parties.length === 0 ? (
        <Card><Empty icon={<Users size={22} />} title="No parties yet" body="Add the people you sell to and buy from. You can also add them while making a bill."
          action={<Button variant="primary" onClick={() => setForm({ open: true })}>Add party</Button>} /></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <Card className={cx('flex min-h-0 flex-col', sel && 'hidden lg:flex')}>
            <div className="flex gap-2 border-b border-border p-3">
              <div className="relative flex-1"><Search size={16} className="absolute left-3 top-3 text-text-muted" aria-hidden />
                <Input aria-label="Search parties" placeholder="Name, phone or GSTIN" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" /></div>
              <Select aria-label="Filter" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="w-32">
                <option value="all">All</option><option value="receive">To receive</option><option value="pay">To pay</option>
              </Select>
            </div>
            {list.length === 0 ? <p className="p-4 text-sm text-text-muted">No party matches "{q}".</p> : (
              <ul className="max-h-[70vh] divide-y divide-border overflow-y-auto">
                {list.map((p) => {
                  const pv = bal.get(p.id) ?? 0;
                  return (
                    <li key={p.id}>
                      <Link to={`/parties/${p.id}`} className={cx('flex items-center gap-3 px-4 py-3 hover:bg-surface', p.id === id && 'bg-accent-soft')}>
                        <div className="min-w-0 flex-1"><div className="truncate font-medium">{p.name}</div><div className="truncate text-xs text-text-muted">{p.phone || p.gstin || '—'}</div></div>
                        <div className={cx('num text-right text-sm font-semibold', pv > 0 ? 'text-success' : pv < 0 ? 'text-danger' : 'text-text-muted')}>{fmt(Math.abs(pv))}
                          <div className="text-[11px] font-normal text-text-muted">{pv > 0 ? 'to receive' : pv < 0 ? 'to pay' : 'settled'}</div></div>
                      </Link>
                    </li>
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
                    <Link to="/parties" className="mb-1 inline-block text-xs font-semibold text-accent lg:hidden">← All parties</Link>
                    <h2 className="truncate text-lg font-bold">{sel.name}</h2>
                    <p className="text-sm text-text-muted">{[sel.phone, sel.gstin, stateName(sel.stateCode)].filter(Boolean).join(' · ') || 'No contact details'}</p>
                    {sel.billingAddress && <p className="mt-1 text-sm text-text-muted">{sel.billingAddress}</p>}
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-text-muted">{v > 0 ? 'They owe you' : v < 0 ? 'You owe them' : 'Settled'}</div>
                    <div className={cx('num text-xl font-bold', v > 0 ? 'text-success' : v < 0 ? 'text-danger' : '')}>{fmt(Math.abs(v))}</div>
                    {sel.creditLimit && v > sel.creditLimit ? <div className="text-xs font-semibold text-danger">Over credit limit of {fmt(sel.creditLimit)}</div> : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 border-t border-border p-3">
                  <Button size="sm" variant="primary" onClick={() => nav(`/sale/invoices/new?party=${sel.id}`)}>New sale</Button>
                  <Button size="sm" onClick={() => nav(`/sale/payments/new?party=${sel.id}`)}>Receive payment</Button>
                  <Button size="sm" onClick={() => nav(`/purchase/bills/new?party=${sel.id}`)}>New purchase</Button>
                  <Button size="sm" onClick={() => nav(`/purchase/payments/new?party=${sel.id}`)}>Pay</Button>
                  {v > 0 && sel.phone && <Button size="sm" icon={<MessageCircle size={15} />} onClick={() => window.open(whatsappUrl(sel.phone!, reminderText(b.firm, sel, v)), '_blank')}>Remind</Button>}
                  <Button size="sm" variant="ghost" onClick={() => nav(`/reports/party-statement?party=${sel.id}`)}>Statement</Button>
                  <span className="flex-1" />
                  <Button size="sm" variant="ghost" icon={<Pencil size={15} />} onClick={() => setForm({ open: true, edit: true })}>Edit</Button>
                  <Button size="sm" variant="ghost" icon={<Merge size={15} />} onClick={() => setMergeOpen(true)}>Merge</Button>
                  <Button size="sm" variant="ghost" icon={<Trash2 size={15} />} onClick={remove} aria-label="Delete party" />
                </div>
              </Card>
              <Card title="Transactions">
                {selTxns.length === 0 ? <Empty title="No transactions yet" body={`Bills and payments with ${sel.name} show up here.`} /> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-surface text-left text-xs text-text-muted"><tr><th className="px-4 py-2 font-medium">Date</th><th className="px-2 py-2 font-medium">Type</th>
                        <th className="px-2 py-2 font-medium">No.</th><th className="px-2 py-2 text-right font-medium">Total</th><th className="px-4 py-2 text-right font-medium">Effect on balance</th></tr></thead>
                      <tbody className="divide-y divide-border">
                        {selTxns.map((t) => (
                          <tr key={t.id} className="cursor-pointer hover:bg-surface" onClick={() => nav(`/txn/${t.id}`)}>
                            <td className="px-4 py-2.5 whitespace-nowrap">{t.date}</td><td className="px-2 py-2.5">{TXN[t.type].label}</td>
                            <td className="px-2 py-2.5"><Link to={`/txn/${t.id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>{t.number || '—'}</Link></td>
                            <td className="num px-2 py-2.5 text-right">{fmt(t.total)}</td>
                            <td className="px-4 py-2.5 text-right">{TXN[t.type].isDoc ? <span className="text-xs text-text-muted">none</span> : <Money v={partyEffect(t)} tone="auto" />}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          ) : (
            <Card className="hidden lg:block"><Empty title="Pick a party" body="Their balance, contact details and every bill appear here." /></Card>
          )}
        </div>
      )}
      <PartyForm open={form.open} onClose={() => setForm({ open: false })} party={form.edit ? sel : undefined} defaultState={b.firm.stateCode}
        onSaved={(p) => nav(`/parties/${p.id}`)} />
      <Modal open={mergeOpen} onClose={() => setMergeOpen(false)} title={`Merge ${sel?.name ?? ''} into…`}
        footer={<><Button onClick={() => setMergeOpen(false)}>Cancel</Button><Button variant="primary" disabled={!merge} onClick={doMerge}>Merge</Button></>}>
        <p className="mb-3 text-sm text-text-muted">For duplicates: every bill and payment moves to the party you pick, opening balances are added, and this one is removed.</p>
        <Select aria-label="Merge into" value={merge} onChange={(e) => setMerge(e.target.value)}>
          <option value="">Choose a party</option>
          {b.parties.filter((p) => p.id !== sel?.id).map((p) => <option key={p.id} value={p.id}>{p.name}{p.phone ? ` (${p.phone})` : ''}</option>)}
        </Select>
      </Modal>
    </>
  );
}
