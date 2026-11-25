import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Product } from '../../src/api';

function fixtures(): Product[] {
  const names = ['Studio wireless headphones', 'Mechanical keyboard', 'Adjustable desk lamp',
    'Everyday canvas tote', 'Ceramic coffee mug', 'A5 dotted notebook', 'Aluminum laptop stand',
    'Insulated water bottle', 'USB-C desktop hub', 'Felt desk mat', 'Weekly planner', 'Linen cushion cover'];
  const prices = ['3499.00','4299.00','1299.00','599.00','449.00','299.00','1899.00','899.00','2499.00','799.00','349.00','699.00'];
  const quantities = [24,12,5,48,32,3,16,0,9,21,7,18];
  const categories = ['Electronics','Electronics','Workspace','Accessories','Home & living','Stationery','Workspace','Accessories','Electronics','Workspace','Stationery','Home & living'];
  return names.map((name, index) => ({ id: index + 1, name, price: prices[index], quantity: quantities[index],
    category: categories[index], image_url: index < 6 ? 'https://catalog.stockroom.test/product-' + index + '.svg' : null, description: 'Thoughtfully designed for everyday use. A practical addition to your workspace.',
    created_at: '2026-11-20T10:00:00Z' }));
}

async function mockApi(page: Page, initial = fixtures()) {
  let products = structuredClone(initial);
  let nextId = 100;
  await page.route('https://catalog.stockroom.test/**', route => route.fulfill({ path: resolve('tests/fixtures/images/' + new URL(route.request().url()).pathname.split('/').pop()!) }));
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (url.pathname === '/api/products/stats') {
      return route.fulfill({ json: { products: products.length, units: products.reduce((n, p) => n + p.quantity, 0),
        value: products.reduce((n, p) => n + Number(p.price) * p.quantity, 0).toFixed(2),
        low_stock: products.filter(p => p.quantity <= 5).length } });
    }
    if (url.pathname === '/api/products' && method === 'GET') {
      const filtered = products.filter(p => p.name.toLowerCase().includes((url.searchParams.get('search') || '').toLowerCase()));
      const pageNumber = Number(url.searchParams.get('page') || 1);
      const pageSize = Number(url.searchParams.get('page_size') || 10);
      return route.fulfill({ json: { items: filtered.slice((pageNumber - 1) * pageSize, pageNumber * pageSize), total: filtered.length, page: pageNumber, page_size: pageSize } });
    }
    if (url.pathname === '/api/products' && method === 'POST') {
      const product = { ...route.request().postDataJSON(), id: nextId++, created_at: new Date().toISOString() };
      products = [product, ...products];
      return route.fulfill({ status: 201, json: product });
    }
    const id = Number(url.pathname.split('/').pop());
    const product = products.find(p => p.id === id);
    if (!product) return route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND', message: 'Product not found', details: [] } } });
    if (method === 'GET') return route.fulfill({ json: product });
    if (method === 'PUT' || method === 'PATCH') {
      Object.assign(product, route.request().postDataJSON());
      return route.fulfill({ json: product });
    }
    if (method === 'DELETE') {
      products = products.filter(p => p.id !== id);
      return route.fulfill({ status: 204 });
    }
    return route.abort();
  });
}

test('create, view, edit, confirm and delete a product', async ({ page }) => {
  await mockApi(page, []);
  await page.goto('/');
  await expect(page.getByText('Your catalog starts here')).toBeVisible();
  await page.getByRole('button', { name: 'Add product', exact: true }).click();
  await page.getByLabel('Product name').fill('Integration desk lamp');
  await page.getByLabel('Price (INR)').fill('149.90');
  await page.getByLabel('Quantity', { exact: false }).fill('4');
  await page.getByLabel('Category', { exact: false }).selectOption('Workspace');
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
  await page.getByRole('textbox', { name: 'Search products by name' }).fill('no-such-product');
  await expect(page.getByText('No matching products')).toBeVisible();
  await page.getByRole('button', { name: 'Clear search', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Studio wireless headphones', exact: true })).toBeVisible();
});

test('invalid form fields stay editable and do not submit', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Add product', exact: true }).click();
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
  await page.getByRole('button', { name: 'Add product', exact: true }).click();
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
  await page.screenshot({ path: '../docs/screenshots/products-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Add product', exact: true }).click();
  await page.getByLabel('Product name').fill('Portable reading light');
  await page.getByLabel('Price (INR)').fill('799.00');
  await page.getByLabel('Quantity', { exact: false }).fill('12');
  await page.getByLabel('Category', { exact: false }).selectOption('Workspace');
  await page.getByLabel('Image URL', { exact: true }).fill('https://catalog.stockroom.test/product-2.svg');
  await expect(page.getByRole('dialog').getByRole('img', { name: 'Portable reading light' })).toBeVisible();
  await page.screenshot({ path: '../docs/screenshots/product-form.png' });
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'View Studio wireless headphones' }).click();
  await expect(page.getByRole('heading', { name: 'Studio wireless headphones' })).toBeVisible();
  await page.screenshot({ path: '../docs/screenshots/product-details.png' });
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Delete Studio wireless headphones' }).click();
  await page.screenshot({ path: '../docs/screenshots/delete-confirmation.png' });
});

test('mobile page stays within the viewport and form is usable', async ({ page }) => {
  await mockApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Studio wireless headphones', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: '../docs/screenshots/products-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Add product', exact: true }).click();
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
  await expect(page.getByLabel('Category', { exact: false })).toHaveValue('Electronics');
  await expect(page.getByLabel('Image URL', { exact: true })).toHaveValue('https://catalog.stockroom.test/product-0.svg');
  expect(patches[0]).toEqual({ description: 'Keep this revised description.', quantity: 8 });
  await page.screenshot({ path: '../docs/screenshots/edit-validation-error.png' });
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