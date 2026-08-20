'use strict';

/**
 * Copy payment screenshots that only exist on this machine into the bucket.
 *
 *   node scripts/backfill-proofs.js --dry     see what would happen
 *   node scripts/backfill-proofs.js           do it
 *
 * Since migration 017 a new proof is written to disk AND uploaded, so the
 * panel can show it from anywhere. Proofs taken before that have only the
 * local path, which means "View proof" still says "open the panel on the
 * computer running the bot" for every one of them.
 *
 * This is deliberately the most boring script it could be:
 *
 *   - it only ever ADDS `proof_object`; `proof_url` is never touched, so the
 *     column keeps the meaning the end-to-end suite asserts
 *   - it never deletes a local file - the disk copy stays the primary
 *   - a row that already has a reference is skipped
 *   - a file that is not on this machine is reported and skipped, not failed
 *   - it must be run ON the bot machine, because that is where the files are
 *
 * Safe to run twice. Safe to stop half way. Nothing it does is destructive.
 */

const fs = require('fs');
const path = require('path');

const { supabase } = require('../src/db/supabase');
const storage = require('../src/db/storage');
const config = require('../src/config');

const DRY = process.argv.includes('--dry');

const EXT_MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
};

/** Resolve a stored path, refusing anything that climbs out of the bot folder. */
function localPathFor(proofUrl) {
  const value = String(proofUrl || '').trim();
  if (!value) return null;
  // Already a link or already a reference: not ours to move.
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return null;
  if (storage.isReference(value)) return null;

  const absolute = path.resolve(config.ROOT, value);
  if (path.relative(config.ROOT, absolute).startsWith('..')) return null;
  return absolute;
}

async function main() {
  const { data, error } = await supabase
    .from('payments')
    .select('id,order_id,proof_url,proof_object,orders(order_id)')
    .not('proof_url', 'is', null)
    .is('proof_object', null)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('\n❌ Could not read payments:', error.message, '\n');
    process.exit(1);
  }

  const rows = data || [];
  console.log(`\n${rows.length} proof(s) recorded before migration 017.${DRY ? '  (dry run)' : ''}\n`);

  const tally = { uploaded: 0, missing: 0, skipped: 0, failed: 0 };

  for (const row of rows) {
    const label = (row.orders && row.orders.order_id) || row.id;
    const absolute = localPathFor(row.proof_url);

    if (!absolute) {
      console.log(`  –  ${label}  not a local path, leaving it alone`);
      tally.skipped += 1;
      continue;
    }
    if (!fs.existsSync(absolute)) {
      console.log(`  ?  ${label}  file is not on this machine (${row.proof_url})`);
      tally.missing += 1;
      continue;
    }

    if (DRY) {
      console.log(`  →  ${label}  would upload ${row.proof_url}`);
      tally.uploaded += 1;
      continue;
    }

    try {
      const buffer = fs.readFileSync(absolute);
      const extension = path.extname(absolute).toLowerCase();
      const safe = String(label).replace(/[^A-Za-z0-9_-]/g, '');
      const key = `proofs/${safe}-backfill-${row.id.slice(0, 8)}${extension || '.bin'}`;

      const reference = await storage.upload(key, buffer, {
        contentType: EXT_MIME[extension] || 'application/octet-stream',
      });

      if (!reference) {
        console.log(`  ✗  ${label}  upload refused (too big, or the bucket said no)`);
        tally.failed += 1;
        continue;
      }

      // Only proof_object. proof_url stays exactly as it was.
      const { error: writeError } = await supabase
        .from('payments')
        .update({ proof_object: reference })
        .eq('id', row.id);

      if (writeError) {
        // Do not leave an object nothing points at.
        await storage.remove(reference);
        console.log(`  ✗  ${label}  ${writeError.message}`);
        tally.failed += 1;
        continue;
      }

      console.log(`  ✓  ${label}  ${reference}`);
      tally.uploaded += 1;
    } catch (err) {
      console.log(`  ✗  ${label}  ${err.message}`);
      tally.failed += 1;
    }
  }

  console.log(
    `\n${DRY ? 'Would upload' : 'Uploaded'} ${tally.uploaded}` +
      `  ·  not on this machine ${tally.missing}` +
      `  ·  skipped ${tally.skipped}` +
      `  ·  failed ${tally.failed}\n`
  );

  if (tally.missing) {
    console.log(
      'Proofs "not on this machine" are the ones taken on a different computer.\n' +
        'Run this there too, or accept that those stay local-only.\n'
    );
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌', err && err.message, '\n');
  process.exit(1);
});
