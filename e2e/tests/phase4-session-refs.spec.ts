import { test, expect } from '@playwright/test';

const apiURL = process.env.PLAYWRIGHT_API_URL;
const supabaseUrl = process.env.PLAYWRIGHT_SUPABASE_URL;
const supabaseAnonKey = process.env.PLAYWRIGHT_SUPABASE_ANON_KEY;

let dmToken: string;
let campaignId: string;
let sessionId: string;
let npcId: string;
let locationId: string;

const dmEmail = `e2e-session-refs-${Date.now()}@example.com`;
const testPassword = 'E2eTestPass1!';

test.describe.serial('Session ↔ NPC/Location references (API)', () => {
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
      data: { name: 'Session Refs E2E Campaign', status: 'Active' },
    });
    expect(campaignRes.status()).toBe(201);
    campaignId = ((await campaignRes.json()) as { campaign: { id: string } }).campaign.id;

    const sessionRes = await request.post(`${apiURL}/api/campaigns/${campaignId}/sessions`, {
      headers: { Authorization: `Bearer ${dmToken}` },
      data: { title: 'The First Adventure', date_played: '2026-01-01', campaign_id: campaignId, session_number: 1 },
    });
    expect(sessionRes.status()).toBe(201);
    sessionId = ((await sessionRes.json()) as { session: { id: string } }).session.id;

    const npcRes = await request.post(`${apiURL}/api/campaigns/${campaignId}/npcs`, {
      headers: { Authorization: `Bearer ${dmToken}` },
      data: { name: 'Goblin Chieftain', status: 'Alive' },
    });
    expect(npcRes.status()).toBe(201);
    npcId = ((await npcRes.json()) as { npc: { id: string } }).npc.id;

    const locRes = await request.post(`${apiURL}/api/campaigns/${campaignId}/locations`, {
      headers: { Authorization: `Bearer ${dmToken}` },
      data: { name: 'The Dark Cave', campaign_id: campaignId },
    });
    expect(locRes.status()).toBe(201);
    locationId = ((await locRes.json()) as { location: { id: string } }).location.id;
  });

  test.afterAll(async ({ request }) => {
    if (apiURL && dmToken && campaignId) {
      await request.delete(`${apiURL}/api/campaigns/${campaignId}`, {
        headers: { Authorization: `Bearer ${dmToken}` },
      });
    }
  });

  test('session detail has empty linked_npcs and linked_locations', async ({ request }) => {
    const res = await request.get(
      `${apiURL}/api/campaigns/${campaignId}/sessions/${sessionId}`,
      { headers: { Authorization: `Bearer ${dmToken}` } },
    );
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { session: { linked_npcs: unknown[]; linked_locations: unknown[] } };
    expect(Array.isArray(body.session.linked_npcs)).toBeTruthy();
    expect(Array.isArray(body.session.linked_locations)).toBeTruthy();
    expect(body.session.linked_npcs).toHaveLength(0);
    expect(body.session.linked_locations).toHaveLength(0);
  });

  test('link NPC to session', async ({ request }) => {
    const res = await request.post(
      `${apiURL}/api/campaigns/${campaignId}/sessions/${sessionId}/npcs`,
      {
        headers: { Authorization: `Bearer ${dmToken}` },
        data: { npc_id: npcId },
      },
    );
    expect(res.status()).toBe(201);
  });

  test('session detail includes linked NPC with name', async ({ request }) => {
    const res = await request.get(
      `${apiURL}/api/campaigns/${campaignId}/sessions/${sessionId}`,
      { headers: { Authorization: `Bearer ${dmToken}` } },
    );
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { session: { linked_npcs: Array<{ id: string; name: string }> } };
    expect(body.session.linked_npcs).toHaveLength(1);
    expect(body.session.linked_npcs[0].id).toBe(npcId);
    expect(body.session.linked_npcs[0].name).toBe('Goblin Chieftain');
  });

  test('link location to session', async ({ request }) => {
    const res = await request.post(
      `${apiURL}/api/campaigns/${campaignId}/sessions/${sessionId}/locations`,
      {
        headers: { Authorization: `Bearer ${dmToken}` },
        data: { location_id: locationId },
      },
    );
    expect(res.status()).toBe(201);
  });

  test('session detail includes linked location with name', async ({ request }) => {
    const res = await request.get(
      `${apiURL}/api/campaigns/${campaignId}/sessions/${sessionId}`,
      { headers: { Authorization: `Bearer ${dmToken}` } },
    );
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { session: { linked_locations: Array<{ id: string; name: string }> } };
    expect(body.session.linked_locations).toHaveLength(1);
    expect(body.session.linked_locations[0].id).toBe(locationId);
    expect(body.session.linked_locations[0].name).toBe('The Dark Cave');
  });

  test('unlink NPC from session', async ({ request }) => {
    const res = await request.delete(
      `${apiURL}/api/campaigns/${campaignId}/sessions/${sessionId}/npcs/${npcId}`,
      { headers: { Authorization: `Bearer ${dmToken}` } },
    );
    expect(res.status()).toBe(204);
  });

  test('unlink location from session', async ({ request }) => {
    const res = await request.delete(
      `${apiURL}/api/campaigns/${campaignId}/sessions/${sessionId}/locations/${locationId}`,
      { headers: { Authorization: `Bearer ${dmToken}` } },
    );
    expect(res.status()).toBe(204);
  });
});
