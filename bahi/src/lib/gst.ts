import type { Paise } from './money';

/** GST state codes (first two digits of a GSTIN). */
export const STATES: [string, string][] = [
  ['01', 'Jammu and Kashmir'], ['02', 'Himachal Pradesh'], ['03', 'Punjab'], ['04', 'Chandigarh'], ['05', 'Uttarakhand'],
  ['06', 'Haryana'], ['07', 'Delhi'], ['08', 'Rajasthan'], ['09', 'Uttar Pradesh'], ['10', 'Bihar'], ['11', 'Sikkim'],
  ['12', 'Arunachal Pradesh'], ['13', 'Nagaland'], ['14', 'Manipur'], ['15', 'Mizoram'], ['16', 'Tripura'],
  ['17', 'Meghalaya'], ['18', 'Assam'], ['19', 'West Bengal'], ['20', 'Jharkhand'], ['21', 'Odisha'],
  ['22', 'Chhattisgarh'], ['23', 'Madhya Pradesh'], ['24', 'Gujarat'], ['26', 'Dadra and Nagar Haveli and Daman and Diu'],
  ['27', 'Maharashtra'], ['29', 'Karnataka'], ['30', 'Goa'], ['31', 'Lakshadweep'], ['32', 'Kerala'],
  ['33', 'Tamil Nadu'], ['34', 'Puducherry'], ['35', 'Andaman and Nicobar Islands'], ['36', 'Telangana'],
  ['37', 'Andhra Pradesh'], ['38', 'Ladakh'], ['97', 'Other Territory'],
];
export const stateName = (code?: string) => STATES.find(([c]) => c === code)?.[1] ?? '';

export const GST_RATES = [0, 0.1, 0.25, 1.5, 3, 5, 12, 18, 28, 40];

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Format and checksum check of a 15-character GSTIN. */
export function validGstin(g: string): boolean {
  g = g.trim().toUpperCase();
  if (!GSTIN_RE.test(g)) return false;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const v = CHARS.indexOf(g[i]) * (i % 2 ? 2 : 1);
    sum += Math.floor(v / 36) + (v % 36);
  }
  return CHARS[(36 - (sum % 36)) % 36] === g[14];
}
export const gstinState = (g?: string) => (g && g.length >= 2 ? g.slice(0, 2) : '');

export interface LineInput {
  qty: number;
  rate: Paise; // per unit, as typed
  inclusive: boolean; // rate includes GST
  discPct: number;
  taxRate: number; // percent
  cessRate: number; // percent
}
export interface LineTax {
  gross: Paise; // qty x rate before discount, as typed
  discount: Paise;
  taxable: Paise;
  cgst: Paise;
  sgst: Paise;
  igst: Paise;
  cess: Paise;
  amount: Paise; // taxable + all tax
}

const r = Math.round;

/**
 * One line's tax. Intra-state splits GST into CGST and SGST halves; inter-state is all IGST.
 * Rounding happens once per component, to the paisa.
 */
export function lineTax(l: LineInput, interState: boolean): LineTax {
  const gross = r(l.qty * l.rate);
  const discount = r((gross * (l.discPct || 0)) / 100);
  const afterDisc = gross - discount;
  const rate = (l.taxRate || 0) + (l.cessRate || 0);
  const taxable = l.inclusive ? r(afterDisc / (1 + rate / 100)) : afterDisc;
  const gst = (taxable * (l.taxRate || 0)) / 100;
  const cess = r((taxable * (l.cessRate || 0)) / 100);
  let cgst = 0, sgst = 0, igst = 0;
  if (interState) igst = r(gst);
  else {
    cgst = r(gst / 2);
    sgst = r(gst) - cgst;
  }
  // Inclusive prices: the line total must equal what was typed, so any paisa of rounding goes to taxable.
  const amount = l.inclusive ? afterDisc : taxable + cgst + sgst + igst + cess;
  const adjTaxable = l.inclusive ? afterDisc - cgst - sgst - igst - cess : taxable;
  return { gross, discount, taxable: adjTaxable, cgst, sgst, igst, cess, amount };
}

export interface Totals {
  subtotal: Paise; // sum of line amounts
  taxable: Paise;
  cgst: Paise; sgst: Paise; igst: Paise; cess: Paise;
  billDiscount: Paise;
  charges: Paise;
  roundOff: Paise;
  total: Paise;
}

export function totals(lines: LineTax[], billDiscount: Paise, charges: Paise, roundToRupee: boolean): Totals {
  const sum = (k: keyof LineTax) => lines.reduce((s, l) => s + l[k], 0);
  const subtotal = sum('amount');
  const raw = subtotal - billDiscount + charges;
  const total = roundToRupee ? Math.round(raw / 100) * 100 : raw;
  return {
    subtotal, taxable: sum('taxable'), cgst: sum('cgst'), sgst: sum('sgst'), igst: sum('igst'), cess: sum('cess'),
    billDiscount, charges, roundOff: total - raw, total,
  };
}

/** Rate-wise tax summary for the invoice footer and HSN tables. */
export function taxBreakup(lines: (LineTax & { taxRate: number })[]) {
  const m = new Map<number, { rate: number; taxable: Paise; cgst: Paise; sgst: Paise; igst: Paise; cess: Paise }>();
  for (const l of lines) {
    const e = m.get(l.taxRate) ?? { rate: l.taxRate, taxable: 0, cgst: 0, sgst: 0, igst: 0, cess: 0 };
    e.taxable += l.taxable; e.cgst += l.cgst; e.sgst += l.sgst; e.igst += l.igst; e.cess += l.cess;
    m.set(l.taxRate, e);
  }
  return [...m.values()].sort((a, b) => a.rate - b.rate);
}
