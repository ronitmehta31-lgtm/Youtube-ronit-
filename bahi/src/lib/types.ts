import type { Paise } from './money';

export type TxnType =
  | 'sale' | 'sale_return' | 'estimate' | 'sale_order' | 'delivery_challan'
  | 'purchase' | 'purchase_return' | 'purchase_order'
  | 'payment_in' | 'payment_out' | 'expense' | 'other_income'
  | 'stock_adj' | 'transfer';

export interface Party {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  gstin?: string;
  stateCode?: string;
  billingAddress?: string;
  shippingAddress?: string;
  openingBalance: Paise; // + they owe you, - you owe them
  openingDate?: string;
  creditLimit?: Paise;
  group?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Item {
  id: string;
  kind: 'product' | 'service';
  name: string;
  code?: string;
  barcode?: string;
  hsn?: string;
  unit: string;
  categoryId?: string;
  salePrice: Paise;
  saleInclusive: boolean;
  purchasePrice: Paise;
  purchaseInclusive: boolean;
  taxRate: number;
  cessRate: number;
  openingStock: number;
  minStock: number;
  mrp?: Paise;
  location?: string;
  description?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Category { id: string; kind: 'item' | 'expense' | 'income'; name: string }

export interface Account {
  id: string;
  kind: 'cash' | 'bank';
  name: string;
  openingBalance: Paise;
  accountNo?: string;
  ifsc?: string;
  upiId?: string;
}

export interface Line {
  itemId?: string;
  name: string;
  hsn?: string;
  unit?: string;
  qty: number;
  freeQty: number;
  rate: Paise;
  inclusive: boolean;
  discPct: number;
  taxRate: number;
  cessRate: number;
  // computed at save
  gross: Paise;
  discount: Paise;
  taxable: Paise;
  cgst: Paise;
  sgst: Paise;
  igst: Paise;
  cess: Paise;
  amount: Paise;
}

export interface Charge { label: string; amount: Paise }
export interface PayLink { txnId: string; amount: Paise }

export interface Txn {
  id: string;
  type: TxnType;
  number: string;
  date: string; // YYYY-MM-DD, local calendar day
  partyId?: string;
  partyName?: string; // for cash sales with no saved party
  partyPhone?: string;
  stateOfSupply?: string;
  reverseCharge?: boolean;
  lines: Line[];
  billDiscount: Paise;
  charges: Charge[];
  roundOff: Paise;
  taxable: Paise;
  cgst: Paise;
  sgst: Paise;
  igst: Paise;
  cess: Paise;
  total: Paise;
  paid: Paise; // received or paid at the time of the bill (for payments: the amount)
  payDiscount?: Paise; // discount given/taken while settling a payment
  accountId?: string; // where the money went or came from
  toAccountId?: string; // transfers
  payMode?: 'cash' | 'upi' | 'card' | 'bank' | 'cheque';
  payRef?: string;
  links?: PayLink[]; // payment -> invoices it settles
  dueDate?: string;
  status?: 'open' | 'converted' | 'cancelled';
  sourceId?: string; // document this was converted from, or the invoice a return is against
  categoryId?: string; // expense / other income
  notes?: string;
  poNumber?: string;
  ewayBill?: string;
  vehicleNo?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Firm {
  name: string;
  gstin?: string;
  stateCode: string;
  address?: string;
  phone?: string;
  email?: string;
  logo?: string; // data URL
  upiId?: string;
  bankDetails?: string;
  terms?: string;
  gstEnabled: boolean;
}

export interface Prefs {
  prefixes: Partial<Record<TxnType, string>>;
  roundOff: boolean;
  defaultInclusive: boolean;
  printSize: 'a4' | 'a5' | 'thermal80' | 'thermal58';
  showUpiQr: boolean;
  showProfitOnSale: boolean;
  reminderAfterDays: number;
  invoiceColor: string;
}

export const DEFAULT_PREFS: Prefs = {
  prefixes: {
    sale: 'INV-', sale_return: 'CN-', estimate: 'EST-', sale_order: 'SO-', delivery_challan: 'DC-',
    purchase: '', purchase_return: 'DN-', purchase_order: 'PO-', payment_in: 'RCPT-', payment_out: 'PAY-',
    expense: 'EXP-', other_income: 'INC-',
  },
  roundOff: true,
  defaultInclusive: false,
  printSize: 'a4',
  showUpiQr: true,
  showProfitOnSale: false,
  reminderAfterDays: 0,
  invoiceColor: '#0b6b5d',
};

export interface TxnMeta {
  label: string;
  plural: string;
  side: 'sale' | 'purchase' | 'other';
  partyLabel: string;
  hasLines: boolean;
  isDoc: boolean; // estimate / order / challan: no effect on books
  convertTo?: TxnType;
  path: string;
}

export const TXN: Record<TxnType, TxnMeta> = {
  sale: { label: 'Sale invoice', plural: 'Sale invoices', side: 'sale', partyLabel: 'Customer', hasLines: true, isDoc: false, path: 'sale/invoices' },
  sale_return: { label: 'Credit note', plural: 'Sale returns', side: 'sale', partyLabel: 'Customer', hasLines: true, isDoc: false, path: 'sale/returns' },
  estimate: { label: 'Estimate', plural: 'Estimates', side: 'sale', partyLabel: 'Customer', hasLines: true, isDoc: true, convertTo: 'sale', path: 'sale/estimates' },
  sale_order: { label: 'Sale order', plural: 'Sale orders', side: 'sale', partyLabel: 'Customer', hasLines: true, isDoc: true, convertTo: 'sale', path: 'sale/orders' },
  delivery_challan: { label: 'Delivery challan', plural: 'Delivery challans', side: 'sale', partyLabel: 'Customer', hasLines: true, isDoc: true, convertTo: 'sale', path: 'sale/challans' },
  purchase: { label: 'Purchase bill', plural: 'Purchase bills', side: 'purchase', partyLabel: 'Supplier', hasLines: true, isDoc: false, path: 'purchase/bills' },
  purchase_return: { label: 'Debit note', plural: 'Purchase returns', side: 'purchase', partyLabel: 'Supplier', hasLines: true, isDoc: false, path: 'purchase/returns' },
  purchase_order: { label: 'Purchase order', plural: 'Purchase orders', side: 'purchase', partyLabel: 'Supplier', hasLines: true, isDoc: true, convertTo: 'purchase', path: 'purchase/orders' },
  payment_in: { label: 'Payment received', plural: 'Payments in', side: 'sale', partyLabel: 'Received from', hasLines: false, isDoc: false, path: 'sale/payments' },
  payment_out: { label: 'Payment made', plural: 'Payments out', side: 'purchase', partyLabel: 'Paid to', hasLines: false, isDoc: false, path: 'purchase/payments' },
  expense: { label: 'Expense', plural: 'Expenses', side: 'other', partyLabel: 'Paid to (optional)', hasLines: true, isDoc: false, path: 'expenses' },
  other_income: { label: 'Other income', plural: 'Other income', side: 'other', partyLabel: 'Received from (optional)', hasLines: true, isDoc: false, path: 'other-income' },
  stock_adj: { label: 'Stock adjustment', plural: 'Stock adjustments', side: 'other', partyLabel: '', hasLines: true, isDoc: false, path: 'items' },
  transfer: { label: 'Cash / bank entry', plural: 'Cash / bank entries', side: 'other', partyLabel: '', hasLines: false, isDoc: false, path: 'cash-bank' },
};
