import { test, expect } from '@playwright/test';

test.describe('Sidebar navigation', () => {
  test('campaigns link is visible in sidebar', async ({ page }) => {
    await page.goto('/campaigns');
    await expect(page.getByRole('link', { name: 'Campaigns' })).toBeVisible();
  });

  test('navigating to /campaigns shows Campaigns heading', async ({ page }) => {
    await page.goto('/campaigns');
    await expect(page.getByRole('heading', { name: 'Campaigns' })).toBeVisible();
  });

  test('campaign entity nav links appear on campaign route', async ({ page }) => {
    // Navigate to a campaign sub-route (the API won't return data in E2E
    // but the layout and sidebar should still render)
    await page.goto('/campaigns/test-id');

    for (const label of ['Sessions', 'Characters', 'NPCs', 'Locations', 'Factions', 'Lore']) {
      await expect(page.getByRole('link', { name: label })).toBeVisible();
    }
  });

  test('entity sub-routes render without crashing', async ({ page }) => {
    const routes = [
      '/campaigns/test-id/sessions',
      '/campaigns/test-id/characters',
      '/campaigns/test-id/npcs',
      '/campaigns/test-id/locations',
      '/campaigns/test-id/factions',
      '/campaigns/test-id/lore',
    ];

    for (const route of routes) {
      await page.goto(route);
      // Each stub page renders an h1 matching its section name
      await expect(page.locator('h1')).toBeVisible();
    }
  });
});

test.describe('DM/Player view toggle', () => {
  test('toggle is NOT visible on /campaigns list (no campaign context)', async ({ page }) => {
    await page.goto('/campaigns');
    await expect(page.getByRole('button', { name: 'DM' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Player' })).not.toBeVisible();
  });
});
