// The only file that talks to storage. Swap this for a cloud data layer later without touching screens.
import Dexie, { type Table } from 'dexie';
import type { Account, Category, Firm, Item, Line, Party, Prefs, Txn, TxnType } from './types';
import { DEFAULT_PREFS, TXN } from './types';
import { lineTax, totals } from './gst';
import { nextNumber, todayStr } from './ledger';

interface Meta { key: string; value: unknown }

class BahiDB extends Dexie {
  parties!: Table<Party, string>;
  items!: Table<Item, string>;
  categories!: Table<Category, string>;
  accounts!: Table<Account, string>;
  txns!: Table<Txn, string>;
  meta!: Table<Meta, string>;
  constructor(name = 'bahi') {
    super(name);
    this.version(1).stores({
      parties: 'id, name, phone, gstin, createdAt',
      items: 'id, name, code, barcode, categoryId, createdAt',
      categories: 'id, kind, name',
      accounts: 'id, kind, name',
      txns: 'id, type, date, partyId, number, sourceId, [type+date], createdAt',
      meta: 'key',
    });
  }
}

export let db = new BahiDB();
/** Tests use a fresh database per run. */
export function useDatabase(name: string) { db = new BahiDB(name); return db; }

export const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

// ---------- meta ----------
export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const m = await db.meta.get(key);
  return (m?.value as T) ?? fallback;
}
export const setMeta = (key: string, value: unknown) => db.meta.put({ key, value });
export const getFirm = () => getMeta<Firm | null>('firm', null);
export async function getPrefs(): Promise<Prefs> {
  const p = await getMeta<Partial<Prefs>>('prefs', {});
  return { ...DEFAULT_PREFS, ...p, prefixes: { ...DEFAULT_PREFS.prefixes, ...(p.prefixes ?? {}) } };
}

export async function setupFirm(firm: Firm) {
  await db.transaction('rw', db.meta, db.accounts, db.categories, async () => {
    await setMeta('firm', firm);
    if ((await db.accounts.count()) === 0) await db.accounts.add({ id: 'cash', kind: 'cash', name: 'Cash in hand', openingBalance: 0 });
    if ((await db.categories.where('kind').equals('expense').count()) === 0) {
      for (const name of ['Rent', 'Salary', 'Electricity', 'Transport', 'Tea and snacks', 'Repairs', 'Other'])
        await db.categories.add({ id: uid(), kind: 'expense', name });
    }
  });
}

// ---------- parties ----------
export async function saveParty(p: Omit<Party, 'id' | 'createdAt'> & { id?: string; createdAt?: string }): Promise<Party> {
  if (!p.name?.trim()) throw new Error('Party name is required');
  const party: Party = { ...p, name: p.name.trim(), id: p.id ?? uid(), createdAt: p.createdAt ?? now(), updatedAt: now() } as Party;
  await db.parties.put(party);
  return party;
}

export async function deleteParty(id: string) {
  const n = await db.txns.where('partyId').equals(id).count();
  if (n) throw new Error(`This party has ${n} transaction(s). Merge it into another party instead of deleting.`);
  await db.parties.delete(id);
}

/** Moves every transaction of `fromId` onto `intoId`, adds opening balances, deletes `fromId`. */
export async function mergeParties(fromId: string, intoId: string) {
  if (fromId === intoId) return;
  await db.transaction('rw', db.parties, db.txns, async () => {
    const [from, into] = await Promise.all([db.parties.get(fromId), db.parties.get(intoId)]);
    if (!from || !into) throw new Error('Party not found');
    await db.txns.where('partyId').equals(fromId).modify({ partyId: intoId });
    await db.parties.update(intoId, { openingBalance: (into.openingBalance || 0) + (from.openingBalance || 0), updatedAt: now() });
    await db.parties.delete(fromId);
  });
}

// ---------- items ----------
export async function saveItem(i: Omit<Item, 'id' | 'createdAt'> & { id?: string; createdAt?: string }): Promise<Item> {
  if (!i.name?.trim()) throw new Error('Item name is required');
  if (i.code) {
    const clash = await db.items.where('code').equals(i.code).first();
    if (clash && clash.id !== i.id) throw new Error(`Item code ${i.code} is already used by ${clash.name}`);
  }
  const item: Item = { ...i, name: i.name.trim(), id: i.id ?? uid(), createdAt: i.createdAt ?? now(), updatedAt: now() } as Item;
  await db.items.put(item);
  return item;
}

export async function deleteItem(id: string) {
  const used = await db.txns.filter((t) => t.lines.some((l) => l.itemId === id)).count();
  if (used) throw new Error(`This item is on ${used} transaction(s). Merge it into another item instead of deleting.`);
  await db.items.delete(id);
}

/** Points every line of `fromId` at `intoId`, adds opening stock, deletes `fromId`. */
export async function mergeItems(fromId: string, intoId: string) {
  if (fromId === intoId) return;
  await db.transaction('rw', db.items, db.txns, async () => {
    const [from, into] = await Promise.all([db.items.get(fromId), db.items.get(intoId)]);
    if (!from || !into) throw new Error('Item not found');
    await db.txns.filter((t) => t.lines.some((l) => l.itemId === fromId)).modify((t) => {
      t.lines = t.lines.map((l) => (l.itemId === fromId ? { ...l, itemId: intoId } : l));
    });
    await db.items.update(intoId, { openingStock: (into.openingStock || 0) + (from.openingStock || 0), updatedAt: now() });
    await db.items.delete(fromId);
  });
}

// ---------- transactions ----------
export type DraftLine = Pick<Line, 'itemId' | 'name' | 'hsn' | 'unit' | 'qty' | 'freeQty' | 'rate' | 'inclusive' | 'discPct' | 'taxRate' | 'cessRate'>;
export type DraftTxn = Omit<Txn, 'id' | 'number' | 'lines' | 'taxable' | 'cgst' | 'sgst' | 'igst' | 'cess' | 'total' | 'roundOff' | 'createdAt'> & {
  id?: string; number?: string; lines: DraftLine[]; total?: number; createdAt?: string;
};

export function isInterState(firmState: string, supplyState?: string) {
  return !!supplyState && supplyState !== firmState;
}

/** Computes every line's GST and the bill totals. Pure, used by the form preview and by save. */
export function compute(d: DraftTxn, firm: Firm, prefs: Prefs): Txn {
  const inter = isInterState(firm.stateCode, d.stateOfSupply);
  const gstOn = firm.gstEnabled;
  const lines: Line[] = d.lines
    .filter((l) => l.name?.trim() && (l.qty || l.freeQty))
    .map((l) => {
      const taxRate = gstOn ? l.taxRate || 0 : 0;
      const cessRate = gstOn ? l.cessRate || 0 : 0;
      return { ...l, taxRate, cessRate, ...lineTax({ ...l, taxRate, cessRate }, inter) };
    });
  const charges = (d.charges ?? []).reduce((s, c) => s + (c.amount || 0), 0);
  const hasLines = TXN[d.type].hasLines;
  const t = hasLines ? totals(lines, d.billDiscount || 0, charges, prefs.roundOff) : null;
  return {
    ...(d as Txn),
    lines,
    billDiscount: d.billDiscount || 0,
    charges: d.charges ?? [],
    taxable: t?.taxable ?? 0, cgst: t?.cgst ?? 0, sgst: t?.sgst ?? 0, igst: t?.igst ?? 0, cess: t?.cess ?? 0,
    roundOff: t?.roundOff ?? 0,
    total: t ? t.total : d.total ?? 0,
  } as Txn;
}

export async function numberFor(type: TxnType, prefs?: Prefs) {
  const p = prefs ?? (await getPrefs());
  const prefix = p.prefixes[type] ?? '';
  const nums = (await db.txns.where('type').equals(type).toArray()).map((t) => t.number);
  return nextNumber(prefix, nums);
}

export async function saveTxn(d: DraftTxn): Promise<Txn> {
  const firm = await getFirm();
  if (!firm) throw new Error('Set up your business first');
  const prefs = await getPrefs();
  const t = compute(d, firm, prefs);
  const meta = TXN[t.type];
  if (meta.hasLines && t.type !== 'expense' && t.type !== 'other_income' && t.lines.length === 0) throw new Error('Add at least one item');
  if ((t.type === 'expense' || t.type === 'other_income') && t.total <= 0) throw new Error('Enter an amount');
  if (!meta.hasLines && t.total <= 0) throw new Error('Enter an amount');
  if (['sale_return', 'purchase', 'purchase_return', 'payment_in', 'payment_out', 'purchase_order'].includes(t.type) && !t.partyId)
    throw new Error(`Choose a ${meta.partyLabel.toLowerCase()}`);
  if (t.paid < 0) throw new Error('Paid amount cannot be negative');
  if (meta.hasLines && !meta.isDoc && t.paid > t.total) throw new Error('Paid amount is more than the bill total');
  if (t.type === 'transfer' && !t.accountId && !t.toAccountId) throw new Error('Choose an account');

  return db.transaction('rw', db.txns, db.accounts, db.items, async () => {
    const number = (t.number || '').trim() || (t.type === 'transfer' || t.type === 'stock_adj' ? '' : await numberFor(t.type, prefs));
    if (number) {
      const clash = await db.txns.where('number').equals(number).filter((x) => x.type === t.type && x.id !== t.id).first();
      if (clash) throw new Error(`${meta.label} number ${number} already exists`);
    }
    // Money that moved needs an account. Default to cash.
    let accountId = t.accountId;
    if (!accountId && (t.paid > 0 || t.type === 'payment_in' || t.type === 'payment_out') && t.type !== 'transfer') accountId = 'cash';
    const paid = meta.hasLines ? t.paid : t.total;
    const saved: Txn = {
      ...t, number, accountId, paid,
      id: t.id ?? uid(),
      date: t.date || todayStr(),
      createdAt: d.createdAt ?? now(),
      updatedAt: now(),
    };
    await db.txns.put(saved);
    return saved;
  });
}

export async function deleteTxn(id: string) {
  await db.transaction('rw', db.txns, async () => {
    await db.txns.delete(id);
    // Unlink payments that pointed at it, and reopen anything converted from it.
    await db.txns.filter((t) => (t.links ?? []).some((l) => l.txnId === id)).modify((t) => {
      t.links = (t.links ?? []).filter((l) => l.txnId !== id);
    });
    await db.txns.where('sourceId').equals(id).modify((t) => { if (t.type === 'sale' || t.type === 'purchase') t.sourceId = undefined; });
  });
}

/** Turns an estimate / order / challan into a draft invoice or bill. The source is marked converted on save. */
export async function convertDraft(id: string): Promise<DraftTxn> {
  const src = await db.txns.get(id);
  if (!src) throw new Error('Not found');
  const to = TXN[src.type].convertTo;
  if (!to) throw new Error('This cannot be converted');
  const { id: _i, number: _n, createdAt: _c, updatedAt: _u, status: _s, ...rest } = src;
  return { ...rest, type: to, date: todayStr(), paid: 0, sourceId: src.id };
}

export async function markConverted(sourceId: string) {
  await db.txns.update(sourceId, { status: 'converted', updatedAt: now() });
}

/** Draft credit/debit note prefilled from an invoice or bill. */
export async function returnDraft(id: string): Promise<DraftTxn> {
  const src = await db.txns.get(id);
  if (!src || (src.type !== 'sale' && src.type !== 'purchase')) throw new Error('Returns are made from an invoice or bill');
  const { id: _i, number: _n, createdAt: _c, updatedAt: _u, links: _l, ...rest } = src;
  return { ...rest, type: src.type === 'sale' ? 'sale_return' : 'purchase_return', date: todayStr(), paid: 0, sourceId: src.id, notes: `Against ${src.number}` };
}

// ---------- backup ----------
export const BACKUP_VERSION = 1;

export async function exportBackup() {
  const [parties, items, categories, accounts, txns, meta] = await Promise.all([
    db.parties.toArray(), db.items.toArray(), db.categories.toArray(), db.accounts.toArray(), db.txns.toArray(), db.meta.toArray(),
  ]);
  return { app: 'bahi', version: BACKUP_VERSION, exportedAt: now(), parties, items, categories, accounts, txns, meta };
}

export async function importBackup(data: any) {
  if (!data || data.app !== 'bahi' || !Array.isArray(data.txns)) throw new Error('This is not a Bahi backup file');
  await db.transaction('rw', [db.parties, db.items, db.categories, db.accounts, db.txns, db.meta], async () => {
    await Promise.all([db.parties.clear(), db.items.clear(), db.categories.clear(), db.accounts.clear(), db.txns.clear(), db.meta.clear()]);
    await db.parties.bulkAdd(data.parties ?? []);
    await db.items.bulkAdd(data.items ?? []);
    await db.categories.bulkAdd(data.categories ?? []);
    await db.accounts.bulkAdd(data.accounts ?? []);
    await db.txns.bulkAdd(data.txns ?? []);
    await db.meta.bulkAdd((data.meta ?? []).filter((m: Meta) => m.key !== 'lastBackupAt'));
  });
}

export async function wipeAll() {
  await Promise.all([db.parties.clear(), db.items.clear(), db.categories.clear(), db.accounts.clear(), db.txns.clear(), db.meta.clear()]);
}
