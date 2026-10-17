import type { Firm, Party, Txn } from './types';
import { TXN } from './types';
import { fmt, type Paise } from './money';

/** wa.me wants digits with country code. Ten-digit Indian numbers get 91. */
export function waNumber(phone: string) {
  const d = phone.replace(/\D/g, '');
  return d.length === 10 ? '91' + d : d.replace(/^0+/, '');
}

export const whatsappUrl = (phone: string | undefined, text: string) =>
  phone ? `https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;

/** UPI deep link. Any UPI app opens it; the QR on the bill encodes the same string. */
export function upiUri(firm: Firm, amount: Paise, note: string) {
  if (!firm.upiId) return '';
  const p = new URLSearchParams({ pa: firm.upiId, pn: firm.name, cu: 'INR', tn: note.slice(0, 40) });
  if (amount > 0) p.set('am', (amount / 100).toFixed(2));
  return 'upi://pay?' + p.toString().replace(/\+/g, '%20');
}

/** The message is built from what is true now: paid bills never say "balance due". */
export function txnText(firm: Firm, t: Txn, partyName: string, due: Paise) {
  const label = TXN[t.type].label;
  const lines = [`Namaste ${partyName},`, '', `${label} ${t.number} from ${firm.name}`, `Date: ${t.date}`, `Amount: ${fmt(t.total)}`];
  if (t.type === 'sale' || t.type === 'purchase') {
    if (due === 0) lines.push('Status: fully paid. Thank you!');
    else {
      lines.push(`Paid: ${fmt(t.total - due)}`, `Balance due: ${fmt(due)}`);
      if (t.dueDate) lines.push(`Due by: ${t.dueDate}`);
      if (firm.upiId && t.type === 'sale') lines.push('', `Pay by UPI to ${firm.upiId}`);
    }
  }
  if (t.lines.length) {
    lines.push('', 'Items:');
    for (const l of t.lines.slice(0, 15)) lines.push(`• ${l.name} × ${l.qty}${l.unit ? ' ' + l.unit : ''} = ${fmt(l.amount)}`);
    if (t.lines.length > 15) lines.push(`…and ${t.lines.length - 15} more`);
  }
  if (firm.phone) lines.push('', `Questions? Call ${firm.phone}`);
  return lines.join('\n');
}

export function reminderText(firm: Firm, p: Party, due: Paise) {
  return [
    `Namaste ${p.name},`, '', `This is a friendly reminder from ${firm.name}.`, `Your pending balance is ${fmt(due)}.`,
    firm.upiId ? `You can pay by UPI to ${firm.upiId}.` : '', '', 'Please ignore if already paid. Thank you!',
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');
}
