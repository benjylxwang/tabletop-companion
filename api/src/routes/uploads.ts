import { Router } from 'express';
import multer, { MulterError } from 'multer';
import { randomUUID } from 'node:crypto';
import {
  SignedUrlRequest,
  SignedUrlResponse,
  UploadResponse,
  UPLOAD_MAX_BYTES,
  UPLOAD_MIME_TYPES,
} from '@tabletop/shared';
import { supabaseService } from '../lib/supabaseService.js';
import { UPLOADS_BUCKET } from '../lib/uploadsBucket.js';
import { HttpError, ValidationError, sendError } from '../lib/httpErrors.js';

// 1-hour signed URLs: long enough that the frontend rarely needs to refresh
// mid-session, short enough that a leaked URL stops working quickly.
const SIGNED_URL_TTL_SECONDS = 60 * 60;

const EXT_FOR_MIME: Record<(typeof UPLOAD_MIME_TYPES)[number], string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'application/pdf': 'pdf',
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: UPLOAD_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if ((UPLOAD_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
      cb(null, true);
      return;
    }
    // Reject by passing an error; translated into a 400 in the route handler.
    cb(new MulterError('LIMIT_UNEXPECTED_FILE', 'unsupported_mime_type'));
  },
});

function expiresAt(ttlSeconds: number): string {
  return new Date(Date.now() + ttlSeconds * 1000).toISOString();
}

export const uploadsRouter = Router();

// ─── POST /uploads ───────────────────────────────────────────────────────────

uploadsRouter.post('/', (req, res) => {
  upload.single('file')(req, res, async (err: unknown) => {
    try {
      if (err instanceof MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          throw new ValidationError('file_too_large');
        }
        if (err.field === 'unsupported_mime_type') {
          throw new ValidationError('unsupported_mime_type');
        }
        throw new ValidationError('invalid_upload');
      }
      if (err) {
        throw new HttpError(500, 'upload_failed');
      }

      const file = req.file;
      if (!file) throw new ValidationError('missing_file');

      const mime = file.mimetype as (typeof UPLOAD_MIME_TYPES)[number];
      const ext = EXT_FOR_MIME[mime];
      const userId = req.user!.id;
      const path = `${userId}/${randomUUID()}.${ext}`;

      const { error: uploadError } = await supabaseService.storage
        .from(UPLOADS_BUCKET)
        .upload(path, file.buffer, { contentType: mime });

      if (uploadError) throw new HttpError(500, 'storage_upload_failed');

      const { data: signed, error: signError } = await supabaseService.storage
        .from(UPLOADS_BUCKET)
        .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

      if (signError || !signed) throw new HttpError(500, 'signed_url_failed');

      res.status(201).json(
        UploadResponse.parse({
          path,
          url: signed.signedUrl,
          expiresAt: expiresAt(SIGNED_URL_TTL_SECONDS),
          contentType: mime,
          size: file.size,
        }),
      );
    } catch (thrown) {
      sendError(res, thrown);
    }
  });
});

// ─── POST /uploads/sign ──────────────────────────────────────────────────────
//
// Refreshes a signed URL. The path must begin with the requesting user's own
// prefix — campaign members only encounter paths that they uploaded themselves.
// Players viewing shared assets (cover images, location maps) presented by
// entity detail pages have those paths resolved server-side; this endpoint is
// only called for assets the user personally manages.

uploadsRouter.post('/sign', async (req, res) => {
  try {
    const parsed = SignedUrlRequest.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('invalid body', parsed.error.flatten());
    }

    const userId = req.user!.id;
    if (!parsed.data.path.startsWith(`${userId}/`)) {
      throw new HttpError(403, 'forbidden');
    }

    const { data: signed, error: signError } = await supabaseService.storage
      .from(UPLOADS_BUCKET)
      .createSignedUrl(parsed.data.path, SIGNED_URL_TTL_SECONDS);

    if (signError || !signed) throw new HttpError(500, 'signed_url_failed');

    res.json(
      SignedUrlResponse.parse({
        url: signed.signedUrl,
        expiresAt: expiresAt(SIGNED_URL_TTL_SECONDS),
      }),
    );
  } catch (err) {
    sendError(res, err);
  }
});
