import { test, expect } from '@playwright/test';

test('root redirects to /campaigns', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/campaigns/);
});

test('page title is Tabletop Companion', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Tabletop Companion');
});

test('sidebar brand is visible', async ({ page }) => {
  await page.goto('/campaigns');
  // Brand is two SVG images (icon + wordmark), both with alt="Tabletop Companion"
  await expect(page.getByRole('img', { name: 'Tabletop Companion' }).first()).toBeVisible();
});
