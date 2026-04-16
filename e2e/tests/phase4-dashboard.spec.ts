import { test, expect } from '@playwright/test';

const apiURL = process.env.PLAYWRIGHT_API_URL;
const supabaseUrl = process.env.PLAYWRIGHT_SUPABASE_URL;
const supabaseAnonKey = process.env.PLAYWRIGHT_SUPABASE_ANON_KEY;

let dmToken: string;
let campaignId: string;

const dmEmail = `e2e-dashboard-${Date.now()}@example.com`;
const testPassword = 'E2eTestPass1!';

test.describe('Campaign dashboard / overview (API)', () => {
  test.skip(!apiURL || !supabaseUrl || !supabaseAnonKey, 'API/Supabase env vars required');

  test.beforeAll(async ({ request }) => {
    const dmRes = await request.post(`${supabaseUrl}/auth/v1/signup`, {
      headers: { apikey: supabaseAnonKey!, 'Content-Type': 'application/json' },
      data: { email: dmEmail, password: testPassword },
    });
    expect(dmRes.ok()).toBeTruthy();
    dmToken = ((await dmRes.json()) as { access_token: string }).access_token;

    const campaignRes = await request.post(`${apiURL}/api/campaigns`, {
      headers: { Authorization: `Bearer ${dmToken}` },
      data: { name: 'Dashboard E2E Campaign', status: 'Active' },
    });
    expect(campaignRes.status()).toBe(201);
    campaignId = ((await campaignRes.json()) as { campaign: { id: string } }).campaign.id;

    // Seed some content
    await request.post(`${apiURL}/api/campaigns/${campaignId}/sessions`, {
      headers: { Authorization: `Bearer ${dmToken}` },
      data: { title: 'The Beginning', date_played: '2026-01-01', campaign_id: campaignId, session_number: 1 },
    });
    await request.post(`${apiURL}/api/campaigns/${campaignId}/npcs`, {
      headers: { Authorization: `Bearer ${dmToken}` },
      data: { name: 'The Mayor', status: 'Alive' },
    });
    await request.post(`${apiURL}/api/campaigns/${campaignId}/locations`, {
      headers: { Authorization: `Bearer ${dmToken}` },
      data: { name: 'Town Square', campaign_id: campaignId },
    });
    await request.post(`${apiURL}/api/campaigns/${campaignId}/factions`, {
      headers: { Authorization: `Bearer ${dmToken}` },
      data: { name: 'The Town Council', campaign_id: campaignId },
    });
    await request.post(`${apiURL}/api/campaigns/${campaignId}/lore`, {
      headers: { Authorization: `Bearer ${dmToken}` },
      data: { title: 'Town History', category: 'History', visibility: 'Public', campaign_id: campaignId },
    });
  });

  test.afterAll(async ({ request }) => {
    if (apiURL && dmToken && campaignId) {
      await request.delete(`${apiURL}/api/campaigns/${campaignId}`, {
        headers: { Authorization: `Bearer ${dmToken}` },
      });
    }
  });

  test('overview endpoint returns all required sections', async ({ request }) => {
    const res = await request.get(`${apiURL}/api/campaigns/${campaignId}/overview`, {
      headers: { Authorization: `Bearer ${dmToken}` },
    });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as {
      overview: {
        recent_sessions: unknown[];
        characters: unknown[];
        key_npcs: unknown[];
        locations: unknown[];
        factions: unknown[];
        stats: {
          sessions: number;
          characters: number;
          npcs: number;
          locations: number;
          factions: number;
          lore: number;
        };
      };
    };
    expect(Array.isArray(body.overview.recent_sessions)).toBeTruthy();
    expect(Array.isArray(body.overview.key_npcs)).toBeTruthy();
    expect(Array.isArray(body.overview.locations)).toBeTruthy();
    expect(Array.isArray(body.overview.factions)).toBeTruthy();
    expect(body.overview.stats.sessions).toBeGreaterThanOrEqual(1);
    expect(body.overview.stats.npcs).toBeGreaterThanOrEqual(1);
    expect(body.overview.stats.locations).toBeGreaterThanOrEqual(1);
    expect(body.overview.stats.factions).toBeGreaterThanOrEqual(1);
    expect(body.overview.stats.lore).toBeGreaterThanOrEqual(1);
  });

  test('overview recent_sessions contains seeded session', async ({ request }) => {
    const res = await request.get(`${apiURL}/api/campaigns/${campaignId}/overview`, {
      headers: { Authorization: `Bearer ${dmToken}` },
    });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { overview: { recent_sessions: Array<{ title: string }> } };
    const titles = body.overview.recent_sessions.map((s) => s.title);
    expect(titles).toContain('The Beginning');
  });

  test('overview not accessible to unauthenticated users', async ({ request }) => {
    const res = await request.get(`${apiURL}/api/campaigns/${campaignId}/overview`);
    expect(res.status()).toBe(401);
  });
});
