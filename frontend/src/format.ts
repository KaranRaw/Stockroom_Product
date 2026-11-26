const integerRupees = new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0,
});

/** API money amounts are non-negative decimal strings, never floating-point values. */
export function formatMoney(amount: string): string {
  const [whole, fraction = ''] = amount.split('.');
  return integerRupees.format(BigInt(whole)) + '.' + fraction.padEnd(2, '0');
}
