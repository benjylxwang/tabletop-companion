import { test, expect, type ConsoleMessage } from '@playwright/test';

// Regression test for the blank-page bug caused by a Rules-of-Hooks violation
// in Layout.tsx when toggling between /campaigns and /campaigns/:id client-side.
// The double `useMatch(...) ?? useMatch(...)` short-circuited the second call
// whenever the URL matched the first pattern, so Layout's hook count flipped
// between the list (2) and the detail (1) and React tore the tree down — blanking the page.

test.describe('Campaigns list ↔ detail client-side navigation', () => {
  test('round-tripping between list and detail does not blank the page', async ({ page }) => {
    const hookErrors: string[] = [];
    page.on('console', (msg: ConsoleMessage) => {
      const text = msg.text();
      if (msg.type() === 'error' && /Rendered (fewer|more) hooks/i.test(text)) {
        hookErrors.push(text);
      }
    });

    // 1. Start on a campaign detail — Layout mounts with the splat useMatch matching.
    await page.goto('/campaigns/test-id');
    await expect(page.getByRole('link', { name: 'Sessions' })).toBeVisible();

    // 2. Client-side nav back to the list via the sidebar NavLink (no reload).
    await page.getByRole('link', { name: 'Campaigns' }).click();
    await expect(page).toHaveURL(/\/campaigns$/);
    await expect(page.getByRole('heading', { name: 'Campaigns' })).toBeVisible();

    // 3. Client-side nav back to the detail via browser history (popstate -> React Router).
    await page.goBack();
    await expect(page).toHaveURL(/\/campaigns\/test-id$/);
    await expect(page.getByRole('link', { name: 'Sessions' })).toBeVisible();

    // 4. Forward to the list again — this is the re-selection that previously blanked.
    await page.goForward();
    await expect(page).toHaveURL(/\/campaigns$/);
    await expect(page.getByRole('heading', { name: 'Campaigns' })).toBeVisible();

    expect(hookErrors, 'React should not log Rules-of-Hooks errors').toEqual([]);
  });
});
