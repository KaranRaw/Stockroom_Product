import type { Page } from '@playwright/test';

// Exercise the visible searchable control, including its filtering and selection.
export async function selectCategory(page: Page, name: string) {
  const picker = page.getByRole('combobox', { name: /^Category/ });
  if (await picker.getAttribute('aria-expanded') !== 'true') await picker.click();
  await picker.fill(name === 'Custom category…' || name === 'No category' ? '' : name);
  await page.getByRole('option', { name, exact: true }).click();
}
