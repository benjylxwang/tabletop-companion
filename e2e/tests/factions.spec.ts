import { test, expect } from '@playwright/test';

const apiURL = process.env.PLAYWRIGHT_API_URL;
const supabaseUrl = process.env.PLAYWRIGHT_SUPABASE_URL;
const supabaseAnonKey = process.env.PLAYWRIGHT_SUPABASE_ANON_KEY;

// ─── Auth setup ───────────────────────────────────────────────────────────────

let token: string;
let campaignId: string;
let createdFactionId: string;

const testEmail = `e2e-factions-${Date.now()}@example.com`;
const testPassword = 'E2eTestPass1!';

test.describe('Faction CRUD (API)', () => {
  test.skip(!apiURL || !supabaseUrl || !supabaseAnonKey, 'API/Supabase env vars required');

  test.beforeAll(async ({ request }) => {
    // Sign up a fresh test user
    const signupRes = await request.post(`${supabaseUrl}/auth/v1/signup`, {
      headers: { apikey: supabaseAnonKey!, 'Content-Type': 'application/json' },
      data: { email: testEmail, password: testPassword },
    });
    expect(signupRes.ok()).toBeTruthy();
    const body = await signupRes.json();
    token = (body as { access_token: string }).access_token;
    expect(token).toBeTruthy();

    // Create a parent campaign
    const campaignRes = await request.post(`${apiURL}/api/campaigns`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: 'Faction Test Campaign', status: 'Active' },
    });
    expect(campaignRes.status()).toBe(201);
    const campaignBody = await campaignRes.json();
    campaignId = (campaignBody as { campaign: { id: string } }).campaign.id;
    expect(campaignId).toBeTruthy();
  });

  test.afterAll(async ({ request }) => {
    if (campaignId && token) {
      await request.delete(`${apiURL}/api/campaigns/${campaignId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  });

  test('POST /api/campaigns/:id/factions creates a faction', async ({ request }) => {
    const res = await request.post(`${apiURL}/api/campaigns/${campaignId}/factions`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name: 'The Iron Circle',
        description: 'A mercenary guild',
        goals: 'Expand influence across the northern territories',
        alignment_tone: 'Hostile',
        dm_notes: 'Secret: they answer to the shadow council',
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.faction.name).toBe('The Iron Circle');
    expect(body.faction.alignment_tone).toBe('Hostile');
    expect(body.faction.dm_notes).toBe('Secret: they answer to the shadow council');
    expect(body.faction.id).toBeTruthy();
    createdFactionId = body.faction.id as string;
  });

  test('GET /api/campaigns/:id/factions lists the created faction', async ({ request }) => {
    const res = await request.get(`${apiURL}/api/campaigns/${campaignId}/factions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const ids = (body.factions as { id: string }[]).map((f) => f.id);
    expect(ids).toContain(createdFactionId);
  });

  test('GET /api/campaigns/:id/factions/:factionId returns the faction', async ({ request }) => {
    const res = await request.get(
      `${apiURL}/api/campaigns/${campaignId}/factions/${createdFactionId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.faction.id).toBe(createdFactionId);
    expect(body.faction.name).toBe('The Iron Circle');
    expect(body.faction.dm_notes).toBe('Secret: they answer to the shadow council');
  });

  test('GET ?view=player strips dm_notes', async ({ request }) => {
    const res = await request.get(
      `${apiURL}/api/campaigns/${campaignId}/factions/${createdFactionId}?view=player`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { faction: Record<string, unknown> };
    expect(body.faction.dm_notes).toBeUndefined();
    // Public fields still present
    expect(body.faction.name).toBe('The Iron Circle');
    expect(body.faction.goals).toBeTruthy();
  });

  test('GET list ?view=player strips dm_notes from all factions', async ({ request }) => {
    const res = await request.get(
      `${apiURL}/api/campaigns/${campaignId}/factions?view=player`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { factions: Record<string, unknown>[] };
    for (const faction of body.factions) {
      expect(faction.dm_notes).toBeUndefined();
    }
  });

  test('PUT /api/campaigns/:id/factions/:factionId updates the faction', async ({ request }) => {
    const res = await request.put(
      `${apiURL}/api/campaigns/${campaignId}/factions/${createdFactionId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: { name: 'The Iron Circle (Renamed)' },
      },
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.faction.name).toBe('The Iron Circle (Renamed)');
  });

  test('DELETE /api/campaigns/:id/factions/:factionId returns 204', async ({ request }) => {
    const res = await request.delete(
      `${apiURL}/api/campaigns/${campaignId}/factions/${createdFactionId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(res.status()).toBe(204);
  });

  test('GET list after delete does not include deleted faction', async ({ request }) => {
    const res = await request.get(`${apiURL}/api/campaigns/${campaignId}/factions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const ids = (body.factions as { id: string }[]).map((f) => f.id);
    expect(ids).not.toContain(createdFactionId);
  });
});

test.describe('Faction permission model (API)', () => {
  test.skip(!apiURL || !supabaseUrl || !supabaseAnonKey, 'API/Supabase env vars required');

  test('Non-member GET /api/campaigns/:id/factions returns 404', async ({ request }) => {
    // Sign up as original user
    const ownerRes = await request.post(`${supabaseUrl}/auth/v1/signup`, {
      headers: { apikey: supabaseAnonKey!, 'Content-Type': 'application/json' },
      data: { email: `e2e-perm-owner-${Date.now()}@example.com`, password: 'E2eTestPass1!' },
    });
    const ownerToken = ((await ownerRes.json()) as { access_token: string }).access_token;

    // Create campaign
    const campaignRes = await request.post(`${apiURL}/api/campaigns`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { name: 'Perm Test Campaign', status: 'Active' },
    });
    const permCampaignId = ((await campaignRes.json()) as { campaign: { id: string } }).campaign.id;

    // Sign up as a different user (non-member)
    const otherRes = await request.post(`${supabaseUrl}/auth/v1/signup`, {
      headers: { apikey: supabaseAnonKey!, 'Content-Type': 'application/json' },
      data: { email: `e2e-perm-other-${Date.now()}@example.com`, password: 'E2eTestPass1!' },
    });
    const otherToken = ((await otherRes.json()) as { access_token: string }).access_token;

    // Non-member tries to list factions
    const res = await request.get(`${apiURL}/api/campaigns/${permCampaignId}/factions`, {
      headers: { Authorization: `Bearer ${otherToken}` },
    });
    expect(res.status()).toBe(404);

    // Cleanup
    await request.delete(`${apiURL}/api/campaigns/${permCampaignId}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
  });
});
