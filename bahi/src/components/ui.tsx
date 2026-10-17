import { createContext, forwardRef, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { X } from 'lucide-react';
import { fmt } from '../lib/money';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
export { cx };

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
const btn: Record<BtnVariant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent-strong border border-transparent',
  secondary: 'bg-bg text-text border border-border-input hover:bg-surface',
  ghost: 'bg-transparent text-text border border-transparent hover:bg-surface-2',
  danger: 'bg-bg text-danger border border-danger hover:bg-danger-soft',
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md'; icon?: ReactNode }>(
  ({ variant = 'secondary', size = 'md', icon, className, children, type = 'button', ...rest }, ref) => (
    <button ref={ref} type={type}
      className={cx('inline-flex items-center justify-center gap-1.5 rounded-md font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap',
        size === 'sm' ? 'h-8 px-2.5 text-[13px]' : 'h-10 px-4 text-sm', btn[variant], className)} {...rest}>
      {icon}{children}
    </button>
  ));

/** Full width unless the caller sets a width. Tailwind can't resolve two width classes by order. */
const widthOf = (c?: string) => (c && /(^|\s)w-/.test(c) ? '' : 'w-full');
const inputCls = 'h-10 rounded-md border border-border-input bg-bg px-3 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent disabled:bg-surface';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...rest }, ref) => (
  <input ref={ref} className={cx(inputCls, widthOf(className), className)} {...rest} />
));
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...rest }, ref) => (
  <select ref={ref} className={cx(inputCls, 'pr-8', widthOf(className), className)} {...rest}>{children}</select>
));
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...p} className={cx(inputCls, 'h-auto min-h-[72px] w-full py-2', p.className)} />
);

/** Label + control + hint/error. Wires the label to the control by id. */
export function Field({ label, hint, error, children, className }: { label: string; hint?: string; error?: string; children: (id: string) => ReactNode; className?: string }) {
  const id = useId();
  return (
    <div className={cx('flex flex-col gap-1', className)}>
      <label htmlFor={id} className="text-xs font-medium text-text-muted">{label}</label>
      {children(id)}
      {error ? <p className="text-xs text-danger" role="alert">{error}</p> : hint ? <p className="text-xs text-text-muted">{hint}</p> : null}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <label htmlFor={id} className="flex-1 cursor-pointer">
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-text-muted mt-0.5">{hint}</span>}
      </label>
      <button id={id} role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={cx('relative h-6 w-11 shrink-0 rounded-full border transition-colors', checked ? 'bg-accent border-accent' : 'bg-surface-2 border-border-input')}>
        <span className={cx('absolute top-0.5 h-[18px] w-[18px] rounded-full bg-bg shadow-card transition-transform', checked ? 'translate-x-[22px]' : 'translate-x-0.5')} />
      </button>
    </div>
  );
}

export function Card({ children, className, title, action }: { children: ReactNode; className?: string; title?: string; action?: ReactNode }) {
  return (
    <section className={cx('rounded-lg border border-border bg-bg shadow-card', className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          {title && <h2 className="text-sm font-semibold">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, tone = 'text', sub, onClick }: { label: string; value: number; tone?: 'text' | 'success' | 'danger' | 'accent'; sub?: string; onClick?: () => void }) {
  const toneCls = { text: 'text-text', success: 'text-success', danger: 'text-danger', accent: 'text-accent' }[tone];
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} className={cx('rounded-lg border border-border bg-bg p-4 text-left shadow-card', onClick && 'hover:border-accent transition-colors')}>
      <div className="text-xs font-medium text-text-muted">{label}</div>
      <div className={cx('mt-1 text-xl font-bold num', toneCls)}>{fmt(value)}</div>
      {sub && <div className="mt-0.5 text-xs text-text-muted">{sub}</div>}
    </Tag>
  );
}

const chipTone: Record<string, string> = {
  paid: 'bg-success-soft text-success', partial: 'bg-warning-soft text-warning', unpaid: 'bg-surface-2 text-text-muted',
  overdue: 'bg-danger-soft text-danger', open: 'bg-accent-soft text-accent-strong', converted: 'bg-surface-2 text-text-muted', low: 'bg-danger-soft text-danger',
};
const chipLabel: Record<string, string> = { paid: 'Paid', partial: 'Part paid', unpaid: 'Unpaid', overdue: 'Overdue', open: 'Open', converted: 'Converted', low: 'Low stock' };
export const Chip = ({ status }: { status: string }) => (
  <span className={cx('inline-flex h-6 items-center rounded-full px-2 text-xs font-semibold', chipTone[status] ?? 'bg-surface-2 text-text-muted')}>{chipLabel[status] ?? status}</span>
);

export function Empty({ title, body, action, icon }: { title: string; body?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      {icon && <div className="mb-1 grid h-12 w-12 place-items-center rounded-full bg-accent-soft text-accent">{icon}</div>}
      <p className="text-base font-semibold">{title}</p>
      {body && <p className="max-w-sm text-sm text-text-muted">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>('input, select, textarea, button:not([data-close])');
    first?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-text/40 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title}
        className={cx('flex max-h-[92vh] w-full flex-col rounded-t-lg bg-bg shadow-pop sm:rounded-lg', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <button data-close onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-md hover:bg-surface-2"><X size={18} /></button>
        </header>
        <div className="overflow-y-auto px-4 py-4">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-border px-4 py-3">{footer}</footer>}
      </div>
    </div>
  );
}

// ---------- toast ----------
interface ToastMsg { id: number; text: string; tone: 'success' | 'danger' }
const ToastCtx = createContext<(text: string, tone?: 'success' | 'danger') => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastHost({ children }: { children: ReactNode }) {
  const [list, setList] = useState<ToastMsg[]>([]);
  const push = useCallback((text: string, tone: 'success' | 'danger' = 'success') => {
    const id = Date.now() + Math.random();
    setList((l) => [...l, { id, text, tone }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="no-print pointer-events-none fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2" aria-live="polite">
        {list.map((t) => (
          <div key={t.id} role="status" className={cx('pointer-events-auto rounded-md px-4 py-2.5 text-sm font-medium shadow-pop', t.tone === 'success' ? 'bg-nav text-on-nav' : 'bg-danger text-on-accent')}>{t.text}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold">{title}</h1>
        {sub && <p className="text-sm text-text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Money cell, right aligned, red when negative. */
export const Money = ({ v, tone }: { v: number; tone?: 'auto' | 'none' }) => (
  <span className={cx('num', tone === 'auto' && v < 0 && 'text-danger', tone === 'auto' && v > 0 && 'text-success')}>{fmt(v)}</span>
);
