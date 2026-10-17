import { expect, test as base, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** Every test fails on a console error or an uncaught exception. */
export const test = base.extend<{ errors: string[] }>({
  errors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    // window.open is how WhatsApp is reached; record it instead of opening a tab.
    await page.addInitScript(() => { (window as any).__opened = []; window.open = ((u: string) => { (window as any).__opened.push(u); return null; }) as any; });
    await use(errors);
    expect(errors, 'console errors').toEqual([]);
  },
});
export { expect };

export async function setupFirm(page: Page, opts: { name?: string; gstin?: string } = {}) {
  await page.goto('/');
  await page.getByLabel('Business name').fill(opts.name ?? 'Test Kirana');
  if (opts.gstin !== '') await page.getByLabel('GSTIN (optional)').fill(opts.gstin ?? '27AAPFU0939F1ZV');
  await page.getByRole('button', { name: 'Start using Bahi' }).click();
  await expect(page.getByRole('heading', { name: /Welcome/ })).toBeVisible();
}

export async function loadSample(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try with sample data' }).click();
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible();
}

/** Serious and critical axe findings only; moderate ones are reviewed by hand. */
export async function a11y(page: Page) {
  const r = await new AxeBuilder({ page }).analyze();
  const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(bad.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
}

export const opened = (page: Page) => page.evaluate(() => (window as any).__opened as string[]);
