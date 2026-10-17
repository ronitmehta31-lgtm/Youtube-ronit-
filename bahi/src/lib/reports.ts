// Every report is a pure function over a snapshot of the books.
import type { Account, Category, Firm, Item, Party, Txn, TxnType } from './types';
import { TXN } from './types';
import type { Paise } from './money';
import { accountBalance, accountEffect, costPrice, daysBetween, partyBalances, partyEffect, payStatus, stockMovements, stockOf } from './ledger';
import { gstinState, stateName, validGstin } from './gst';

export interface Books {
  firm: Firm;
  parties: Party[];
  items: Item[];
  txns: Txn[];
  accounts: Account[];
  categories: Category[];
}

export interface Column { key: string; label: string; kind?: 'money' | 'num' | 'text' | 'date' }
export interface Report {
  title: string;
  columns: Column[];
  rows: Record<string, string | number>[];
  totals?: Record<string, string | number>;
  note?: string;
}

const inRange = (d: string, from: string, to: string) => d >= from && d <= to;
const sumBy = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0);
const tax = (t: { cgst: Paise; sgst: Paise; igst: Paise; cess: Paise }) => t.cgst + t.sgst + t.igst + t.cess;

function totalsOf(rows: Record<string, string | number>[], cols: Column[], label = 'Total') {
  const out: Record<string, string | number> = {};
  cols.forEach((c, i) => {
    if (i === 0) out[c.key] = label;
    else if (c.kind === 'money' || c.kind === 'num') out[c.key] = rows.reduce((s, r) => s + (Number(r[c.key]) || 0), 0);
  });
  return out;
}

const partyName = (b: Books, t: Txn) => b.parties.find((p) => p.id === t.partyId)?.name ?? t.partyName ?? (t.partyId ? '?' : 'Cash');

// ---------- transaction reports ----------
export function txnReport(b: Books, types: TxnType[], from: string, to: string, today: string): Report {
  const rows = b.txns
    .filter((t) => types.includes(t.type) && inRange(t.date, from, to))
    .sort((a, c) => a.date.localeCompare(c.date) || a.number.localeCompare(c.number, undefined, { numeric: true }))
    .map((t) => {
      const st = TXN[t.type].hasLines && !TXN[t.type].isDoc && (t.type === 'sale' || t.type === 'purchase') ? payStatus(t, b.txns, today) : null;
      return {
        date: t.date, number: t.number, type: TXN[t.type].label, party: partyName(b, t),
        taxable: t.taxable, tax: tax(t), total: t.total, balance: st ? st.due : 0, status: st?.status ?? t.status ?? '',
      };
    });
  const columns: Column[] = [
    { key: 'date', label: 'Date', kind: 'date' }, { key: 'number', label: 'No.' }, { key: 'type', label: 'Type' },
    { key: 'party', label: 'Party' }, { key: 'taxable', label: 'Taxable', kind: 'money' }, { key: 'tax', label: 'Tax', kind: 'money' },
    { key: 'total', label: 'Total', kind: 'money' }, { key: 'balance', label: 'Balance due', kind: 'money' }, { key: 'status', label: 'Status' },
  ];
  return { title: types.map((t) => TXN[t].plural).join(' + '), columns, rows, totals: totalsOf(rows, columns) };
}

export function dayBook(b: Books, from: string, to: string): Report {
  const cash = (t: Txn) => sumBy(b.accounts, (a) => accountEffect(t, a.id));
  const rows = b.txns
    .filter((t) => inRange(t.date, from, to) && !TXN[t.type].isDoc)
    .sort((a, c) => a.date.localeCompare(c.date) || a.createdAt.localeCompare(c.createdAt))
    .map((t) => {
      const c = cash(t);
      return { date: t.date, type: TXN[t.type].label, number: t.number, party: t.type === 'transfer' ? '' : partyName(b, t), total: t.total, moneyIn: c > 0 ? c : 0, moneyOut: c < 0 ? -c : 0 };
    });
  const columns: Column[] = [
    { key: 'date', label: 'Date', kind: 'date' }, { key: 'type', label: 'Type' }, { key: 'number', label: 'No.' }, { key: 'party', label: 'Party' },
    { key: 'total', label: 'Amount', kind: 'money' }, { key: 'moneyIn', label: 'Money in', kind: 'money' }, { key: 'moneyOut', label: 'Money out', kind: 'money' },
  ];
  return { title: 'Day book', columns, rows, totals: totalsOf(rows, columns) };
}

// ---------- profit ----------
/** Stock value at cost on a date: opening stock plus movements up to and including that date. */
export function stockValueAt(b: Books, date: string): Paise {
  const moves = stockMovements(b.txns.filter((t) => t.date <= date));
  return sumBy(b.items, (i) => Math.max(0, stockOf(i, moves)) * costPrice(i));
}

function dayBefore(d: string) {
  const x = new Date(d + 'T00:00:00Z');
  x.setUTCDate(x.getUTCDate() - 1);
  return x.toISOString().slice(0, 10);
}

export function profitLoss(b: Books, from: string, to: string) {
  const ts = b.txns.filter((t) => inRange(t.date, from, to));
  const by = (type: TxnType) => sumBy(ts.filter((t) => t.type === type), (t) => t.taxable + sumBy(t.charges, (c) => c.amount) - t.billDiscount);
  const sales = by('sale'), saleReturns = by('sale_return'), purchases = by('purchase'), purchaseReturns = by('purchase_return');
  const expenses = by('expense'), otherIncome = by('other_income');
  const openingStock = stockValueAt(b, dayBefore(from));
  const closingStock = stockValueAt(b, to);
  const paymentDiscountGiven = sumBy(ts.filter((t) => t.type === 'payment_in'), (t) => t.payDiscount ?? 0);
  const paymentDiscountTaken = sumBy(ts.filter((t) => t.type === 'payment_out'), (t) => t.payDiscount ?? 0);
  const cogs = openingStock + purchases - purchaseReturns - closingStock;
  const grossProfit = sales - saleReturns - cogs;
  const netProfit = grossProfit + otherIncome + paymentDiscountTaken - expenses - paymentDiscountGiven;
  return { sales, saleReturns, purchases, purchaseReturns, openingStock, closingStock, cogs, grossProfit, expenses, otherIncome, paymentDiscountGiven, paymentDiscountTaken, netProfit };
}

export function profitLossReport(b: Books, from: string, to: string): Report {
  const p = profitLoss(b, from, to);
  const rows: [string, Paise][] = [
    ['Sales (before tax)', p.sales], ['Less: sale returns', -p.saleReturns], ['Opening stock', -p.openingStock],
    ['Purchases (before tax)', -p.purchases], ['Less: purchase returns', p.purchaseReturns], ['Closing stock', p.closingStock],
    ['Gross profit', p.grossProfit], ['Other income', p.otherIncome], ['Discount received on payments', p.paymentDiscountTaken],
    ['Expenses (before tax)', -p.expenses], ['Discount given on payments', -p.paymentDiscountGiven], ['Net profit', p.netProfit],
  ];
  return {
    title: 'Profit and loss',
    columns: [{ key: 'head', label: '' }, { key: 'amount', label: 'Amount', kind: 'money' }],
    rows: rows.map(([head, amount]) => ({ head, amount })),
    note: 'Stock is valued at each item\'s purchase price before tax. GST is not income or cost, so it is left out.',
  };
}

export function billWiseProfit(b: Books, from: string, to: string): Report {
  const items = new Map(b.items.map((i) => [i.id, i]));
  const rows = b.txns.filter((t) => t.type === 'sale' && inRange(t.date, from, to)).map((t) => {
    const sale = t.taxable - t.billDiscount + sumBy(t.charges, (c) => c.amount);
    const cost = sumBy(t.lines, (l) => { const i = l.itemId ? items.get(l.itemId) : undefined; return i ? (l.qty + l.freeQty) * costPrice(i) : 0; });
    return { date: t.date, number: t.number, party: partyName(b, t), sale, cost, profit: sale - cost };
  });
  const columns: Column[] = [{ key: 'date', label: 'Date', kind: 'date' }, { key: 'number', label: 'Invoice' }, { key: 'party', label: 'Party' },
    { key: 'sale', label: 'Sale (before tax)', kind: 'money' }, { key: 'cost', label: 'Cost', kind: 'money' }, { key: 'profit', label: 'Profit', kind: 'money' }];
  return { title: 'Bill-wise profit', columns, rows, totals: totalsOf(rows, columns) };
}

export function itemWiseProfit(b: Books, from: string, to: string): Report {
  const m = new Map<string, { name: string; qty: number; sale: Paise; cost: Paise }>();
  for (const t of b.txns) {
    if (!inRange(t.date, from, to) || (t.type !== 'sale' && t.type !== 'sale_return')) continue;
    const sign = t.type === 'sale' ? 1 : -1;
    for (const l of t.lines) {
      const item = b.items.find((i) => i.id === l.itemId);
      const key = l.itemId ?? l.name;
      const e = m.get(key) ?? { name: item?.name ?? l.name, qty: 0, sale: 0, cost: 0 };
      e.qty += sign * (l.qty + l.freeQty); e.sale += sign * l.taxable; e.cost += sign * (item ? (l.qty + l.freeQty) * costPrice(item) : 0);
      m.set(key, e);
    }
  }
  const rows = [...m.values()].map((e) => ({ ...e, profit: e.sale - e.cost })).sort((a, c) => c.profit - a.profit);
  const columns: Column[] = [{ key: 'name', label: 'Item' }, { key: 'qty', label: 'Qty sold', kind: 'num' }, { key: 'sale', label: 'Sale (before tax)', kind: 'money' },
    { key: 'cost', label: 'Cost', kind: 'money' }, { key: 'profit', label: 'Profit', kind: 'money' }];
  return { title: 'Item-wise profit', columns, rows, totals: totalsOf(rows, columns) };
}

export function partyWiseProfit(b: Books, from: string, to: string): Report {
  const bill = billWiseProfit(b, from, to);
  const m = new Map<string, { party: string; sale: number; cost: number; profit: number }>();
  for (const r of bill.rows) {
    const e = m.get(String(r.party)) ?? { party: String(r.party), sale: 0, cost: 0, profit: 0 };
    e.sale += Number(r.sale); e.cost += Number(r.cost); e.profit += Number(r.profit);
    m.set(e.party, e);
  }
  const rows = [...m.values()].sort((a, c) => c.profit - a.profit);
  const columns: Column[] = [{ key: 'party', label: 'Party' }, { key: 'sale', label: 'Sale (before tax)', kind: 'money' }, { key: 'cost', label: 'Cost', kind: 'money' }, { key: 'profit', label: 'Profit', kind: 'money' }];
  return { title: 'Party-wise profit', columns, rows, totals: totalsOf(rows, columns) };
}

// ---------- stock ----------
export function stockSummary(b: Books, lowOnly = false): Report {
  const moves = stockMovements(b.txns);
  const rows = b.items.filter((i) => i.kind === 'product').map((i) => {
    const qty = stockOf(i, moves);
    return { name: i.name, code: i.code ?? '', unit: i.unit, qty, min: i.minStock || 0, cost: costPrice(i), value: Math.max(0, qty) * costPrice(i), salePrice: i.salePrice };
  }).filter((r) => !lowOnly || r.qty <= r.min).sort((a, c) => a.name.localeCompare(c.name));
  const columns: Column[] = [{ key: 'name', label: 'Item' }, { key: 'code', label: 'Code' }, { key: 'unit', label: 'Unit' }, { key: 'qty', label: 'Stock', kind: 'num' },
    { key: 'min', label: 'Min', kind: 'num' }, { key: 'cost', label: 'Purchase price', kind: 'money' }, { key: 'value', label: 'Stock value', kind: 'money' }, { key: 'salePrice', label: 'Sale price', kind: 'money' }];
  return { title: lowOnly ? 'Low stock' : 'Stock summary', columns, rows, totals: { name: 'Total', value: sumBy(rows, (r) => r.value) } };
}

export function itemDetail(b: Books, itemId: string): Report {
  const item = b.items.find((i) => i.id === itemId);
  let running = item?.openingStock ?? 0;
  const sign: Partial<Record<TxnType, number>> = { sale: -1, sale_return: 1, purchase: 1, purchase_return: -1, stock_adj: 1 };
  const rows: Record<string, string | number>[] = [{ date: '', type: 'Opening stock', number: '', party: '', change: running, stock: running }];
  for (const t of [...b.txns].sort((a, c) => a.date.localeCompare(c.date) || a.createdAt.localeCompare(c.createdAt))) {
    const s = sign[t.type];
    if (!s) continue;
    const qty = sumBy(t.lines.filter((l) => l.itemId === itemId), (l) => l.qty + l.freeQty);
    if (!qty) continue;
    running += s * qty;
    rows.push({ date: t.date, type: TXN[t.type].label, number: t.number, party: t.type === 'stock_adj' ? t.notes ?? '' : partyName(b, t), change: s * qty, stock: running });
  }
  return {
    title: `Stock history: ${item?.name ?? ''}`,
    columns: [{ key: 'date', label: 'Date', kind: 'date' }, { key: 'type', label: 'Type' }, { key: 'number', label: 'No.' }, { key: 'party', label: 'Party / reason' },
      { key: 'change', label: 'Change', kind: 'num' }, { key: 'stock', label: 'Stock after', kind: 'num' }],
    rows,
  };
}

// ---------- parties ----------
export function partyStatement(b: Books, partyId: string, from: string, to: string): Report {
  const p = b.parties.find((x) => x.id === partyId);
  if (!p) return { title: 'Party statement', columns: [], rows: [] };
  const mine = b.txns.filter((t) => t.partyId === partyId && !TXN[t.type].isDoc).sort((a, c) => a.date.localeCompare(c.date) || a.createdAt.localeCompare(c.createdAt));
  let bal = (p.openingBalance || 0) + sumBy(mine.filter((t) => t.date < from), partyEffect);
  const rows: Record<string, string | number>[] = [{ date: from, type: 'Opening balance', number: '', debit: 0, credit: 0, balance: bal }];
  for (const t of mine.filter((t) => inRange(t.date, from, to))) {
    const e = partyEffect(t);
    bal += e;
    rows.push({ date: t.date, type: TXN[t.type].label, number: t.number, total: t.total, debit: e > 0 ? e : 0, credit: e < 0 ? -e : 0, balance: bal });
  }
  const columns: Column[] = [{ key: 'date', label: 'Date', kind: 'date' }, { key: 'type', label: 'Type' }, { key: 'number', label: 'No.' }, { key: 'total', label: 'Bill total', kind: 'money' },
    { key: 'debit', label: 'They owe more', kind: 'money' }, { key: 'credit', label: 'They owe less', kind: 'money' }, { key: 'balance', label: 'Balance', kind: 'money' }];
  return { title: `Statement: ${p.name}`, columns, rows, note: 'Positive balance: they owe you. Negative: you owe them.' };
}

export function allParties(b: Books, today: string): Report {
  const bal = partyBalances(b.parties, b.txns);
  const rows = b.parties.map((p) => {
    const open = b.txns.filter((t) => t.partyId === p.id && t.type === 'sale').map((t) => ({ t, s: payStatus(t, b.txns, today) })).filter((x) => x.s.due > 0);
    const oldest = open.reduce((m, x) => Math.max(m, daysBetween(x.t.dueDate ?? x.t.date, today)), 0);
    const v = bal.get(p.id) ?? 0;
    return { name: p.name, phone: p.phone ?? '', receivable: v > 0 ? v : 0, payable: v < 0 ? -v : 0, oldestDays: open.length ? oldest : 0 };
  }).sort((a, c) => c.receivable - a.receivable || c.payable - a.payable);
  const columns: Column[] = [{ key: 'name', label: 'Party' }, { key: 'phone', label: 'Phone' }, { key: 'receivable', label: 'To receive', kind: 'money' },
    { key: 'payable', label: 'To pay', kind: 'money' }, { key: 'oldestDays', label: 'Oldest unpaid (days)', kind: 'num' }];
  return { title: 'All parties', columns, rows, totals: totalsOf(rows, columns) };
}

// ---------- money ----------
export function cashFlow(b: Books, from: string, to: string): Report {
  const rows = b.accounts.map((a) => {
    const before = b.txns.filter((t) => t.date < from).reduce((s, t) => s + accountEffect(t, a.id), a.openingBalance || 0);
    let inn = 0, out = 0;
    for (const t of b.txns) if (inRange(t.date, from, to)) { const e = accountEffect(t, a.id); if (e > 0) inn += e; else out -= e; }
    return { name: a.name, opening: before, moneyIn: inn, moneyOut: out, closing: before + inn - out };
  });
  const columns: Column[] = [{ key: 'name', label: 'Account' }, { key: 'opening', label: 'Opening', kind: 'money' }, { key: 'moneyIn', label: 'Money in', kind: 'money' },
    { key: 'moneyOut', label: 'Money out', kind: 'money' }, { key: 'closing', label: 'Closing', kind: 'money' }];
  return { title: 'Cash flow', columns, rows, totals: totalsOf(rows, columns) };
}

export function balanceSheet(b: Books, asOf: string): Report {
  const ts = b.txns.filter((t) => t.date <= asOf);
  const bal = partyBalances(b.parties, ts);
  const receivable = sumBy([...bal.values()].filter((v) => v > 0), (v) => v);
  const payable = -sumBy([...bal.values()].filter((v) => v < 0), (v) => v);
  const cash = sumBy(b.accounts, (a) => accountBalance(a, ts));
  const stock = stockValueAt(b, asOf);
  // GST: output tax on sales minus input tax on purchases and expenses. Positive means you owe the government.
  const out = sumBy(ts.filter((t) => t.type === 'sale'), tax) - sumBy(ts.filter((t) => t.type === 'sale_return'), tax);
  const inp = sumBy(ts.filter((t) => t.type === 'purchase' || t.type === 'expense'), tax) - sumBy(ts.filter((t) => t.type === 'purchase_return'), tax);
  const gst = out - inp;
  const assets = receivable + Math.max(0, cash) + stock + (gst < 0 ? -gst : 0);
  const liabilities = payable + (cash < 0 ? -cash : 0) + (gst > 0 ? gst : 0);
  const rows = [
    { head: 'Assets', amount: '' }, { head: 'Cash and bank', amount: Math.max(0, cash) }, { head: 'To receive from parties', amount: receivable },
    { head: 'Stock (at cost)', amount: stock }, { head: 'GST input credit', amount: gst < 0 ? -gst : 0 }, { head: 'Total assets', amount: assets },
    { head: 'Liabilities', amount: '' }, { head: 'To pay to parties', amount: payable }, { head: 'Overdrawn bank', amount: cash < 0 ? -cash : 0 },
    { head: 'GST payable', amount: gst > 0 ? gst : 0 }, { head: 'Total liabilities', amount: liabilities },
    { head: "Owner's capital (assets - liabilities)", amount: assets - liabilities },
  ];
  return { title: `Balance sheet as on ${asOf}`, columns: [{ key: 'head', label: '' }, { key: 'amount', label: 'Amount', kind: 'money' }], rows,
    note: 'A simple balance sheet from your bills, payments, stock and cash. Fixed assets and loans are not tracked here.' };
}

export function expenseByCategory(b: Books, from: string, to: string, kind: 'expense' | 'other_income' = 'expense'): Report {
  const m = new Map<string, number>();
  for (const t of b.txns) if (t.type === kind && inRange(t.date, from, to)) {
    const name = b.categories.find((c) => c.id === t.categoryId)?.name ?? 'Uncategorised';
    m.set(name, (m.get(name) ?? 0) + t.total);
  }
  const rows = [...m.entries()].map(([category, amount]) => ({ category, amount })).sort((a, c) => c.amount - a.amount);
  const columns: Column[] = [{ key: 'category', label: 'Category' }, { key: 'amount', label: 'Amount', kind: 'money' }];
  return { title: kind === 'expense' ? 'Expenses by category' : 'Other income by category', columns, rows, totals: totalsOf(rows, columns) };
}

// ---------- GST ----------
export function taxRateReport(b: Books, from: string, to: string): Report {
  const m = new Map<number, { rate: number; salesTaxable: number; salesTax: number; purchTaxable: number; purchTax: number }>();
  for (const t of b.txns) {
    if (!inRange(t.date, from, to)) continue;
    const s = t.type === 'sale' ? ['sales', 1] : t.type === 'sale_return' ? ['sales', -1] : t.type === 'purchase' || t.type === 'expense' ? ['purch', 1] : t.type === 'purchase_return' ? ['purch', -1] : null;
    if (!s) continue;
    for (const l of t.lines) {
      const e = m.get(l.taxRate) ?? { rate: l.taxRate, salesTaxable: 0, salesTax: 0, purchTaxable: 0, purchTax: 0 };
      const k = s[0] as 'sales' | 'purch', sign = s[1] as number;
      if (k === 'sales') { e.salesTaxable += sign * l.taxable; e.salesTax += sign * tax(l); } else { e.purchTaxable += sign * l.taxable; e.purchTax += sign * tax(l); }
      m.set(l.taxRate, e);
    }
  }
  const rows = [...m.values()].sort((a, c) => a.rate - c.rate).map((e) => ({ ...e, rate: e.rate + '%' }));
  const columns: Column[] = [{ key: 'rate', label: 'GST rate' }, { key: 'salesTaxable', label: 'Sales taxable', kind: 'money' }, { key: 'salesTax', label: 'Tax collected', kind: 'money' },
    { key: 'purchTaxable', label: 'Purchases taxable', kind: 'money' }, { key: 'purchTax', label: 'Tax paid', kind: 'money' }];
  return { title: 'Tax by rate', columns, rows, totals: totalsOf(rows, columns) };
}

export function hsnSummary(b: Books, from: string, to: string, side: 'sale' | 'purchase'): Report {
  const m = new Map<string, { hsn: string; desc: string; uqc: string; rate: number; qty: number; value: number; taxable: number; igst: number; cgst: number; sgst: number; cess: number }>();
  const types: [TxnType, number][] = side === 'sale' ? [['sale', 1], ['sale_return', -1]] : [['purchase', 1], ['purchase_return', -1]];
  for (const t of b.txns) {
    const tp = types.find(([x]) => x === t.type);
    if (!tp || !inRange(t.date, from, to)) continue;
    for (const l of t.lines) {
      const key = `${l.hsn ?? ''}|${l.taxRate}`;
      const e = m.get(key) ?? { hsn: l.hsn ?? '', desc: l.name, uqc: uqc(l.unit), rate: l.taxRate, qty: 0, value: 0, taxable: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 };
      const s = tp[1];
      e.qty += s * (l.qty + l.freeQty); e.value += s * l.amount; e.taxable += s * l.taxable;
      e.igst += s * l.igst; e.cgst += s * l.cgst; e.sgst += s * l.sgst; e.cess += s * l.cess;
      m.set(key, e);
    }
  }
  const rows = [...m.values()].sort((a, c) => a.hsn.localeCompare(c.hsn));
  const columns: Column[] = [{ key: 'hsn', label: 'HSN/SAC' }, { key: 'desc', label: 'Description' }, { key: 'uqc', label: 'UQC' }, { key: 'rate', label: 'Rate %', kind: 'num' },
    { key: 'qty', label: 'Qty', kind: 'num' }, { key: 'value', label: 'Total value', kind: 'money' }, { key: 'taxable', label: 'Taxable', kind: 'money' },
    { key: 'igst', label: 'IGST', kind: 'money' }, { key: 'cgst', label: 'CGST', kind: 'money' }, { key: 'sgst', label: 'SGST', kind: 'money' }, { key: 'cess', label: 'Cess', kind: 'money' }];
  return { title: side === 'sale' ? 'HSN summary of sales' : 'HSN summary of purchases', columns, rows, totals: totalsOf(rows, columns) };
}

/** Unit quantity codes used by the GST portal. */
export function uqc(unit?: string): string {
  const u = (unit ?? '').toLowerCase().replace(/[^a-z]/g, '');
  const map: Record<string, string> = {
    pcs: 'PCS', pc: 'PCS', piece: 'PCS', pieces: 'PCS', nos: 'NOS', no: 'NOS', number: 'NOS', kg: 'KGS', kgs: 'KGS', g: 'GMS', gm: 'GMS', gms: 'GMS', gram: 'GMS',
    l: 'LTR', ltr: 'LTR', litre: 'LTR', liter: 'LTR', ml: 'MLT', m: 'MTR', mtr: 'MTR', meter: 'MTR', metre: 'MTR', box: 'BOX', bag: 'BAG', dozen: 'DOZ', doz: 'DOZ',
    pair: 'PRS', pairs: 'PRS', set: 'SET', sets: 'SET', pack: 'PAC', packet: 'PAC', bottle: 'BTL', btl: 'BTL', can: 'CAN', roll: 'ROL', sqft: 'SQF', sqm: 'SQM', tonne: 'TON', ton: 'TON', unit: 'UNT', units: 'UNT',
  };
  return map[u] ?? 'OTH';
}

const rupees = (p: Paise) => Math.round(p) / 100;
const gstDate = (d: string) => `${d.slice(8, 10)}-${d.slice(5, 7)}-${d.slice(0, 4)}`;

/** B2CL threshold: invoice value above which an inter-state sale to an unregistered buyer is reported invoice-wise. */
export const B2CL_LIMIT: Paise = 100000_00;

function itms(t: Txn) {
  const m = new Map<number, { txval: number; iamt: number; camt: number; samt: number; csamt: number }>();
  for (const l of t.lines) {
    const e = m.get(l.taxRate) ?? { txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 };
    e.txval += l.taxable; e.iamt += l.igst; e.camt += l.cgst; e.samt += l.sgst; e.csamt += l.cess;
    m.set(l.taxRate, e);
  }
  return [...m.entries()].map(([rt, e], i) => ({
    num: i + 1,
    itm_det: { txval: rupees(e.txval), rt, iamt: rupees(e.iamt), camt: rupees(e.camt), samt: rupees(e.samt), csamt: rupees(e.csamt) },
  }));
}

/** GSTR-1 for one month (YYYY-MM): tables and the JSON the GST offline tool imports. */
export function gstr1(b: Books, month: string) {
  const from = month + '-01', to = month + '-31';
  const firmState = b.firm.stateCode;
  const party = (t: Txn) => b.parties.find((p) => p.id === t.partyId);
  const sales = b.txns.filter((t) => t.type === 'sale' && inRange(t.date, from, to));
  const notes = b.txns.filter((t) => t.type === 'sale_return' && inRange(t.date, from, to));
  const pos = (t: Txn) => t.stateOfSupply || party(t)?.stateCode || firmState;
  const ctin = (t: Txn) => { const g = party(t)?.gstin?.toUpperCase(); return g && validGstin(g) ? g : ''; };

  const b2b = new Map<string, any[]>();
  const b2cl = new Map<string, any[]>();
  const b2cs = new Map<string, any>();
  const warnings: string[] = [];

  for (const t of sales) {
    const g = ctin(t);
    const p = pos(t);
    const inter = p !== firmState;
    if (party(t)?.gstin && !g) warnings.push(`${t.number}: party GSTIN ${party(t)?.gstin} is not valid, reported as B2C`);
    if (g) {
      const list = b2b.get(g) ?? [];
      list.push({ inum: t.number, idt: gstDate(t.date), val: rupees(t.total), pos: p, rchrg: t.reverseCharge ? 'Y' : 'N', inv_typ: 'R', itms: itms(t) });
      b2b.set(g, list);
    } else if (inter && t.total > B2CL_LIMIT) {
      const list = b2cl.get(p) ?? [];
      list.push({ inum: t.number, idt: gstDate(t.date), val: rupees(t.total), itms: itms(t) });
      b2cl.set(p, list);
    } else {
      for (const l of t.lines) {
        const key = `${p}|${l.taxRate}`;
        const e = b2cs.get(key) ?? { sply_ty: inter ? 'INTER' : 'INTRA', pos: p, typ: 'OE', rt: l.taxRate, txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 };
        e.txval += l.taxable; e.iamt += l.igst; e.camt += l.cgst; e.samt += l.sgst; e.csamt += l.cess;
        b2cs.set(key, e);
      }
    }
  }
  // Credit notes to registered parties are reported note-wise; to unregistered B2C parties they reduce B2CS.
  const cdnr = new Map<string, any[]>();
  for (const t of notes) {
    const g = ctin(t);
    const p = pos(t);
    if (g) {
      const list = cdnr.get(g) ?? [];
      list.push({ ntty: 'C', nt_num: t.number, nt_dt: gstDate(t.date), val: rupees(t.total), pos: p, rchrg: 'N', inv_typ: 'R', itms: itms(t) });
      cdnr.set(g, list);
    } else {
      for (const l of t.lines) {
        const key = `${p}|${l.taxRate}`;
        const e = b2cs.get(key) ?? { sply_ty: p !== firmState ? 'INTER' : 'INTRA', pos: p, typ: 'OE', rt: l.taxRate, txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 };
        e.txval -= l.taxable; e.iamt -= l.igst; e.camt -= l.cgst; e.samt -= l.sgst; e.csamt -= l.cess;
        b2cs.set(key, e);
      }
    }
  }

  // HSN table 12, split into B2B and B2C as the portal now asks.
  const hsnFor = (ts: Txn[]) => {
    const m = new Map<string, any>();
    for (const t of ts) {
      const sign = t.type === 'sale' ? 1 : -1;
      for (const l of t.lines) {
        const key = `${l.hsn ?? ''}|${uqc(l.unit)}|${l.taxRate}`;
        const e = m.get(key) ?? { hsn_sc: l.hsn ?? '', desc: l.name.slice(0, 30), uqc: uqc(l.unit), qty: 0, rt: l.taxRate, txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 };
        e.qty += sign * (l.qty + l.freeQty); e.txval += sign * l.taxable; e.iamt += sign * l.igst; e.camt += sign * l.cgst; e.samt += sign * l.sgst; e.csamt += sign * l.cess;
        m.set(key, e);
      }
    }
    return [...m.values()].map((e, i) => ({ num: i + 1, ...e, txval: rupees(e.txval), iamt: rupees(e.iamt), camt: rupees(e.camt), samt: rupees(e.samt), csamt: rupees(e.csamt) }));
  };
  const all = [...sales, ...notes];
  const hsnB2b = hsnFor(all.filter((t) => ctin(t)));
  const hsnB2c = hsnFor(all.filter((t) => !ctin(t)));
  for (const t of all) for (const l of t.lines) if (!l.hsn) { warnings.push(`${t.number}: "${l.name}" has no HSN/SAC code`); }

  const [y, mo] = month.split('-');
  const json = {
    gstin: b.firm.gstin ?? '',
    fp: `${mo}${y}`,
    version: 'GST3.2.1',
    hash: 'hash',
    b2b: [...b2b.entries()].map(([c, inv]) => ({ ctin: c, inv })),
    b2cl: [...b2cl.entries()].map(([p, inv]) => ({ pos: p, inv })),
    b2cs: [...b2cs.values()].map((e) => ({ ...e, txval: rupees(e.txval), iamt: rupees(e.iamt), camt: rupees(e.camt), samt: rupees(e.samt), csamt: rupees(e.csamt) })),
    cdnr: [...cdnr.entries()].map(([c, nt]) => ({ ctin: c, nt })),
    hsn: { hsn_b2b: hsnB2b, hsn_b2c: hsnB2c },
  };
  const summary = {
    b2bInvoices: [...b2b.values()].reduce((s, l) => s + l.length, 0),
    b2clInvoices: [...b2cl.values()].reduce((s, l) => s + l.length, 0),
    b2csRows: b2cs.size,
    creditNotes: [...cdnr.values()].reduce((s, l) => s + l.length, 0),
    taxable: sumBy(sales, (t) => t.taxable) - sumBy(notes, (t) => t.taxable),
    tax: sumBy(sales, tax) - sumBy(notes, tax),
  };
  return { json, summary, warnings: [...new Set(warnings)], b2bRows: [...b2b.entries()].flatMap(([c, inv]) => inv.map((i: any) => ({ ctin: c, ...i, pos: `${i.pos} ${stateName(i.pos)}` }))) };
}

/** GSTR-3B summary for one month. */
export function gstr3b(b: Books, month: string) {
  const from = month + '-01', to = month + '-31';
  const ts = b.txns.filter((t) => inRange(t.date, from, to));
  const agg = (types: TxnType[], pred: (t: Txn) => boolean = () => true) => {
    const xs = ts.filter((t) => types.includes(t.type) && pred(t));
    return { taxable: sumBy(xs, (t) => t.taxable), igst: sumBy(xs, (t) => t.igst), cgst: sumBy(xs, (t) => t.cgst), sgst: sumBy(xs, (t) => t.sgst), cess: sumBy(xs, (t) => t.cess) };
  };
  const minus = (a: ReturnType<typeof agg>, c: ReturnType<typeof agg>) => ({ taxable: a.taxable - c.taxable, igst: a.igst - c.igst, cgst: a.cgst - c.cgst, sgst: a.sgst - c.sgst, cess: a.cess - c.cess });
  const zero = (t: Txn) => t.lines.every((l) => l.taxRate === 0);
  const outward = minus(agg(['sale'], (t) => !zero(t)), agg(['sale_return'], (t) => !zero(t)));
  const nilRated = minus(agg(['sale'], zero), agg(['sale_return'], zero));
  const rcm = agg(['purchase'], (t) => !!t.reverseCharge);
  const itc = minus(agg(['purchase', 'expense'], (t) => !t.reverseCharge), agg(['purchase_return']));
  const interUnreg = new Map<string, { pos: string; taxable: number; igst: number }>();
  for (const t of ts.filter((t) => t.type === 'sale')) {
    const p = b.parties.find((x) => x.id === t.partyId);
    const pos = t.stateOfSupply || p?.stateCode || b.firm.stateCode;
    if (pos === b.firm.stateCode || (p?.gstin && validGstin(p.gstin))) continue;
    const e = interUnreg.get(pos) ?? { pos, taxable: 0, igst: 0 };
    e.taxable += t.taxable; e.igst += t.igst;
    interUnreg.set(pos, e);
  }
  const payable = {
    igst: outward.igst + rcm.igst - itc.igst, cgst: outward.cgst + rcm.cgst - itc.cgst, sgst: outward.sgst + rcm.sgst - itc.sgst, cess: outward.cess + rcm.cess - itc.cess,
  };
  return { outward, nilRated, rcm, itc, interUnreg: [...interUnreg.values()], payable };
}

export function gstinOf(p?: Party) { return p?.gstin ? `${p.gstin} (${stateName(gstinState(p.gstin))})` : ''; }

export function toCsv(r: Report): string {
  const esc = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const val = (c: Column, v: unknown) => (c.kind === 'money' && typeof v === 'number' ? (v / 100).toFixed(2) : v);
  const lines = [r.columns.map((c) => esc(c.label)).join(',')];
  for (const row of r.rows) lines.push(r.columns.map((c) => esc(val(c, row[c.key]))).join(','));
  if (r.totals) lines.push(r.columns.map((c) => esc(val(c, r.totals![c.key]))).join(','));
  return lines.join('\n');
}
