import { useState } from 'react';
import { CheckCircle2, Download, FileUp, ShieldCheck, Upload, XCircle, AlertTriangle } from 'lucide-react';
import { useBook } from '../App';
import { Button, Card, PageHeader, useToast } from '../components/ui';
import { download } from '../components/ReportTable';
import { exportBackup, importBackup, setMeta } from '../lib/db';
import { ITEM_TEMPLATE, PARTY_TEMPLATE, importItems, importParties, verifyBooks } from '../lib/io';
import { toCsv, stockSummary, allParties } from '../lib/reports';
import { todayStr } from '../lib/ledger';

const readFile = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsText(f); });

export default function Backup() {
  const b = useBook();
  const toast = useToast();
  const [result, setResult] = useState<{ title: string; ok: number; errors: string[] } | null>(null);
  const [checks, setChecks] = useState<ReturnType<typeof verifyBooks> | null>(null);

  const backup = async () => {
    const data = await exportBackup();
    download(`bahi-backup-${b.firm.name.replace(/\W+/g, '-')}-${todayStr()}.json`, JSON.stringify(data), 'application/json');
    await setMeta('lastBackupAt', new Date().toISOString());
    toast('Backup downloaded. Keep it somewhere safe, like Google Drive or email.');
  };
  const restore = async (f?: File) => {
    if (!f) return;
    if (!confirm('Restoring replaces everything in Bahi on this device with the backup. Continue?')) return;
    try { await importBackup(JSON.parse(await readFile(f))); toast('Backup restored'); }
    catch (e) { toast((e as Error).message, 'danger'); }
  };
  const runImport = async (kind: 'items' | 'parties', f?: File) => {
    if (!f) return;
    try {
      const text = await readFile(f);
      const r = kind === 'items' ? await importItems(text) : await importParties(text);
      setResult({ title: kind === 'items' ? 'Items imported' : 'Parties imported', ...r });
    } catch (e) { toast((e as Error).message, 'danger'); }
  };

  return (
    <>
      <PageHeader title="Backup and data" sub="Your books live in this browser. A backup file is your safety net." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Backup">
          <div className="space-y-3 p-4 text-sm">
            <p>{b.lastBackupAt ? `Last backup: ${new Date(b.lastBackupAt).toLocaleString('en-IN')}` : 'You have not made a backup yet.'}</p>
            <p className="text-text-muted">Download a backup at least once a week. To move to a new phone or computer, open Bahi there and restore the file.</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" icon={<Download size={16} />} onClick={backup}>Download backup</Button>
              <label className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-md border border-border-input px-4 font-semibold hover:bg-surface">
                <Upload size={16} />Restore from file<input type="file" accept=".json,application/json" className="sr-only" onChange={(e) => restore(e.target.files?.[0])} />
              </label>
            </div>
          </div>
        </Card>
        <Card title="Check my books">
          <div className="space-y-3 p-4 text-sm">
            <p className="text-text-muted">Looks for duplicate bill numbers, bills paid more than their total, broken links, negative stock and missing HSN codes.</p>
            <Button icon={<ShieldCheck size={16} />} onClick={() => setChecks(verifyBooks(b))}>Run check</Button>
            {checks && (checks.length === 0
              ? <p className="flex items-center gap-2 font-medium text-success"><CheckCircle2 size={16} />Everything adds up.</p>
              : <ul className="space-y-1">{checks.map((c, i) => (
                <li key={i} className={'flex items-start gap-2 ' + (c.level === 'error' ? 'text-danger' : 'text-warning')}>
                  {c.level === 'error' ? <XCircle size={15} className="mt-0.5 shrink-0" /> : <AlertTriangle size={15} className="mt-0.5 shrink-0" />}{c.text}</li>
              ))}</ul>)}
          </div>
        </Card>
        <Card title="Import from a spreadsheet">
          <div className="space-y-3 p-4 text-sm">
            <p className="text-text-muted">Save your sheet as CSV (File, Save as, CSV) and pick it here. Start from a template so the columns match.</p>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-md border border-border-input px-4 font-semibold hover:bg-surface">
                <FileUp size={16} />Import items<input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => runImport('items', e.target.files?.[0])} /></label>
              <label className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-md border border-border-input px-4 font-semibold hover:bg-surface">
                <FileUp size={16} />Import parties<input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => runImport('parties', e.target.files?.[0])} /></label>
            </div>
            <div className="flex flex-wrap gap-3 text-xs">
              <button className="font-semibold text-accent hover:underline" onClick={() => download('bahi-items-template.csv', ITEM_TEMPLATE)}>Items template</button>
              <button className="font-semibold text-accent hover:underline" onClick={() => download('bahi-parties-template.csv', PARTY_TEMPLATE)}>Parties template</button>
            </div>
            {result && <div className="rounded-md bg-surface p-3"><p className="font-semibold">{result.title}: {result.ok}</p>
              {result.errors.length > 0 && <ul className="mt-1 list-disc pl-5 text-danger">{result.errors.slice(0, 10).map((e) => <li key={e}>{e}</li>)}</ul>}</div>}
          </div>
        </Card>
        <Card title="Export">
          <div className="flex flex-wrap gap-2 p-4">
            <Button onClick={() => download('bahi-items.csv', toCsv(stockSummary(b)))}>Items and stock (CSV)</Button>
            <Button onClick={() => download('bahi-parties.csv', toCsv(allParties(b, todayStr())))}>Parties and balances (CSV)</Button>
          </div>
        </Card>
      </div>
    </>
  );
}
