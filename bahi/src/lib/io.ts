// Spreadsheet import/export (CSV) and the "check my books" audit.
import type { Books } from './reports';
import { saveItem, saveParty } from './db';
import { toPaise } from './money';
import { STATES, validGstin, gstinState } from './gst';
import { settledOn, stockMovements, stockOf } from './ledger';
import { TXN } from './types';

/** RFC 4180-ish CSV parser: quotes, escaped quotes, commas and newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
function pick(header: string[], names: string[]) {
  const h = header.map(norm);
  for (const n of names) { const i = h.indexOf(norm(n)); if (i >= 0) return i; }
  return -1;
}

export const ITEM_TEMPLATE = 'Name,Code,HSN,Unit,Sale price,Purchase price,GST %,Opening stock,Min stock\nBasmati Rice 5kg,R5,1006,Bag,650,520,5,40,10\n';
export const PARTY_TEMPLATE = 'Name,Phone,GSTIN,State code,Address,Opening balance\nAsha General Stores,9811111111,,27,"Kothrud, Pune",2500\n';

export async function importItems(text: string) {
  const [header, ...rows] = parseCsv(text);
  if (!header) throw new Error('The file is empty');
  const col = {
    name: pick(header, ['name', 'item', 'item name']), code: pick(header, ['code', 'item code', 'sku']), hsn: pick(header, ['hsn', 'hsn/sac', 'sac']),
    unit: pick(header, ['unit', 'uom']), sale: pick(header, ['sale price', 'price', 'selling price', 'rate']), purchase: pick(header, ['purchase price', 'cost', 'buying price']),
    gst: pick(header, ['gst %', 'gst', 'tax', 'tax rate', 'gst rate']), stock: pick(header, ['opening stock', 'stock', 'qty', 'quantity']), min: pick(header, ['min stock', 'minimum', 'reorder level']),
  };
  if (col.name < 0) throw new Error('No "Name" column found. Use the template.');
  let ok = 0; const errors: string[] = [];
  for (const [i, r] of rows.entries()) {
    const get = (k: keyof typeof col) => (col[k] >= 0 ? (r[col[k]] ?? '').trim() : '');
    try {
      await saveItem({ kind: 'product', name: get('name'), code: get('code') || undefined, hsn: get('hsn') || undefined, unit: get('unit') || 'Pcs',
        salePrice: toPaise(get('sale') || 0), saleInclusive: false, purchasePrice: toPaise(get('purchase') || 0), purchaseInclusive: false,
        taxRate: Number(get('gst').replace('%', '')) || 0, cessRate: 0, openingStock: Number(get('stock')) || 0, minStock: Number(get('min')) || 0 });
      ok++;
    } catch (e) { errors.push(`Row ${i + 2}: ${(e as Error).message}`); }
  }
  return { ok, errors };
}

export async function importParties(text: string) {
  const [header, ...rows] = parseCsv(text);
  if (!header) throw new Error('The file is empty');
  const col = { name: pick(header, ['name', 'party', 'party name', 'customer']), phone: pick(header, ['phone', 'mobile', 'phone number']), gstin: pick(header, ['gstin', 'gst no', 'gst number']),
    state: pick(header, ['state code', 'state']), address: pick(header, ['address', 'billing address']), opening: pick(header, ['opening balance', 'balance', 'opening']) };
  if (col.name < 0) throw new Error('No "Name" column found. Use the template.');
  let ok = 0; const errors: string[] = [];
  for (const [i, r] of rows.entries()) {
    const get = (k: keyof typeof col) => (col[k] >= 0 ? (r[col[k]] ?? '').trim() : '');
    const gstin = get('gstin').toUpperCase();
    if (gstin && !validGstin(gstin)) { errors.push(`Row ${i + 2}: GSTIN ${gstin} is not valid, saved without it`); }
    let state = get('state');
    if (state && !/^\d{2}$/.test(state)) state = STATES.find(([, n]) => n.toLowerCase() === state.toLowerCase())?.[0] ?? '';
    try {
      await saveParty({ name: get('name'), phone: get('phone') || undefined, gstin: gstin && validGstin(gstin) ? gstin : undefined,
        stateCode: state || (gstin ? gstinState(gstin) : undefined), billingAddress: get('address') || undefined, openingBalance: toPaise(get('opening') || 0) });
      ok++;
    } catch (e) { errors.push(`Row ${i + 2}: ${(e as Error).message}`); }
  }
  return { ok, errors };
}

/** Finds the mismatches users fear most: duplicate numbers, over-settled bills, broken links, negative stock. */
export function verifyBooks(b: Books): { level: 'error' | 'warn'; text: string }[] {
  const out: { level: 'error' | 'warn'; text: string }[] = [];
  const seen = new Map<string, number>();
  for (const t of b.txns) if (t.number) { const k = `${t.type}|${t.number}`; seen.set(k, (seen.get(k) ?? 0) + 1); }
  for (const [k, n] of seen) if (n > 1) { const [type, num] = k.split('|'); out.push({ level: 'error', text: `${TXN[type as keyof typeof TXN].label} number ${num} is used ${n} times` }); }
  const ids = new Set(b.txns.map((t) => t.id));
  for (const t of b.txns) for (const l of t.links ?? []) if (!ids.has(l.txnId)) out.push({ level: 'error', text: `${TXN[t.type].label} ${t.number} is linked to a bill that no longer exists` });
  for (const t of b.txns) if ((t.type === 'sale' || t.type === 'purchase') && settledOn(t, b.txns) > t.total) out.push({ level: 'warn', text: `${TXN[t.type].label} ${t.number} has been paid more than its total` });
  const pids = new Set(b.parties.map((p) => p.id));
  for (const t of b.txns) if (t.partyId && !pids.has(t.partyId)) out.push({ level: 'error', text: `${TXN[t.type].label} ${t.number} belongs to a party that was removed` });
  for (const t of b.txns) {
    const sum = t.lines.reduce((s, l) => s + l.amount, 0) - t.billDiscount + t.charges.reduce((s, c) => s + c.amount, 0) + t.roundOff;
    if (TXN[t.type].hasLines && t.type !== 'stock_adj' && t.lines.length && sum !== t.total) out.push({ level: 'error', text: `${TXN[t.type].label} ${t.number}: lines add up to a different total` });
  }
  const moves = stockMovements(b.txns);
  for (const i of b.items) { const q = stockOf(i, moves); if (i.kind === 'product' && q < 0) out.push({ level: 'warn', text: `${i.name} has negative stock (${q} ${i.unit})` }); }
  if (b.firm.gstEnabled) {
    const noHsn = b.items.filter((i) => !i.hsn).length;
    if (noHsn) out.push({ level: 'warn', text: `${noHsn} item(s) have no HSN/SAC code. GSTR-1 needs one.` });
    for (const p of b.parties) if (p.gstin && !validGstin(p.gstin)) out.push({ level: 'warn', text: `${p.name}: GSTIN ${p.gstin} is not valid` });
  }
  return out;
}
