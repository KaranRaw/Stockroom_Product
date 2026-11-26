import { describe, expect, it } from 'vitest';
import type { Product, ProductPage } from './api';
import { removeFromPage, removeFromStats } from './cache';

const product: Product = { id: 2, name: 'Studio headphones', price: '0.10', quantity: 3,
  description: null, category: null, image_url: null, created_at: '2026-01-01T00:00:00Z' };
const page: ProductPage = { items: [product], total: 11, page: 2, page_size: 10 };

describe('confirmed delete cache updates', () => {
  it('removes the row and decrements the total without mutating the old result', () => {
    expect(removeFromPage(page, product, '')).toEqual({ ...page, items: [], total: 10 });
    expect(page.items).toHaveLength(1);
  });
  it('updates totals on other pages of a matching search', () => {
    expect(removeFromPage({ ...page, items: [] }, product, ' HEADPHONES ').total).toBe(10);
  });
  it('leaves unrelated search results untouched', () => {
    const unrelated = { ...page, items: [] };
    expect(removeFromPage(unrelated, product, 'notebook')).toBe(unrelated);
  });
  it('subtracts decimal prices exactly', () => {
    expect(removeFromStats({ products: 2, units: 5, value: '0.50', low_stock: 2 }, product))
      .toEqual({ products: 1, units: 2, value: '0.20', low_stock: 1 });
  });
  it('preserves precision for values above the JavaScript safe integer range', () => {
    expect(removeFromStats({ products: 2, units: 5, value: '999999999999999999.99', low_stock: 2 }, product).value)
      .toBe('999999999999999999.69');
  });
  it('does not count healthy stock as low stock', () => {
    expect(removeFromStats({ products: 2, units: 50, value: '10.00', low_stock: 1 },
      { ...product, quantity: 10 }).low_stock).toBe(1);
  });
  it('never displays negative counts for an out-of-date summary', () => {
    expect(removeFromStats({ products: 0, units: 0, value: '0', low_stock: 0 }, product))
      .toEqual({ products: 0, units: 0, value: '0.00', low_stock: 0 });
  });
});

it('does not subtract twice from a fresh response that already hides the deleted row', () => {
  const fresh = { ...page, items: [], total: 10 };
  expect(removeFromPage(fresh, product, 'headphones', false)).toBe(fresh);
});

it('still removes a deleted row explicitly present in a newly arrived response', () => {
  expect(removeFromPage(page, product, 'headphones', false)).toEqual({ ...page, items: [], total: 10 });
});
