import { test, expect } from '@playwright/test';
import { selectCategory } from '../category';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Product } from '../../src/api';
import { fixtures, mockApi } from '../fixtures/catalog';

test('create, view, edit, confirm and delete a product', async ({ page }) => {
  await mockApi(page, []);
  await page.goto('/');
  await expect(page.getByText('Your catalog starts here')).toBeVisible();
  await page.getByRole('main').getByRole('button', { name: 'Add product', exact: true }).click();
  await page.getByLabel('Product name').fill('Integration desk lamp');
  await page.getByLabel('Price (INR)').fill('149.90');
  await page.getByLabel('Quantity', { exact: false }).fill('4');
  await selectCategory(page, 'Workspace');
  await page.getByRole('button', { name: 'Create product' }).click();
  await expect(page.getByRole('button', { name: 'Integration desk lamp', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'View Integration desk lamp' }).click();
  await expect(page.getByRole('heading', { name: 'Product details' })).toBeVisible();
  await page.getByRole('button', { name: 'Edit product', exact: true }).click();
  await page.getByLabel('Product name').fill('Updated desk lamp');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('button', { name: 'Updated desk lamp', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Delete Updated desk lamp' }).click();
  await page.getByRole('button', { name: 'Keep product' }).click();
  await expect(page.getByRole('button', { name: 'Updated desk lamp', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Delete Updated desk lamp' }).click();
  await page.getByRole('button', { name: 'Delete product', exact: true }).click();
  await expect(page.getByText('Your catalog starts here')).toBeVisible();
});

test('search, clear search, paginate and show no matches', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');
  await expect(page.getByText('Page', { exact: false }).last()).toBeVisible();
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.getByRole('button', { name: 'Weekly planner', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Search products by name' }).fill('HEADPHONES');
  await expect(page.getByRole('button', { name: 'Studio wireless headphones', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Weekly planner', exact: true })).toHaveCount(0);
  await expect(page.locator('.count-pill')).toHaveText('1');
  await page.screenshot({ animations: 'disabled', path: '../docs/screenshots/products-search.png', fullPage: true });
  await page.getByRole('textbox', { name: 'Search products by name' }).fill('no-such-product');
  await expect(page.getByText('No matching products')).toBeVisible();
  await page.getByRole('button', { name: 'Clear search', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Studio wireless headphones', exact: true })).toBeVisible();
});

test('invalid form fields stay editable and do not submit', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');
  await page.getByRole('main').getByRole('button', { name: 'Add product', exact: true }).click();
  await page.getByRole('button', { name: 'Create product' }).click();
  await expect(page.getByText('Enter a product name.')).toBeVisible();
  await page.getByLabel('Product name').fill('My product');
  await page.getByLabel('Price (INR)').fill('-1');
  await page.getByLabel('Quantity', { exact: false }).fill('1.5');
  await page.getByRole('button', { name: 'Create product' }).click();
  await expect(page.getByLabel('Product name')).toHaveValue('My product');
  await expect(page.getByLabel('Price (INR)')).toHaveAttribute('aria-invalid', 'true');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('server errors preserve form input', async ({ page }) => {
  await mockApi(page);
  await page.route('**/api/products', async route => {
    if (route.request().method() === 'POST') return route.fulfill({ status: 503, json: { error: { message: 'Database temporarily unavailable', details: [] } } });
    return route.fallback();
  });
  await page.goto('/');
  await page.getByRole('main').getByRole('button', { name: 'Add product', exact: true }).click();
  await page.getByLabel('Product name').fill('Keep this name');
  await page.getByLabel('Price (INR)').fill('19.99');
  await page.getByLabel('Quantity', { exact: false }).fill('2');
  await page.getByRole('button', { name: 'Create product' }).click();
  await expect(page.getByRole('alert')).toContainText('Database temporarily unavailable');
  await expect(page.getByLabel('Product name')).toHaveValue('Keep this name');
});

test('list errors expose a retry action', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ status: 503, json: { error: { message: 'Server unavailable', details: [] } } }));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Server unavailable');
});

test('desktop UI screenshots with deterministic API fixtures', async ({ page }) => {
  await mockApi(page);
  await mkdir('../docs/screenshots', { recursive: true });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Studio wireless headphones', exact: true })).toBeVisible();
  await page.screenshot({ animations: 'disabled', path: '../docs/screenshots/products-desktop.png', fullPage: true });
  await page.getByRole('main').getByRole('button', { name: 'Add product', exact: true }).click();
  await page.getByLabel('Product name').fill('Portable reading light');
  await page.getByLabel('Price (INR)').fill('799.00');
  await page.getByLabel('Quantity', { exact: false }).fill('12');
  await selectCategory(page, 'Workspace');
  await page.getByLabel('Image URL', { exact: true }).fill('https://catalog.stockroom.test/product-2.svg');
  await expect(page.getByRole('dialog').getByRole('img', { name: 'Portable reading light' })).toBeVisible();
  await page.screenshot({ animations: 'disabled', path: '../docs/screenshots/product-form.png' });
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'View Studio wireless headphones' }).click();
  await expect(page.getByRole('heading', { name: 'Studio wireless headphones' })).toBeVisible();
  await page.screenshot({ animations: 'disabled', path: '../docs/screenshots/product-details.png' });
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Delete Studio wireless headphones' }).click();
  await page.screenshot({ animations: 'disabled', path: '../docs/screenshots/delete-confirmation.png' });
});

test('mobile page stays within the viewport and form is usable', async ({ page }) => {
  await mockApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Studio wireless headphones', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ animations: 'disabled', path: '../docs/screenshots/products-mobile.png', fullPage: true });
  await page.getByRole('main').getByRole('button', { name: 'Add product', exact: true }).click();
  await expect(page.getByLabel('Product name')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create product' })).toBeVisible();
});

test('debounced search sends one request after typing pauses', async ({ page }) => {
  await mockApi(page);
  const searches: string[] = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.pathname === '/api/products' && request.method() === 'GET') searches.push(url.searchParams.get('search') || '');
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Studio wireless headphones', exact: true })).toBeVisible();
  await page.clock.install();
  searches.length = 0;
  const search = page.getByRole('textbox', { name: 'Search products by name' });
  await search.fill('h');
  await page.clock.fastForward(150);
  await search.fill('hea');
  await page.clock.fastForward(150);
  await search.fill('headphones');
  await page.clock.fastForward(299);
  expect(searches).toEqual([]);
  await page.clock.fastForward(1);
  await expect.poll(() => searches).toEqual(['headphones']);
});

test('edit uses PATCH and keeps all form values after a 422 before retry', async ({ page }) => {
  await mockApi(page);
  let reject = true;
  const patches: Record<string, unknown>[] = [];
  await page.route('**/api/products/1', async route => {
    if (route.request().method() !== 'PATCH') return route.fallback();
    patches.push(route.request().postDataJSON());
    if (reject) {
      reject = false;
      return route.fulfill({ status: 422, json: { error: { code: 'VALIDATION_ERROR', message: 'Please check the submitted fields.', details: [{ field: 'quantity', message: 'Quantity needs review.' }] } } });
    }
    return route.fallback();
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Edit Studio wireless headphones' }).click();
  await page.getByLabel('Description', { exact: false }).fill('Keep this revised description.');
  await page.getByLabel('Quantity', { exact: false }).fill('8');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('alert')).toContainText('Please check');
  await expect(page.getByLabel('Product name')).toHaveValue('Studio wireless headphones');
  await expect(page.getByLabel('Description', { exact: false })).toHaveValue('Keep this revised description.');
  await expect(page.getByLabel('Price (INR)')).toHaveValue('3499.00');
  await expect(page.getByLabel('Quantity', { exact: false })).toHaveValue('8');
  await expect(page.getByRole('combobox', { name: /^Category/ })).toHaveValue('Electronics');
  await expect(page.getByLabel('Image URL', { exact: true })).toHaveValue('https://catalog.stockroom.test/product-0.svg');
  expect(patches[0]).toEqual({ description: 'Keep this revised description.', quantity: 8 });
  await page.screenshot({ animations: 'disabled', path: '../docs/screenshots/edit-validation-error.png' });
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(patches).toHaveLength(2);
  await expect(page.getByRole('row').filter({ hasText: 'Studio wireless headphones' })).toContainText('8 units');
});

test('image URLs preview, fail gracefully, and can be removed', async ({ page }) => {
  await mockApi(page);
  await page.route('https://broken.stockroom.test/**', route => route.fulfill({ status: 404 }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Edit Studio wireless headphones' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('img', { name: 'Studio wireless headphones' })).toBeVisible();
  await page.getByLabel('Image URL', { exact: true }).fill('https://broken.stockroom.test/missing.jpg');
  await expect(dialog.getByRole('img', { name: 'Image unavailable' })).toBeVisible();
  await page.getByRole('button', { name: 'Remove image URL' }).click();
  await expect(page.getByLabel('Image URL', { exact: true })).toHaveValue('');
  const response = page.waitForResponse(res => res.request().method() === 'PATCH');
  await page.getByRole('button', { name: 'Save changes' }).click();
  expect((await response).request().postDataJSON()).toEqual({ image_url: null });
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('delete failure retains confirmation and can be retried', async ({ page }) => {
  await mockApi(page);
  let reject = true;
  await page.route('**/api/products/1', async route => {
    if (route.request().method() === 'DELETE' && reject) {
      reject = false;
      return route.fulfill({ status: 503, json: { error: { message: 'Temporarily unavailable', details: [] } } });
    }
    return route.fallback();
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Delete Studio wireless headphones' }).click();
  await page.getByRole('button', { name: 'Delete product', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Temporarily unavailable');
  await page.getByRole('button', { name: 'Delete product', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Studio wireless headphones', exact: true })).toHaveCount(0);
});

test('page-size dropdown changes the requested limit', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Studio wireless headphones', exact: true })).toBeVisible();
  await page.getByLabel('Rows', { exact: true }).selectOption('25');
  await expect(page.getByRole('button', { name: 'Weekly planner', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next page' })).toBeDisabled();
});
test('sidebar collapse preserves its actions and centers save feedback', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');
  const sidebar = page.getByRole('complementary');
  const main = page.locator('.main-shell');
  await expect.poll(async () => Math.round((await main.boundingBox())!.x)).toBe(224);
  const expanded = await main.boundingBox();
  const toggle = (await page.getByRole('button', { name: 'Collapse sidebar' }).boundingBox())!;
  const sidebarBounds = (await sidebar.boundingBox())!;
  expect(toggle.x + toggle.width).toBeLessThanOrEqual(sidebarBounds.x + sidebarBounds.width);
  expect(expanded).not.toBeNull();
  await page.getByRole('button', { name: 'Collapse sidebar' }).click();
  await expect(page.getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute('aria-expanded', 'false');
  await expect.poll(async () => Math.round((await sidebar.boundingBox())!.width)).toBe(76);
  expect((await main.boundingBox())!.width).toBeGreaterThan(expanded!.width);
  await sidebar.getByRole('button', { name: 'Add product', exact: true }).click();
  await page.getByLabel('Product name').fill('Sidebar fixture product');
  await page.getByLabel('Price (INR)').fill('19.99');
  await page.getByLabel('Quantity', { exact: false }).fill('2');
  await page.getByRole('button', { name: 'Create product' }).click();
  const toast = page.getByRole('status').filter({ hasText: 'Product added' });
  await expect(toast).toBeVisible();
  await expect.poll(async () => {
    const content = (await main.boundingBox())!;
    const feedback = (await toast.boundingBox())!;
    return Math.abs(feedback.x + feedback.width / 2 - content.x - content.width / 2);
  }).toBeLessThan(2);
  await sidebar.getByRole('button', { name: 'Open workspace guide' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Got it' }).click();
  await page.getByRole('button', { name: 'Expand sidebar' }).click();
  await expect(page.getByRole('button', { name: 'Collapse sidebar' })).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(async () => Math.round((await sidebar.boundingBox())!.width)).toBe(224);
});

test('topbar stays visible while the catalog scrolls', async ({ page }) => {
  await mockApi(page);
  await page.setViewportSize({ width: 1440, height: 760 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Studio wireless headphones', exact: true })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 700));
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
  await expect.poll(async () => Math.round((await page.locator('.topbar').boundingBox())!.y)).toBe(0);
  await expect(page.getByRole('banner').getByText('Workspace', { exact: true })).toBeVisible();
});

test('collapsed sidebar remains usable across tablet and mobile widths', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Collapse sidebar' }).click();
  await page.setViewportSize({ width: 900, height: 900 });
  await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeHidden();
  const sidebar = page.getByRole('complementary');
  await sidebar.getByRole('button', { name: 'Open workspace guide' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Got it' }).click();
  await sidebar.getByRole('button', { name: 'Add product', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(sidebar).toBeHidden();
  await expect.poll(async () => Math.round((await page.locator('.main-shell').boundingBox())!.x)).toBe(0);
  await page.getByRole('main').getByRole('button', { name: 'Add product', exact: true }).click();
  await expect(page.getByLabel('Product name')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('soft delete retains the record while hiding it from the catalog and totals', async ({ page }) => {
  const state = await mockApi(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Studio wireless headphones', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Delete Studio wireless headphones' }).click();
  await expect(page.getByRole('dialog')).toContainText('Its record is retained.');
  await expect(page.getByRole('dialog')).not.toContainText('permanently');
  await page.getByRole('button', { name: 'Delete product', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Studio wireless headphones', exact: true })).toHaveCount(0);
  await expect(page.getByRole('article').filter({ hasText: 'Total products' }).locator('.stat-value')).toHaveText('11');
  await expect(page.getByRole('article').filter({ hasText: 'Units in stock' }).locator('.stat-value')).toHaveText('171');
  const records = state.records();
  expect(records).toHaveLength(12);
  expect(records.find(record => record.id === 1)).toMatchObject({ is_deleted: true, quantity: 24, price: '3499.00' });
  await page.getByRole('textbox', { name: 'Search products by name' }).fill('Studio wireless headphones');
  await expect(page.getByText('No matching products')).toBeVisible();
});

test('confirmed deletion updates rows and totals before a slow refresh finishes', async ({ page }) => {
  const state = await mockApi(page);
  let releaseDelete!: () => void;
  let releaseReads!: () => void;
  const deleteGate = new Promise<void>(resolve => { releaseDelete = resolve; });
  const readGate = new Promise<void>(resolve => { releaseReads = resolve; });
  let holdReads = false;
  let deleteRequested = false;
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === 'DELETE') {
      deleteRequested = true;
      await deleteGate;
    } else if (holdReads && route.request().method() === 'GET' &&
      (path === '/api/products' || path === '/api/products/stats')) {
      await readGate;
    }
    return route.fallback();
  });
  try {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Studio wireless headphones', exact: true })).toBeVisible();
    await expect(page.getByRole('article').filter({ hasText: 'Total products' }).locator('.stat-value')).toHaveText('12');
    holdReads = true;
    await page.getByRole('button', { name: 'Delete Studio wireless headphones' }).click();
    await page.getByRole('button', { name: 'Delete product', exact: true }).click();
    await expect.poll(() => deleteRequested).toBe(true);
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(state.records().find(record => record.id === 1)?.is_deleted).toBe(false);
    releaseDelete();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Studio wireless headphones', exact: true })).toHaveCount(0);
    await expect(page.getByRole('article').filter({ hasText: 'Total products' }).locator('.stat-value')).toHaveText('11');
    await expect(page.getByRole('article').filter({ hasText: 'Units in stock' }).locator('.stat-value')).toHaveText('171');
    await expect(page.getByRole('article').filter({ hasText: 'Inventory value' }).locator('.stat-value')).toHaveText('₹1,86,779.00');
    expect(state.records().find(record => record.id === 1)?.is_deleted).toBe(true);
  } finally { releaseDelete(); releaseReads(); }
});

test('deleting the last product on the final page returns to a valid page immediately', async ({ page }) => {
  await mockApi(page, fixtures().slice(0, 11));
  let releaseReads!: () => void;
  const gate = new Promise<void>(resolve => { releaseReads = resolve; });
  let hold = false;
  await page.route('**/api/**', async route => {
    if (hold && route.request().method() === 'GET') await gate;
    return route.fallback();
  });
  try {
    await page.goto('/');
    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(page.getByRole('button', { name: 'Weekly planner', exact: true })).toBeVisible();
    hold = true;
    await page.getByRole('button', { name: 'Delete Weekly planner' }).click();
    await page.getByRole('button', { name: 'Delete product', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Weekly planner', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Studio wireless headphones', exact: true })).toBeVisible();
    await expect(page.locator('.page-number')).toHaveText('Page 1 of 1');
    await expect(page.getByRole('button', { name: 'Next page' })).toBeDisabled();
    await expect(page.locator('.table-footer')).toContainText('of 10 products');
  } finally { releaseReads(); }
});

test('a pre-delete refresh is aborted and cannot restore a removed row', async ({ page }) => {
  await mockApi(page);
  let holdNext = false;
  let captured = false;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const aborted: string[] = [];
  page.on('requestfailed', request => aborted.push(new URL(request.url()).pathname));
  await page.route('**/api/products?**', async route => {
    if (!holdNext) return route.fallback();
    holdNext = false; captured = true;
    await gate;
    try { await route.fulfill({ json: { items: fixtures().slice(0, 10), total: 12, page: 1, page_size: 10 } }); }
    catch (error) { if (!route.request().failure()) throw error; }
  });
  try {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Studio wireless headphones', exact: true })).toBeVisible();
    holdNext = true;
    await page.getByRole('button', { name: 'Refresh products' }).click();
    await expect.poll(() => captured).toBe(true);
    await page.getByRole('button', { name: 'Delete Studio wireless headphones' }).click();
    await page.getByRole('button', { name: 'Delete product', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect.poll(() => aborted).toContain('/api/products');
    release();
    await expect(page.getByRole('button', { name: 'Studio wireless headphones', exact: true })).toHaveCount(0);
    await expect(page.getByRole('article').filter({ hasText: 'Total products' }).locator('.stat-value')).toHaveText('11');
  } finally { release(); }
});
test('a search response that already excludes the deleted row is not decremented twice', async ({ page }) => {
  const data = fixtures();
  data.push({ ...data[0], id: 13, name: 'Travel headphones' });
  let releaseDelete!: () => void;
  let releaseReads!: () => void;
  const deleteGate = new Promise<void>(resolve => { releaseDelete = resolve; });
  const readGate = new Promise<void>(resolve => { releaseReads = resolve; });
  let committed = false;
  await mockApi(page, data, async () => { committed = true; await deleteGate; });
  let holdReads = false;
  await page.route('**/api/**', async route => {
    if (holdReads && route.request().method() === 'GET') await readGate;
    return route.fallback();
  });
  try {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Studio wireless headphones', exact: true })).toBeVisible();
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    await page.getByRole('textbox', { name: 'Search products by name' }).fill('headphones');
    await page.getByRole('button', { name: 'Delete Studio wireless headphones' }).click();
    await page.getByRole('button', { name: 'Delete product', exact: true }).click();
    await expect.poll(() => committed).toBe(true);
    await page.clock.fastForward(300);
    await page.clock.resume();
    await expect(page.getByRole('button', { name: 'Travel headphones', exact: true })).toBeVisible();
    await expect(page.locator('.count-pill')).toHaveText('1');
    holdReads = true;
    releaseDelete();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.count-pill')).toHaveText('1');
    await expect(page.locator('.table-footer')).toContainText('of 1 products');
  } finally { releaseDelete(); releaseReads(); }
});

test('custom categories persist after refresh and can be reused in Add and Edit', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');
  await page.getByRole('main').getByRole('button', { name: 'Add product', exact: true }).click();
  await page.getByLabel('Product name').fill('Category fixture phone');
  await page.getByLabel('Price (INR)').fill('199.00');
  await page.getByLabel('Quantity', { exact: false }).fill('2');
  await selectCategory(page, 'Custom category…');
  await page.getByRole('textbox', { name: 'New category name' }).fill('Smartphone');
  // Saving the product also registers the custom name, without a separate button click.
  await page.getByRole('button', { name: 'Create product' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await page.getByRole('main').getByRole('button', { name: 'Add product', exact: true }).click();
  await selectCategory(page, 'Smartphone');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Mechanical keyboard' }).click();
  await selectCategory(page, 'Smartphone');
  const patch = page.waitForResponse(response => response.request().method() === 'PATCH');
  await page.getByRole('button', { name: 'Save changes' }).click();
  expect((await patch).request().postDataJSON()).toEqual({ category: 'Smartphone' });
  await expect(page.getByRole('row').filter({ hasText: 'Mechanical keyboard' })).toContainText('Smartphone');
  for (const name of ['Category fixture phone', 'Mechanical keyboard']) {
    await page.getByRole('button', { name: 'Delete ' + name }).click();
    await page.getByRole('button', { name: 'Delete product', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  await page.reload();
  await page.getByRole('main').getByRole('button', { name: 'Add product', exact: true }).click();
  await selectCategory(page, 'Smartphone');
  await expect(page.getByRole('combobox', { name: /^Category/ })).toHaveValue('Smartphone');
});

test('inline category creation is persistent without saving a product and reuses duplicates', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');
  await page.getByRole('main').getByRole('button', { name: 'Add product', exact: true }).click();
  const select = page.getByRole('combobox', { name: /^Category/ });
  await selectCategory(page, 'Custom category…');
  await page.getByRole('textbox', { name: 'New category name' }).fill('Future devices');
  await page.getByRole('button', { name: 'Save category', exact: true }).click();
  await expect(select).toHaveValue('Future devices');
  const id = await select.inputValue();
  await selectCategory(page, 'Custom category…');
  await page.getByRole('textbox', { name: 'New category name' }).fill('  FUTURE   devices  ');
  await page.getByRole('button', { name: 'Save category', exact: true }).click();
  await expect(select).toHaveValue(id);
  await select.click();
  await select.fill('Future devices');
  await expect(page.getByRole('option', { name: 'Future devices', exact: true })).toHaveCount(1);
  await select.press('Escape');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Edit Mechanical keyboard' }).click();
  await selectCategory(page, 'Future devices');
});

test('a failed category save preserves the category draft and product inputs for retry', async ({ page }) => {
  await mockApi(page);
  let reject = true;
  await page.route('**/api/categories', async route => {
    if (route.request().method() === 'POST' && reject) {
      reject = false;
      return route.fulfill({ status: 503, json: { error: { message: 'Categories temporarily unavailable', details: [] } } });
    }
    return route.fallback();
  });
  await page.goto('/');
  await page.getByRole('main').getByRole('button', { name: 'Add product', exact: true }).click();
  await page.getByLabel('Product name').fill('Do not lose this draft');
  await page.getByLabel('Price (INR)').fill('149.90');
  await page.getByLabel('Quantity', { exact: false }).fill('4');
  await selectCategory(page, 'Custom category…');
  await page.getByRole('textbox', { name: 'New category name' }).fill('Wearables');
  await page.getByRole('button', { name: 'Save category', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Categories temporarily unavailable');
  await expect(page.getByLabel('Product name')).toHaveValue('Do not lose this draft');
  await expect(page.getByLabel('Price (INR)')).toHaveValue('149.90');
  await expect(page.getByLabel('Quantity', { exact: false })).toHaveValue('4');
  await expect(page.getByRole('textbox', { name: 'New category name' })).toHaveValue('Wearables');
  await page.getByRole('button', { name: 'Save category', exact: true }).click();
  await expect(page.getByRole('combobox', { name: /^Category/ })).toHaveValue('Wearables');
  await expect(page.getByRole('button', { name: 'Create product' })).toBeEnabled();
});

test('category list errors can be retried without resetting the product form', async ({ page }) => {
  await mockApi(page);
  let fail = true;
  await page.route('**/api/categories', route => fail && route.request().method() === 'GET'
    ? route.fulfill({ status: 503, json: { error: { message: 'Category list unavailable', details: [] } } })
    : route.fallback());
  await page.goto('/');
  await page.getByRole('main').getByRole('button', { name: 'Add product', exact: true }).click();
  await page.getByLabel('Product name').fill('Keep my product name');
  await expect(page.getByRole('alert')).toContainText('Couldn’t load categories.');
  fail = false;
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await selectCategory(page, 'Electronics');
  await expect(page.getByLabel('Product name')).toHaveValue('Keep my product name');
});

test('custom category controls fit mobile dialogs with long category names', async ({ page }) => {
  await mockApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('main').getByRole('button', { name: 'Add product', exact: true }).click();
  await page.getByLabel('Product name').fill('Mobile category preview');
  await page.getByLabel('Price (INR)').fill('799.00');
  await page.getByLabel('Quantity', { exact: false }).fill('2');
  await selectCategory(page, 'Custom category…');
  await page.getByRole('textbox', { name: 'New category name' }).fill('Smartphone ' + 'A'.repeat(89));
  const dialog = page.getByRole('dialog');
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  const input = (await page.getByRole('textbox', { name: 'New category name' }).boundingBox())!;
  const button = (await page.getByRole('button', { name: 'Save category', exact: true }).boundingBox())!;
  expect(input.width).toBeGreaterThan(90);
  expect(button.x + button.width).toBeLessThanOrEqual(375);
  await page.getByRole('button', { name: 'Save category', exact: true }).click();
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await expect(page.getByRole('button', { name: 'Create product' })).toBeVisible();
  await page.screenshot({ animations: 'disabled', path: '../docs/screenshots/category-mobile.png' });
});

test('custom category preview uses the same form spacing and controls', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');
  await page.getByRole('main').getByRole('button', { name: 'Add product', exact: true }).click();
  await page.getByLabel('Product name').fill('Studio charging dock');
  await page.getByLabel('Price (INR)').fill('1299.00');
  await page.getByLabel('Quantity', { exact: false }).fill('12');
  await selectCategory(page, 'Custom category…');
  await page.getByRole('textbox', { name: 'New category name' }).fill('Smartphone');
  await page.screenshot({ animations: 'disabled', path: '../docs/screenshots/category-editor.png' });
});
test('an empty custom category is rejected without losing the other fields', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');
  await page.getByRole('main').getByRole('button', { name: 'Add product', exact: true }).click();
  await page.getByLabel('Product name').fill('Uncategorized fixture');
  await page.getByLabel('Price (INR)').fill('1.00');
  await page.getByLabel('Quantity', { exact: false }).fill('0');
  await selectCategory(page, 'Custom category…');
  await page.getByRole('button', { name: 'Create product' }).click();
  await expect(page.getByText('Enter a category name or choose No category.')).toBeVisible();
  await expect(page.getByLabel('Product name')).toHaveValue('Uncategorized fixture');
  await selectCategory(page, 'No category');
  const response = page.waitForResponse(res => res.url().endsWith('/api/products') && res.request().method() === 'POST');
  await page.getByRole('button', { name: 'Create product' }).click();
  expect((await response).request().postDataJSON().category).toBeNull();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('category names cannot collide with the custom-category control value', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');
  await page.getByRole('main').getByRole('button', { name: 'Add product', exact: true }).click();
  const select = page.getByRole('combobox', { name: /^Category/ });
  await selectCategory(page, 'Custom category…');
  await page.getByRole('textbox', { name: 'New category name' }).fill('__custom__');
  await page.getByRole('button', { name: 'Save category', exact: true }).click();
  await expect(select).toHaveValue('__custom__');
  expect(await select.inputValue()).toBe('__custom__');
  await expect(page.getByRole('textbox', { name: 'New category name' })).toHaveCount(0);
});

test('category search finds shared choices in Add and Edit without per-keystroke requests', async ({ page }) => {
  await mockApi(page);
  const categories = Array.from({ length: 250 }, (_, index) => ({
    id: index + 1000, name: 'Catalog category ' + String(index + 1).padStart(3, '0'),
    created_at: '2026-01-01T00:00:00Z',
  }));
  categories.push({ id: 2000, name: 'Smartphone accessories', created_at: '2026-01-01T00:00:00Z' });
  let requests = 0;
  await page.route('**/api/categories', route => {
    if (route.request().method() !== 'GET') return route.fallback();
    requests++;
    return route.fulfill({ json: categories });
  });
  await page.goto('/');
  await page.getByRole('main').getByRole('button', { name: 'Add product', exact: true }).click();
  const picker = page.getByRole('combobox', { name: /^Category/ });
  await expect(picker).toBeEnabled();
  const beforeSearch = requests;
  await picker.click();
  await picker.pressSequentially('pHoNe');
  await expect(page.getByRole('option', { name: 'Smartphone accessories', exact: true })).toBeVisible();
  await expect(page.getByRole('option', { name: /^Catalog category/ })).toHaveCount(0);
  expect(requests).toBe(beforeSearch);
  await picker.press('Enter');
  await expect(picker).toHaveValue('Smartphone accessories');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Mechanical keyboard' }).click();
  await selectCategory(page, 'Catalog category 249');
  const response = page.waitForResponse(res => res.request().method() === 'PATCH');
  await page.getByRole('button', { name: 'Save changes' }).click();
  expect((await response).request().postDataJSON()).toEqual({ category: 'Catalog category 249' });
  await expect(page.getByRole('row').filter({ hasText: 'Mechanical keyboard' })).toContainText('Catalog category 249');
});

test('category search supports keyboard selection and Escape without losing the current category', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Edit Mechanical keyboard' }).click();
  const picker = page.getByRole('combobox', { name: /^Category/ });
  await picker.click();
  await picker.fill('does not exist');
  await expect(page.getByText('No matching categories.', { exact: true })).toBeVisible();
  await picker.press('Enter');
  await expect(page.getByRole('listbox', { name: 'Category choices' })).toBeVisible();
  await expect(page.getByLabel('Product name')).toHaveValue('Mechanical keyboard');
  await picker.press('Escape');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(picker).toHaveValue('Electronics');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await picker.click();
  await picker.fill('work');
  await expect(picker).toHaveAttribute('aria-activedescendant', /.+-0$/);
  await picker.press('ArrowDown');
  await picker.press('ArrowUp');
  await picker.press('Enter');
  await expect(picker).toHaveValue('Workspace');
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  await picker.click();
  await picker.fill('station');
  await picker.press('Tab');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(picker).toHaveValue('Workspace');
});

test('category search can be cleared and custom creation remains available with no results', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');
  await page.getByRole('main').getByRole('button', { name: 'Add product', exact: true }).click();
  await page.getByLabel('Product name').fill('Keep this draft');
  const picker = page.getByRole('combobox', { name: /^Category/ });
  await picker.click();
  await picker.fill('not in registry');
  await page.getByRole('button', { name: 'Clear category search' }).click();
  await expect(page.getByRole('option', { name: 'Electronics', exact: true })).toBeVisible();
  await picker.fill('not in registry');
  await page.getByRole('option', { name: 'Custom category…', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'New category name' })).toBeFocused();
  await page.getByRole('textbox', { name: 'New category name' }).fill('Wearable technology');
  await page.getByRole('button', { name: 'Save category', exact: true }).click();
  await expect(picker).toHaveValue('Wearable technology');
  await expect(page.getByLabel('Product name')).toHaveValue('Keep this draft');
  await picker.click();
  await picker.fill('not in registry');
  await page.getByRole('option', { name: 'No category', exact: true }).click();
  await expect(picker).toHaveValue('No category');
  await expect(page.getByRole('textbox', { name: 'New category name' })).toHaveCount(0);
});

for (const width of [390, 768, 1440]) {
  test('searchable category results fit a ' + width + 'px dialog without overlapping form controls', async ({ page }) => {
    await mockApi(page);
    const longName = 'Smartphone ' + 'accessories '.repeat(7) + 'cases';
    const categories = Array.from({ length: 150 }, (_, index) => ({
      id: index + 100, name: 'Smartphone collection ' + String(index).padStart(3, '0'),
      created_at: '2026-01-01T00:00:00Z',
    }));
    categories.unshift({ id: 999, name: longName, created_at: '2026-01-01T00:00:00Z' });
    await page.route('**/api/categories', route => route.request().method() === 'GET'
      ? route.fulfill({ json: categories }) : route.fallback());
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1100 });
    await page.goto('/');
    await page.getByRole('main').getByRole('button', { name: 'Add product', exact: true }).click();
    const picker = page.getByRole('combobox', { name: /^Category/ });
    await picker.click();
    await picker.fill('smartphone');
    const results = page.locator('.category-results');
    expect(await results.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
    expect((await results.boundingBox())!.height).toBeLessThanOrEqual(177);
    const dialog = page.getByRole('dialog');
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    const panel = (await page.locator('.category-picker-panel').boundingBox())!;
    const form = (await dialog.boundingBox())!;
    expect(panel.x).toBeGreaterThanOrEqual(form.x);
    expect(panel.x + panel.width).toBeLessThanOrEqual(form.x + form.width);
    // The panel participates in layout; the following section begins below it.
    expect((await page.locator('.image-section-label').boundingBox())!.y).toBeGreaterThan(panel.y + panel.height);
    await page.getByRole('option', { name: longName, exact: true }).click();
    await expect(picker).toHaveValue(longName);
    await picker.click();
    await picker.fill('collection 149');
    await expect(page.getByRole('option', { name: 'Smartphone collection 149', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Create product' }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: 'Create product' })).toBeInViewport();
    // Return to the open search control for the visual check.
    await picker.scrollIntoViewIfNeeded();
    if (width === 390 || width === 1440)
      await page.screenshot({ animations: 'disabled', path: '../docs/screenshots/category-search-' + width + '.png' });
    await page.getByLabel('Product name').click();
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(picker).toHaveValue(longName);
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  });
}

test('the thirty-product seed catalog renders images, paginates, edits and soft deletes', async ({ page }) => {
  const data = JSON.parse(await readFile(resolve('../backend/app/seed_products.json'), 'utf8')) as Omit<Product, 'id' | 'created_at'>[];
  expect(data).toHaveLength(30);
  const products: Product[] = data.map((product, index) => ({
    ...product, id: index + 1, created_at: '2026-11-20T10:00:00Z',
  }));
  await mockApi(page, products);
  // Image rendering stays deterministic; public URL availability is checked separately.
  for (const pattern of ['https://images.unsplash.com/**', 'https://cdn.dummyjson.com/**']) {
    await page.route(pattern, route => route.fulfill({ path: resolve('tests/fixtures/images/product-2.svg') }));
  }
  await page.goto('/');
  await expect(page.locator('.count-pill')).toHaveText('30');
  await expect(page.locator('.page-number')).toHaveText('Page 1 of 3');
  const image = page.getByRole('img', { name: data[0].name, exact: true });
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.locator('.page-number')).toHaveText('Page 2 of 3');
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.locator('.page-number')).toHaveText('Page 3 of 3');
  const last = data[29];
  await page.getByRole('button', { name: 'View ' + last.name }).click();
  await expect(page.getByRole('heading', { name: last.name })).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('img', { name: last.name })).toBeVisible();
  await page.getByRole('button', { name: 'Edit product', exact: true }).click();
  await expect(page.getByLabel('Image URL', { exact: true })).toHaveValue(last.image_url!);
  await page.getByLabel('Quantity', { exact: false }).fill('9');
  await selectCategory(page, 'Stationery');
  await page.getByRole('button', { name: 'Save changes' }).click();
  const row = page.getByRole('row').filter({ hasText: last.name });
  await expect(row).toContainText('9 units');
  await expect(row).toContainText('Stationery');
  await page.getByRole('button', { name: 'Delete ' + last.name }).click();
  await page.getByRole('button', { name: 'Delete product', exact: true }).click();
  await expect(page.locator('.count-pill')).toHaveText('29');
  await expect(page.locator('.page-number')).toHaveText('Page 3 of 3');
  await expect(page.getByRole('button', { name: last.name, exact: true })).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Search products by name' }).fill(data[0].name);
  await expect(page.locator('.count-pill')).toHaveText('1');
  await expect(page.getByRole('button', { name: data[0].name, exact: true })).toBeVisible();
});
