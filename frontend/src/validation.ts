import type { ProductInput, ProductPatch } from './api';

export interface FormValues {
  name: string; description: string; price: string; quantity: string; category: string; image_url: string;
}
export type FormErrors = Partial<Record<keyof FormValues, string>>;

export function validImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return value.length <= 2048 && value.startsWith('https://') &&
      url.protocol === 'https:' && !!url.hostname && !url.username && !url.password &&
      !/\s|\\/.test(value) && (!url.port || Number(url.port) > 0);
  } catch { return false; }
}

export function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {};
  if (!values.name.trim()) errors.name = 'Enter a product name.';
  else if (values.name.trim().length > 200) errors.name = 'Use 200 characters or fewer.';
  if (!/^(?:0|[0-9]{1,10})(?:\.[0-9]{1,2})?$/.test(values.price) || Number(values.price) > 9999999999.99)
    errors.price = 'Enter a price from 0 to 9,999,999,999.99, with up to 2 decimal places.';
  if (!/^\d+$/.test(values.quantity) || Number(values.quantity) > 2147483647)
    errors.quantity = 'Enter units as a whole number from 0 to 2,147,483,647.';
  if (values.category.trim().length > 100) errors.category = 'Use 100 characters or fewer.';
  if (values.description.trim().length > 5000) errors.description = 'Use 5,000 characters or fewer.';
  if (values.image_url.trim() && !validImageUrl(values.image_url.trim()))
    errors.image_url = 'Use a public HTTPS image URL, up to 2,048 characters, without embedded credentials.';
  return errors;
}

export function toInput(values: FormValues): ProductInput {
  return {
    name: values.name.trim(), description: values.description.trim() || null,
    price: values.price, quantity: Number(values.quantity), category: values.category.trim() || null,
    image_url: values.image_url.trim() || null,
  };
}

export function changedFields(original: ProductInput, next: ProductInput): ProductPatch {
  const patch: ProductPatch = {};
  for (const key of Object.keys(next) as (keyof ProductInput)[]) {
    const same = key === 'price' ? Number(original.price) === Number(next.price) : original[key] === next[key];
    if (!same) Object.assign(patch, { [key]: next[key] });
  }
  return patch;
}
