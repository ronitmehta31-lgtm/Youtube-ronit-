import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRightLeft, Copy, FileDown, IndianRupee, MessageCircle, Pencil, Printer, Share2, Trash2, Undo2 } from 'lucide-react';
import { useBook } from '../App';
import { Button, Card, Chip, PageHeader, Select, useToast } from '../components/ui';
import { InvoiceDoc } from '../components/InvoiceDoc';
import { deleteTxn, setMeta } from '../lib/db';
import { payStatus, settledOn, todayStr } from '../lib/ledger';
import { fmt } from '../lib/money';
import { txnText, whatsappUrl } from '../lib/share';
import { TXN, type Prefs } from '../lib/types';
import { elementToPdf, shareOrDownload } from '../lib/pdf';

export default function TxnView() {
  const b = useBook();
  const { id } = useParams();
  const [sp, setSp] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const t = b.txns.find((x) => x.id === id);
  const party = b.parties.find((p) => p.id === t?.partyId);
  const st = useMemo(() => (t && (t.type === 'sale' || t.type === 'purchase') ? payStatus(t, b.txns, todayStr()) : null), [t, b.txns]);
  const due = st?.due ?? 0;
  const docRef = useRef<HTMLDivElement>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    if (sp.get('print') && t) { setSp({}, { replace: true }); setTimeout(() => window.print(), 300); }
  }, [sp, t, setSp]);

  if (!t) return <Card><p className="p-6 text-text-muted">This entry no longer exists. <Link to="/" className="text-accent">Go home</Link></p></Card>;
  const meta = TXN[t.type];
  const name = party?.name ?? t.partyName ?? (t.type === 'expense' ? 'Expense' : 'Cash sale');
  const phone = party?.phone ?? t.partyPhone;
  const text = txnText(b.firm, t, name, due);
  const linkedPayments = b.txns.filter((x) => x.links?.some((l) => l.txnId === t.id));
  const source = t.sourceId ? b.txns.find((x) => x.id === t.sourceId) : undefined;
  const converted = b.txns.find((x) => x.sourceId === t.id && !TXN[x.type].isDoc && x.type !== 'sale_return' && x.type !== 'purchase_return');

  const remove = async () => {
    const extra = linkedPayments.length ? ` ${linkedPayments.length} payment(s) linked to it will stay as advance on the party.` : '';
    if (!confirm(`Delete ${meta.label.toLowerCase()} ${t.number}?${extra}`)) return;
    await deleteTxn(t.id);
    toast('Deleted');
    nav(-1);
  };
  const share = async () => {
    if (navigator.share) { try { await navigator.share({ title: `${meta.label} ${t.number}`, text }); return; } catch { /* cancelled */ } }
    await navigator.clipboard?.writeText(text);
    toast('Bill text copied');
  };
  const setSize = (s: Prefs['printSize']) => setMeta('prefs', { ...b.prefs, printSize: s });
  const sendPdf = async () => {
    if (!docRef.current) return;
    setPdfBusy(true);
    try {
      const file = await elementToPdf(docRef.current, `${meta.label.replace(/\s+/g, '-')}-${t.number || t.date}.pdf`, b.prefs.printSize.startsWith('thermal'));
      const how = await shareOrDownload(file, text);
      if (how === 'downloaded') toast('PDF downloaded. Attach it in WhatsApp or email.');
    } catch (e) { toast('Could not make the PDF: ' + (e as Error).message, 'danger'); }
    setPdfBusy(false);
  };

  return (
    <>
      <div className="no-print">
        <PageHeader title={`${meta.label} ${t.number}`} sub={`${name} · ${t.date}`} actions={<>
          {st && <Chip status={st.status} />}
          {meta.isDoc && <Chip status={t.status ?? 'open'} />}
        </>} />
        {sp.get('saved') && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-success-soft px-4 py-3 text-sm text-success">
            <span>Saved. {st && due > 0 ? `Balance due ${fmt(due)}.` : st ? 'Fully paid.' : ''}</span>
            <Button size="sm" variant="primary" onClick={() => nav(`/${meta.path}/new`)}>Make another</Button>
          </div>
        )}
        <Card className="mb-4">
          <div className="flex flex-wrap items-center gap-2 p-3">
            {meta.hasLines && <Button size="sm" variant="primary" icon={<Printer size={15} />} onClick={() => window.print()}>Print / PDF</Button>}
            {meta.hasLines && <Select aria-label="Paper size" value={b.prefs.printSize} onChange={(e) => setSize(e.target.value as Prefs['printSize'])} className="h-8 w-36 text-[13px]">
              <option value="a4">A4</option><option value="a5">A5</option><option value="thermal80">Thermal 80mm</option><option value="thermal58">Thermal 58mm</option></Select>}
            {meta.hasLines && <Button size="sm" icon={<FileDown size={15} />} onClick={sendPdf} disabled={pdfBusy}>{pdfBusy ? 'Making PDF…' : 'Send PDF'}</Button>}
            <Button size="sm" icon={<MessageCircle size={15} />} onClick={() => window.open(whatsappUrl(phone, text), '_blank')}>WhatsApp</Button>
            <Button size="sm" icon={<Share2 size={15} />} onClick={share}>Share</Button>
            {st && due > 0 && <Button size="sm" icon={<IndianRupee size={15} />} onClick={() => nav(`/${t.type === 'sale' ? 'sale' : 'purchase'}/payments/new?party=${t.partyId ?? ''}&invoice=${t.id}`)}>
              {t.type === 'sale' ? 'Receive payment' : 'Pay'}</Button>}
            {meta.convertTo && t.status !== 'converted' && <Button size="sm" icon={<ArrowRightLeft size={15} />} onClick={() => nav(`/${TXN[meta.convertTo!].path}/new?from=${t.id}`)}>
              Convert to {TXN[meta.convertTo].label.toLowerCase()}</Button>}
            {(t.type === 'sale' || t.type === 'purchase') && <Button size="sm" icon={<Undo2 size={15} />} onClick={() => nav(`/${TXN[t.type === 'sale' ? 'sale_return' : 'purchase_return'].path}/new?return=${t.id}`)}>Return</Button>}
            <span className="flex-1" />
            {meta.hasLines && t.type !== 'stock_adj' && <Button size="sm" variant="ghost" icon={<Copy size={15} />} onClick={() => nav(`/${meta.path}/new?copy=${t.id}`)}
              title="Start a new bill with the same party and items">Duplicate</Button>}
            <Button size="sm" variant="ghost" icon={<Pencil size={15} />} onClick={() => nav(meta.hasLines ? `/txn/${t.id}/edit` : `/${meta.path}/new?edit=${t.id}`)} hidden={t.type === 'transfer' || t.type === 'stock_adj'}>Edit</Button>
            <Button size="sm" variant="ghost" icon={<Trash2 size={15} />} onClick={remove} aria-label="Delete" />
          </div>
          {(source || converted || linkedPayments.length > 0 || (t.links?.length ?? 0) > 0) && (
            <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-border px-4 py-2.5 text-sm text-text-muted">
              {source && <span>From <Link className="text-accent hover:underline" to={`/txn/${source.id}`}>{TXN[source.type].label} {source.number}</Link></span>}
              {converted && <span>Converted to <Link className="text-accent hover:underline" to={`/txn/${converted.id}`}>{TXN[converted.type].label} {converted.number}</Link></span>}
              {linkedPayments.map((p) => <span key={p.id}>Payment <Link className="text-accent hover:underline" to={`/txn/${p.id}`}>{p.number}</Link> {fmt(p.links!.find((l) => l.txnId === t.id)!.amount)}</span>)}
              {t.links?.map((l) => { const inv = b.txns.find((x) => x.id === l.txnId); return inv ? <span key={l.txnId}>Settles <Link className="text-accent hover:underline" to={`/txn/${inv.id}`}>{inv.number}</Link> {fmt(l.amount)}</span> : null; })}
              {st && <span>Settled so far {fmt(settledOn(t, b.txns))} of {fmt(t.total)}</span>}
            </div>
          )}
        </Card>
      </div>
      {meta.hasLines ? (
        <div ref={docRef} className="overflow-x-auto rounded-lg border border-border bg-white shadow-card print:border-0 print:shadow-none">
          <InvoiceDoc t={t} firm={b.firm} party={party} prefs={b.prefs} due={due} />
        </div>
      ) : (
        <Card>
          <dl className="grid gap-px bg-border sm:grid-cols-2">
            {[['Amount', fmt(t.total)], ['Party', name], ['Date', t.date], ['Mode', t.payMode ?? 'cash'], ['Account', b.accounts.find((a) => a.id === t.accountId)?.name ?? '—'],
              ['Discount', fmt(t.payDiscount ?? 0)], ['Reference', t.payRef || '—'], ['Notes', t.notes || '—']].map(([k, v]) => (
              <div key={k} className="bg-bg px-4 py-3"><dt className="text-xs text-text-muted">{k}</dt><dd className="font-medium">{v}</dd></div>
            ))}
          </dl>
        </Card>
      )}
    </>
  );
}
