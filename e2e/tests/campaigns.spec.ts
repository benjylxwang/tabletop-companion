import { test, expect } from '@playwright/test';

const apiURL = process.env.PLAYWRIGHT_API_URL;
const supabaseUrl = process.env.PLAYWRIGHT_SUPABASE_URL;
const supabaseAnonKey = process.env.PLAYWRIGHT_SUPABASE_ANON_KEY;

// ─── Auth setup ───────────────────────────────────────────────────────────────

let token: string;
let createdCampaignId: string;

// Use a unique email per test run so sign-up always succeeds
const testEmail = `e2e-${Date.now()}@example.com`;
const testPassword = 'E2eTestPass1!';

test.describe('Campaign CRUD (API)', () => {
  test.skip(!apiURL || !supabaseUrl || !supabaseAnonKey, 'API/Supabase env vars required');

  test.beforeAll(async ({ request }) => {
    // Sign up a fresh test user and get a session token
    const res = await request.post(`${supabaseUrl}/auth/v1/signup`, {
      headers: { apikey: supabaseAnonKey!, 'Content-Type': 'application/json' },
      data: { email: testEmail, password: testPassword },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    token = (body as { access_token: string }).access_token;
    expect(token).toBeTruthy();
  });

  test('POST /api/campaigns creates a campaign with DM role', async ({ request }) => {
    const res = await request.post(`${apiURL}/api/campaigns`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: 'E2E Test Campaign', status: 'Active' },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.campaign.name).toBe('E2E Test Campaign');
    expect(body.campaign.my_role).toBe('dm');
    expect(body.campaign.id).toBeTruthy();
    createdCampaignId = body.campaign.id as string;
  });

  test('GET /api/campaigns lists the created campaign', async ({ request }) => {
    const res = await request.get(`${apiURL}/api/campaigns`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const ids = (body.campaigns as { id: string }[]).map((c) => c.id);
    expect(ids).toContain(createdCampaignId);
  });

  test('GET /api/campaigns/:id returns campaign with DM role', async ({ request }) => {
    const res = await request.get(`${apiURL}/api/campaigns/${createdCampaignId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.campaign.my_role).toBe('dm');
    expect(body.campaign.id).toBe(createdCampaignId);
  });

  test('GET /api/campaigns/:id?view=player strips dm_notes', async ({ request }) => {
    // First set dm_notes
    await request.put(`${apiURL}/api/campaigns/${createdCampaignId}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { dm_notes: 'secret notes' },
    });

    const res = await request.get(`${apiURL}/api/campaigns/${createdCampaignId}?view=player`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { campaign: Record<string, unknown> };
    expect(body.campaign.dm_notes).toBeUndefined();
  });

  test('PUT /api/campaigns/:id updates the campaign', async ({ request }) => {
    const res = await request.put(`${apiURL}/api/campaigns/${createdCampaignId}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: 'Updated E2E Campaign' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.campaign.name).toBe('Updated E2E Campaign');
  });

  test('DELETE /api/campaigns/:id returns 204', async ({ request }) => {
    const res = await request.delete(`${apiURL}/api/campaigns/${createdCampaignId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(204);
  });

  test('GET /api/campaigns after delete does not include deleted campaign', async ({ request }) => {
    const res = await request.get(`${apiURL}/api/campaigns`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const ids = (body.campaigns as { id: string }[]).map((c) => c.id);
    expect(ids).not.toContain(createdCampaignId);
  });
});

test.describe('Campaign permission model (API)', () => {
  test.skip(!apiURL || !supabaseUrl || !supabaseAnonKey, 'API/Supabase env vars required');

  test('Non-member GET /api/campaigns/:id returns 404', async ({ request }) => {
    // Use a different test user who is not a member
    const email2 = `e2e-other-${Date.now()}@example.com`;
    const signupRes = await request.post(`${supabaseUrl}/auth/v1/signup`, {
      headers: { apikey: supabaseAnonKey!, 'Content-Type': 'application/json' },
      data: { email: email2, password: testPassword },
    });
    const otherToken = ((await signupRes.json()) as { access_token: string }).access_token;

    // Create a campaign as the first user
    const createRes = await request.post(`${apiURL}/api/campaigns`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: 'Permission Test Campaign', status: 'Active' },
    });
    const campaignId = ((await createRes.json()) as { campaign: { id: string } }).campaign.id;

    // Try to access as the other user
    const res = await request.get(`${apiURL}/api/campaigns/${campaignId}`, {
      headers: { Authorization: `Bearer ${otherToken}` },
    });
    expect(res.status()).toBe(404);

    // Cleanup
    await request.delete(`${apiURL}/api/campaigns/${campaignId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  });

  test.skip('Player role PUT /api/campaigns/:id returns 403', async () => {
    // Requires member management (#44) to add a second user as player
    // Will be un-skipped after #44 is merged
  });
});

test.describe('Campaign list page (UI)', () => {
  test('renders and redirects to /login when unauthenticated', async ({ page }) => {
    await page.goto('/campaigns');
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
  });
});
