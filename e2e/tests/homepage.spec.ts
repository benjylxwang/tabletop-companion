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
  await expect(page.getByAltText('Tabletop Companion').first()).toBeVisible();
});
