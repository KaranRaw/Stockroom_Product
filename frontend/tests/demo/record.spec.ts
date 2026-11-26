import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { selectCategory } from '../category';
import { mockApi } from '../fixtures/catalog';

// This records the actual frontend with deterministic API fixtures.
// Pauses and deliberate typing keep the walkthrough readable; assertions verify every stage.
test('record the product management UI walkthrough', async ({ page }) => {
  await mockApi(page);
  const pause = (milliseconds = 1300) => page.waitForTimeout(milliseconds);
  const name = 'Portable reading light';
  const category = 'Lighting';

  await test.step('Browse the catalog and search products', async () => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Studio wireless headphones', exact: true })).toBeVisible();
    await pause(2200);
    const search = page.getByRole('textbox', { name: 'Search products by name' });
    await search.pressSequentially('lamp', { delay: 110 });
    await expect(page.locator('.count-pill')).toHaveText('1');
    await pause(1800);
    await page.getByRole('button', { name: 'View Adjustable desk lamp' }).click();
    await expect(page.getByRole('heading', { name: 'Adjustable desk lamp' })).toBeVisible();
    await pause(2000);
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Clear search', exact: true }).first().click();
    await expect(page.locator('.count-pill')).toHaveText('12');
  });

  await test.step('Validate and add an illustrated product with a custom category', async () => {
    await page.getByRole('main').getByRole('button', { name: 'Add product', exact: true }).click();
    await page.getByRole('button', { name: 'Create product' }).click();
    await expect(page.getByText('Enter a product name.')).toBeVisible();
    await pause(1800);
    await page.getByLabel('Product name').pressSequentially(name, { delay: 65 });
    await page.getByLabel('Description').pressSequentially('A compact, dimmable lamp for reading and focused work.', { delay: 30 });
    await page.getByLabel('Price (INR)').pressSequentially('1299.00', { delay: 100 });
    await page.getByLabel('Quantity', { exact: false }).fill('8');
    await pause();
    await selectCategory(page, 'Custom category…');
    await page.getByRole('textbox', { name: 'New category name' }).pressSequentially(category, { delay: 110 });
    await pause();
    await page.getByRole('button', { name: 'Save category', exact: true }).click();
    await expect(page.getByRole('combobox', { name: /^Category/ })).toHaveValue(category);
    await page.getByLabel('Image URL', { exact: true }).fill('https://catalog.stockroom.test/product-2.svg');
    await expect(page.getByRole('dialog').getByRole('img', { name })).toBeVisible();
    await pause(2200);
    await page.getByRole('button', { name: 'Create product' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
    await pause(1800);
  });

  await test.step('View and edit the new product', async () => {
    await page.getByRole('button', { name: 'View ' + name }).click();
    await expect(page.getByRole('heading', { name })).toBeVisible();
    await pause(2200);
    await page.getByRole('button', { name: 'Edit product', exact: true }).click();
    await page.getByLabel('Quantity', { exact: false }).fill('4');
    await page.getByLabel('Description').fill('A dimmable reading lamp with a warm finish and adjustable head.');
    const picker = page.getByRole('combobox', { name: /^Category/ });
    await picker.click();
    await picker.pressSequentially('work', { delay: 130 });
    await expect(page.getByRole('option', { name: 'Workspace', exact: true })).toBeVisible();
    await pause();
    await page.getByRole('option', { name: 'Workspace', exact: true }).click();
    await pause(1800);
    await page.getByRole('button', { name: 'Save changes' }).click();
    const row = page.getByRole('row').filter({ hasText: name });
    await expect(row).toContainText('4 units');
    await expect(row).toContainText('Low stock');
    await expect(row).toContainText('Workspace');
    await pause(2200);
  });

  await test.step('Reuse a saved category after refresh', async () => {
    await page.reload();
    await page.getByRole('button', { name: 'Edit ' + name }).click();
    const picker = page.getByRole('combobox', { name: /^Category/ });
    await picker.click();
    await picker.pressSequentially('light', { delay: 140 });
    await expect(page.getByRole('option', { name: category, exact: true })).toBeVisible();
    await pause(1500);
    await page.getByRole('option', { name: category, exact: true }).click();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('row').filter({ hasText: name })).toContainText(category);
    await pause(1600);
  });

  await test.step('Confirm deletion and return to the catalog', async () => {
    await page.getByRole('button', { name: 'Delete ' + name }).click();
    await expect(page.getByRole('heading', { name: 'Delete this product?' })).toBeVisible();
    await pause(2200);
    await page.getByRole('button', { name: 'Keep product', exact: true }).click();
    await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
    await pause();
    await page.getByRole('button', { name: 'Delete ' + name }).click();
    await pause();
    await page.getByRole('button', { name: 'Delete product', exact: true }).click();
    await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
    await expect(page.locator('.count-pill')).toHaveText('12');
    await page.mouse.move(1400, 50);
    await pause(2200);
  });

  // Publish only a completed, passing recording. Failed attempts remain in ignored test-results.
  const video = page.video();
  if (!video) throw new Error('Video recording is required; use npm run demo.');
  await page.close();
  await mkdir('../docs/demos', { recursive: true });
  await video.saveAs(resolve('../docs/demos/stockroom_ui_walkthrough.webm'));
});
