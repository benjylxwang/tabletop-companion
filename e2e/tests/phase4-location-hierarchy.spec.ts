import { test, expect } from '@playwright/test';

const apiURL = process.env.PLAYWRIGHT_API_URL;
const supabaseUrl = process.env.PLAYWRIGHT_SUPABASE_URL;
const supabaseAnonKey = process.env.PLAYWRIGHT_SUPABASE_ANON_KEY;

let dmToken: string;
let campaignId: string;
let regionId: string;
let townId: string;
let tavernId: string;

const dmEmail = `e2e-location-hierarchy-${Date.now()}@example.com`;
const testPassword = 'E2eTestPass1!';

test.describe.serial('Location hierarchy navigation (API)', () => {
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
      data: { name: 'Hierarchy E2E Campaign', status: 'Active' },
    });
    expect(campaignRes.status()).toBe(201);
    campaignId = ((await campaignRes.json()) as { campaign: { id: string } }).campaign.id;

    // Create hierarchy: Region → Town → Tavern
    const regionRes = await request.post(`${apiURL}/api/campaigns/${campaignId}/locations`, {
      headers: { Authorization: `Bearer ${dmToken}` },
      data: { name: 'Sword Coast', type: 'Region', campaign_id: campaignId },
    });
    expect(regionRes.status()).toBe(201);
    regionId = ((await regionRes.json()) as { location: { id: string } }).location.id;

    const townRes = await request.post(`${apiURL}/api/campaigns/${campaignId}/locations`, {
      headers: { Authorization: `Bearer ${dmToken}` },
      data: { name: 'Phandalin', type: 'Town', parent_location_id: regionId, campaign_id: campaignId },
    });
    expect(townRes.status()).toBe(201);
    townId = ((await townRes.json()) as { location: { id: string } }).location.id;

    const tavernRes = await request.post(`${apiURL}/api/campaigns/${campaignId}/locations`, {
      headers: { Authorization: `Bearer ${dmToken}` },
      data: { name: 'The Stonehill Inn', type: 'Tavern', parent_location_id: townId, campaign_id: campaignId },
    });
    expect(tavernRes.status()).toBe(201);
    tavernId = ((await tavernRes.json()) as { location: { id: string } }).location.id;
  });

  test.afterAll(async ({ request }) => {
    if (apiURL && dmToken && campaignId) {
      await request.delete(`${apiURL}/api/campaigns/${campaignId}`, {
        headers: { Authorization: `Bearer ${dmToken}` },
      });
    }
  });

  test('region has no ancestors and two sub-locations', async ({ request }) => {
    const res = await request.get(
      `${apiURL}/api/campaigns/${campaignId}/locations/${regionId}`,
      { headers: { Authorization: `Bearer ${dmToken}` } },
    );
    expect(res.status()).toBe(200);
    const body = (await res.json()) as {
      location: { ancestors: unknown[]; sub_locations: Array<{ id: string; name: string }> };
    };
    expect(body.location.ancestors).toHaveLength(0);
    expect(body.location.sub_locations).toHaveLength(1);
    expect(body.location.sub_locations[0].name).toBe('Phandalin');
  });

  test('town has one ancestor (region) and one sub-location (tavern)', async ({ request }) => {
    const res = await request.get(
      `${apiURL}/api/campaigns/${campaignId}/locations/${townId}`,
      { headers: { Authorization: `Bearer ${dmToken}` } },
    );
    expect(res.status()).toBe(200);
    const body = (await res.json()) as {
      location: {
        ancestors: Array<{ id: string; name: string }>;
        sub_locations: Array<{ id: string; name: string }>;
      };
    };
    expect(body.location.ancestors).toHaveLength(1);
    expect(body.location.ancestors[0].id).toBe(regionId);
    expect(body.location.ancestors[0].name).toBe('Sword Coast');
    expect(body.location.sub_locations).toHaveLength(1);
    expect(body.location.sub_locations[0].name).toBe('The Stonehill Inn');
  });

  test('tavern has two ancestors (region, town) and no sub-locations', async ({ request }) => {
    const res = await request.get(
      `${apiURL}/api/campaigns/${campaignId}/locations/${tavernId}`,
      { headers: { Authorization: `Bearer ${dmToken}` } },
    );
    expect(res.status()).toBe(200);
    const body = (await res.json()) as {
      location: {
        ancestors: Array<{ id: string; name: string }>;
        sub_locations: unknown[];
      };
    };
    expect(body.location.ancestors).toHaveLength(2);
    expect(body.location.ancestors[0].id).toBe(regionId);
    expect(body.location.ancestors[1].id).toBe(townId);
    expect(body.location.sub_locations).toHaveLength(0);
  });
});
