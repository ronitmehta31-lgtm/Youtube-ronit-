// Money is integer paise everywhere. Only these functions turn it into text.

export type Paise = number;

export const toPaise = (rupees: number | string): Paise => {
  const n = typeof rupees === 'string' ? parseFloat(rupees.replace(/[,₹\s]/g, '')) : rupees;
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

export const toRupees = (p: Paise): number => p / 100;

const inr = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmt = (p: Paise): string => (p < 0 ? '-' : '') + '₹' + inr.format(Math.abs(p) / 100);
export const fmtPlain = (p: Paise): string => inr.format(p / 100);
export const rupeeInput = (p: Paise): string => (p ? (p / 100).toFixed(2).replace(/\.00$/, '') : '');

const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function upTo99(n: number): string {
  return n < 20 ? ones[n] : tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
}
function upTo999(n: number): string {
  const h = Math.floor(n / 100), r = n % 100;
  return [h ? ones[h] + ' Hundred' : '', r ? upTo99(r) : ''].filter(Boolean).join(' ');
}

/** Indian numbering in words: crore, lakh, thousand. */
export function inWords(p: Paise): string {
  const neg = p < 0;
  p = Math.abs(Math.round(p));
  let r = Math.floor(p / 100);
  const paise = p % 100;
  if (r === 0 && paise === 0) return 'Zero Rupees Only';
  const parts: string[] = [];
  const crore = Math.floor(r / 1e7); r %= 1e7;
  const lakh = Math.floor(r / 1e5); r %= 1e5;
  const thousand = Math.floor(r / 1e3); r %= 1e3;
  if (crore) parts.push((crore > 99 ? upTo999(crore) : upTo99(crore)) + ' Crore');
  if (lakh) parts.push(upTo99(lakh) + ' Lakh');
  if (thousand) parts.push(upTo99(thousand) + ' Thousand');
  if (r) parts.push(upTo999(r));
  let s = parts.length ? parts.join(' ') + ' Rupees' : '';
  if (paise) s += (s ? ' and ' : '') + upTo99(paise) + ' Paise';
  return (neg ? 'Minus ' : '') + s + ' Only';
}
