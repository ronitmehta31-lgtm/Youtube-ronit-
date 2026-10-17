import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { cx } from './ui';

export interface Option { id: string; label: string; sub?: string; right?: ReactNode; exact?: string[] }

/**
 * Keyboard-first picker. Arrow keys move, Enter picks the highlighted option, or an exact code/barcode match
 * straight away. A "create" row appears for text that matches nothing.
 */
export const Combobox = forwardRef<HTMLInputElement, {
  options: Option[];
  value: string;
  onText: (text: string) => void;
  onPick: (id: string) => void;
  onCreate?: (text: string) => void;
  createLabel?: (text: string) => string;
  placeholder?: string;
  label: string;
  className?: string;
  inputClassName?: string;
  limit?: number;
}>(function Combobox({ options, value, onText, onPick, onCreate, createLabel, placeholder, label, className, inputClassName, limit = 8 }, ref) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => inputRef.current!);
  const listId = useId();

  const q = value.trim().toLowerCase();
  const matches = (q ? options.filter((o) => o.label.toLowerCase().includes(q) || o.sub?.toLowerCase().includes(q) || o.exact?.some((e) => e.toLowerCase() === q)) : options).slice(0, limit);
  const exact = q ? options.find((o) => o.exact?.some((e) => e.toLowerCase() === q) || o.label.toLowerCase() === q) : undefined;
  const showCreate = !!onCreate && !!q && !options.some((o) => o.label.toLowerCase() === q);
  const total = matches.length + (showCreate ? 1 : 0);

  useEffect(() => setHi(0), [value]);

  const choose = (i: number) => {
    if (i < matches.length) onPick(matches[i].id);
    else if (showCreate) onCreate!(value.trim());
    setOpen(false);
  };

  return (
    <div className={cx('relative', className)}>
      <input ref={inputRef} role="combobox" aria-label={label} aria-expanded={open && total > 0} aria-controls={listId} aria-autocomplete="list"
        aria-activedescendant={open && total ? `${listId}-${hi}` : undefined}
        className={cx('w-full h-10 rounded-md border border-border-input bg-bg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent', inputClassName)}
        value={value} placeholder={placeholder} autoComplete="off"
        onChange={(e) => { onText(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHi((h) => Math.min(total - 1, h + 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); }
          else if (e.key === 'Enter') {
            if (exact && hi === 0) { e.preventDefault(); onPick(exact.id); setOpen(false); }
            else if (open && total > 0) { e.preventDefault(); choose(hi); }
          } else if (e.key === 'Escape') setOpen(false);
        }} />
      {open && total > 0 && (
        <ul id={listId} role="listbox" className="absolute left-0 right-0 top-full z-40 mt-1 max-h-72 min-w-[260px] overflow-y-auto rounded-md border border-border bg-bg py-1 shadow-pop">
          {matches.map((o, i) => (
            <li key={o.id} id={`${listId}-${i}`} role="option" aria-selected={i === hi}
              onMouseDown={(e) => { e.preventDefault(); choose(i); }} onMouseEnter={() => setHi(i)}
              className={cx('flex cursor-pointer items-center gap-2 px-3 py-2 text-sm', i === hi && 'bg-accent-soft')}>
              <div className="min-w-0 flex-1"><div className="truncate font-medium">{o.label}</div>{o.sub && <div className="truncate text-xs text-text-muted">{o.sub}</div>}</div>
              {o.right && <div className="shrink-0 text-xs">{o.right}</div>}
            </li>
          ))}
          {showCreate && (
            <li id={`${listId}-${matches.length}`} role="option" aria-selected={hi === matches.length}
              onMouseDown={(e) => { e.preventDefault(); choose(matches.length); }} onMouseEnter={() => setHi(matches.length)}
              className={cx('cursor-pointer border-t border-border px-3 py-2 text-sm font-semibold text-accent', hi === matches.length && 'bg-accent-soft')}>
              {createLabel ? createLabel(value.trim()) : `Add "${value.trim()}"`}
            </li>
          )}
        </ul>
      )}
    </div>
  );
});
