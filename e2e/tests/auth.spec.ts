import { test, expect } from '@playwright/test';
import { adminClient, createConfirmedUser, deleteUser, type TestUser } from '../setup/testUser';

const apiURL = process.env.PLAYWRIGHT_API_URL;

// ─── API middleware smoke tests (no UI) ──────────────────────────────────────

test.describe('API auth middleware', () => {
  test.skip(!apiURL, 'PLAYWRIGHT_API_URL is required for API auth specs');

  test('GET /health is public (no token required)', async ({ request }) => {
    const res = await request.get(`${apiURL}/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  test('GET /api/campaigns without token returns 401', async ({ request }) => {
    const res = await request.get(`${apiURL}/api/campaigns`);
    expect(res.status()).toBe(401);
  });

  test('GET /api/campaigns with invalid token returns 401', async ({ request }) => {
    const res = await request.get(`${apiURL}/api/campaigns`, {
      headers: { Authorization: 'Bearer not-a-real-token' },
    });
    expect(res.status()).toBe(401);
  });
});

// ─── UI flow tests ───────────────────────────────────────────────────────────

test.describe('Auth UI flow', () => {
  // Start without the shared storage state so we exercise login from scratch.
  test.use({ storageState: { cookies: [], origins: [] } });

  let user: TestUser;

  test.beforeAll(async () => {
    user = await createConfirmedUser(adminClient());
  });

  test.afterAll(async () => {
    await deleteUser(adminClient(), user.id);
  });

  test('unauthenticated visit to /campaigns redirects to /login', async ({ page }) => {
    await page.goto('/campaigns');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
  });

  test('user can log in and reach the campaigns page', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Password').fill(user.password);
    await page.getByRole('button', { name: /sign in/i }).click();

    await page.waitForURL('**/campaigns');
    await expect(page.getByRole('heading', { name: 'Campaigns' })).toBeVisible();
  });

  test('sign out returns user to /login', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Password').fill(user.password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/campaigns');

    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.waitForURL('**/login');
    await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
  });

  test('bad password surfaces an error', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Password').fill('wrong-password');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});
