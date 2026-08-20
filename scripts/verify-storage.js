'use strict';

/**
 * Check the live Storage bucket against what the code needs.
 *
 *   node scripts/verify-storage.js
 *
 * Read only. It changes nothing - not the bucket, not the database, not a
 * single object. Configuration is the one part of this system that lives
 * outside the repository and therefore outside review, and the last time
 * nobody checked it, ordinary JPEG payment proofs were being silently
 * rejected for three phases.
 *
 * Exit code 1 on anything that actually breaks the shop, so this can go in a
 * deploy check. A missing optional type is reported and does not fail.
 */

const { supabase } = require('../src/db/supabase');
const storage = require('../src/db/storage');
const config = require('../src/config');

const REQUIRED = storage.BUCKET_REQUIREMENTS;

const tick = (ok) => (ok ? '✅' : '❌');

async function main() {
  console.log(`\nChecking bucket "${config.STORAGE_BUCKET}"…\n`);

  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) {
    console.error(`❌ Could not list buckets: ${error.message}\n`);
    process.exit(1);
  }

  const bucket = (buckets || []).find((b) => b.name === config.STORAGE_BUCKET);
  if (!bucket) {
    console.error(
      `❌ There is no bucket called "${config.STORAGE_BUCKET}".\n\n` +
        '   Supabase → Storage → New bucket, private, 5 MB limit,\n' +
        `   allowed types: ${REQUIRED.requiredTypes.join(', ')}\n`
    );
    process.exit(1);
  }

  const problems = [];
  const notes = [];

  // ---- private ------------------------------------------------------------
  const isPrivate = bucket.public === false;
  console.log(`  ${tick(isPrivate)} private`);
  if (!isPrivate) {
    problems.push(
      'The bucket is PUBLIC. Every payment screenshot in it is readable by anyone ' +
        'who can guess a URL. Supabase → Storage → the bucket → make it private.'
    );
  }

  // ---- size ---------------------------------------------------------------
  const sizeOk = !bucket.file_size_limit || REQUIRED.maxBytes <= bucket.file_size_limit;
  console.log(
    `  ${tick(sizeOk)} size limit  (code enforces ${REQUIRED.maxBytes}, bucket allows ${
      bucket.file_size_limit ?? 'unlimited'
    })`
  );
  if (!sizeOk) {
    problems.push(
      `The bucket caps uploads at ${bucket.file_size_limit} bytes but this code accepts up ` +
        `to ${REQUIRED.maxBytes}. Files between the two are accepted by the panel and then ` +
        'refused by Storage.'
    );
  }

  // ---- content types ------------------------------------------------------
  const allowed = bucket.allowed_mime_types;
  if (!allowed) {
    console.log('  ✅ content types  (bucket has no restriction)');
  } else {
    for (const type of REQUIRED.requiredTypes) {
      const ok = allowed.includes(type);
      console.log(`  ${tick(ok)} ${type}`);
      if (!ok) problems.push(`The bucket refuses ${type}, which the shop uses every day.`);
    }
    for (const type of REQUIRED.optionalTypes) {
      const ok = allowed.includes(type);
      console.log(`  ${ok ? '✅' : '–'} ${type}  (optional)`);
      if (!ok) {
        notes.push(
          `${type} is not allowed. A proof in that format stays on the bot's disk and still ` +
            'reaches the admin on WhatsApp, but cannot be opened from the panel. Add it to the ' +
            "bucket's allowed types if you want that."
        );
      }
    }
  }

  // ---- and prove a public object really is refused -------------------------
  try {
    const { data } = supabase.storage
      .from(config.STORAGE_BUCKET)
      .getPublicUrl('verify/does-not-exist.png');
    const response = await fetch(data.publicUrl);
    const refused = response.status >= 400;
    console.log(`  ${tick(refused)} public URL refused  (HTTP ${response.status})`);
    if (!refused) {
      problems.push(
        'An unauthenticated public URL was served. The bucket is exposing objects even though ' +
          'it reports itself as private.'
      );
    }
  } catch (err) {
    console.log(`  –  public URL check skipped (${err.message})`);
  }

  // ---- report -------------------------------------------------------------
  if (notes.length) {
    console.log('\nNotes:');
    for (const note of notes) console.log(`  · ${note}`);
  }

  if (problems.length) {
    console.log('\nProblems:');
    for (const problem of problems) console.log(`  ❌ ${problem}`);
    console.log('');
    process.exit(1);
  }

  console.log('\nBucket matches what the code needs.\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌', err && err.message, '\n');
  process.exit(1);
});
