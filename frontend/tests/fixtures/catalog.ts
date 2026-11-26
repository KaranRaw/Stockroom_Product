import type { Page } from '@playwright/test';
import { resolve } from 'node:path';
import type { Category, Product } from '../../src/api';

export function fixtures(): Product[] {
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

export async function mockApi(page: Page, initial = fixtures(), afterDelete?: () => Promise<void>) {
  type StoredProduct = Product & { is_deleted: boolean };
  let products: StoredProduct[] = structuredClone(initial).map(product => ({ ...product, is_deleted: false }));
  const publicProduct = ({ is_deleted: _deleted, ...product }: StoredProduct): Product => product;
  let nextId = 100;
  let nextCategoryId = 10;
  const categoryNames = ['Electronics', 'Workspace', 'Home & living', 'Accessories', 'Stationery'];
  const categories: Category[] = categoryNames.map((name, index) => ({ id: index + 1, name, created_at: '2026-01-01T00:00:00Z' }));
  function saveCategory(name: string): Category {
    const normalized = name.trim().replace(/\s+/g, ' ');
    const existing = categories.find(category => category.name.toLowerCase() === normalized.toLowerCase());
    if (existing) return existing;
    const category = { id: nextCategoryId++, name: normalized, created_at: new Date().toISOString() };
    categories.push(category);
    return category;
  }
  for (const product of products) if (product.category) product.category = saveCategory(product.category).name;
  await page.route('https://catalog.stockroom.test/**', route => route.fulfill({ path: resolve('tests/fixtures/images/' + new URL(route.request().url()).pathname.split('/').pop()!) }));
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const active = products.filter(product => !product.is_deleted);
    if (url.pathname === '/api/categories' && method === 'GET') {
      return route.fulfill({ json: [...categories].sort((a, b) => a.name.localeCompare(b.name)) });
    }
    if (url.pathname === '/api/categories' && method === 'POST') {
      const name = route.request().postDataJSON().name;
      if (typeof name !== 'string' || !name.trim() || name.trim().length > 100)
        return route.fulfill({ status: 422, json: { error: { message: 'Invalid category name', details: [{ field: 'name', message: 'Enter a category name.' }] } } });
      const before = categories.length;
      const category = saveCategory(name);
      return route.fulfill({ status: categories.length === before ? 200 : 201, json: category });
    }
    if (url.pathname === '/api/products/stats') {
      return route.fulfill({ json: { products: active.length, units: active.reduce((n, p) => n + p.quantity, 0),
        value: active.reduce((n, p) => n + Number(p.price) * p.quantity, 0).toFixed(2),
        low_stock: active.filter(p => p.quantity <= 5).length } });
    }
    if (url.pathname === '/api/products' && method === 'GET') {
      const filtered = active.filter(p => p.name.toLowerCase().includes((url.searchParams.get('search') || '').toLowerCase()));
      const pageNumber = Number(url.searchParams.get('page') || 1);
      const pageSize = Number(url.searchParams.get('page_size') || 10);
      return route.fulfill({ json: { items: filtered.slice((pageNumber - 1) * pageSize, pageNumber * pageSize).map(publicProduct), total: filtered.length, page: pageNumber, page_size: pageSize } });
    }
    if (url.pathname === '/api/products' && method === 'POST') {
      const product = { ...route.request().postDataJSON(), id: nextId++, created_at: new Date().toISOString(), is_deleted: false };
      if (product.category) product.category = saveCategory(product.category).name;
      products = [product, ...products];
      return route.fulfill({ status: 201, json: publicProduct(product) });
    }
    const id = Number(url.pathname.split('/').pop());
    const product = active.find(p => p.id === id);
    if (!product) return route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND', message: 'Product not found', details: [] } } });
    if (method === 'GET') return route.fulfill({ json: publicProduct(product) });
    if (method === 'PUT' || method === 'PATCH') {
      const input = route.request().postDataJSON();
      if (input.category) input.category = saveCategory(input.category).name;
      Object.assign(product, input);
      return route.fulfill({ json: publicProduct(product) });
    }
    if (method === 'DELETE') {
      product.is_deleted = true;
      await afterDelete?.();
      return route.fulfill({ status: 204 });
    }
    return route.abort();
  });
  return { records: () => structuredClone(products) };
}
