import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BellOff, MessageCircle } from 'lucide-react';
import { useBook } from '../App';
import { Button, Card, Empty, PageHeader, cx } from '../components/ui';
import { daysBetween, partyBalances, payStatus, todayStr } from '../lib/ledger';
import { fmt } from '../lib/money';
import { reminderText, whatsappUrl } from '../lib/share';

export default function Reminders() {
  const b = useBook();
  const today = todayStr();
  const rows = useMemo(() => {
    const bal = partyBalances(b.parties, b.txns);
    return b.parties.map((p) => {
      const open = b.txns.filter((t) => t.type === 'sale' && t.partyId === p.id).map((t) => ({ t, s: payStatus(t, b.txns, today) })).filter((x) => x.s.due > 0);
      const oldest = open.reduce((m, x) => Math.max(m, daysBetween(x.t.dueDate ?? x.t.date, today)), 0);
      return { p, due: bal.get(p.id) ?? 0, open, oldest, overdue: open.some((x) => x.s.status === 'overdue') };
    }).filter((r) => r.due > 0).sort((a, c) => Number(c.overdue) - Number(a.overdue) || c.oldest - a.oldest || c.due - a.due);
  }, [b, today]);

  const total = rows.reduce((s, r) => s + r.due, 0);
  return (
    <>
      <PageHeader title="Payment reminders" sub={rows.length ? `${rows.length} parties owe you ${fmt(total)}` : undefined} />
      <Card>
        {rows.length === 0 ? <Empty icon={<BellOff size={22} />} title="Nobody owes you money" body="When a customer has a balance, they show up here with a one-tap WhatsApp reminder." /> : (
          <ul className="divide-y divide-border">
            {rows.map(({ p, due, open, oldest, overdue }) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <Link to={`/parties/${p.id}`} className="font-medium hover:underline">{p.name}</Link>
                  <div className="text-xs text-text-muted">{open.length} unpaid bill{open.length === 1 ? '' : 's'}{open.length ? ` · oldest ${oldest} day${oldest === 1 ? '' : 's'}` : ''}{p.phone ? ` · ${p.phone}` : ' · no phone saved'}</div>
                </div>
                <span className={cx('num font-semibold', overdue ? 'text-danger' : '')}>{fmt(due)}</span>
                <Button size="sm" variant={overdue ? 'primary' : 'secondary'} icon={<MessageCircle size={15} />} disabled={!p.phone}
                  onClick={() => window.open(whatsappUrl(p.phone, reminderText(b.firm, p, due)), '_blank')}>Remind on WhatsApp</Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
