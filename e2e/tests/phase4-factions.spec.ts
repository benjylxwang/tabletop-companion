import { test, expect } from '@playwright/test';

const apiURL = process.env.PLAYWRIGHT_API_URL;
const supabaseUrl = process.env.PLAYWRIGHT_SUPABASE_URL;
const supabaseAnonKey = process.env.PLAYWRIGHT_SUPABASE_ANON_KEY;

let dmToken: string;
let campaignId: string;
let factionId: string;
let npcId: string;
let faction2Id: string;

const dmEmail = `e2e-factions-dm-${Date.now()}@example.com`;
const testPassword = 'E2eTestPass1!';

test.describe('Factions CRUD + members + relationships (API)', () => {
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
      data: { name: 'Factions E2E Campaign', status: 'Active' },
    });
    expect(campaignRes.status()).toBe(201);
    campaignId = ((await campaignRes.json()) as { campaign: { id: string } }).campaign.id;

    // Create an NPC to use as a member
    const npcRes = await request.post(`${apiURL}/api/campaigns/${campaignId}/npcs`, {
      headers: { Authorization: `Bearer ${dmToken}` },
      data: { name: 'Test NPC', status: 'Alive' },
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

  test('create faction', async ({ request }) => {
    const res = await request.post(`${apiURL}/api/campaigns/${campaignId}/factions`, {
      headers: { Authorization: `Bearer ${dmToken}` },
      data: { name: 'The Iron Circle', description: 'A merchant guild', alignment_tone: 'Neutral', campaign_id: campaignId },
    });
    expect(res.status()).toBe(201);
    const body = (await res.json()) as { faction: { id: string; name: string } };
    expect(body.faction.name).toBe('The Iron Circle');
    factionId = body.faction.id;
  });

  test('create second faction', async ({ request }) => {
    const res = await request.post(`${apiURL}/api/campaigns/${campaignId}/factions`, {
      headers: { Authorization: `Bearer ${dmToken}` },
      data: { name: 'The Silver Ravens', campaign_id: campaignId },
    });
    expect(res.status()).toBe(201);
    faction2Id = ((await res.json()) as { faction: { id: string } }).faction.id;
  });

  test('list factions', async ({ request }) => {
    const res = await request.get(`${apiURL}/api/campaigns/${campaignId}/factions`, {
      headers: { Authorization: `Bearer ${dmToken}` },
    });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { factions: { id: string }[] };
    expect(body.factions.length).toBeGreaterThanOrEqual(2);
  });

  test('get faction detail with empty members + relationships', async ({ request }) => {
    const res = await request.get(`${apiURL}/api/campaigns/${campaignId}/factions/${factionId}`, {
      headers: { Authorization: `Bearer ${dmToken}` },
    });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { faction: { id: string; members: unknown[]; relationships: unknown[] } };
    expect(body.faction.id).toBe(factionId);
    expect(Array.isArray(body.faction.members)).toBeTruthy();
    expect(Array.isArray(body.faction.relationships)).toBeTruthy();
  });

  test('update faction', async ({ request }) => {
    const res = await request.put(`${apiURL}/api/campaigns/${campaignId}/factions/${factionId}`, {
      headers: { Authorization: `Bearer ${dmToken}` },
      data: { goals: 'Control all trade routes' },
    });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { faction: { goals: string } };
    expect(body.faction.goals).toBe('Control all trade routes');
  });

  test('add NPC member to faction', async ({ request }) => {
    const res = await request.post(
      `${apiURL}/api/campaigns/${campaignId}/factions/${factionId}/members`,
      {
        headers: { Authorization: `Bearer ${dmToken}` },
        data: { npc_id: npcId, role: 'Enforcer' },
      },
    );
    expect(res.status()).toBe(201);
  });

  test('faction detail includes member with NPC name', async ({ request }) => {
    const res = await request.get(`${apiURL}/api/campaigns/${campaignId}/factions/${factionId}`, {
      headers: { Authorization: `Bearer ${dmToken}` },
    });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { faction: { members: Array<{ npc_id: string; npc_name: string; role: string | null }> } };
    expect(body.faction.members).toHaveLength(1);
    expect(body.faction.members[0].npc_id).toBe(npcId);
    expect(body.faction.members[0].npc_name).toBe('Test NPC');
    expect(body.faction.members[0].role).toBe('Enforcer');
  });

  test('add inter-faction relationship', async ({ request }) => {
    const res = await request.post(
      `${apiURL}/api/campaigns/${campaignId}/factions/${factionId}/relationships`,
      {
        headers: { Authorization: `Bearer ${dmToken}` },
        data: { related_faction_id: faction2Id, relationship_type: 'rival' },
      },
    );
    expect(res.status()).toBe(201);
  });

  test('faction detail includes relationship with related faction name', async ({ request }) => {
    const res = await request.get(`${apiURL}/api/campaigns/${campaignId}/factions/${factionId}`, {
      headers: { Authorization: `Bearer ${dmToken}` },
    });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { faction: { relationships: Array<{ related_faction_id: string; related_faction_name: string; relationship_type: string }> } };
    expect(body.faction.relationships).toHaveLength(1);
    expect(body.faction.relationships[0].related_faction_id).toBe(faction2Id);
    expect(body.faction.relationships[0].related_faction_name).toBe('The Silver Ravens');
    expect(body.faction.relationships[0].relationship_type).toBe('rival');
  });

  test('remove NPC member from faction', async ({ request }) => {
    const res = await request.delete(
      `${apiURL}/api/campaigns/${campaignId}/factions/${factionId}/members/${npcId}`,
      { headers: { Authorization: `Bearer ${dmToken}` } },
    );
    expect(res.status()).toBe(204);
  });

  test('remove inter-faction relationship', async ({ request }) => {
    const res = await request.delete(
      `${apiURL}/api/campaigns/${campaignId}/factions/${factionId}/relationships/${faction2Id}`,
      { headers: { Authorization: `Bearer ${dmToken}` } },
    );
    expect(res.status()).toBe(204);
  });

  test('delete faction', async ({ request }) => {
    const res = await request.delete(
      `${apiURL}/api/campaigns/${campaignId}/factions/${faction2Id}`,
      { headers: { Authorization: `Bearer ${dmToken}` } },
    );
    expect(res.status()).toBe(204);
  });
});
