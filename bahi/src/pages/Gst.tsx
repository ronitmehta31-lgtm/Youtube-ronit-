import { useMemo, useState } from 'react';
import { AlertTriangle, Download } from 'lucide-react';
import { useBook } from '../App';
import { Button, Card, Field, Input, PageHeader } from '../components/ui';
import { download, ReportTable } from '../components/ReportTable';
import { gstr1, gstr3b, hsnSummary } from '../lib/reports';
import { fmt } from '../lib/money';
import { stateName } from '../lib/gst';
import { todayStr } from '../lib/ledger';

const lastMonth = () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

export default function Gst() {
  const b = useBook();
  const [month, setMonth] = useState(lastMonth());
  const g1 = useMemo(() => gstr1(b, month), [b, month]);
  const g3 = useMemo(() => gstr3b(b, month), [b, month]);
  const hsn = useMemo(() => hsnSummary(b, month + '-01', month + '-31', 'sale'), [b, month]);

  if (!b.firm.gstEnabled || !b.firm.gstin)
    return (<><PageHeader title="GST returns" /><Card><p className="p-6 text-sm text-text-muted">Add your GSTIN and turn on GST in Settings to prepare GSTR-1 and GSTR-3B.</p></Card></>);

  const row = (label: string, v: { taxable: number; igst: number; cgst: number; sgst: number; cess: number }) => (
    <tr key={label}><td className="px-3 py-2">{label}</td>{[v.taxable, v.igst, v.cgst, v.sgst, v.cess].map((x, i) => <td key={i} className="num px-3 py-2 text-right">{fmt(x)}</td>)}</tr>
  );

  return (
    <>
      <PageHeader title="GST returns" sub={`GSTIN ${b.firm.gstin}`} actions={
        <Field label="Return month">{(id) => <Input id={id} type="month" value={month} max={todayStr().slice(0, 7)} onChange={(e) => setMonth(e.target.value)} className="w-44" />}</Field>} />
      <p className="mb-4 rounded-lg border border-border bg-warning-soft px-4 py-3 text-sm text-warning">
        Prepared from your bills. Before filing, import the JSON into the GST portal's offline tool (or give it to your CA) and check the numbers. The portal's format changes from time to time.
      </p>

      <Card title="GSTR-1: outward supplies" className="mb-4" action={
        <Button size="sm" variant="primary" icon={<Download size={15} />} onClick={() => download(`GSTR1_${b.firm.gstin}_${g1.json.fp}.json`, JSON.stringify(g1.json, null, 2), 'application/json')}>Download JSON</Button>}>
        <dl className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3 lg:grid-cols-6">
          {[['B2B invoices', g1.summary.b2bInvoices], ['B2C large', g1.summary.b2clInvoices], ['B2C small rows', g1.summary.b2csRows], ['Credit notes (B2B)', g1.summary.creditNotes],
            ['Taxable value', fmt(g1.summary.taxable)], ['Total tax', fmt(g1.summary.tax)]].map(([k, v]) => (
            <div key={k} className="bg-bg px-4 py-3"><dt className="text-xs text-text-muted">{k}</dt><dd className="num font-semibold">{v}</dd></div>
          ))}
        </dl>
        {g1.warnings.length > 0 && (
          <ul className="border-t border-border px-4 py-3 text-sm">
            {g1.warnings.slice(0, 12).map((w) => <li key={w} className="flex items-start gap-2 py-0.5 text-warning"><AlertTriangle size={14} className="mt-0.5 shrink-0" />{w}</li>)}
            {g1.warnings.length > 12 && <li className="text-text-muted">…and {g1.warnings.length - 12} more</li>}
          </ul>
        )}
        {g1.b2bRows.length > 0 && (
          <div className="overflow-x-auto border-t border-border"><table className="w-full text-sm">
            <thead className="bg-surface text-left text-xs text-text-muted"><tr><th className="px-3 py-2 font-medium">Buyer GSTIN</th><th className="px-3 py-2 font-medium">Invoice</th><th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Place of supply</th><th className="px-3 py-2 text-right font-medium">Value</th></tr></thead>
            <tbody className="divide-y divide-border">{g1.b2bRows.map((r: any) => (
              <tr key={r.inum}><td className="px-3 py-2 font-mono text-xs">{r.ctin}</td><td className="px-3 py-2">{r.inum}</td><td className="px-3 py-2">{r.idt}</td><td className="px-3 py-2">{r.pos}</td><td className="num px-3 py-2 text-right">₹{r.val.toFixed(2)}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>

      <Card title="GSTR-3B: summary" className="mb-4">
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead className="bg-surface text-left text-xs text-text-muted"><tr><th className="px-3 py-2 font-medium">Section</th>{['Taxable', 'IGST', 'CGST', 'SGST', 'Cess'].map((h) => <th key={h} className="px-3 py-2 text-right font-medium">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-border">
            {row('3.1(a) Outward taxable supplies', g3.outward)}
            {row('3.1(c) Nil rated / exempt', g3.nilRated)}
            {row('3.1(d) Inward supplies on reverse charge', g3.rcm)}
            {row('4(A) Input tax credit available', g3.itc)}
            <tr className="bg-surface font-semibold"><td className="px-3 py-2">Tax payable after credit</td><td className="px-3 py-2" />
              {[g3.payable.igst, g3.payable.cgst, g3.payable.sgst, g3.payable.cess].map((x, i) => <td key={i} className={'num px-3 py-2 text-right ' + (x < 0 ? 'text-success' : '')}>{fmt(x)}</td>)}</tr>
          </tbody>
        </table></div>
        {g3.interUnreg.length > 0 && <p className="border-t border-border px-4 py-2.5 text-sm text-text-muted">3.2 Inter-state supplies to unregistered persons: {g3.interUnreg.map((x) => `${stateName(x.pos)} ${fmt(x.taxable)} (IGST ${fmt(x.igst)})`).join('; ')}</p>}
        <p className="border-t border-border px-4 py-2.5 text-xs text-text-muted">A negative payable is credit carried forward. Cross-utilisation of IGST against CGST/SGST is done on the portal.</p>
      </Card>

      <ReportTable r={hsn} file={`hsn-${month}`} />
    </>
  );
}
