// Pure functions: every balance in the app is computed from transactions, never stored.
import type { Account, Item, Party, Txn, TxnType } from './types';
import type { Paise } from './money';

/** What a transaction does to a party's balance. Positive = they owe you more. */
export function partyEffect(t: Txn): Paise {
  switch (t.type) {
    case 'sale': return t.total - t.paid;
    case 'sale_return': return -(t.total - t.paid);
    case 'purchase': return -(t.total - t.paid);
    case 'purchase_return': return t.total - t.paid;
    case 'payment_in': return -(t.total + (t.payDiscount ?? 0));
    case 'payment_out': return t.total + (t.payDiscount ?? 0);
    case 'expense': return t.partyId ? -(t.total - t.paid) : 0;
    case 'other_income': return t.partyId ? t.total - t.paid : 0;
    default: return 0;
  }
}

export function partyBalance(p: Party, txns: Txn[]): Paise {
  return txns.reduce((s, t) => (t.partyId === p.id ? s + partyEffect(t) : s), p.openingBalance || 0);
}

export function partyBalances(parties: Party[], txns: Txn[]): Map<string, Paise> {
  const m = new Map(parties.map((p) => [p.id, p.openingBalance || 0] as [string, Paise]));
  for (const t of txns) if (t.partyId && m.has(t.partyId)) m.set(t.partyId, m.get(t.partyId)! + partyEffect(t));
  return m;
}

/** Signed stock movement of one line, by transaction type. */
const STOCK_SIGN: Partial<Record<TxnType, number>> = { sale: -1, sale_return: 1, purchase: 1, purchase_return: -1, stock_adj: 1 };

export function stockMovements(txns: Txn[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of txns) {
    const sign = STOCK_SIGN[t.type];
    if (!sign) continue;
    for (const l of t.lines) if (l.itemId) m.set(l.itemId, (m.get(l.itemId) ?? 0) + sign * (l.qty + (l.freeQty || 0)));
  }
  return m;
}

export const stockOf = (item: Item, moves: Map<string, number>) =>
  item.kind === 'service' ? 0 : (item.openingStock || 0) + (moves.get(item.id) ?? 0);

/** Purchase price without tax, used to value stock and cost of goods. */
export const costPrice = (item: Item): Paise =>
  item.purchaseInclusive ? Math.round(item.purchasePrice / (1 + (item.taxRate + item.cessRate) / 100)) : item.purchasePrice;

/** Money in (+) or out (-) of an account from one transaction. */
export function accountEffect(t: Txn, accountId: string): Paise {
  if (t.type === 'transfer') {
    let s = 0;
    if (t.accountId === accountId) s -= t.total;
    if (t.toAccountId === accountId) s += t.total;
    return s;
  }
  if (t.accountId !== accountId) return 0;
  switch (t.type) {
    case 'sale': case 'purchase_return': case 'other_income': case 'payment_in': return t.paid;
    case 'purchase': case 'sale_return': case 'expense': case 'payment_out': return -t.paid;
    default: return 0;
  }
}

export function accountBalance(a: Account, txns: Txn[]): Paise {
  return txns.reduce((s, t) => s + accountEffect(t, a.id), a.openingBalance || 0);
}

/** How much of an invoice or bill has been settled: paid on the bill, plus linked payments. */
export function settledOn(inv: Txn, txns: Txn[]): Paise {
  let s = inv.paid;
  for (const t of txns) for (const l of t.links ?? []) if (l.txnId === inv.id) s += l.amount;
  return s;
}

export type PayStatus = 'paid' | 'partial' | 'unpaid' | 'overdue';

export function payStatus(inv: Txn, txns: Txn[], today: string): { status: PayStatus; due: Paise } {
  const due = Math.max(0, inv.total - settledOn(inv, txns));
  if (due === 0) return { status: 'paid', due };
  if (inv.dueDate && inv.dueDate < today) return { status: 'overdue', due };
  return { status: due === inv.total ? 'unpaid' : 'partial', due };
}

/** Oldest-first allocation of a payment across open invoices of one party. */
export function autoAllocate(amount: Paise, open: { id: string; due: Paise; date: string }[]): { txnId: string; amount: Paise }[] {
  const out: { txnId: string; amount: Paise }[] = [];
  let left = amount;
  for (const inv of [...open].sort((a, b) => a.date.localeCompare(b.date))) {
    if (left <= 0) break;
    const take = Math.min(left, inv.due);
    if (take > 0) out.push({ txnId: inv.id, amount: take });
    left -= take;
  }
  return out;
}

export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);

/** Next number for a document type: highest numeric suffix in use + 1. */
export function nextNumber(prefix: string, existing: string[]): string {
  let max = 0;
  for (const n of existing) {
    if (prefix && !n.startsWith(prefix)) continue;
    const m = n.slice(prefix.length).match(/^(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return prefix + (max + 1);
}
