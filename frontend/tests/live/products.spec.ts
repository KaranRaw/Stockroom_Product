import { test, expect } from '@playwright/test';
import { selectCategory } from '../category';

test('real backend and PostgreSQL product lifecycle', async ({ page }) => {
  test.skip(process.env.RUN_LIVE_E2E !== '1', 'Explicit opt-in: run against your own development database.');
  const stamp = Date.now();
  const name = 'Live test lamp ' + stamp;
  const categoryName = 'Live category ' + stamp;
  let id: number | undefined;
  try {
    await page.goto('/');
    await page.getByRole('main').getByRole('button', { name: 'Add product', exact: true }).click();
    await page.getByLabel('Product name').fill(name);
    await page.getByLabel('Price (INR)').fill('149.90');
    await page.getByLabel('Quantity', { exact: false }).fill('4');
    await selectCategory(page, 'Custom category…');
    await page.getByRole('textbox', { name: 'New category name' }).fill(categoryName);
    const response = page.waitForResponse(res => res.url().endsWith('/api/products') && res.request().method() === 'POST');
    await page.getByRole('button', { name: 'Create product' }).click();
    const created = await response;
    expect(created.status()).toBe(201);
    id = (await created.json()).id;
    await page.getByRole('textbox', { name: 'Search products by name' }).fill(name);
    await page.getByRole('button', { name: 'View ' + name }).click();
    await expect(page.getByRole('heading', { name })).toBeVisible();
    await page.getByRole('button', { name: 'Edit product', exact: true }).click();
    await page.getByLabel('Quantity', { exact: false }).fill('8');
    const updatedResponse = page.waitForResponse(res =>
      res.request().method() === 'PATCH' && res.url().endsWith('/api/products/' + id));
    await page.getByRole('button', { name: 'Save changes' }).click();
    expect((await updatedResponse).status()).toBe(200);
    const row = page.getByRole('row').filter({ hasText: name });
    await expect(row).toContainText('8 units');
    await page.getByRole('button', { name: 'Delete ' + name }).click();
    await page.getByRole('button', { name: 'Delete product', exact: true }).click();
    await expect(page.getByText('No matching products')).toBeVisible();
    const deleted = await page.request.get('/api/products/' + id);
    expect(deleted.status()).toBe(404);
    const hiddenUpdate = await page.request.patch('/api/products/' + id, { data: { quantity: 99 } });
    expect(hiddenUpdate.status()).toBe(404);
    const repeatDelete = await page.request.delete('/api/products/' + id);
    expect(repeatDelete.status()).toBe(404);
    const categories = await page.request.get('/api/categories');
    expect((await categories.json()).some((category: { name: string }) => category.name === categoryName)).toBe(true);
    await page.reload();
    await page.getByRole('main').getByRole('button', { name: 'Add product', exact: true }).click();
    await selectCategory(page, categoryName);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    const filtered = await page.request.get('/api/products?search=' + encodeURIComponent(name));
    expect((await filtered.json()).total).toBe(0);
    id = undefined;
  } finally {
    if (id) await page.request.delete('/api/products/' + id);
  }
});
