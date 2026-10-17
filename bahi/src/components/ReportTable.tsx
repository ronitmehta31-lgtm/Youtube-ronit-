import { Download, Printer } from 'lucide-react';
import type { Report } from '../lib/reports';
import { toCsv } from '../lib/reports';
import { fmt } from '../lib/money';
import { Button, Card, cx } from './ui';

export function download(name: string, content: string, type = 'text/csv') {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const cell = (kind: string | undefined, v: unknown) => (kind === 'money' && typeof v === 'number' ? fmt(v) : v == null ? '' : String(v));

export function ReportTable({ r, file }: { r: Report; file: string }) {
  return (
    <Card title={r.title} action={<div className="no-print flex gap-2">
      <Button size="sm" icon={<Download size={15} />} onClick={() => download(`${file}.csv`, toCsv(r))}>Excel (CSV)</Button>
      <Button size="sm" icon={<Printer size={15} />} onClick={() => window.print()}>Print</Button></div>}>
      {r.rows.length === 0 ? <p className="p-6 text-center text-sm text-text-muted">Nothing to show for this period.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-xs text-text-muted">
              <tr>{r.columns.map((c) => <th key={c.key} className={cx('whitespace-nowrap px-3 py-2 font-medium', (c.kind === 'money' || c.kind === 'num') && 'text-right')}>{c.label}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-border">
              {r.rows.map((row, i) => {
                const head = String(row[r.columns[0].key] ?? '');
                const strong = /^(Total|Gross profit|Net profit|Assets|Liabilities|Owner)/.test(head);
                return (
                  <tr key={i} className={cx(strong && 'bg-surface font-semibold')}>
                    {r.columns.map((c) => {
                      const v = row[c.key];
                      return <td key={c.key} className={cx('px-3 py-2', (c.kind === 'money' || c.kind === 'num') && 'num text-right whitespace-nowrap', c.kind === 'money' && typeof v === 'number' && v < 0 && 'text-danger')}>{cell(c.kind, v)}</td>;
                    })}
                  </tr>
                );
              })}
            </tbody>
            {r.totals && (
              <tfoot className="border-t-2 border-border bg-surface font-semibold">
                <tr>{r.columns.map((c) => <td key={c.key} className={cx('px-3 py-2', (c.kind === 'money' || c.kind === 'num') && 'num text-right whitespace-nowrap')}>{cell(c.kind, r.totals![c.key])}</td>)}</tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
      {r.note && <p className="border-t border-border px-4 py-2.5 text-xs text-text-muted">{r.note}</p>}
    </Card>
  );
}
