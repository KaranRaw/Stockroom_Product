export interface Product {
  id: number;
  name: string;
  description: string | null;
  price: string;
  quantity: number;
  category: string | null;
  image_url: string | null;
  created_at: string;
}
export type ProductInput = Pick<Product, 'name' | 'description' | 'price' | 'quantity' | 'category' | 'image_url'>;
export type ProductPatch = Partial<ProductInput>;
export interface ProductPage { items: Product[]; total: number; page: number; page_size: number }
export interface Stats { products: number; units: number; value: string; low_stock: number }
export interface FieldError { field: string; message: string }

export class ApiError extends Error {
  constructor(message: string, public status: number, public details: FieldError[] = []) { super(message); }
}

const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(base + path, {
      ...options,
      headers: { ...(options?.body ? { 'Content-Type': 'application/json' } : {}), ...options?.headers },
    });
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(body?.error?.message || 'The request could not be completed.',
      response.status, body?.error?.details || []);
  }
  return response.status === 204 ? undefined as T : response.json();
}

export const api = {
  list: (search: string, page: number, pageSize = 10) =>
    request<ProductPage>('/api/products?' + new URLSearchParams({ search, page: String(page), page_size: String(pageSize) })),
  stats: () => request<Stats>('/api/products/stats'),
  get: (id: number) => request<Product>(`/api/products/${id}`),
  create: (data: ProductInput) => request<Product>('/api/products', { method: 'POST', body: JSON.stringify(data) }),
  replace: (id: number, data: ProductInput) => request<Product>(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  patch: (id: number, data: ProductPatch) => request<Product>(`/api/products/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: number) => request<void>(`/api/products/${id}`, { method: 'DELETE' }),
};
