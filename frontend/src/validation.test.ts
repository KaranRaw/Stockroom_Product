import { describe, expect, it } from 'vitest';
import { validate, type FormValues } from './validation';

const valid: FormValues = { name: 'Lamp', description: '', price: '149.90', quantity: '4', category: '', image_url: '' };
describe('product form validation', () => {
  it('accepts zero stock and zero prices', () => {
    expect(validate({ ...valid, price: '0.00', quantity: '0' })).toEqual({});
  });
  it('requires a nonblank product name', () => {
    expect(validate({ ...valid, name: '   ' }).name).toBeTruthy();
  });
  it.each(['-1', '1.001', 'NaN', '', '10000000000', '1e2'])('rejects invalid price %s', price => {
    expect(validate({ ...valid, price }).price).toBeTruthy();
  });
  it.each(['-1', '1.1', '', '2147483648', '1e2'])('rejects invalid quantity %s', quantity => {
    expect(validate({ ...valid, quantity }).quantity).toBeTruthy();
  });
  it('accepts the database boundary values', () => {
    expect(validate({ ...valid, price: '9999999999.99', quantity: '2147483647' })).toEqual({});
  });
  it('checks text field lengths', () => {
    const result = validate({ ...valid, name: 'x'.repeat(201), category: 'x'.repeat(101), description: 'x'.repeat(5001) });
    expect(Object.keys(result)).toEqual(['name', 'category', 'description']);
  });
});
