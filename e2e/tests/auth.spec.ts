import { test, expect } from '@playwright/test';

const apiURL = process.env.PLAYWRIGHT_API_URL;

test.describe('auth + view mode middleware', () => {
  test.skip(!apiURL, 'PLAYWRIGHT_API_URL is required for auth specs');

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
