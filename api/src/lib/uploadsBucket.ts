import { supabaseService } from './supabaseService.js';
import { UPLOAD_MAX_BYTES, UPLOAD_MIME_TYPES } from '@tabletop/shared';

export const UPLOADS_BUCKET = 'uploads';

const BUCKET_CONFIG = {
  public: false,
  fileSizeLimit: UPLOAD_MAX_BYTES,
  allowedMimeTypes: [...UPLOAD_MIME_TYPES] as string[],
};

// Idempotent bootstrap — called once at API startup. If the bucket already
// exists we update its settings to enforce the correct limits; a pre-existing
// public bucket would otherwise bypass the private-storage requirement.
export async function ensureUploadsBucket(): Promise<void> {
  const { error: createErr } = await supabaseService.storage.createBucket(
    UPLOADS_BUCKET,
    BUCKET_CONFIG,
  );
  if (!createErr) return;

  const msg = createErr.message?.toLowerCase() ?? '';
  if (!msg.includes('already exists') && !msg.includes('duplicate')) {
    throw new Error(`failed to ensure uploads bucket: ${createErr.message}`);
  }

  // Bucket exists — enforce correct settings in case it was created differently.
  const { error: updateErr } = await supabaseService.storage.updateBucket(
    UPLOADS_BUCKET,
    BUCKET_CONFIG,
  );
  if (updateErr) {
    throw new Error(`failed to update uploads bucket settings: ${updateErr.message}`);
  }
}
