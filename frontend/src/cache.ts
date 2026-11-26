import type { Product, ProductPage, Stats } from './api';

/** Update cached results only after the API confirms deletion. */
export function removeFromPage(page: ProductPage, product: Product, search: string, knownBeforeDelete = true): ProductPage {
  const contains = page.items.some(item => item.id === product.id);
  const matches = knownBeforeDelete && product.name.toLowerCase().includes(search.trim().toLowerCase());
  if (!contains && !matches) return page;
  return {
    ...page,
    items: page.items.filter(item => item.id !== product.id),
    total: Math.max(0, page.total - 1),
  };
}

function minorUnits(amount: string): bigint {
  const [whole, fraction = ''] = amount.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}

export function removeFromStats(stats: Stats, product: Product): Stats {
  const remaining = minorUnits(stats.value) - minorUnits(product.price) * BigInt(product.quantity);
  const safe = remaining < 0n ? 0n : remaining;
  return {
    products: Math.max(0, stats.products - 1),
    units: Math.max(0, stats.units - product.quantity),
    value: (safe / 100n).toString() + '.' + (safe % 100n).toString().padStart(2, '0'),
    low_stock: Math.max(0, stats.low_stock - (product.quantity <= 5 ? 1 : 0)),
  };
}
