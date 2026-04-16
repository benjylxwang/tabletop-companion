import { test, expect } from '@playwright/test';

const apiURL = process.env.PLAYWRIGHT_API_URL;
const supabaseUrl = process.env.PLAYWRIGHT_SUPABASE_URL;
const supabaseAnonKey = process.env.PLAYWRIGHT_SUPABASE_ANON_KEY;

// ─── Minimal valid file bytes ─────────────────────────────────────────────────
//
// Inline fixtures avoid a `fixtures/` directory dependency while staying small
// enough to not affect test speed.

// 1×1 transparent PNG (67 bytes).
const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// 1×1 white JPEG.
const JPEG_B64 =
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwg' +
  'JC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIy' +
  'MjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFgAB' +
  'AQEAAAAAAAAAAAAAAAAABgUE/8QAIRAAAQQCAgMBAAAAAAAAAAAAAQIDBBEhMRJBUWH/xAAUAQEAAAAAAAAA' +
  'AAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKnpFdRtFimtXLasQOp02TE' +
  'ySSSSSSSSSSSST/2Q==';

// Minimal valid PDF (one-page, no content).
const PDF_TEXT =
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj ' +
  '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj ' +
  '3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj ' +
  'xref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n' +
  '0000000115 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF';

// ─── Auth & fixture state ─────────────────────────────────────────────────────

let token: string;
let campaignId: string;
let locationId: string;
let characterId: string;

const testEmail = `e2e-uploads-${Date.now()}@example.com`;
const testPassword = 'E2eTestPass1!';

test.describe('File Uploads (API)', () => {
  test.skip(!apiURL || !supabaseUrl || !supabaseAnonKey, 'API/Supabase env vars required');

  test.beforeAll(async ({ request }) => {
    // Sign up and get a token.
    const signupRes = await request.post(`${supabaseUrl}/auth/v1/signup`, {
      headers: { apikey: supabaseAnonKey!, 'Content-Type': 'application/json' },
      data: { email: testEmail, password: testPassword },
    });
    expect(signupRes.ok()).toBeTruthy();
    token = ((await signupRes.json()) as { access_token: string }).access_token;
    expect(token).toBeTruthy();

    // Create a campaign.
    const campRes = await request.post(`${apiURL}/api/campaigns`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: 'Uploads E2E Campaign', status: 'Active' },
    });
    expect(campRes.status()).toBe(201);
    campaignId = ((await campRes.json()) as { campaign: { id: string } }).campaign.id;

    // Create a location.
    const locRes = await request.post(`${apiURL}/api/campaigns/${campaignId}/locations`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: 'Test Location' },
    });
    expect(locRes.status()).toBe(201);
    locationId = ((await locRes.json()) as { location: { id: string } }).location.id;

    // Create a character.
    const charRes = await request.post(`${apiURL}/api/campaigns/${campaignId}/characters`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { campaign_id: campaignId, name: 'Test Character' },
    });
    expect(charRes.status()).toBe(201);
    characterId = ((await charRes.json()) as { character: { id: string } }).character.id;
  });

  test.afterAll(async ({ request }) => {
    if (apiURL && token && campaignId) {
      await request.delete(`${apiURL}/api/campaigns/${campaignId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  });

  // ─── POST /api/uploads ──────────────────────────────────────────────────────

  test('POST /api/uploads — accepts PNG and returns path + signed URL', async ({ request }) => {
    const res = await request.post(`${apiURL}/api/uploads`, {
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        file: {
          name: 'cover.png',
          mimeType: 'image/png',
          buffer: Buffer.from(PNG_B64, 'base64'),
        },
      },
    });
    expect(res.status()).toBe(201);
    const body = (await res.json()) as {
      path: string;
      url: string;
      expiresAt: string;
      contentType: string;
      size: number;
    };
    expect(body.contentType).toBe('image/png');
    expect(body.size).toBeGreaterThan(0);
    expect(body.path).toMatch(/^[^/]+\/[0-9a-f-]{36}\.png$/);
    expect(body.url).toMatch(/^https?:\/\//);
    expect(typeof body.expiresAt).toBe('string');
  });

  test('POST /api/uploads — accepts JPEG', async ({ request }) => {
    const res = await request.post(`${apiURL}/api/uploads`, {
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        file: {
          name: 'map.jpg',
          mimeType: 'image/jpeg',
          buffer: Buffer.from(JPEG_B64, 'base64'),
        },
      },
    });
    expect(res.status()).toBe(201);
    const body = (await res.json()) as { contentType: string };
    expect(body.contentType).toBe('image/jpeg');
  });

  test('POST /api/uploads — accepts PDF', async ({ request }) => {
    const res = await request.post(`${apiURL}/api/uploads`, {
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        file: {
          name: 'sheet.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.from(PDF_TEXT, 'utf-8'),
        },
      },
    });
    expect(res.status()).toBe(201);
    const body = (await res.json()) as { contentType: string };
    expect(body.contentType).toBe('application/pdf');
  });

  test('POST /api/uploads — rejects unsupported MIME', async ({ request }) => {
    const res = await request.post(`${apiURL}/api/uploads`, {
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        file: {
          name: 'evil.exe',
          mimeType: 'application/octet-stream',
          buffer: Buffer.from('not a real file'),
        },
      },
    });
    expect(res.status()).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('unsupported_mime_type');
  });

  test('POST /api/uploads — requires auth', async ({ request }) => {
    const res = await request.post(`${apiURL}/api/uploads`, {
      multipart: {
        file: {
          name: 'cover.png',
          mimeType: 'image/png',
          buffer: Buffer.from(PNG_B64, 'base64'),
        },
      },
    });
    expect(res.status()).toBe(401);
  });

  // ─── POST /api/uploads/sign ─────────────────────────────────────────────────

  test('POST /api/uploads/sign — returns fresh signed URL for a path', async ({ request }) => {
    // Upload first to obtain a real path.
    const uploadRes = await request.post(`${apiURL}/api/uploads`, {
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        file: {
          name: 'cover.png',
          mimeType: 'image/png',
          buffer: Buffer.from(PNG_B64, 'base64'),
        },
      },
    });
    expect(uploadRes.status()).toBe(201);
    const { path } = (await uploadRes.json()) as { path: string };

    // Sign it.
    const signRes = await request.post(`${apiURL}/api/uploads/sign`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { path },
    });
    expect(signRes.status()).toBe(200);
    const signBody = (await signRes.json()) as { url: string; expiresAt: string };
    expect(signBody.url).toMatch(/^https?:\/\//);
    expect(typeof signBody.expiresAt).toBe('string');
  });

  test('POST /api/uploads/sign — rejects missing path', async ({ request }) => {
    const res = await request.post(`${apiURL}/api/uploads/sign`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  // ─── End-to-end entity flows ────────────────────────────────────────────────

  test('campaign cover: upload → PUT → GET preserves path', async ({ request }) => {
    // Upload a cover image.
    const uploadRes = await request.post(`${apiURL}/api/uploads`, {
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        file: {
          name: 'cover.png',
          mimeType: 'image/png',
          buffer: Buffer.from(PNG_B64, 'base64'),
        },
      },
    });
    expect(uploadRes.status()).toBe(201);
    const { path } = (await uploadRes.json()) as { path: string };

    // Persist on the campaign.
    const putRes = await request.put(`${apiURL}/api/campaigns/${campaignId}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { cover_image_url: path },
    });
    expect(putRes.status()).toBe(200);

    // Fetch back and verify.
    const getRes = await request.get(`${apiURL}/api/campaigns/${campaignId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(getRes.status()).toBe(200);
    const body = (await getRes.json()) as { campaign: { cover_image_url: string } };
    expect(body.campaign.cover_image_url).toBe(path);
  });

  test('location map: upload → PUT → GET preserves path', async ({ request }) => {
    const uploadRes = await request.post(`${apiURL}/api/uploads`, {
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        file: {
          name: 'map.jpg',
          mimeType: 'image/jpeg',
          buffer: Buffer.from(JPEG_B64, 'base64'),
        },
      },
    });
    expect(uploadRes.status()).toBe(201);
    const { path } = (await uploadRes.json()) as { path: string };

    const putRes = await request.put(
      `${apiURL}/api/campaigns/${campaignId}/locations/${locationId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: { map_image_url: path },
      },
    );
    expect(putRes.status()).toBe(200);

    const getRes = await request.get(
      `${apiURL}/api/campaigns/${campaignId}/locations/${locationId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const body = (await getRes.json()) as { location: { map_image_url: string } };
    expect(body.location.map_image_url).toBe(path);
  });

  test('character sheet: upload PDF → PATCH → GET preserves path', async ({ request }) => {
    const uploadRes = await request.post(`${apiURL}/api/uploads`, {
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        file: {
          name: 'sheet.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.from(PDF_TEXT, 'utf-8'),
        },
      },
    });
    expect(uploadRes.status()).toBe(201);
    const { path } = (await uploadRes.json()) as { path: string };

    const patchRes = await request.patch(
      `${apiURL}/api/campaigns/${campaignId}/characters/${characterId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: { character_sheet_url: path },
      },
    );
    expect(patchRes.status()).toBe(200);

    const getRes = await request.get(
      `${apiURL}/api/campaigns/${campaignId}/characters/${characterId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const body = (await getRes.json()) as { character: { character_sheet_url: string } };
    expect(body.character.character_sheet_url).toBe(path);
  });

  test('campaign cover: clear by sending null', async ({ request }) => {
    // Ensure we start with a cover set
    const uploadRes = await request.post(`${apiURL}/api/uploads`, {
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        file: {
          name: 'cover.png',
          mimeType: 'image/png',
          buffer: Buffer.from(PNG_B64, 'base64'),
        },
      },
    });
    const { path } = (await uploadRes.json()) as { path: string };
    await request.put(`${apiURL}/api/campaigns/${campaignId}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { cover_image_url: path },
    });

    // Clear it.
    const clearRes = await request.put(`${apiURL}/api/campaigns/${campaignId}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { cover_image_url: null },
    });
    expect(clearRes.status()).toBe(200);

    const getRes = await request.get(`${apiURL}/api/campaigns/${campaignId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await getRes.json()) as { campaign: Record<string, unknown> };
    expect(body.campaign.cover_image_url).toBeUndefined();
  });
});
