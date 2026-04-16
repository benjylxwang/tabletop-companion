import { test, expect } from '@playwright/test';

const apiURL = process.env.PLAYWRIGHT_API_URL;
const supabaseUrl = process.env.PLAYWRIGHT_SUPABASE_URL;
const supabaseAnonKey = process.env.PLAYWRIGHT_SUPABASE_ANON_KEY;

let dmToken: string;
let playerToken: string;
let campaignId: string;
let npcId: string;

const dmEmail = `e2e-npc-dm-${Date.now()}@example.com`;
const playerEmail = `e2e-npc-player-${Date.now()}@example.com`;
const testPassword = 'E2eTestPass1!';

test.describe('NPC CRUD (API)', () => {
  test.skip(!apiURL || !supabaseUrl || !supabaseAnonKey, 'API/Supabase env vars required');

  test.beforeAll(async ({ request }) => {
    // DM
    const dmRes = await request.post(`${supabaseUrl}/auth/v1/signup`, {
      headers: { apikey: supabaseAnonKey!, 'Content-Type': 'application/json' },
      data: { email: dmEmail, password: testPassword },
    });
    expect(dmRes.ok()).toBeTruthy();
    dmToken = ((await dmRes.json()) as { access_token: string }).access_token;

    // Player — for the forbidden-mutation test later
    const playerRes = await request.post(`${supabaseUrl}/auth/v1/signup`, {
      headers: { apikey: supabaseAnonKey!, 'Content-Type': 'application/json' },
      data: { email: playerEmail, password: testPassword },
    });
    expect(playerRes.ok()).toBeTruthy();
    playerToken = ((await playerRes.json()) as { access_token: string }).access_token;

    // DM creates the container campaign
    const campaignRes = await request.post(`${apiURL}/api/campaigns`, {
      headers: { Authorization: `Bearer ${dmToken}` },
      data: { name: 'NPC E2E Campaign', status: 'Active' },
    });
    expect(campaignRes.status()).toBe(201);
    campaignId = ((await campaignRes.json()) as { campaign: { id: string } }).campaign.id;

    // DM invites the player
    const inviteRes = await request.post(
      `${apiURL}/api/campaigns/${campaignId}/members`,
      {
        headers: { Authorization: `Bearer ${dmToken}` },
        data: { email: playerEmail },
      },
    );
    expect(inviteRes.status()).toBe(201);
  });

  test.afterAll(async ({ request }) => {
    if (apiURL && dmToken && campaignId) {
      await request.delete(`${apiURL}/api/campaigns/${campaignId}`, {
        headers: { Authorization: `Bearer ${dmToken}` },
      });
    }
  });

  test('POST /api/campaigns/:id/npcs creates an NPC', async ({ request }) => {
    const res = await request.post(`${apiURL}/api/campaigns/${campaignId}/npcs`, {
      headers: { Authorization: `Bearer ${dmToken}` },
      data: {
        name: 'Seraphine',
        role_title: 'Innkeeper',
        status: 'Alive',
        dm_notes: 'Secretly a cult informant.',
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.npc.name).toBe('Seraphine');
    expect(body.npc.status).toBe('Alive');
    expect(body.npc.dm_notes).toBe('Secretly a cult informant.');
    expect(body.npc.id).toBeTruthy();
    npcId = body.npc.id as string;
  });

  test('GET /api/campaigns/:id/npcs lists the created NPC', async ({ request }) => {
    const res = await request.get(`${apiURL}/api/campaigns/${campaignId}/npcs`, {
      headers: { Authorization: `Bearer ${dmToken}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const ids = (body.npcs as { id: string }[]).map((n) => n.id);
    expect(ids).toContain(npcId);
  });

  test('GET /api/campaigns/:id/npcs/:npcId returns the NPC with dm_notes in DM view', async ({
    request,
  }) => {
    const res = await request.get(
      `${apiURL}/api/campaigns/${campaignId}/npcs/${npcId}`,
      { headers: { Authorization: `Bearer ${dmToken}` } },
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.npc.dm_notes).toBe('Secretly a cult informant.');
  });

  test('GET /api/campaigns/:id/npcs/:npcId?view=player strips dm_notes', async ({
    request,
  }) => {
    // Core acceptance criterion for #17 — dm_notes MUST never appear in player view
    const res = await request.get(
      `${apiURL}/api/campaigns/${campaignId}/npcs/${npcId}?view=player`,
      { headers: { Authorization: `Bearer ${dmToken}` } },
    );
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { npc: Record<string, unknown> };
    expect(body.npc.dm_notes).toBeUndefined();
  });

  test('GET /api/campaigns/:id/npcs?view=player strips dm_notes on list', async ({
    request,
  }) => {
    const res = await request.get(
      `${apiURL}/api/campaigns/${campaignId}/npcs?view=player`,
      { headers: { Authorization: `Bearer ${dmToken}` } },
    );
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { npcs: Record<string, unknown>[] };
    for (const n of body.npcs) expect(n.dm_notes).toBeUndefined();
  });

  test('GET as invited player strips dm_notes regardless of view', async ({
    request,
  }) => {
    const res = await request.get(
      `${apiURL}/api/campaigns/${campaignId}/npcs/${npcId}`,
      { headers: { Authorization: `Bearer ${playerToken}` } },
    );
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { npc: Record<string, unknown> };
    expect(body.npc.dm_notes).toBeUndefined();
  });

  test('PUT /api/campaigns/:id/npcs/:npcId updates the NPC', async ({ request }) => {
    const res = await request.put(
      `${apiURL}/api/campaigns/${campaignId}/npcs/${npcId}`,
      {
        headers: { Authorization: `Bearer ${dmToken}` },
        data: { status: 'Dead', personality: 'Gruff but kind.' },
      },
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.npc.status).toBe('Dead');
    expect(body.npc.personality).toBe('Gruff but kind.');
  });

  test('POST as a player returns 403', async ({ request }) => {
    const res = await request.post(`${apiURL}/api/campaigns/${campaignId}/npcs`, {
      headers: { Authorization: `Bearer ${playerToken}` },
      data: { name: 'Forbidden', status: 'Alive' },
    });
    expect(res.status()).toBe(403);
  });

  test('PUT as a player returns 403', async ({ request }) => {
    const res = await request.put(
      `${apiURL}/api/campaigns/${campaignId}/npcs/${npcId}`,
      {
        headers: { Authorization: `Bearer ${playerToken}` },
        data: { name: 'Forbidden' },
      },
    );
    expect(res.status()).toBe(403);
  });

  test('DELETE /api/campaigns/:id/npcs/:npcId returns 204 for DM', async ({ request }) => {
    const res = await request.delete(
      `${apiURL}/api/campaigns/${campaignId}/npcs/${npcId}`,
      { headers: { Authorization: `Bearer ${dmToken}` } },
    );
    expect(res.status()).toBe(204);
  });

  test('GET after delete returns 404', async ({ request }) => {
    const res = await request.get(
      `${apiURL}/api/campaigns/${campaignId}/npcs/${npcId}`,
      { headers: { Authorization: `Bearer ${dmToken}` } },
    );
    expect(res.status()).toBe(404);
  });
});

test.describe('NPC permission model (API)', () => {
  test.skip(!apiURL || !supabaseUrl || !supabaseAnonKey, 'API/Supabase env vars required');

  test('Non-member GET /api/campaigns/:id/npcs returns 404', async ({ request }) => {
    const email2 = `e2e-npc-outsider-${Date.now()}@example.com`;
    const signupRes = await request.post(`${supabaseUrl}/auth/v1/signup`, {
      headers: { apikey: supabaseAnonKey!, 'Content-Type': 'application/json' },
      data: { email: email2, password: testPassword },
    });
    const outsiderToken = ((await signupRes.json()) as { access_token: string })
      .access_token;

    // Create a campaign + NPC as the DM
    const campaignRes = await request.post(`${apiURL}/api/campaigns`, {
      headers: { Authorization: `Bearer ${dmToken}` },
      data: { name: 'Outsider Test Campaign', status: 'Active' },
    });
    const cId = ((await campaignRes.json()) as { campaign: { id: string } }).campaign.id;

    const npcRes = await request.post(`${apiURL}/api/campaigns/${cId}/npcs`, {
      headers: { Authorization: `Bearer ${dmToken}` },
      data: { name: 'Hidden NPC', status: 'Alive' },
    });
    const nId = ((await npcRes.json()) as { npc: { id: string } }).npc.id;

    // Outsider attempts to list / get
    const listRes = await request.get(`${apiURL}/api/campaigns/${cId}/npcs`, {
      headers: { Authorization: `Bearer ${outsiderToken}` },
    });
    expect(listRes.status()).toBe(404);

    const getRes = await request.get(`${apiURL}/api/campaigns/${cId}/npcs/${nId}`, {
      headers: { Authorization: `Bearer ${outsiderToken}` },
    });
    expect(getRes.status()).toBe(404);

    // Cleanup
    await request.delete(`${apiURL}/api/campaigns/${cId}`, {
      headers: { Authorization: `Bearer ${dmToken}` },
    });
  });
});
