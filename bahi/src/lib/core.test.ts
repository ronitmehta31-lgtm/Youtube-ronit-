import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { fmt, inWords, toPaise } from './money';
import { lineTax, totals, validGstin } from './gst';
import { autoAllocate, nextNumber, partyBalance, payStatus, stockMovements, stockOf, accountBalance } from './ledger';
import { db, deleteItem, deleteTxn, mergeItems, mergeParties, saveItem, saveParty, saveTxn, setupFirm, useDatabase, convertDraft, exportBackup, importBackup, wipeAll } from './db';
import type { Books } from './reports';
import { gstr1, gstr3b, profitLoss, stockSummary, toCsv, txnReport, B2CL_LIMIT } from './reports';
import type { Firm, Item } from './types';

describe('money', () => {
  it('parses rupees to paise without float drift', () => {
    expect(toPaise('1,234.56')).toBe(123456);
    expect(toPaise(0.1 + 0.2)).toBe(30);
    expect(toPaise('abc')).toBe(0);
  });
  it('formats Indian grouping', () => {
    expect(fmt(12345678_90)).toBe('₹1,23,45,678.90');
    expect(fmt(-500)).toBe('-₹5.00');
  });
  it('writes amounts in words, Indian style', () => {
    expect(inWords(1_25_00_000_00)).toBe('One Crore Twenty Five Lakh Rupees Only');
    expect(inWords(1180_50)).toBe('One Thousand One Hundred Eighty Rupees and Fifty Paise Only');
    expect(inWords(0)).toBe('Zero Rupees Only');
  });
});

describe('gst', () => {
  it('splits intra-state tax into CGST and SGST', () => {
    const t = lineTax({ qty: 2, rate: 500_00, inclusive: false, discPct: 0, taxRate: 18, cessRate: 0 }, false);
    expect(t).toMatchObject({ taxable: 1000_00, cgst: 90_00, sgst: 90_00, igst: 0, amount: 1180_00 });
  });
  it('charges IGST inter-state', () => {
    const t = lineTax({ qty: 1, rate: 1000_00, inclusive: false, discPct: 10, taxRate: 12, cessRate: 0 }, true);
    expect(t).toMatchObject({ discount: 100_00, taxable: 900_00, igst: 108_00, cgst: 0, amount: 1008_00 });
  });
  it('backs tax out of inclusive prices and keeps the typed total exact', () => {
    const t = lineTax({ qty: 3, rate: 99_99, inclusive: true, discPct: 0, taxRate: 18, cessRate: 0 }, false);
    expect(t.amount).toBe(299_97);
    expect(t.taxable + t.cgst + t.sgst).toBe(299_97);
    expect(t.cgst).toBe(t.sgst);
  });
  it('handles odd-paisa splits without losing a paisa', () => {
    const t = lineTax({ qty: 1, rate: 1_01, inclusive: false, discPct: 0, taxRate: 5, cessRate: 0 }, false);
    expect(t.cgst + t.sgst).toBe(5); // 1.01 * 5% = 0.0505 -> 5 paise
  });
  it('adds cess on the taxable value', () => {
    const t = lineTax({ qty: 1, rate: 1000_00, inclusive: false, discPct: 0, taxRate: 28, cessRate: 12 }, false);
    expect(t).toMatchObject({ cgst: 140_00, sgst: 140_00, cess: 120_00, amount: 1400_00 });
  });
  it('rounds the bill to the rupee and shows the round-off', () => {
    const l = lineTax({ qty: 1, rate: 100_40, inclusive: false, discPct: 0, taxRate: 0, cessRate: 0 }, false);
    const t = totals([l], 0, 0, true);
    expect(t).toMatchObject({ total: 100_00, roundOff: -40 });
  });
  it('validates GSTIN checksum', () => {
    expect(validGstin('27AAPFU0939F1ZV')).toBe(true);
    expect(validGstin('27AAPFU0939F1ZX')).toBe(false);
    expect(validGstin('27AAPFU0939F1Z')).toBe(false);
  });
});

describe('ledger helpers', () => {
  it('numbers documents after the highest in use', () => {
    expect(nextNumber('INV-', ['INV-1', 'INV-9', 'INV-10', 'X-99', 'INV-abc'])).toBe('INV-11');
    expect(nextNumber('', [])).toBe('1');
  });
  it('allocates payments to the oldest invoice first', () => {
    expect(autoAllocate(150, [{ id: 'b', due: 100, date: '2026-02-01' }, { id: 'a', due: 100, date: '2026-01-01' }]))
      .toEqual([{ txnId: 'a', amount: 100 }, { txnId: 'b', amount: 50 }]);
  });
});

const firm: Firm = { name: 'Test Traders', gstin: '27AAPFU0939F1ZV', stateCode: '27', gstEnabled: true };
const baseItem = (o: Partial<Item>) => ({ kind: 'product' as const, name: 'Rice 5kg', unit: 'Bag', hsn: '1006', salePrice: 500_00, saleInclusive: false,
  purchasePrice: 400_00, purchaseInclusive: false, taxRate: 5, cessRate: 0, openingStock: 10, minStock: 2, ...o });
const line = (item: Item, qty: number, rate = item.salePrice) => ({ itemId: item.id, name: item.name, hsn: item.hsn, unit: item.unit, qty, freeQty: 0, rate,
  inclusive: false, discPct: 0, taxRate: item.taxRate, cessRate: 0 });
const draft = (o: any) => ({ billDiscount: 0, charges: [], paid: 0, lines: [], date: '2026-10-05', ...o });

async function books(): Promise<Books> {
  const [parties, items, txns, accounts, categories] = await Promise.all([db.parties.toArray(), db.items.toArray(), db.txns.toArray(), db.accounts.toArray(), db.categories.toArray()]);
  return { firm, parties, items, txns, accounts, categories };
}

describe('books end to end', () => {
  beforeEach(async () => {
    useDatabase('test-' + Math.random());
    await setupFirm(firm);
  });

  it('sale, payment and return keep party, stock and cash right', async () => {
    const p = await saveParty({ name: 'Asha Stores', openingBalance: 100_00, stateCode: '27' });
    const rice = await saveItem(baseItem({}));
    const inv = await saveTxn(draft({ type: 'sale', partyId: p.id, stateOfSupply: '27', lines: [line(rice, 4)], paid: 500_00 }));
    expect(inv.number).toBe('INV-1');
    expect(inv.total).toBe(2100_00); // 2000 + 5% GST
    expect(inv.cgst).toBe(50_00);
    expect(inv.accountId).toBe('cash');

    let all = await db.txns.toArray();
    expect(partyBalance(p, all)).toBe(100_00 + 1600_00);
    expect(payStatus(inv, all, '2026-10-05')).toEqual({ status: 'partial', due: 1600_00 });
    expect(stockOf(rice, stockMovements(all))).toBe(6);

    await saveTxn(draft({ type: 'payment_in', partyId: p.id, total: 1600_00, links: [{ txnId: inv.id, amount: 1600_00 }] }));
    await saveTxn(draft({ type: 'sale_return', partyId: p.id, stateOfSupply: '27', lines: [line(rice, 1)] }));
    all = await db.txns.toArray();
    expect(payStatus(inv, all, '2026-10-05').status).toBe('paid');
    expect(partyBalance(p, all)).toBe(100_00 - 525_00);
    expect(stockOf(rice, stockMovements(all))).toBe(7);
    const cash = (await db.accounts.get('cash'))!;
    expect(accountBalance(cash, all)).toBe(2100_00);
  });

  it('blocks duplicate numbers and over-payment', async () => {
    const rice = await saveItem(baseItem({}));
    await saveTxn(draft({ type: 'sale', number: 'A-1', lines: [line(rice, 1)] }));
    await expect(saveTxn(draft({ type: 'sale', number: 'A-1', lines: [line(rice, 1)] }))).rejects.toThrow(/already exists/);
    await expect(saveTxn(draft({ type: 'sale', lines: [line(rice, 1)], paid: 999_00 }))).rejects.toThrow(/more than/);
    await expect(saveTxn(draft({ type: 'sale', lines: [] }))).rejects.toThrow(/at least one item/);
  });

  it('converts an estimate into an invoice', async () => {
    const rice = await saveItem(baseItem({}));
    const est = await saveTxn(draft({ type: 'estimate', lines: [line(rice, 2)] }));
    expect(est.number).toBe('EST-1');
    const d = await convertDraft(est.id);
    expect(d.type).toBe('sale');
    expect(d.sourceId).toBe(est.id);
    const inv = await saveTxn(d);
    expect(inv.total).toBe(est.total);
    // estimates never move stock
    expect(stockOf(rice, stockMovements(await db.txns.toArray()))).toBe(8);
  });

  it('deleting an invoice unlinks payments', async () => {
    const p = await saveParty({ name: 'B', openingBalance: 0 });
    const rice = await saveItem(baseItem({}));
    const inv = await saveTxn(draft({ type: 'sale', partyId: p.id, lines: [line(rice, 1)] }));
    const pay = await saveTxn(draft({ type: 'payment_in', partyId: p.id, total: 525_00, links: [{ txnId: inv.id, amount: 525_00 }] }));
    await deleteTxn(inv.id);
    expect((await db.txns.get(pay.id))!.links).toEqual([]);
  });

  it('merges duplicate items and parties instead of deleting', async () => {
    const a = await saveItem(baseItem({ name: 'Rice' }));
    const b = await saveItem(baseItem({ name: 'Rice (dup)', openingStock: 5 }));
    const p1 = await saveParty({ name: 'Ravi', phone: '9000000001', openingBalance: 10_00 });
    const p2 = await saveParty({ name: 'Ravi', phone: '9000000002', openingBalance: 5_00 });
    await saveTxn(draft({ type: 'sale', partyId: p2.id, lines: [line(b, 1)] }));
    await expect(deleteItem(b.id)).rejects.toThrow(/Merge/);
    await mergeItems(b.id, a.id);
    await mergeParties(p2.id, p1.id);
    const all = await db.txns.toArray();
    const merged = (await db.items.get(a.id))!;
    expect(merged.openingStock).toBe(15);
    expect(stockOf(merged, stockMovements(all))).toBe(14);
    expect(all[0].partyId).toBe(p1.id);
    expect((await db.parties.get(p1.id))!.openingBalance).toBe(15_00);
  });

  it('profit, stock and GSTR reports agree with the bills', async () => {
    const reg = await saveParty({ name: 'Registered Co', gstin: '29AAPFU0939F1ZR', stateCode: '29', openingBalance: 0 });
    const walkIn = await saveParty({ name: 'Walk-in', stateCode: '27', openingBalance: 0 });
    const far = await saveParty({ name: 'Far Buyer', stateCode: '07', openingBalance: 0 });
    const rice = await saveItem(baseItem({ openingStock: 0 }));
    const tv = await saveItem(baseItem({ name: 'TV', hsn: '8528', unit: 'Pcs', salePrice: 120000_00, purchasePrice: 90000_00, taxRate: 18, openingStock: 0 }));
    await saveTxn(draft({ type: 'purchase', partyId: walkIn.id, stateOfSupply: '27', lines: [line(rice, 10, 400_00), line(tv, 2, 90000_00)] }));
    await saveTxn(draft({ type: 'sale', partyId: reg.id, stateOfSupply: '29', lines: [line(rice, 2)] }));
    await saveTxn(draft({ type: 'sale', partyId: walkIn.id, stateOfSupply: '27', lines: [line(rice, 1)] }));
    await saveTxn(draft({ type: 'sale', partyId: far.id, stateOfSupply: '07', lines: [line(tv, 1)] }));
    const b = await books();

    const pl = profitLoss(b, '2026-10-01', '2026-10-31');
    expect(pl.sales).toBe(1500_00 + 120000_00);
    expect(pl.closingStock).toBe(7 * 400_00 + 90000_00);
    expect(pl.grossProfit).toBe(3 * 100_00 + 30000_00);

    expect(stockSummary(b).rows.find((r) => r.name === 'TV')!.qty).toBe(1);

    const g1 = gstr1(b, '2026-10');
    expect(g1.json.b2b).toHaveLength(1);
    expect(g1.json.b2b[0].inv[0].itms[0].itm_det).toMatchObject({ txval: 1000, rt: 5, iamt: 50 });
    expect(B2CL_LIMIT).toBe(100000_00);
    expect(g1.json.b2cl).toHaveLength(1); // 1,41,600 inter-state to unregistered
    expect(g1.json.b2cs).toHaveLength(1);
    expect(g1.json.b2cs[0]).toMatchObject({ sply_ty: 'INTRA', pos: '27', rt: 5, txval: 500, camt: 12.5, samt: 12.5 });
    expect(g1.json.fp).toBe('102026');

    const g3 = gstr3b(b, '2026-10');
    expect(g3.outward.taxable).toBe(1500_00 + 120000_00);
    expect(g3.itc.cgst).toBe(100_00 + 16200_00);
    expect(g3.payable.igst).toBe(50_00 + 21600_00);

    const rep = txnReport(b, ['sale'], '2026-10-01', '2026-10-31', '2026-10-31');
    expect(rep.rows).toHaveLength(3);
    expect(toCsv(rep).split('\n')[0]).toContain('Balance due');
  });

  it('backs up and restores everything', async () => {
    const rice = await saveItem(baseItem({}));
    await saveTxn(draft({ type: 'sale', lines: [line(rice, 1)] }));
    const backup = JSON.parse(JSON.stringify(await exportBackup()));
    await wipeAll();
    expect(await db.txns.count()).toBe(0);
    await importBackup(backup);
    expect(await db.txns.count()).toBe(1);
    expect(await db.items.count()).toBe(1);
    await expect(importBackup({ hello: 1 })).rejects.toThrow(/not a Bahi backup/);
  });
});
