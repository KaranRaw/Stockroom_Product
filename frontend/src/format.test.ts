import { expect, it } from 'vitest';
import { formatMoney } from './format';

it.each([
  ['0', '₹0.00'],
  ['0.10', '₹0.10'],
  ['3499.9', '₹3,499.90'],
  ['270755.00', '₹2,70,755.00'],
  ['9007199254740993.99', '₹9,00,71,99,25,47,40,993.99'],
])('formats exact INR amounts without floating-point loss: %s', (amount, expected) => {
  expect(formatMoney(amount)).toBe(expected);
});
