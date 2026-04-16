import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { Request, Response, NextFunction } from 'express';

// ─── Mocks ────────────────────────────────────────────────────────────────────
//
// Uploads flows through multer (express middleware) before reaching our handler,
// so we can't just invoke the handler directly like the location tests do —
// supertest drives a real mini-app to exercise the full pipeline.

const mockUpload = vi.fn();
const mockCreateSignedUrl = vi.fn();

vi.mock('../lib/supabaseService.js', () => ({
  supabaseService: {
    storage: {
      from: () => ({
        upload: (...args: unknown[]) => mockUpload(...args),
        createSignedUrl: (...args: unknown[]) => mockCreateSignedUrl(...args),
      }),
    },
  },
}));

const { uploadsRouter } = await import('./uploads.js');

// ─── App harness ──────────────────────────────────────────────────────────────

function makeApp(): express.Express {
  const app = express();
  app.use(express.json());
  // Stub auth: inject a user onto every request so handlers see `req.user`.
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as Request & { user: { id: string } }).user = { id: 'user-1' };
    next();
  });
  app.use('/api/uploads', uploadsRouter);
  return app;
}

// 1x1 PNG for "valid image" tests.
const PNG_BYTES = Buffer.from(
  '89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4' +
    '890000000A49444154789C63000100000500010D0A2DB40000000049454E44AE426082',
  'hex',
);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/uploads', () => {
  beforeEach(() => {
    mockUpload.mockReset();
    mockCreateSignedUrl.mockReset();
  });

  it('rejects unsupported mime types with 400', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/api/uploads')
      .attach('file', Buffer.from('hello'), {
        filename: 'evil.exe',
        contentType: 'application/octet-stream',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('unsupported_mime_type');
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('stores the file at {userId}/{uuid}.{ext} and returns a signed URL', async () => {
    mockUpload.mockResolvedValue({ error: null });
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://storage.example/signed?t=abc' },
      error: null,
    });

    const app = makeApp();
    const res = await request(app)
      .post('/api/uploads')
      .attach('file', PNG_BYTES, { filename: 'map.png', contentType: 'image/png' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      contentType: 'image/png',
      size: PNG_BYTES.length,
      url: 'https://storage.example/signed?t=abc',
    });
    expect(res.body.path).toMatch(/^user-1\/[0-9a-f-]{36}\.png$/);
    expect(typeof res.body.expiresAt).toBe('string');

    // Supabase upload was called with the same path and file contents.
    const [uploadPath, uploadBuffer, options] = mockUpload.mock.calls[0] as [
      string,
      Buffer,
      { contentType: string },
    ];
    expect(uploadPath).toBe(res.body.path);
    expect(uploadBuffer.equals(PNG_BYTES)).toBe(true);
    expect(options.contentType).toBe('image/png');
  });

  it('returns 500 when storage upload fails', async () => {
    mockUpload.mockResolvedValue({ error: { message: 'boom' } });

    const app = makeApp();
    const res = await request(app)
      .post('/api/uploads')
      .attach('file', PNG_BYTES, { filename: 'map.png', contentType: 'image/png' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('storage_upload_failed');
  });

  it('returns 400 when no file is attached', async () => {
    const app = makeApp();
    const res = await request(app).post('/api/uploads');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('missing_file');
  });
});

describe('POST /api/uploads/sign', () => {
  beforeEach(() => {
    mockCreateSignedUrl.mockReset();
  });

  it('returns a fresh signed URL for the given path', async () => {
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://storage.example/new?t=xyz' },
      error: null,
    });

    const app = makeApp();
    const res = await request(app)
      .post('/api/uploads/sign')
      .send({ path: 'other-user/abc.png' });

    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://storage.example/new?t=xyz');
    expect(typeof res.body.expiresAt).toBe('string');
  });

  it('rejects missing path with 400', async () => {
    const app = makeApp();
    const res = await request(app).post('/api/uploads/sign').send({});
    expect(res.status).toBe(400);
  });

  it('returns 500 when Supabase signing fails', async () => {
    mockCreateSignedUrl.mockResolvedValue({ data: null, error: { message: 'nope' } });

    const app = makeApp();
    const res = await request(app)
      .post('/api/uploads/sign')
      .send({ path: 'user-1/abc.png' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('signed_url_failed');
  });
});
