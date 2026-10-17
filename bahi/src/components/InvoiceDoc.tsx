import qrcode from 'qrcode-generator';
import type { Firm, Party, Prefs, Txn } from '../lib/types';
import { TXN } from '../lib/types';
import { fmt, fmtPlain, inWords } from '../lib/money';
import { stateName, taxBreakup } from '../lib/gst';
import { upiUri } from '../lib/share';
import { cx } from './ui';

function Qr({ text, size = 104 }: { text: string; size?: number }) {
  const q = qrcode(0, 'M');
  q.addData(text);
  q.make();
  const n = q.getModuleCount();
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c},${r}h1v1h-1z`;
  return <svg viewBox={`-2 -2 ${n + 4} ${n + 4}`} width={size} height={size} role="img" aria-label="UPI payment QR code" shapeRendering="crispEdges"><rect x={-2} y={-2} width={n + 4} height={n + 4} fill="#fff" /><path d={d} fill="#000" /></svg>;
}

/** The printable document. Plain black on white so it prints and photocopies cleanly; the accent is the owner's chosen invoice colour. */
export function InvoiceDoc({ t, firm, party, prefs, due }: { t: Txn; firm: Firm; party?: Party; prefs: Prefs; due: number }) {
  const meta = TXN[t.type];
  const thermal = prefs.printSize.startsWith('thermal');
  const color = prefs.invoiceColor || '#0b6b5d';
  const inter = !!t.stateOfSupply && t.stateOfSupply !== firm.stateCode;
  const gst = firm.gstEnabled && (t.cgst + t.sgst + t.igst + t.cess) > 0;
  const showQr = prefs.showUpiQr && !!firm.upiId && (t.type === 'sale' || t.type === 'estimate' || t.type === 'sale_order') && due > 0;
  const title = t.type === 'sale' ? (firm.gstEnabled && firm.gstin ? 'Tax Invoice' : 'Bill of Supply') : meta.label;
  const name = party?.name ?? t.partyName ?? 'Cash sale';
  const breakup = taxBreakup(t.lines);
  const chargesTotal = t.charges.reduce((s, c) => s + c.amount, 0);

  if (thermal)
    return (
      <div className={cx('print-area mx-auto bg-white p-3 font-mono text-[11px] leading-snug text-black', prefs.printSize === 'thermal58' ? 'print-thermal58 w-[220px]' : 'print-thermal80 w-[300px]')}>
        <div className="text-center"><div className="text-sm font-bold">{firm.name}</div>{firm.address && <div>{firm.address}</div>}{firm.phone && <div>Ph {firm.phone}</div>}{firm.gstin && <div>GSTIN {firm.gstin}</div>}
          <div className="mt-1 font-bold">{title}</div></div>
        <div className="mt-1 flex justify-between"><span>No {t.number}</span><span>{t.date}</span></div>
        <div>To: {name}</div>
        <div className="my-1 border-t border-dashed border-black" />
        {t.lines.map((l, i) => (
          <div key={i}><div>{l.name}</div><div className="flex justify-between"><span>{l.qty}{l.freeQty ? `+${l.freeQty}` : ''} × {fmtPlain(l.rate)}</span><span>{fmtPlain(l.amount)}</span></div></div>
        ))}
        <div className="my-1 border-t border-dashed border-black" />
        {gst && <div className="flex justify-between"><span>Tax incl.</span><span>{fmtPlain(t.cgst + t.sgst + t.igst + t.cess)}</span></div>}
        {t.billDiscount > 0 && <div className="flex justify-between"><span>Discount</span><span>-{fmtPlain(t.billDiscount)}</span></div>}
        {t.charges.map((c, i) => <div key={i} className="flex justify-between"><span>{c.label}</span><span>{fmtPlain(c.amount)}</span></div>)}
        {t.roundOff !== 0 && <div className="flex justify-between"><span>Round off</span><span>{fmtPlain(t.roundOff)}</span></div>}
        <div className="flex justify-between text-sm font-bold"><span>TOTAL</span><span>{fmt(t.total)}</span></div>
        {(t.type === 'sale' || t.type === 'purchase') && <><div className="flex justify-between"><span>Paid</span><span>{fmtPlain(t.total - due)}</span></div>
          {due > 0 && <div className="flex justify-between font-bold"><span>Balance</span><span>{fmtPlain(due)}</span></div>}</>}
        {showQr && <div className="mt-2 flex flex-col items-center"><Qr text={upiUri(firm, due, `${t.number}`)} size={110} /><div>Scan to pay {firm.upiId}</div></div>}
        <div className="mt-2 text-center">Thank you, visit again</div>
      </div>
    );

  return (
    <div className={cx('print-area mx-auto bg-white text-[12px] leading-[1.45] text-black', prefs.printSize === 'a5' ? 'max-w-[560px] p-5' : 'max-w-[800px] p-8')}>
      <div className="flex items-start justify-between gap-4 border-b-2 pb-3" style={{ borderColor: color }}>
        <div className="flex items-start gap-3">
          {firm.logo && <img src={firm.logo} alt="" className="h-14 w-14 object-contain" />}
          <div>
            <div className="text-lg font-bold" style={{ color }}>{firm.name}</div>
            {firm.address && <div className="whitespace-pre-line">{firm.address}</div>}
            <div>{[firm.phone && `Phone ${firm.phone}`, firm.email].filter(Boolean).join(' · ')}</div>
            {firm.gstin && <div>GSTIN <b>{firm.gstin}</b> · State {firm.stateCode}-{stateName(firm.stateCode)}</div>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-base font-bold uppercase tracking-wide" style={{ color }}>{title}</div>
          <div>No. <b>{t.number}</b></div>
          <div>Date {t.date}</div>
          {t.dueDate && <div>Due {t.dueDate}</div>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 border-b border-gray-300 py-3">
        <div>
          <div className="text-[10px] font-semibold uppercase text-gray-600">{meta.side === 'purchase' ? 'From' : 'Bill to'}</div>
          <div className="font-bold">{name}</div>
          {party?.billingAddress && <div className="whitespace-pre-line">{party.billingAddress}</div>}
          {(party?.phone || t.partyPhone) && <div>Phone {party?.phone ?? t.partyPhone}</div>}
          {party?.gstin && <div>GSTIN {party.gstin}</div>}
        </div>
        <div className="text-right">
          {firm.gstEnabled && t.stateOfSupply && <div>Place of supply: {t.stateOfSupply}-{stateName(t.stateOfSupply)}</div>}
          {party?.shippingAddress && <div><span className="text-[10px] font-semibold uppercase text-gray-600">Ship to </span>{party.shippingAddress}</div>}
          {t.poNumber && <div>PO no. {t.poNumber}</div>}
          {t.ewayBill && <div>E-way bill {t.ewayBill}</div>}
          {t.vehicleNo && <div>Vehicle {t.vehicleNo}</div>}
          {t.reverseCharge && <div>Reverse charge: Yes</div>}
        </div>
      </div>

      {t.lines.length > 0 && (
        <table className="mt-3 w-full border-collapse">
          <thead><tr className="text-left text-[10px] uppercase text-white" style={{ background: color }}>
            <th className="px-1.5 py-1">#</th><th className="px-1.5 py-1">Item</th>{gst && <th className="px-1.5 py-1">HSN</th>}<th className="px-1.5 py-1 text-right">Qty</th>
            <th className="px-1.5 py-1 text-right">Rate</th>{t.lines.some((l) => l.discPct) && <th className="px-1.5 py-1 text-right">Disc</th>}
            {gst && <th className="px-1.5 py-1 text-right">GST</th>}<th className="px-1.5 py-1 text-right">Amount</th></tr></thead>
          <tbody>
            {t.lines.map((l, i) => (
              <tr key={i} className="border-b border-gray-200 align-top">
                <td className="px-1.5 py-1">{i + 1}</td><td className="px-1.5 py-1">{l.name}</td>{gst && <td className="px-1.5 py-1">{l.hsn}</td>}
                <td className="px-1.5 py-1 text-right">{l.qty}{l.freeQty ? ` + ${l.freeQty} free` : ''} {l.unit}</td>
                <td className="px-1.5 py-1 text-right">{fmtPlain(l.rate)}</td>{t.lines.some((x) => x.discPct) && <td className="px-1.5 py-1 text-right">{l.discPct ? `${l.discPct}%` : ''}</td>}
                {gst && <td className="px-1.5 py-1 text-right">{fmtPlain(l.cgst + l.sgst + l.igst + l.cess)}<div className="text-[10px] text-gray-600">{l.taxRate}%</div></td>}
                <td className="px-1.5 py-1 text-right">{fmtPlain(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="mt-3 grid grid-cols-[1fr_260px] gap-6">
        <div>
          {gst && (
            <table className="mb-3 w-full border-collapse text-[11px]">
              <thead><tr className="border-b border-gray-400 text-left"><th className="py-0.5">Rate</th><th className="py-0.5 text-right">Taxable</th>
                {inter ? <th className="py-0.5 text-right">IGST</th> : <><th className="py-0.5 text-right">CGST</th><th className="py-0.5 text-right">SGST</th></>}
                {t.cess > 0 && <th className="py-0.5 text-right">Cess</th>}</tr></thead>
              <tbody>{breakup.map((r) => (
                <tr key={r.rate}><td>{r.rate}%</td><td className="text-right">{fmtPlain(r.taxable)}</td>
                  {inter ? <td className="text-right">{fmtPlain(r.igst)}</td> : <><td className="text-right">{fmtPlain(r.cgst)}</td><td className="text-right">{fmtPlain(r.sgst)}</td></>}
                  {t.cess > 0 && <td className="text-right">{fmtPlain(r.cess)}</td>}</tr>
              ))}</tbody>
            </table>
          )}
          <div><span className="text-[10px] font-semibold uppercase text-gray-600">Amount in words </span>{inWords(t.total)}</div>
          {t.notes && <div className="mt-2 whitespace-pre-line"><span className="text-[10px] font-semibold uppercase text-gray-600">Notes </span>{t.notes}</div>}
          {firm.bankDetails && <div className="mt-2 whitespace-pre-line"><span className="text-[10px] font-semibold uppercase text-gray-600">Bank details </span>{firm.bankDetails}</div>}
          {firm.terms && meta.side === 'sale' && <div className="mt-2 whitespace-pre-line text-[11px] text-gray-700"><span className="text-[10px] font-semibold uppercase text-gray-600">Terms </span>{firm.terms}</div>}
          {showQr && <div className="mt-3 flex items-center gap-3"><Qr text={upiUri(firm, due, t.number)} /><div className="text-[11px]">Scan with any UPI app to pay<br /><b>{fmt(due)}</b> to {firm.upiId}</div></div>}
        </div>
        <div>
          <table className="w-full">
            <tbody>
              {gst && <tr><td>Taxable value</td><td className="text-right">{fmtPlain(t.taxable)}</td></tr>}
              {gst && (inter ? <tr><td>IGST</td><td className="text-right">{fmtPlain(t.igst)}</td></tr>
                : <><tr><td>CGST</td><td className="text-right">{fmtPlain(t.cgst)}</td></tr><tr><td>SGST</td><td className="text-right">{fmtPlain(t.sgst)}</td></tr></>)}
              {gst && t.cess > 0 && <tr><td>Cess</td><td className="text-right">{fmtPlain(t.cess)}</td></tr>}
              {t.billDiscount > 0 && <tr><td>Discount</td><td className="text-right">-{fmtPlain(t.billDiscount)}</td></tr>}
              {chargesTotal > 0 && t.charges.map((c, i) => <tr key={i}><td>{c.label}</td><td className="text-right">{fmtPlain(c.amount)}</td></tr>)}
              {t.roundOff !== 0 && <tr><td>Round off</td><td className="text-right">{fmtPlain(t.roundOff)}</td></tr>}
              <tr className="border-t-2 text-[14px] font-bold" style={{ borderColor: color }}><td className="pt-1">Total</td><td className="pt-1 text-right">{fmt(t.total)}</td></tr>
              {(t.type === 'sale' || t.type === 'purchase') && <>
                <tr><td>{t.type === 'sale' ? 'Received' : 'Paid'}</td><td className="text-right">{fmtPlain(t.total - due)}</td></tr>
                <tr className="font-bold"><td>Balance</td><td className="text-right">{fmt(due)}</td></tr>
              </>}
            </tbody>
          </table>
          <div className="mt-10 text-right">
            <div className="text-[11px]">For {firm.name}</div>
            <div className="mt-8 border-t border-gray-400 pt-1 text-[10px] text-gray-600">Authorised signatory</div>
          </div>
        </div>
      </div>
    </div>
  );
}
