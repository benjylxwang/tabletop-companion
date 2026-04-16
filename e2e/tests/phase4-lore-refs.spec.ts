import { test, expect } from '@playwright/test';

const apiURL = process.env.PLAYWRIGHT_API_URL;
const supabaseUrl = process.env.PLAYWRIGHT_SUPABASE_URL;
const supabaseAnonKey = process.env.PLAYWRIGHT_SUPABASE_ANON_KEY;

let dmToken: string;
let campaignId: string;
let loreId: string;
let npcId: string;
let lore2Id: string;

const dmEmail = `e2e-lore-refs-${Date.now()}@example.com`;
const testPassword = 'E2eTestPass1!';

test.describe.serial('Lore ↔ entity references (API)', () => {
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
      data: { name: 'Lore Refs E2E Campaign', status: 'Active' },
    });
    expect(campaignRes.status()).toBe(201);
    campaignId = ((await campaignRes.json()) as { campaign: { id: string } }).campaign.id;

    const loreRes = await request.post(`${apiURL}/api/campaigns/${campaignId}/lore`, {
      headers: { Authorization: `Bearer ${dmToken}` },
      data: { title: 'History of the Ancients', category: 'History', visibility: 'Public', campaign_id: campaignId },
    });
    expect(loreRes.status()).toBe(201);
    loreId = ((await loreRes.json()) as { lore: { id: string } }).lore.id;

    const npcRes = await request.post(`${apiURL}/api/campaigns/${campaignId}/npcs`, {
      headers: { Authorization: `Bearer ${dmToken}` },
      data: { name: 'The Ancient One', status: 'Unknown' },
    });
    expect(npcRes.status()).toBe(201);
    npcId = ((await npcRes.json()) as { npc: { id: string } }).npc.id;

    const lore2Res = await request.post(`${apiURL}/api/campaigns/${campaignId}/lore`, {
      headers: { Authorization: `Bearer ${dmToken}` },
      data: { title: 'The Elder Prophecy', category: 'Religion', visibility: 'Public', campaign_id: campaignId },
    });
    expect(lore2Res.status()).toBe(201);
    lore2Id = ((await lore2Res.json()) as { lore: { id: string } }).lore.id;
  });

  test.afterAll(async ({ request }) => {
    if (apiURL && dmToken && campaignId) {
      await request.delete(`${apiURL}/api/campaigns/${campaignId}`, {
        headers: { Authorization: `Bearer ${dmToken}` },
      });
    }
  });

  test('lore detail has empty references initially', async ({ request }) => {
    const res = await request.get(
      `${apiURL}/api/campaigns/${campaignId}/lore/${loreId}`,
      { headers: { Authorization: `Bearer ${dmToken}` } },
    );
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { lore: { references: unknown[] } };
    expect(Array.isArray(body.lore.references)).toBeTruthy();
    expect(body.lore.references).toHaveLength(0);
  });

  test('add NPC reference to lore entry', async ({ request }) => {
    const res = await request.post(
      `${apiURL}/api/campaigns/${campaignId}/lore/${loreId}/references`,
      {
        headers: { Authorization: `Bearer ${dmToken}` },
        data: { entity_type: 'npc', entity_id: npcId },
      },
    );
    expect(res.status()).toBe(201);
  });

  test('add lore-to-lore reference', async ({ request }) => {
    const res = await request.post(
      `${apiURL}/api/campaigns/${campaignId}/lore/${loreId}/references`,
      {
        headers: { Authorization: `Bearer ${dmToken}` },
        data: { entity_type: 'lore', entity_id: lore2Id },
      },
    );
    expect(res.status()).toBe(201);
  });

  test('lore detail includes references with resolved entity names', async ({ request }) => {
    const res = await request.get(
      `${apiURL}/api/campaigns/${campaignId}/lore/${loreId}`,
      { headers: { Authorization: `Bearer ${dmToken}` } },
    );
    expect(res.status()).toBe(200);
    const body = (await res.json()) as {
      lore: {
        references: Array<{ entity_type: string; entity_id: string; entity_name: string }>;
      };
    };
    expect(body.lore.references).toHaveLength(2);

    const npcRef = body.lore.references.find((r) => r.entity_type === 'npc');
    expect(npcRef?.entity_id).toBe(npcId);
    expect(npcRef?.entity_name).toBe('The Ancient One');

    const loreRef = body.lore.references.find((r) => r.entity_type === 'lore');
    expect(loreRef?.entity_id).toBe(lore2Id);
    expect(loreRef?.entity_name).toBe('The Elder Prophecy');
  });

  test('remove NPC reference from lore entry', async ({ request }) => {
    const res = await request.delete(
      `${apiURL}/api/campaigns/${campaignId}/lore/${loreId}/references/npc/${npcId}`,
      { headers: { Authorization: `Bearer ${dmToken}` } },
    );
    expect(res.status()).toBe(204);
  });

  test('remove lore-to-lore reference', async ({ request }) => {
    const res = await request.delete(
      `${apiURL}/api/campaigns/${campaignId}/lore/${loreId}/references/lore/${lore2Id}`,
      { headers: { Authorization: `Bearer ${dmToken}` } },
    );
    expect(res.status()).toBe(204);
  });
});
