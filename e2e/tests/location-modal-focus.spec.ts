import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { TEST_USER_FILE } from '../setup/paths';
import type { TestUser } from '../setup/testUser';

// Regression for the "typing defocuses the input" bug in the locations create
// modal. Root cause was Modal.tsx's focus-trap effect depending on `onClose`;
// CreateLocationModal wraps onClose in a local `handleClose` that is rebuilt
// every render, so every keystroke re-ran the effect and punted focus to the
// ✕ close button in the header.

const apiURL = process.env.PLAYWRIGHT_API_URL;
const supabaseUrl = process.env.PLAYWRIGHT_SUPABASE_URL;
const supabaseAnonKey = process.env.PLAYWRIGHT_SUPABASE_ANON_KEY;

test.describe('Create Location modal — keyboard focus', () => {
  test.skip(
    !apiURL || !supabaseUrl || !supabaseAnonKey,
    'API/Supabase env vars required for UI bootstrap',
  );

  let campaignId: string;

  test.beforeAll(async ({ request }) => {
    // Reuse the user that globalSetup already authenticated in storageState,
    // so the browser session can see the campaign we create here.
    const user = JSON.parse(readFileSync(TEST_USER_FILE, 'utf-8')) as TestUser;

    const tokenRes = await request.post(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      headers: { apikey: supabaseAnonKey!, 'Content-Type': 'application/json' },
      data: { email: user.email, password: user.password },
    });
    expect(tokenRes.ok()).toBeTruthy();
    const token = ((await tokenRes.json()) as { access_token: string }).access_token;

    const createRes = await request.post(`${apiURL}/api/campaigns`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: 'Modal Focus Regression', status: 'Active' },
    });
    expect(createRes.status()).toBe(201);
    campaignId = ((await createRes.json()) as { campaign: { id: string } }).campaign.id;
  });

  test('typing in the Name field keeps focus on that field', async ({ page }) => {
    await page.goto(`/campaigns/${campaignId}/locations`);

    await page.getByRole('button', { name: 'New Location' }).click();

    const nameInput = page.getByLabel('Name');
    await expect(nameInput).toBeVisible();
    await nameInput.click();

    const typed = 'Phandalin';
    await page.keyboard.type(typed, { delay: 15 });

    await expect(nameInput).toHaveValue(typed);
    await expect(nameInput).toBeFocused();
  });
});
