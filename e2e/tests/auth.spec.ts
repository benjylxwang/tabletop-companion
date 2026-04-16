import { test, expect, request } from '@playwright/test';

const apiURL = process.env.PLAYWRIGHT_API_URL;

test.describe('auth + view mode middleware', () => {
  test.skip(!apiURL, 'PLAYWRIGHT_API_URL is required for auth specs');

  test('GET /health is public (no token required)', async () => {
    const ctx = await request.newContext({ baseURL: apiURL });
    const res = await ctx.get('/health');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  test('GET /api/campaigns without token returns 401', async () => {
    const ctx = await request.newContext({ baseURL: apiURL });
    const res = await ctx.get('/api/campaigns');
    expect(res.status()).toBe(401);
  });

  test('GET /api/campaigns with invalid token returns 401', async () => {
    const ctx = await request.newContext({
      baseURL: apiURL,
      extraHTTPHeaders: { Authorization: 'Bearer not-a-real-token' },
    });
    const res = await ctx.get('/api/campaigns');
    expect(res.status()).toBe(401);
  });
});
