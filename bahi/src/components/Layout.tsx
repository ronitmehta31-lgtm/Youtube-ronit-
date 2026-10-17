import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, Bell, BookOpen, Boxes, ChevronDown, FileText, HardDriveDownload, Home, Landmark, Menu, Plus, Receipt, Settings as Cog, ShoppingCart, Users, Wallet, X } from 'lucide-react';
import { useBook } from '../App';
import { Button, cx } from './ui';
import { daysBetween, todayStr } from '../lib/ledger';

interface NavItem { to: string; label: string }
interface NavGroup { label: string; icon: JSX.Element; to?: string; children?: NavItem[] }

const NAV: NavGroup[] = [
  { label: 'Home', icon: <Home size={18} />, to: '/' },
  { label: 'Parties', icon: <Users size={18} />, to: '/parties' },
  { label: 'Items', icon: <Boxes size={18} />, to: '/items' },
  { label: 'Sale', icon: <Receipt size={18} />, children: [
    { to: '/sale/invoices', label: 'Sale invoices' }, { to: '/sale/estimates', label: 'Estimates' }, { to: '/sale/payments', label: 'Payments in' },
    { to: '/sale/orders', label: 'Sale orders' }, { to: '/sale/challans', label: 'Delivery challans' }, { to: '/sale/returns', label: 'Sale returns' },
  ] },
  { label: 'Purchase', icon: <ShoppingCart size={18} />, children: [
    { to: '/purchase/bills', label: 'Purchase bills' }, { to: '/purchase/payments', label: 'Payments out' },
    { to: '/purchase/orders', label: 'Purchase orders' }, { to: '/purchase/returns', label: 'Purchase returns' },
  ] },
  { label: 'Expenses', icon: <Wallet size={18} />, children: [{ to: '/expenses', label: 'Expenses' }, { to: '/other-income', label: 'Other income' }] },
  { label: 'Cash and bank', icon: <Landmark size={18} />, to: '/cash-bank' },
  { label: 'Reports', icon: <BarChart3 size={18} />, to: '/reports' },
  { label: 'GST returns', icon: <FileText size={18} />, to: '/gst' },
  { label: 'Payment reminders', icon: <Bell size={18} />, to: '/reminders' },
  { label: 'Backup', icon: <HardDriveDownload size={18} />, to: '/backup' },
  { label: 'Settings', icon: <Cog size={18} />, to: '/settings' },
];

function NavGroupView({ g, onNav }: { g: NavGroup; onNav: () => void }) {
  const loc = useLocation();
  const active = g.children?.some((c) => loc.pathname.startsWith(c.to)) ?? false;
  const [open, setOpen] = useState(active);
  useEffect(() => { if (active) setOpen(true); }, [active]);
  const base = 'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors';
  if (g.to)
    return (
      <NavLink to={g.to} end={g.to === '/'} onClick={onNav}
        className={({ isActive }) => cx(base, isActive ? 'bg-accent text-on-accent' : 'text-on-nav hover:bg-[rgba(255,255,255,.08)]')}>
        {g.icon}{g.label}
      </NavLink>
    );
  return (
    <div>
      <button onClick={() => setOpen(!open)} aria-expanded={open} className={cx(base, 'text-on-nav hover:bg-[rgba(255,255,255,.08)]')}>
        {g.icon}<span className="flex-1 text-left">{g.label}</span><ChevronDown size={16} className={cx('transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="ml-9 mt-0.5 flex flex-col gap-0.5">
          {g.children!.map((c) => (
            <NavLink key={c.to} to={c.to} onClick={onNav}
              className={({ isActive }) => cx('rounded-md px-3 py-1.5 text-[13px]', isActive ? 'bg-accent text-on-accent font-semibold' : 'text-on-nav-muted hover:text-on-nav')}>
              {c.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { firm, lastBackupAt, txns } = useBook();
  const [drawer, setDrawer] = useState(false);
  const nav = useNavigate();
  const loc = useLocation();

  useEffect(() => setDrawer(false), [loc.pathname]);
  // Shortcuts: Alt+S new sale, Alt+P new purchase, Alt+R receive payment.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 's') { e.preventDefault(); nav('/sale/invoices/new'); }
      if (k === 'p') { e.preventDefault(); nav('/purchase/bills/new'); }
      if (k === 'r') { e.preventDefault(); nav('/sale/payments/new'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nav]);

  const backupDays = lastBackupAt ? daysBetween(lastBackupAt.slice(0, 10), todayStr()) : null;
  const needBackup = txns.length > 0 && (backupDays === null || backupDays >= 7);

  const sidebar = (
    <nav aria-label="Main" className="flex h-full flex-col gap-1 overflow-y-auto bg-nav p-3">
      <div className="mb-3 flex items-center gap-2 px-2 pt-1">
        <img src="./icon.svg" alt="" className="h-8 w-8" />
        <div className="min-w-0">
          <div className="text-[15px] font-bold leading-tight text-on-nav">Bahi</div>
          <div className="truncate text-xs text-on-nav-muted">{firm.name}</div>
        </div>
      </div>
      {NAV.map((g) => <NavGroupView key={g.label} g={g} onNav={() => setDrawer(false)} />)}
      <div className="mt-auto px-3 pt-4 text-xs text-on-nav-muted">Your data stays on this device.</div>
    </nav>
  );

  return (
    <div className="flex h-full">
      <aside className="no-print hidden w-sidebar shrink-0 lg:block">{sidebar}</aside>
      {drawer && (
        <div className="no-print fixed inset-0 z-40 flex lg:hidden">
          <div className="w-72 max-w-[85%]">{sidebar}</div>
          <button aria-label="Close menu" className="flex-1 bg-text/40" onClick={() => setDrawer(false)} />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-bg px-3 sm:px-4">
          <button className="grid h-10 w-10 place-items-center rounded-md hover:bg-surface-2 lg:hidden" aria-label="Open menu" onClick={() => setDrawer(true)}>
            {drawer ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="flex-1 truncate text-sm font-semibold lg:hidden">{firm.name}</div>
          <div className="hidden flex-1 text-xs text-text-muted lg:block">Shortcuts: Alt+S sale · Alt+P purchase · Alt+R payment in</div>
          <Button size="sm" variant="secondary" icon={<Plus size={16} />} onClick={() => nav('/purchase/bills/new')} className="hidden sm:inline-flex">Purchase</Button>
          <Button size="sm" variant="primary" icon={<Plus size={16} />} onClick={() => nav('/sale/invoices/new')}>New sale</Button>
        </header>
        {needBackup && loc.pathname !== '/backup' && (
          <div className="no-print flex flex-wrap items-center justify-between gap-2 border-b border-border bg-warning-soft px-4 py-2 text-sm text-warning">
            <span className="flex items-center gap-2"><BookOpen size={16} />
              {backupDays === null ? 'You have never downloaded a backup. Your books live only in this browser.' : `Last backup was ${backupDays} days ago.`}
            </span>
            <Button size="sm" variant="secondary" onClick={() => nav('/backup')}>Back up now</Button>
          </div>
        )}
        <main className="min-w-0 flex-1 overflow-y-auto bg-surface p-3 sm:p-6">
          <div className="mx-auto max-w-[1280px]"><Outlet /></div>
        </main>
      </div>
    </div>
  );
}
