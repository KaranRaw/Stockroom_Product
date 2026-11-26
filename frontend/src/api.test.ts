import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from './api';

afterEach(() => vi.unstubAllGlobals());
describe('API client', () => {
  it('encodes search and pagination', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [], total: 0, page: 2, page_size: 10 })));
    vi.stubGlobal('fetch', fetch);
    await api.list('lamp & desk', 2);
    expect(fetch.mock.calls[0][0]).toBe('/api/products?search=lamp+%26+desk&page=2&page_size=10');
  });
  it('does not parse the empty delete response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    expect(await api.remove(2)).toBeUndefined();
  });
  it('retains structured validation details', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { message: 'Invalid fields', details: [{ field: 'name', message: 'Required' }] },
    }), { status: 422 })));
    await expect(api.get(1)).rejects.toMatchObject({ status: 422, details: [{ field: 'name', message: 'Required' }] });
  });
  it('makes network errors readable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Network failure')));
    await expect(api.get(1)).rejects.toBeInstanceOf(ApiError);
    await expect(api.get(1)).rejects.toThrow('Cannot reach the server');
  });
});

it('PATCH sends only the supplied edit fields', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 1, quantity: 9 })));
  vi.stubGlobal('fetch', fetch);
  await api.patch(1, { quantity: 9 });
  expect(fetch.mock.calls[0][1].method).toBe('PATCH');
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ quantity: 9 });
});
it('preserves cancellation instead of displaying a network failure', async () => {
  const controller = new AbortController();
  controller.abort();
  const aborted = new DOMException('The request was aborted', 'AbortError');
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(aborted));
  await expect(api.list('', 1, 10, controller.signal)).rejects.toBe(aborted);
});

it('loads shared categories from the backend', async () => {
  const categories = [{ id: 1, name: 'Smartphone', created_at: '2026-01-01T00:00:00Z' }];
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(categories)));
  vi.stubGlobal('fetch', fetch);
  expect(await api.categories()).toEqual(categories);
  expect(fetch.mock.calls[0][0]).toBe('/api/categories');
});

it('accepts the existing-category response when creating a duplicate', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 1, name: 'Smartphone' }), { status: 200 }));
  vi.stubGlobal('fetch', fetch);
  expect((await api.createCategory('smartphone')).name).toBe('Smartphone');
  expect(fetch.mock.calls[0][1].method).toBe('POST');
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ name: 'smartphone' });
});
