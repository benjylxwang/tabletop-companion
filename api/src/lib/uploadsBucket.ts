import { supabaseService } from './supabaseService.js';
import { UPLOAD_MAX_BYTES, UPLOAD_MIME_TYPES } from '@tabletop/shared';

export const UPLOADS_BUCKET = 'uploads';

// Idempotent bootstrap — called once at API startup. Creating a bucket that
// already exists returns 409; any other failure is fatal because uploads
// wouldn't work without the bucket.
export async function ensureUploadsBucket(): Promise<void> {
  const { error } = await supabaseService.storage.createBucket(UPLOADS_BUCKET, {
    public: false,
    fileSizeLimit: UPLOAD_MAX_BYTES,
    allowedMimeTypes: [...UPLOAD_MIME_TYPES],
  });
  if (!error) return;
  const message = error.message?.toLowerCase() ?? '';
  if (message.includes('already exists') || message.includes('duplicate')) return;
  throw new Error(`failed to ensure uploads bucket: ${error.message}`);
}
