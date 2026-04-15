import { test, expect } from '@playwright/test';

test('homepage shows Tabletop Companion heading', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Tabletop Companion' })).toBeVisible();
});

test('API status shows ok', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/API status:\s*ok/)).toBeVisible({ timeout: 10_000 });
});

test('page title is Tabletop Companion', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Tabletop Companion');
});
