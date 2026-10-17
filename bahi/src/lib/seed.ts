// Realistic sample data for trying the app out. Fictional businesses only.
import { saveItem, saveParty, saveTxn, setupFirm, db, uid } from './db';
import type { Firm, Item } from './types';
import { todayStr } from './ledger';

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** One transaction: the app only sees the sample once every row is written. */
export function loadSample(firm?: Firm) {
  return db.transaction('rw', [db.parties, db.items, db.categories, db.accounts, db.txns, db.meta], () => seed(firm));
}

async function seed(firm?: Firm) {
  await setupFirm(firm ?? { name: 'Shree Ganesh Traders', gstin: '27AAPFU0939F1ZV', stateCode: '27', address: 'Shop 4, Market Yard, Pune 411037',
    phone: '9800000000', upiId: 'shreeganesh@upi', gstEnabled: true, terms: 'Goods once sold will be exchanged within 7 days with bill.' });
  await db.accounts.put({ id: 'bank1', kind: 'bank', name: 'Current account', openingBalance: 50000_00, accountNo: 'XXXX4521', ifsc: 'SBIN0000001' });

  const asha = await saveParty({ name: 'Asha General Stores', phone: '9811111111', stateCode: '27', billingAddress: 'Kothrud, Pune', openingBalance: 2500_00 });
  const metro = await saveParty({ name: 'Metro Wholesale Pvt Ltd', phone: '9822222222', gstin: '29AAPFU0939F1ZR', stateCode: '29', billingAddress: 'Peenya, Bengaluru', openingBalance: 0 });
  const sai = await saveParty({ name: 'Sai Agro Suppliers', phone: '9833333333', stateCode: '27', billingAddress: 'Hadapsar, Pune', openingBalance: -8000_00 });
  const ravi = await saveParty({ name: 'Ravi Kumar', phone: '9844444444', stateCode: '27', openingBalance: 0 });

  const mk = (o: Partial<Item> & { name: string }) => saveItem({ kind: 'product', unit: 'Pcs', salePrice: 0, saleInclusive: false, purchasePrice: 0, purchaseInclusive: false,
    taxRate: 18, cessRate: 0, openingStock: 0, minStock: 0, ...o });
  const rice = await mk({ name: 'Basmati Rice 5kg', code: 'R5', unit: 'Bag', hsn: '1006', salePrice: 650_00, purchasePrice: 520_00, taxRate: 5, openingStock: 40, minStock: 10 });
  const oil = await mk({ name: 'Sunflower Oil 1L', code: 'O1', unit: 'Btl', hsn: '1512', salePrice: 165_00, purchasePrice: 138_00, taxRate: 5, openingStock: 60, minStock: 24 });
  const sugar = await mk({ name: 'Sugar 1kg', code: 'S1', unit: 'Kg', hsn: '1701', salePrice: 48_00, purchasePrice: 41_00, taxRate: 5, openingStock: 8, minStock: 25 });
  const soap = await mk({ name: 'Bath Soap 100g', code: 'B1', hsn: '3401', salePrice: 40_00, saleInclusive: true, purchasePrice: 28_00, taxRate: 18, openingStock: 120, minStock: 30 });
  const delivery = await mk({ name: 'Home delivery', kind: 'service', unit: 'Nos', hsn: '9968', salePrice: 50_00, taxRate: 18 });

  const ln = (i: Item, qty: number) => ({ itemId: i.id, name: i.name, hsn: i.hsn, unit: i.unit, qty, freeQty: 0, rate: i.salePrice, inclusive: i.saleInclusive, discPct: 0, taxRate: i.taxRate, cessRate: 0 });
  const base = { billDiscount: 0, charges: [], paid: 0, lines: [] as never[] };

  await saveTxn({ ...base, type: 'purchase', partyId: sai.id, stateOfSupply: '27', date: daysAgo(40), number: 'SA/221', lines: [{ ...ln(rice, 20), rate: rice.purchasePrice }, { ...ln(oil, 48), rate: oil.purchasePrice }] });
  const i1 = await saveTxn({ ...base, type: 'sale', partyId: asha.id, stateOfSupply: '27', date: daysAgo(35), dueDate: daysAgo(20), lines: [ln(rice, 5), ln(oil, 12), ln(soap, 24)], paid: 2000_00, accountId: 'cash' });
  await saveTxn({ ...base, type: 'sale', partyId: metro.id, stateOfSupply: '29', date: daysAgo(18), dueDate: daysAgo(3), lines: [ln(rice, 15), ln(oil, 24)] });
  await saveTxn({ ...base, type: 'sale', partyName: 'Walk-in customer', stateOfSupply: '27', date: daysAgo(2), lines: [ln(sugar, 3), ln(soap, 2)], paid: 0, accountId: 'cash' }).then(async (t) => db.txns.update(t.id, { paid: t.total }));
  await saveTxn({ ...base, type: 'sale', partyId: ravi.id, stateOfSupply: '27', date: daysAgo(1), lines: [ln(rice, 1), ln(delivery, 1)], paid: 0 });
  await saveTxn({ ...base, type: 'payment_in', partyId: asha.id, date: daysAgo(10), total: 3000_00, accountId: 'bank1', payMode: 'upi', links: [{ txnId: i1.id, amount: 3000_00 }] });
  await saveTxn({ ...base, type: 'payment_out', partyId: sai.id, date: daysAgo(12), total: 10000_00, accountId: 'bank1', payMode: 'bank' });
  await saveTxn({ ...base, type: 'estimate', partyId: metro.id, stateOfSupply: '29', date: daysAgo(0), lines: [ln(rice, 30), ln(sugar, 50)] });

  const rent = (await db.categories.where('kind').equals('expense').toArray()).find((c) => c.name === 'Rent');
  await saveTxn({ ...base, type: 'expense', date: daysAgo(15), categoryId: rent?.id, lines: [{ name: 'Shop rent', qty: 1, freeQty: 0, rate: 12000_00, inclusive: false, discPct: 0, taxRate: 0, cessRate: 0 }], paid: 0 })
    .then((t) => db.txns.update(t.id, { paid: t.total, accountId: 'bank1' }));
  await db.txns.add({ id: uid(), type: 'stock_adj', number: '', date: todayStr(), lines: [{ itemId: oil.id, name: oil.name, qty: -2, freeQty: 0, rate: 0, inclusive: false, discPct: 0, taxRate: 0, cessRate: 0, gross: 0, discount: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, cess: 0, amount: 0 }],
    billDiscount: 0, charges: [], roundOff: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, cess: 0, total: 0, paid: 0, notes: 'Two bottles leaked', createdAt: new Date().toISOString() });
}
