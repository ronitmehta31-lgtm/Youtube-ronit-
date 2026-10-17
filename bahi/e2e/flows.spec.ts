import { test, expect, setupFirm, loadSample, a11y, opened } from './helpers';

test.describe('F12 first-run setup', () => {
  test('F12-N1 bad GSTIN is caught, F12-H1 setup lands on an empty home', async ({ page, errors }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Start using Bahi' }).click();
    await expect(page.getByText('Enter your business name')).toBeVisible();
    await page.getByLabel('Business name').fill('Test Kirana');
    await page.getByLabel('GSTIN (optional)').fill('27AAPFU0939F1ZX');
    await page.getByRole('button', { name: 'Start using Bahi' }).click();
    await expect(page.getByText(/does not look right/)).toBeVisible();
    await page.getByLabel('GSTIN (optional)').fill('27AAPFU0939F1ZV');
    await page.getByRole('button', { name: 'Start using Bahi' }).click();
    await expect(page.getByRole('button', { name: 'New sale invoice' })).toBeVisible();
    void errors;
  });
});

test.describe('F01 make a GST invoice and share it', () => {
  test('F01-H1 new party and new item inline, keyboard only, paid in full, WhatsApp says paid', async ({ page, errors }) => {
    await setupFirm(page);
    await page.keyboard.press('Alt+s');
    await expect(page.getByRole('heading', { name: 'New sale invoice' })).toBeVisible();

    // New party from the picker
    const party = page.getByRole('combobox', { name: 'Customer' });
    await party.fill('Meena Traders');
    await page.getByRole('option', { name: /Add "Meena Traders" as a new party/ }).click();
    await page.getByRole('dialog').getByLabel('Phone', { exact: true }).fill('9876543210');
    await page.getByRole('button', { name: 'Save party' }).click();
    await expect(party).toHaveValue('Meena Traders');

    // New item from the grid
    const item = page.getByRole('combobox', { name: 'Item, row 1' });
    await item.fill('Tea 250g');
    await page.getByRole('option', { name: /Add "Tea 250g" as a new item/ }).click();
    const dlg = page.getByRole('dialog');
    await dlg.getByLabel('Item code').fill('T25');
    await dlg.getByLabel('HSN / SAC').fill('0902');
    await dlg.getByLabel('Sale price', { exact: true }).fill('100');
    await dlg.getByLabel('GST rate').selectOption('5');
    await dlg.getByLabel('Opening stock').fill('10');
    await page.getByRole('button', { name: 'Save item' }).click();

    // Quantity is focused after picking; Enter jumps to the next row's item box.
    await expect(page.getByLabel('Quantity, row 1', { exact: true })).toBeFocused();
    await page.keyboard.type('3');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('combobox', { name: 'Item, row 2' })).toBeFocused();
    // Item code + Enter adds it straight away
    await page.keyboard.type('T25');
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('Quantity, row 2', { exact: true })).toBeFocused();

    await expect(page.getByText('₹420.00').first()).toBeVisible(); // 4 x 100 + 5% GST
    await page.getByLabel('Received in full').check();
    await page.keyboard.press('Control+s');

    await expect(page.getByRole('heading', { name: 'Sale invoice INV-1' })).toBeVisible();
    await expect(page.getByText('Paid', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Tax Invoice')).toBeVisible();
    await expect(page.getByText('Four Hundred Twenty Rupees Only')).toBeVisible();

    await page.getByRole('button', { name: 'WhatsApp' }).click();
    const [url] = await opened(page);
    expect(url).toContain('wa.me/919876543210');
    expect(decodeURIComponent(url)).toContain('fully paid');
    expect(decodeURIComponent(url)).not.toContain('Balance due');

    // Stock went down by 4
    await page.goto('/#/items');
    await expect(page.getByRole('link', { name: /Tea 250g/ })).toContainText('6 Pcs');
    await a11y(page);
    void errors;
  });

  test('F01-E1 inter-state party gets IGST', async ({ page, errors }) => {
    await loadSample(page);
    await page.goto('/#/sale/invoices/new');
    await page.getByRole('combobox', { name: 'Customer' }).fill('Metro');
    await page.getByRole('option', { name: /Metro Wholesale/ }).click();
    await expect(page.getByText('Other state: IGST')).toBeVisible();
    await page.getByRole('combobox', { name: 'Item, row 1' }).fill('R5');
    await page.keyboard.press('Enter');
    await expect(page.getByText(/Includes IGST ₹32.50/)).toBeVisible();
    await a11y(page);
    void errors;
  });

  test('F01-N1 a cash sale with no party must be paid in full', async ({ page, errors }) => {
    await loadSample(page);
    await page.goto('/#/sale/invoices/new');
    await page.getByRole('combobox', { name: 'Customer' }).fill('Walk-in Ramesh');
    await page.getByRole('combobox', { name: 'Item, row 1' }).fill('S1');
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('must be received in full');
    await page.getByLabel('Received in full').check();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('heading', { name: /Sale invoice INV-5/ })).toBeVisible();
    void errors;
  });

  test('F01-E2 double-clicking save makes one invoice', async ({ page, errors }) => {
    await loadSample(page);
    await page.goto('/#/sale/invoices/new');
    await page.getByRole('combobox', { name: 'Customer' }).fill('Ravi');
    await page.getByRole('option', { name: /Ravi Kumar/ }).click();
    await page.getByRole('combobox', { name: 'Item, row 1' }).fill('O1');
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Save', exact: true }).dblclick();
    await expect(page.getByRole('heading', { name: /Sale invoice INV-5/ })).toBeVisible();
    await page.goto('/#/sale/invoices');
    await expect(page.getByRole('link', { name: 'INV-5' })).toHaveCount(1);
    await expect(page.getByRole('link', { name: 'INV-6' })).toHaveCount(0);
    void errors;
  });
});

test.describe('F02 receive a payment against unpaid invoices', () => {
  test('F02-H1 receive from the invoice, status turns paid', async ({ page, errors }) => {
    await loadSample(page);
    await page.goto('/#/sale/invoices');
    await page.getByRole('link', { name: 'INV-4' }).click();
    await page.getByRole('button', { name: 'Receive payment' }).click();
    await expect(page.getByLabel('Amount', { exact: true })).toHaveValue('742');
    await page.getByLabel('Mode').selectOption('upi');
    await page.getByRole('button', { name: 'Save payment' }).click();
    await expect(page.getByText(/Settles/)).toBeVisible();
    await page.goto('/#/sale/invoices');
    await page.getByRole('link', { name: 'INV-4' }).click();
    await expect(page.getByText('Paid', { exact: true }).first()).toBeVisible();
    await a11y(page);
    void errors;
  });

  test('F02-N1 linking more than due is refused', async ({ page, errors }) => {
    await loadSample(page);
    await page.goto('/#/sale/payments/new');
    await page.getByRole('combobox', { name: 'Received from' }).fill('Ravi');
    await page.getByRole('option', { name: /Ravi Kumar/ }).click();
    await page.getByLabel('Amount', { exact: true }).fill('100');
    await page.getByLabel('Amount for INV-4').fill('500');
    await page.getByRole('button', { name: 'Save payment' }).click();
    await expect(page.getByRole('alert')).toContainText('linked');
    void errors;
  });
});

test.describe('F04 quote, then convert to invoice', () => {
  test('F04-H1 estimate converts and is marked converted', async ({ page, errors }) => {
    await loadSample(page);
    await page.goto('/#/sale/estimates');
    await page.getByRole('link', { name: 'EST-1' }).click();
    await page.getByRole('button', { name: /Convert to sale invoice/ }).click();
    await expect(page.getByRole('heading', { name: 'New sale invoice' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Customer' })).toHaveValue('Metro Wholesale Pvt Ltd');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText(/From Estimate EST-1/)).toBeVisible();
    await page.goto('/#/sale/estimates');
    await expect(page.getByRole('cell', { name: 'Converted' })).toBeVisible();
    void errors;
  });
});

test.describe('F06 return goods', () => {
  test('F06-H1 credit note from an invoice puts stock back', async ({ page, errors }) => {
    await loadSample(page);
    await page.goto('/#/items');
    const stock = () => page.getByRole('link', { name: /Basmati Rice 5kg/ }).locator('.num');
    const before = parseInt((await stock().innerText()).match(/(-?\d+) Bag/)![1], 10);
    await page.goto('/#/sale/invoices');
    await page.getByRole('link', { name: 'INV-4' }).click();
    await page.getByRole('button', { name: 'Return' }).click();
    await expect(page.getByRole('heading', { name: 'New credit note' })).toBeVisible();
    await page.getByRole('button', { name: 'Remove row 2' }).click();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('heading', { name: /Credit note CN-1/ })).toBeVisible();
    await page.goto('/#/items');
    await expect(stock()).toHaveText(`${before + 1} Bag`);
    void errors;
  });
});

test.describe('F07 record an expense', () => {
  test('F07-H1 expense lowers cash', async ({ page, errors }) => {
    await loadSample(page);
    await page.goto('/#/expenses/new');
    await page.getByLabel('Category').selectOption({ label: 'Electricity' });
    await page.getByRole('combobox', { name: 'Item, row 1' }).fill('MSEB bill October');
    await page.getByLabel('Price, row 1').fill('1850');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('heading', { name: /Expense EXP-/ })).toBeVisible();
    await page.goto('/#/reports/expenses');
    await expect(page.getByRole('cell', { name: 'Electricity' })).toBeVisible();
    void errors;
  });
});

test.describe('F09 GST filing prep', () => {
  test('F09-H1 GSTR-1 JSON downloads with the right period', async ({ page, errors }) => {
    await loadSample(page);
    await page.goto('/#/gst');
    const month = await page.getByLabel('Return month').inputValue();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download JSON' }).click()]);
    const json = JSON.parse(await (await import('node:fs/promises')).readFile(await dl.path(), 'utf8'));
    expect(json.gstin).toBe('27AAPFU0939F1ZV');
    expect(json.fp).toBe(month.slice(5, 7) + month.slice(0, 4));
    await a11y(page);
    void errors;
  });
});

test.describe('F15 backup, restore and import', () => {
  test('F15-H1 backup then restore brings everything back', async ({ page, errors }) => {
    await loadSample(page);
    await page.goto('/#/backup');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download backup' }).click()]);
    const file = await dl.path();
    await expect(page.getByText(/Last backup:/)).toBeVisible();
    await page.goto('/#/settings');
    page.once('dialog', (d) => d.accept('DELETE'));
    await page.getByRole('button', { name: 'Erase all data' }).click();
    await expect(page.getByRole('heading', { name: 'Set up Bahi' })).toBeVisible();
    // Restore needs a firm to reach the page; set one up, then restore over it.
    await setupFirm(page, { name: 'Temp' });
    await page.goto('/#/backup');
    page.once('dialog', (d) => d.accept());
    await page.getByLabel('Restore from file').setInputFiles(file!);
    await page.goto('/#/parties');
    await expect(page.getByRole('link', { name: /Asha General Stores/ })).toBeVisible();
    void errors;
  });

  test('F15-H2 CSV import of items, with a bad row reported', async ({ page, errors }) => {
    await setupFirm(page);
    await page.goto('/#/backup');
    const csv = 'Item Name,Code,HSN,Unit,Selling Price,GST %,Opening stock\n"Ghee, 1L",G1,0405,Ltr,620,12,5\n,X1,,,10,5,1\nPaneer 200g,P2,0406,Pcs,90,5,20\n';
    await page.getByLabel('Import items').setInputFiles({ name: 'items.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await expect(page.getByText('Items imported: 2')).toBeVisible();
    await expect(page.getByText(/Row 3: Item name is required/)).toBeVisible();
    await page.goto('/#/items');
    await expect(page.getByRole('link', { name: /Ghee, 1L/ })).toBeVisible();
    void errors;
  });
});

test.describe('Duplicates', () => {
  test('two parties with the same name are allowed and can be merged', async ({ page, errors }) => {
    await loadSample(page);
    await page.goto('/#/parties');
    await page.getByRole('button', { name: 'Add party' }).click();
    await page.getByLabel('Name').fill('Ravi Kumar');
    await page.getByLabel('Phone', { exact: true }).fill('9000000009');
    await page.getByRole('button', { name: 'Save party' }).click();
    await expect(page.getByRole('heading', { name: 'Ravi Kumar' })).toBeVisible();
    await page.getByRole('button', { name: 'Merge' }).click();
    await page.getByLabel('Merge into').selectOption({ label: 'Ravi Kumar (9844444444)' });
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Merge', exact: true }).last().click();
    await expect(page.getByText('Parties merged')).toBeVisible();
    await page.goto('/#/parties');
    await expect(page.getByRole('link', { name: /Ravi Kumar/ })).toHaveCount(1);
    void errors;
  });
});

test.describe('Screens: a11y and mobile', () => {
  for (const r of ['', 'parties', 'items', 'sale/invoices', 'sale/invoices/new', 'sale/payments/new', 'purchase/bills/new', 'cash-bank', 'reports/profit-loss', 'reports/balance-sheet', 'reminders', 'settings', 'backup']) {
    test(`screen /${r} has no serious a11y issues and no sideways scroll at 390px`, async ({ page, errors }) => {
      await loadSample(page);
      await page.goto('/#/' + r);
      await page.waitForTimeout(200);
      await a11y(page);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(150);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
      void errors;
    });
  }
});
