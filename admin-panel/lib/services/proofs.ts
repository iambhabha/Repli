import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';

import { REPLI_PROOFS_BUCKET, REPLI_ROOT } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabase/admin';

export type ProofLocation =
  | { kind: 'url'; url: string }
  | { kind: 'file'; absolutePath: string; contentType: string; size: number }
  | { kind: 'unavailable'; reason: string };

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
};

/**
 * The bot stores payment screenshots on its own disk (mode 0600, outside any
 * web root) and only records the relative path - a deliberate privacy choice
 * in src/services/paymentService.js. So "View proof" has three cases:
 *
 *   1. proof_url is already a link            -> use it
 *   2. a private Storage bucket is configured -> hand out a short-lived signed URL
 *   3. the panel runs beside the bot          -> stream the file off disk
 *
 * When none apply (typical Vercel deployment, proofs on a laptop) we say so
 * plainly instead of showing a broken image.
 */
export async function resolveProof(proofUrl: string | null): Promise<ProofLocation> {
  const value = (proofUrl ?? '').trim();

  if (!value) {
    return { kind: 'unavailable', reason: 'No payment proof was attached to this order.' };
  }

  if (/^https?:\/\//i.test(value)) {
    return { kind: 'url', url: value };
  }

  if (REPLI_PROOFS_BUCKET) {
    const objectPath = value.replace(/^data\/proofs\//, '');
    const { data, error } = await supabaseAdmin()
      .storage.from(REPLI_PROOFS_BUCKET)
      .createSignedUrl(objectPath, 300);

    if (!error && data?.signedUrl) {
      return { kind: 'url', url: data.signedUrl };
    }
  }

  if (REPLI_ROOT) {
    const root = path.resolve(REPLI_ROOT);
    const absolute = path.resolve(root, value);

    // Path traversal guard: proof_url comes from the database, and the database
    // is only as trustworthy as everything that writes to it.
    if (absolute !== root && !absolute.startsWith(root + path.sep)) {
      return { kind: 'unavailable', reason: 'This proof file is outside the Repli folder.' };
    }

    try {
      const info = await stat(absolute);
      if (info.isFile()) {
        return {
          kind: 'file',
          absolutePath: absolute,
          contentType: CONTENT_TYPES[path.extname(absolute).toLowerCase()] ?? 'application/octet-stream',
          size: info.size,
        };
      }
    } catch {
      return {
        kind: 'unavailable',
        reason: 'The proof file is not on this machine. Open the panel on the computer running the bot.',
      };
    }
  }

  return {
    kind: 'unavailable',
    reason:
      'Payment proofs live on the bot machine. Set REPLI_ROOT (or REPLI_PROOFS_BUCKET) to view them here.',
  };
}

/** Node stream -> Web stream, so a Route Handler can return the file directly. */
export function fileStream(absolutePath: string): ReadableStream<Uint8Array> {
  const nodeStream = createReadStream(absolutePath);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      nodeStream.on('data', (chunk) => {
        controller.enqueue(new Uint8Array(chunk as Buffer));
      });
      nodeStream.on('end', () => controller.close());
      nodeStream.on('error', (error) => controller.error(error));
    },
    cancel() {
      nodeStream.destroy();
    },
  });
}
