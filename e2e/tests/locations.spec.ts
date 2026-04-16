import { test, expect } from '@playwright/test';

const apiURL = process.env.PLAYWRIGHT_API_URL;
const supabaseUrl = process.env.PLAYWRIGHT_SUPABASE_URL;
const supabaseAnonKey = process.env.PLAYWRIGHT_SUPABASE_ANON_KEY;

let token: string;
let campaignId: string;
let parentId: string;
let childId: string;

const testEmail = `e2e-loc-${Date.now()}@example.com`;
const testPassword = 'E2eTestPass1!';

test.describe('Location CRUD (API)', () => {
  test.skip(!apiURL || !supabaseUrl || !supabaseAnonKey, 'API/Supabase env vars required');

  test.beforeAll(async ({ request }) => {
    // Sign up a fresh test user and get a session token
    const signupRes = await request.post(`${supabaseUrl}/auth/v1/signup`, {
      headers: { apikey: supabaseAnonKey!, 'Content-Type': 'application/json' },
      data: { email: testEmail, password: testPassword },
    });
    expect(signupRes.ok()).toBeTruthy();
    token = ((await signupRes.json()) as { access_token: string }).access_token;
    expect(token).toBeTruthy();

    // Create a campaign to house the locations
    const createRes = await request.post(`${apiURL}/api/campaigns`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: 'Locations E2E Campaign', status: 'Active' },
    });
    expect(createRes.status()).toBe(201);
    campaignId = ((await createRes.json()) as { campaign: { id: string } }).campaign.id;
  });

  test.afterAll(async ({ request }) => {
    // Best-effort cleanup — deleting the campaign cascades to locations
    if (apiURL && token && campaignId) {
      await request.delete(`${apiURL}/api/campaigns/${campaignId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  });

  test('POST /api/campaigns/:id/locations creates a location', async ({ request }) => {
    const res = await request.post(`${apiURL}/api/campaigns/${campaignId}/locations`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name: 'Phandalin',
        type: 'Town',
        description: 'A small frontier town.',
        dm_notes: 'The mayor is secretly a cultist.',
      },
    });
    expect(res.status()).toBe(201);
    const body = (await res.json()) as { location: { id: string; name: string; campaign_id: string } };
    expect(body.location.name).toBe('Phandalin');
    expect(body.location.campaign_id).toBe(campaignId);
    parentId = body.location.id;
  });

  test('POST can create a child location referencing the parent', async ({ request }) => {
    const res = await request.post(`${apiURL}/api/campaigns/${campaignId}/locations`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name: 'The Rusty Flagon',
        type: 'Tavern',
        parent_location_id: parentId,
      },
    });
    expect(res.status()).toBe(201);
    const body = (await res.json()) as { location: { id: string; parent_location_id: string } };
    expect(body.location.parent_location_id).toBe(parentId);
    childId = body.location.id;
  });

  test('GET /api/campaigns/:id/locations lists both locations', async ({ request }) => {
    const res = await request.get(`${apiURL}/api/campaigns/${campaignId}/locations`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { locations: { id: string }[] };
    const ids = body.locations.map((l) => l.id);
    expect(ids).toContain(parentId);
    expect(ids).toContain(childId);
  });

  test('GET /api/campaigns/:id/locations/:locId returns the full location with dm_notes', async ({
    request,
  }) => {
    const res = await request.get(
      `${apiURL}/api/campaigns/${campaignId}/locations/${parentId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { location: { dm_notes?: string } };
    expect(body.location.dm_notes).toBe('The mayor is secretly a cultist.');
  });

  test('GET with view=player strips dm_notes', async ({ request }) => {
    const res = await request.get(
      `${apiURL}/api/campaigns/${campaignId}/locations/${parentId}?view=player`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { location: Record<string, unknown> };
    expect(body.location.dm_notes).toBeUndefined();
    // Non-dm fields stay
    expect(body.location.name).toBe('Phandalin');
  });

  test('LIST with view=player strips dm_notes from every row', async ({ request }) => {
    const res = await request.get(
      `${apiURL}/api/campaigns/${campaignId}/locations?view=player`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { locations: Record<string, unknown>[] };
    for (const l of body.locations) {
      expect(l.dm_notes).toBeUndefined();
    }
  });

  test('PUT updates the location', async ({ request }) => {
    const res = await request.put(
      `${apiURL}/api/campaigns/${campaignId}/locations/${parentId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: { name: 'Phandalin (rebuilt)', type: 'City' },
      },
    );
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { location: { name: string; type: string } };
    expect(body.location.name).toBe('Phandalin (rebuilt)');
    expect(body.location.type).toBe('City');
  });

  test('Non-member cannot read locations (404)', async ({ request }) => {
    const otherEmail = `e2e-loc-other-${Date.now()}@example.com`;
    const signupRes = await request.post(`${supabaseUrl}/auth/v1/signup`, {
      headers: { apikey: supabaseAnonKey!, 'Content-Type': 'application/json' },
      data: { email: otherEmail, password: testPassword },
    });
    const otherToken = ((await signupRes.json()) as { access_token: string }).access_token;

    const res = await request.get(`${apiURL}/api/campaigns/${campaignId}/locations`, {
      headers: { Authorization: `Bearer ${otherToken}` },
    });
    expect(res.status()).toBe(404);
  });

  test('DELETE removes the child location (204)', async ({ request }) => {
    const res = await request.delete(
      `${apiURL}/api/campaigns/${campaignId}/locations/${childId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    expect(res.status()).toBe(204);
  });

  test('GET after delete does not include the removed child', async ({ request }) => {
    const res = await request.get(`${apiURL}/api/campaigns/${campaignId}/locations`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await res.json()) as { locations: { id: string }[] };
    expect(body.locations.map((l) => l.id)).not.toContain(childId);
  });
});

// Auth redirect is already covered by tests/auth.spec.ts (Auth UI flow describe block).
