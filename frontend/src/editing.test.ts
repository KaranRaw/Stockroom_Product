import { describe, expect, it } from 'vitest';
import { changedFields, validImageUrl, toInput, validate, type FormValues } from './validation';

const values: FormValues = { name: 'Lamp', description: 'Warm light', price: '149.90',
  quantity: '4', category: 'Workspace', image_url: 'https://bucket.s3.amazonaws.com/lamp.jpg' };

describe('partial edits', () => {
  it('sends only a changed quantity', () => {
    expect(changedFields(toInput(values), toInput({ ...values, quantity: '10' }))).toEqual({ quantity: 10 });
  });
  it('clears optional values with null and preserves unedited fields', () => {
    expect(changedFields(toInput(values), toInput({ ...values, image_url: '', description: '' })))
      .toEqual({ description: null, image_url: null });
  });
  it('does not treat price formatting as a change', () => {
    expect(changedFields(toInput(values), toInput({ ...values, price: '149.9' }))).toEqual({});
  });
});

describe('image URL validation', () => {
  it.each(['https://example.com/product.jpg', 'https://bucket.s3.amazonaws.com/item.png?signature=abc'])
    ('accepts HTTPS URLs: %s', value => expect(validImageUrl(value)).toBe(true));
  it.each(['http://example.com/a.jpg', 'javascript:alert(1)', 'data:image/png;base64,abc',
    'https://', 'https://user:password@example.com/a.jpg', 'https://example.com/a b.jpg',
    'https://example.com:99999/a.jpg', 'not a URL'])
    ('rejects invalid image URL: %s', value => expect(validImageUrl(value)).toBe(false));
  it('makes the image field optional', () => {
    expect(validate({ ...values, image_url: '' })).toEqual({});
  });
});
