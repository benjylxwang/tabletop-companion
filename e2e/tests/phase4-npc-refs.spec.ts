import { test, expect } from '@playwright/test';

const apiURL = process.env.PLAYWRIGHT_API_URL;
const supabaseUrl = process.env.PLAYWRIGHT_SUPABASE_URL;
const supabaseAnonKey = process.env.PLAYWRIGHT_SUPABASE_ANON_KEY;

let dmToken: string;
let campaignId: string;
let npcId: string;
let factionId: string;
let sessionId: string;

const dmEmail = `e2e-npc-refs-${Date.now()}@example.com`;
const testPassword = 'E2eTestPass1!';

test.describe('NPC ↔ Faction + first-appeared session (API)', () => {
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
      data: { name: 'NPC Refs E2E Campaign', status: 'Active' },
    });
    expect(campaignRes.status()).toBe(201);
    campaignId = ((await campaignRes.json()) as { campaign: { id: string } }).campaign.id;

    const factionRes = await request.post(`${apiURL}/api/campaigns/${campaignId}/factions`, {
      headers: { Authorization: `Bearer ${dmToken}` },
      data: { name: 'The Guild', campaign_id: campaignId },
    });
    expect(factionRes.status()).toBe(201);
    factionId = ((await factionRes.json()) as { faction: { id: string } }).faction.id;

    const sessionRes = await request.post(`${apiURL}/api/campaigns/${campaignId}/sessions`, {
      headers: { Authorization: `Bearer ${dmToken}` },
      data: { title: 'Session One', date_played: '2026-01-01', campaign_id: campaignId, session_number: 1 },
    });
    expect(sessionRes.status()).toBe(201);
    sessionId = ((await sessionRes.json()) as { session: { id: string } }).session.id;

    const npcRes = await request.post(`${apiURL}/api/campaigns/${campaignId}/npcs`, {
      headers: { Authorization: `Bearer ${dmToken}` },
      data: { name: 'Aria', status: 'Alive' },
    });
    expect(npcRes.status()).toBe(201);
    npcId = ((await npcRes.json()) as { npc: { id: string } }).npc.id;
  });

  test.afterAll(async ({ request }) => {
    if (apiURL && dmToken && campaignId) {
      await request.delete(`${apiURL}/api/campaigns/${campaignId}`, {
        headers: { Authorization: `Bearer ${dmToken}` },
      });
    }
  });

  test('NPC detail has no faction or session ref initially', async ({ request }) => {
    const res = await request.get(
      `${apiURL}/api/campaigns/${campaignId}/npcs/${npcId}`,
      { headers: { Authorization: `Bearer ${dmToken}` } },
    );
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { npc: { faction?: unknown; first_appeared_session?: unknown } };
    expect(body.npc.faction).toBeUndefined();
    expect(body.npc.first_appeared_session).toBeUndefined();
  });

  test('update NPC with faction and first-appeared session', async ({ request }) => {
    const res = await request.put(
      `${apiURL}/api/campaigns/${campaignId}/npcs/${npcId}`,
      {
        headers: { Authorization: `Bearer ${dmToken}` },
        data: { faction_id: factionId, first_appeared_session_id: sessionId },
      },
    );
    expect(res.status()).toBe(200);
  });

  test('NPC detail includes faction name and session number', async ({ request }) => {
    const res = await request.get(
      `${apiURL}/api/campaigns/${campaignId}/npcs/${npcId}`,
      { headers: { Authorization: `Bearer ${dmToken}` } },
    );
    expect(res.status()).toBe(200);
    const body = (await res.json()) as {
      npc: {
        faction?: { id: string; name: string };
        first_appeared_session?: { id: string; name: string; session_number: number };
      };
    };
    expect(body.npc.faction?.id).toBe(factionId);
    expect(body.npc.faction?.name).toBe('The Guild');
    expect(body.npc.first_appeared_session?.id).toBe(sessionId);
    expect(body.npc.first_appeared_session?.name).toBe('Session One');
    expect(body.npc.first_appeared_session?.session_number).toBe(1);
  });

  test('clear NPC faction and session refs', async ({ request }) => {
    const res = await request.put(
      `${apiURL}/api/campaigns/${campaignId}/npcs/${npcId}`,
      {
        headers: { Authorization: `Bearer ${dmToken}` },
        data: { faction_id: null, first_appeared_session_id: null },
      },
    );
    expect(res.status()).toBe(200);
  });
});
