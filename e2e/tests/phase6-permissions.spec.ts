/**
 * phase6-permissions.spec.ts
 *
 * Comprehensive API-level permission tests verifying that:
 * - DM can see dm_notes on GET (single) and LIST
 * - ?view=player strips dm_notes from GET and LIST responses
 * - Private lore entries are completely hidden from player view
 *
 * Uses Playwright API testing (no browser navigation required).
 */

import { test, expect } from '@playwright/test';

const apiURL = process.env.PLAYWRIGHT_API_URL;
const supabaseUrl = process.env.PLAYWRIGHT_SUPABASE_URL;
const supabaseAnonKey = process.env.PLAYWRIGHT_SUPABASE_ANON_KEY;

// Unique email per test run for isolation
const dmEmail = `e2e-phase6-perm-${Date.now()}@example.com`;
const testPassword = 'E2eTestPass1!';

let dmToken: string;
let campaignId: string;

test.describe('Phase 6 — dm_notes permission model (API)', () => {
  test.skip(
    !apiURL || !supabaseUrl || !supabaseAnonKey,
    'PLAYWRIGHT_API_URL, PLAYWRIGHT_SUPABASE_URL and PLAYWRIGHT_SUPABASE_ANON_KEY are required',
  );

  // ── Bootstrap: create DM user + campaign ──────────────────────────────────

  test.beforeAll(async ({ request }) => {
    const signupRes = await request.post(`${supabaseUrl}/auth/v1/signup`, {
      headers: { apikey: supabaseAnonKey!, 'Content-Type': 'application/json' },
      data: { email: dmEmail, password: testPassword },
    });
    expect(signupRes.ok()).toBeTruthy();
    dmToken = ((await signupRes.json()) as { access_token: string }).access_token;
    expect(dmToken).toBeTruthy();

    const campaignRes = await request.post(`${apiURL}/api/campaigns`, {
      headers: { Authorization: `Bearer ${dmToken}` },
      data: { name: 'Phase-6 Permission Campaign', status: 'Active' },
    });
    expect(campaignRes.status()).toBe(201);
    campaignId = (
      (await campaignRes.json()) as { campaign: { id: string } }
    ).campaign.id;
  });

  test.afterAll(async ({ request }) => {
    if (apiURL && dmToken && campaignId) {
      await request.delete(`${apiURL}/api/campaigns/${campaignId}`, {
        headers: { Authorization: `Bearer ${dmToken}` },
      });
    }
  });

  // ── Campaign ──────────────────────────────────────────────────────────────

  test.describe('Campaign dm_notes visibility', () => {
    test.beforeAll(async ({ request }) => {
      // Set dm_notes on the existing campaign
      await request.put(`${apiURL}/api/campaigns/${campaignId}`, {
        headers: { Authorization: `Bearer ${dmToken}` },
        data: { dm_notes: 'DM-only campaign secret' },
      });
    });

    test('GET campaign as DM includes dm_notes', async ({ request }) => {
      const res = await request.get(`${apiURL}/api/campaigns/${campaignId}`, {
        headers: { Authorization: `Bearer ${dmToken}` },
      });
      expect(res.status()).toBe(200);
      const body = (await res.json()) as { campaign: Record<string, unknown> };
      expect(body.campaign.dm_notes).toBe('DM-only campaign secret');
    });

    test('GET campaign with ?view=player strips dm_notes', async ({ request }) => {
      const res = await request.get(
        `${apiURL}/api/campaigns/${campaignId}?view=player`,
        { headers: { Authorization: `Bearer ${dmToken}` } },
      );
      expect(res.status()).toBe(200);
      const body = (await res.json()) as { campaign: Record<string, unknown> };
      expect(body.campaign.dm_notes).toBeUndefined();
    });
  });

  // ── Sessions ──────────────────────────────────────────────────────────────

  test.describe('Session dm_notes visibility', () => {
    let sessionId: string;

    test.beforeAll(async ({ request }) => {
      const res = await request.post(
        `${apiURL}/api/campaigns/${campaignId}/sessions`,
        {
          headers: { Authorization: `Bearer ${dmToken}` },
          data: {
            campaign_id: campaignId,
            session_number: 1,
            title: 'Perm Test Session',
            date_played: '2026-01-01',
            dm_notes: 'DM-only session secret',
          },
        },
      );
      expect(res.status()).toBe(201);
      sessionId = ((await res.json()) as { session: { id: string } }).session.id;
    });

    test('GET session as DM includes dm_notes', async ({ request }) => {
      const res = await request.get(
        `${apiURL}/api/campaigns/${campaignId}/sessions/${sessionId}`,
        { headers: { Authorization: `Bearer ${dmToken}` } },
      );
      expect(res.status()).toBe(200);
      const body = (await res.json()) as { session: Record<string, unknown> };
      expect(body.session.dm_notes).toBe('DM-only session secret');
    });

    test('GET session with ?view=player strips dm_notes', async ({ request }) => {
      const res = await request.get(
        `${apiURL}/api/campaigns/${campaignId}/sessions/${sessionId}?view=player`,
        { headers: { Authorization: `Bearer ${dmToken}` } },
      );
      expect(res.status()).toBe(200);
      const body = (await res.json()) as { session: Record<string, unknown> };
      expect(body.session.dm_notes).toBeUndefined();
    });

    test('LIST sessions with ?view=player strips dm_notes from all entries', async ({
      request,
    }) => {
      const res = await request.get(
        `${apiURL}/api/campaigns/${campaignId}/sessions?view=player`,
        { headers: { Authorization: `Bearer ${dmToken}` } },
      );
      expect(res.status()).toBe(200);
      const body = (await res.json()) as { sessions: Record<string, unknown>[] };
      for (const s of body.sessions) {
        expect(s.dm_notes).toBeUndefined();
      }
    });
  });

  // ── Characters ────────────────────────────────────────────────────────────

  test.describe('Character dm_notes visibility', () => {
    let characterId: string;

    test.beforeAll(async ({ request }) => {
      const res = await request.post(
        `${apiURL}/api/campaigns/${campaignId}/characters`,
        {
          headers: { Authorization: `Bearer ${dmToken}` },
          data: {
            campaign_id: campaignId,
            name: 'Perm Test Character',
            dm_notes: 'DM-only character secret',
          },
        },
      );
      expect(res.status()).toBe(201);
      characterId = (
        (await res.json()) as { character: { id: string } }
      ).character.id;
    });

    test('GET character as DM includes dm_notes', async ({ request }) => {
      const res = await request.get(
        `${apiURL}/api/campaigns/${campaignId}/characters/${characterId}`,
        { headers: { Authorization: `Bearer ${dmToken}` } },
      );
      expect(res.status()).toBe(200);
      const body = (await res.json()) as { character: Record<string, unknown> };
      expect(body.character.dm_notes).toBe('DM-only character secret');
    });

    test('GET character with ?view=player strips dm_notes', async ({ request }) => {
      const res = await request.get(
        `${apiURL}/api/campaigns/${campaignId}/characters/${characterId}?view=player`,
        { headers: { Authorization: `Bearer ${dmToken}` } },
      );
      expect(res.status()).toBe(200);
      const body = (await res.json()) as { character: Record<string, unknown> };
      expect(body.character.dm_notes).toBeUndefined();
    });

    test('LIST characters with ?view=player strips dm_notes from all entries', async ({
      request,
    }) => {
      const res = await request.get(
        `${apiURL}/api/campaigns/${campaignId}/characters?view=player`,
        { headers: { Authorization: `Bearer ${dmToken}` } },
      );
      expect(res.status()).toBe(200);
      const body = (await res.json()) as {
        characters: Record<string, unknown>[];
      };
      for (const c of body.characters) {
        expect(c.dm_notes).toBeUndefined();
      }
    });
  });

  // ── NPCs ──────────────────────────────────────────────────────────────────

  test.describe('NPC dm_notes visibility', () => {
    let npcId: string;

    test.beforeAll(async ({ request }) => {
      const res = await request.post(
        `${apiURL}/api/campaigns/${campaignId}/npcs`,
        {
          headers: { Authorization: `Bearer ${dmToken}` },
          data: {
            name: 'Perm Test NPC',
            status: 'Alive',
            dm_notes: 'DM-only NPC secret',
          },
        },
      );
      expect(res.status()).toBe(201);
      npcId = ((await res.json()) as { npc: { id: string } }).npc.id;
    });

    test('GET NPC as DM includes dm_notes', async ({ request }) => {
      const res = await request.get(
        `${apiURL}/api/campaigns/${campaignId}/npcs/${npcId}`,
        { headers: { Authorization: `Bearer ${dmToken}` } },
      );
      expect(res.status()).toBe(200);
      const body = (await res.json()) as { npc: Record<string, unknown> };
      expect(body.npc.dm_notes).toBe('DM-only NPC secret');
    });

    test('GET NPC with ?view=player strips dm_notes', async ({ request }) => {
      const res = await request.get(
        `${apiURL}/api/campaigns/${campaignId}/npcs/${npcId}?view=player`,
        { headers: { Authorization: `Bearer ${dmToken}` } },
      );
      expect(res.status()).toBe(200);
      const body = (await res.json()) as { npc: Record<string, unknown> };
      expect(body.npc.dm_notes).toBeUndefined();
    });

    test('LIST NPCs with ?view=player strips dm_notes from all entries', async ({
      request,
    }) => {
      const res = await request.get(
        `${apiURL}/api/campaigns/${campaignId}/npcs?view=player`,
        { headers: { Authorization: `Bearer ${dmToken}` } },
      );
      expect(res.status()).toBe(200);
      const body = (await res.json()) as { npcs: Record<string, unknown>[] };
      for (const n of body.npcs) {
        expect(n.dm_notes).toBeUndefined();
      }
    });
  });

  // ── Locations ─────────────────────────────────────────────────────────────

  test.describe('Location dm_notes visibility', () => {
    let locationId: string;

    test.beforeAll(async ({ request }) => {
      const res = await request.post(
        `${apiURL}/api/campaigns/${campaignId}/locations`,
        {
          headers: { Authorization: `Bearer ${dmToken}` },
          data: {
            name: 'Perm Test Location',
            dm_notes: 'DM-only location secret',
          },
        },
      );
      expect(res.status()).toBe(201);
      locationId = (
        (await res.json()) as { location: { id: string } }
      ).location.id;
    });

    test('GET location as DM includes dm_notes', async ({ request }) => {
      const res = await request.get(
        `${apiURL}/api/campaigns/${campaignId}/locations/${locationId}`,
        { headers: { Authorization: `Bearer ${dmToken}` } },
      );
      expect(res.status()).toBe(200);
      const body = (await res.json()) as { location: Record<string, unknown> };
      expect(body.location.dm_notes).toBe('DM-only location secret');
    });

    test('GET location with ?view=player strips dm_notes', async ({ request }) => {
      const res = await request.get(
        `${apiURL}/api/campaigns/${campaignId}/locations/${locationId}?view=player`,
        { headers: { Authorization: `Bearer ${dmToken}` } },
      );
      expect(res.status()).toBe(200);
      const body = (await res.json()) as { location: Record<string, unknown> };
      expect(body.location.dm_notes).toBeUndefined();
    });

    test('LIST locations with ?view=player strips dm_notes from all entries', async ({
      request,
    }) => {
      const res = await request.get(
        `${apiURL}/api/campaigns/${campaignId}/locations?view=player`,
        { headers: { Authorization: `Bearer ${dmToken}` } },
      );
      expect(res.status()).toBe(200);
      const body = (await res.json()) as {
        locations: Record<string, unknown>[];
      };
      for (const l of body.locations) {
        expect(l.dm_notes).toBeUndefined();
      }
    });
  });

  // ── Factions ──────────────────────────────────────────────────────────────

  test.describe('Faction dm_notes visibility', () => {
    let factionId: string;

    test.beforeAll(async ({ request }) => {
      const res = await request.post(
        `${apiURL}/api/campaigns/${campaignId}/factions`,
        {
          headers: { Authorization: `Bearer ${dmToken}` },
          data: {
            campaign_id: campaignId,
            name: 'Perm Test Faction',
            dm_notes: 'DM-only faction secret',
          },
        },
      );
      expect(res.status()).toBe(201);
      factionId = (
        (await res.json()) as { faction: { id: string } }
      ).faction.id;
    });

    test('GET faction as DM includes dm_notes', async ({ request }) => {
      const res = await request.get(
        `${apiURL}/api/campaigns/${campaignId}/factions/${factionId}`,
        { headers: { Authorization: `Bearer ${dmToken}` } },
      );
      expect(res.status()).toBe(200);
      const body = (await res.json()) as { faction: Record<string, unknown> };
      expect(body.faction.dm_notes).toBe('DM-only faction secret');
    });

    test('GET faction with ?view=player strips dm_notes', async ({ request }) => {
      const res = await request.get(
        `${apiURL}/api/campaigns/${campaignId}/factions/${factionId}?view=player`,
        { headers: { Authorization: `Bearer ${dmToken}` } },
      );
      expect(res.status()).toBe(200);
      const body = (await res.json()) as { faction: Record<string, unknown> };
      expect(body.faction.dm_notes).toBeUndefined();
    });

    test('LIST factions with ?view=player strips dm_notes from all entries', async ({
      request,
    }) => {
      const res = await request.get(
        `${apiURL}/api/campaigns/${campaignId}/factions?view=player`,
        { headers: { Authorization: `Bearer ${dmToken}` } },
      );
      expect(res.status()).toBe(200);
      const body = (await res.json()) as {
        factions: Record<string, unknown>[];
      };
      for (const f of body.factions) {
        expect(f.dm_notes).toBeUndefined();
      }
    });
  });

  // ── Lore ──────────────────────────────────────────────────────────────────

  test.describe('Lore dm_notes visibility + Private entry filtering', () => {
    let publicLoreId: string;
    let privateLoreId: string;

    test.beforeAll(async ({ request }) => {
      // Public lore with dm_notes
      const pubRes = await request.post(
        `${apiURL}/api/campaigns/${campaignId}/lore`,
        {
          headers: { Authorization: `Bearer ${dmToken}` },
          data: {
            campaign_id: campaignId,
            title: 'Public Lore Entry',
            category: 'History',
            visibility: 'Public',
            dm_notes: 'DM-only lore secret',
          },
        },
      );
      expect(pubRes.status()).toBe(201);
      publicLoreId = ((await pubRes.json()) as { lore: { id: string } }).lore.id;

      // Private lore entry
      const privRes = await request.post(
        `${apiURL}/api/campaigns/${campaignId}/lore`,
        {
          headers: { Authorization: `Bearer ${dmToken}` },
          data: {
            campaign_id: campaignId,
            title: 'Private Lore Entry — DM Eyes Only',
            category: 'Other',
            visibility: 'Private',
          },
        },
      );
      expect(privRes.status()).toBe(201);
      privateLoreId = (
        (await privRes.json()) as { lore: { id: string } }
      ).lore.id;
    });

    test('GET public lore as DM includes dm_notes', async ({ request }) => {
      const res = await request.get(
        `${apiURL}/api/campaigns/${campaignId}/lore/${publicLoreId}`,
        { headers: { Authorization: `Bearer ${dmToken}` } },
      );
      expect(res.status()).toBe(200);
      const body = (await res.json()) as { lore: Record<string, unknown> };
      expect(body.lore.dm_notes).toBe('DM-only lore secret');
    });

    test('GET public lore with ?view=player strips dm_notes', async ({
      request,
    }) => {
      const res = await request.get(
        `${apiURL}/api/campaigns/${campaignId}/lore/${publicLoreId}?view=player`,
        { headers: { Authorization: `Bearer ${dmToken}` } },
      );
      expect(res.status()).toBe(200);
      const body = (await res.json()) as { lore: Record<string, unknown> };
      expect(body.lore.dm_notes).toBeUndefined();
    });

    test('LIST lore as DM includes both public and private entries', async ({
      request,
    }) => {
      const res = await request.get(
        `${apiURL}/api/campaigns/${campaignId}/lore`,
        { headers: { Authorization: `Bearer ${dmToken}` } },
      );
      expect(res.status()).toBe(200);
      const body = (await res.json()) as { lore: { id: string }[] };
      const ids = body.lore.map((l) => l.id);
      expect(ids).toContain(publicLoreId);
      expect(ids).toContain(privateLoreId);
    });

    test('LIST lore with ?view=player strips dm_notes and omits Private entries', async ({
      request,
    }) => {
      const res = await request.get(
        `${apiURL}/api/campaigns/${campaignId}/lore?view=player`,
        { headers: { Authorization: `Bearer ${dmToken}` } },
      );
      expect(res.status()).toBe(200);
      const body = (await res.json()) as { lore: Record<string, unknown>[] };

      // Private entry must not appear at all
      const ids = body.lore.map((l) => l['id']);
      expect(ids).not.toContain(privateLoreId);

      // dm_notes must be absent from every visible entry
      for (const l of body.lore) {
        expect(l.dm_notes).toBeUndefined();
      }
    });

    test('GET private lore entry with ?view=player returns 404 or filters it out', async ({
      request,
    }) => {
      // Accessing a Private entry directly in player view should be denied.
      // The API may return 404 (not found) or 403 (forbidden) — either is acceptable.
      const res = await request.get(
        `${apiURL}/api/campaigns/${campaignId}/lore/${privateLoreId}?view=player`,
        { headers: { Authorization: `Bearer ${dmToken}` } },
      );
      expect([403, 404]).toContain(res.status());
    });
  });
});
