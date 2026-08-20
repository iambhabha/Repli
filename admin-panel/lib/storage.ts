import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * Uploading the shop's own files - product photos, the payment QR.
 *
 * The panel is on Vercel and the bot is on a server, so neither can write to
 * the other's disk. Supabase Storage is the one place both already have
 * credentials for, and it is the reason the owner can finally add a product
 * picture without editing SQL.
 *
 * What is written to the database is a reference, never a URL:
 *
 *   storage:repli-media/products/TS001-1735910000.png
 *
 * The bot refuses to send anything that looks like a link, on purpose - a URL
 * in a database column is a URL somebody could eventually point anywhere. A
 * reference names a bucket the shop owns and a key this file built, and the
 * bot re-validates both before it downloads a single byte.
 *
 * Server only: it uses the service-role client, which throws if it is ever
 * evaluated in a browser.
 */

const PREFIX = 'storage:';

/** Must match src/db/storage.js. tests/storage.test.js checks that they agree. */
const KEY_SHAPE = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/;
const BUCKET_SHAPE = /^[a-z0-9][a-z0-9-]{1,62}$/;

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * What the shop is willing to store, by what the file actually contains.
 *
 * The extension is derived from the type rather than taken from the uploaded
 * name: a browser will happily send "invoice.png" for a PDF, and the name is
 * the one part of an upload nobody should trust.
 */
export const ALLOWED_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export function bucket(): string {
  return process.env.STORAGE_BUCKET || 'repli-media';
}

export function isReference(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

/** Fails closed: an unparseable reference is treated as no reference at all. */
export function parseReference(value: unknown): { bucket: string; key: string } | null {
  if (!isReference(value)) return null;

  const body = value.slice(PREFIX.length);
  const slash = body.indexOf('/');
  if (slash <= 0) return null;

  const name = body.slice(0, slash);
  const key = body.slice(slash + 1);

  if (!BUCKET_SHAPE.test(name)) return null;
  if (!KEY_SHAPE.test(key)) return null;
  if (key.includes('..') || key.startsWith('/')) return null;

  return { bucket: name, key };
}

/**
 * The first bytes of a file, checked against what the upload claimed to be.
 *
 * A content type is whatever the browser felt like sending. The magic number
 * is what the file actually is, and disagreement means the upload is refused
 * rather than stored and worried about later.
 */
function looksLike(type: string, bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  const b = bytes;

  if (type === 'image/png') {
    return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  }
  if (type === 'image/jpeg') {
    return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  }
  if (type === 'image/webp') {
    // "RIFF" .... "WEBP"
    return (
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
    );
  }
  return false;
}

export interface UploadResult {
  ok: boolean;
  reference?: string;
  reason?: string;
}

/**
 * Validate a file and put it in the bucket.
 *
 * @param folder  a fixed, code-chosen prefix: 'products', 'variants', 'qr'
 * @param name    something stable about the row, used to build the key
 */
export async function uploadMedia(
  folder: string,
  name: string,
  file: { type: string; size: number; arrayBuffer(): Promise<ArrayBuffer> }
): Promise<UploadResult> {
  const type = String(file.type || '').toLowerCase();
  const extension = ALLOWED_TYPES[type];

  if (!extension) return { ok: false, reason: 'Only PNG, JPEG and WebP images can be uploaded.' };
  if (!file.size) return { ok: false, reason: 'That file is empty.' };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, reason: 'Images must be under 5 MB.' };

  const buffer = new Uint8Array(await file.arrayBuffer());
  if (buffer.length > MAX_UPLOAD_BYTES) return { ok: false, reason: 'Images must be under 5 MB.' };
  if (!looksLike(type, buffer)) {
    return { ok: false, reason: 'That file does not look like the image type it claims to be.' };
  }

  // The key is built here, never taken from the upload. Anything the caller
  // supplied is reduced to a safe slug first.
  const slug = String(name || 'item')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'item';
  const safeFolder = String(folder).replace(/[^a-z]/g, '') || 'media';
  const key = `${safeFolder}/${slug}-${Date.now()}.${extension}`;

  if (!KEY_SHAPE.test(key)) return { ok: false, reason: 'Could not build a safe file name.' };

  const target = bucket();
  const { error } = await supabaseAdmin()
    .storage.from(target)
    .upload(key, buffer, { contentType: type, upsert: false });

  if (error) return { ok: false, reason: `Upload failed: ${error.message}` };

  return { ok: true, reference: `${PREFIX}${target}/${key}` };
}

/**
 * Delete a stored object. Best effort by design.
 *
 * This is only ever called for a file that has already been replaced in the
 * database, so a failure leaves an orphan in the bucket - untidy, and far
 * better than a row pointing at something that is gone.
 */
export async function removeMedia(reference: unknown): Promise<void> {
  const parsed = parseReference(reference);
  if (!parsed) return;

  try {
    await supabaseAdmin().storage.from(parsed.bucket).remove([parsed.key]);
  } catch (error) {
    console.error('[storage] could not remove', parsed.key, error);
  }
}

/** A short-lived link, for showing the picture in the panel itself. */
export async function signedUrl(reference: unknown, seconds = 300): Promise<string | null> {
  const parsed = parseReference(reference);
  if (!parsed) return null;

  const { data, error } = await supabaseAdmin()
    .storage.from(parsed.bucket)
    .createSignedUrl(parsed.key, seconds);

  return error ? null : (data?.signedUrl ?? null);
}
