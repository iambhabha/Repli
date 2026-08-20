'use strict';

/**
 * Which stored objects nothing points at any more, and which rows point at
 * objects that are gone.
 *
 *   node scripts/audit-storage.js
 *
 * REPORT ONLY. It deletes nothing, uploads nothing and writes nothing - not
 * one row, not one object. That is deliberate and it is not laziness:
 *
 *   - an orphaned file costs a few kilobytes and harms nobody
 *   - a script that deletes from a bucket, run against the wrong project or
 *     with a bug in its "is this referenced?" query, destroys payment
 *     evidence that cannot be recovered
 *
 * The asymmetry is the whole argument. So this prints what it found and the
 * exact `supabase.storage.remove([...])` a human can run if they agree.
 *
 * The other direction matters more anyway: a row pointing at a missing object
 * is a customer being told "I have no photo of that" about something the shop
 * does have, and that is worth knowing about.
 */

const { supabase } = require('../src/db/supabase');
const storage = require('../src/db/storage');
const config = require('../src/config');

/** Every reference the database currently holds, and where it came from. */
async function referencedObjects() {
  const held = new Map(); // key -> [description]

  const note = (value, where) => {
    const parsed = storage.parseReference(value);
    if (!parsed) return;
    if (!held.has(parsed.key)) held.set(parsed.key, []);
    held.get(parsed.key).push(where);
  };

  const tables = [
    ['products', 'id,code,image_path', (r) => `product ${r.code}`, 'image_path'],
    ['product_variants', 'id,sku,image_path', (r) => `variant ${r.sku || r.id}`, 'image_path'],
    ['product_categories', 'key,image_path', (r) => `category ${r.key}`, 'image_path'],
    ['payments', 'id,proof_object', (r) => `payment ${r.id}`, 'proof_object'],
    ['app_settings', 'key,value', (r) => `setting ${r.key}`, 'value'],
  ];

  for (const [table, columns, describe, column] of tables) {
    const { data, error } = await supabase.from(table).select(columns);
    if (error) throw new Error(`${table}: ${error.message}`);
    for (const row of data || []) note(row[column], describe(row));
  }

  return held;
}

/** Everything actually in the bucket, walked one folder at a time. */
async function storedObjects() {
  const bucket = config.STORAGE_BUCKET;
  const found = [];

  // The folders this codebase ever writes to. Listing the root does not
  // recurse, so they are named rather than discovered.
  for (const folder of ['products', 'variants', 'categories', 'qr', 'proofs']) {
    const { data, error } = await supabase.storage.from(bucket).list(folder, { limit: 1000 });
    if (error) {
      console.error(`  ! could not list ${folder}/: ${error.message}`);
      continue;
    }
    for (const entry of data || []) {
      if (!entry.name) continue;
      found.push({
        key: `${folder}/${entry.name}`,
        bytes: (entry.metadata && entry.metadata.size) || 0,
        at: entry.created_at || entry.updated_at || null,
      });
    }
  }

  return found;
}

async function main() {
  console.log(`\nAuditing bucket "${config.STORAGE_BUCKET}" — read only, nothing is deleted.\n`);

  const [held, stored] = await Promise.all([referencedObjects(), storedObjects()]);
  const storedKeys = new Set(stored.map((object) => object.key));

  // ---- rows pointing at nothing (the one that hurts) ----------------------
  const dangling = [...held.entries()].filter(([key]) => !storedKeys.has(key));

  console.log(`Rows pointing at a missing object: ${dangling.length}`);
  for (const [key, owners] of dangling) {
    console.log(`  ❌ ${key}\n       held by ${owners.join(', ')}`);
  }
  if (dangling.length) {
    console.log(
      '\n  These show as "no photo" to a customer, or an unopenable proof in the\n' +
        '  panel. Re-upload from the panel, or clear the field so nothing claims\n' +
        '  a picture that does not exist.\n'
    );
  }

  // ---- objects nothing points at ------------------------------------------
  const orphans = stored.filter((object) => !held.has(object.key));
  const wasted = orphans.reduce((sum, object) => sum + object.bytes, 0);

  console.log(`\nObjects nothing points at: ${orphans.length} (${Math.round(wasted / 1024)} KB)`);
  for (const object of orphans) {
    console.log(`  · ${object.key}  ${Math.round(object.bytes / 1024)} KB  ${object.at || ''}`);
  }

  if (orphans.length) {
    console.log(
      '\n  Left in place on purpose. Deleting from a bucket is not recoverable and\n' +
        '  a payment proof is evidence, so this script will not do it for you.\n' +
        '  If you have read the list above and agree, this removes them:\n'
    );
    console.log(
      `    supabase.storage.from('${config.STORAGE_BUCKET}').remove([\n` +
        orphans.map((object) => `      '${object.key}',`).join('\n') +
        '\n    ])\n'
    );
  }

  console.log(
    `Summary: ${stored.length} object(s) stored, ${held.size} referenced, ` +
      `${orphans.length} orphaned, ${dangling.length} dangling.\n`
  );

  // A dangling reference is a real fault. An orphan is only untidy.
  process.exit(dangling.length ? 1 : 0);
}

main().catch((err) => {
  console.error('\n❌', err && err.message, '\n');
  process.exit(1);
});
