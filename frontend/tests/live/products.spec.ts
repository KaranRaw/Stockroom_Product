import { test, expect } from '@playwright/test';

test('real backend and PostgreSQL product lifecycle', async ({ page }) => {
  test.skip(process.env.RUN_LIVE_E2E !== '1', 'Explicit opt-in: run against your own development database.');
  const name = 'Live test lamp ' + Date.now();
  let id: number | undefined;
  try {
    await page.goto('/');
    await page.getByRole('button', { name: 'Add product', exact: true }).click();
    await page.getByLabel('Product name').fill(name);
    await page.getByLabel('Price (INR)').fill('149.90');
    await page.getByLabel('Quantity', { exact: false }).fill('4');
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
    await page.getByRole('button', { name: 'Save changes' }).click();
    const row = page.getByRole('row').filter({ hasText: name });
    await expect(row).toContainText('8 units');
    await page.getByRole('button', { name: 'Delete ' + name }).click();
    await page.getByRole('button', { name: 'Delete product', exact: true }).click();
    await expect(page.getByText('No matching products')).toBeVisible();
    id = undefined;
  } finally {
    if (id) await page.request.delete('/api/products/' + id);
  }
});
