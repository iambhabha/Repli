'use strict';

/**
 * Bulk-add numbers to the bypass list from a file.
 *
 *   node scripts/import-bypass.js contacts.json
 *   node scripts/import-bypass.js contacts.json --dry
 *   node scripts/import-bypass.js contacts.txt --replace
 *
 * The bypass list is the most consequential table in Repli - a number on it
 * gets no reply, no state and no database row - so this script is deliberately
 * careful:
 *
 *   - it accepts whatever shape the file happens to be in, because a contact
 *     export is never in the shape you hoped for;
 *   - it normalises every number through the same function the bot uses, so
 *     what is stored is exactly what the bot will compare against;
 *   - it refuses to guess: anything that does not look like a phone number is
 *     listed as skipped rather than silently dropped;
 *   - --dry shows what would happen and writes nothing.
 *
 * Accepted files:
 *   ["919876543210", "+91 98765 43211"]
 *   [{ "phone": "9876543210", "name": "Bhai" }, ...]
 *   { "numbers": [...] }  |  { "contacts": [...] }  |  { "bypass": [...] }
 *   plain text / CSV, one number per line (first column wins)
 */

const fs = require('fs');
const path = require('path');

const config = require('../src/config');
const { supabase, unwrap } = require('../src/db/supabase');

const args = process.argv.slice(2);
const file = args.find((arg) => !arg.startsWith('--'));
const dryRun = args.includes('--dry');
const replace = args.includes('--replace');

function die(message) {
  console.error(`\n❌ ${message}\n`);
  process.exit(1);
}

/** Every shape we are willing to read, flattened to {phone, name}. */
function extract(raw, source) {
  const rows = [];

  const push = (value, name) => {
    if (value === null || value === undefined) return;
    if (typeof value === 'object') {
      const phone = value.phone || value.number || value.mobile || value.msisdn || value.wa_id;
      const label = value.name || value.label || value.contact || name;
      if (phone) rows.push({ raw: String(phone), name: label ? String(label) : null });
      return;
    }
    rows.push({ raw: String(value), name: name ? String(name) : null });
  };

  if (source.endsWith('.json')) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      die(`${path.basename(source)} is not valid JSON: ${err.message}`);
    }

    const list = Array.isArray(parsed)
      ? parsed
      : parsed.numbers || parsed.contacts || parsed.bypass || parsed.phones || null;

    if (!list) {
      // A plain object keyed by number: { "919876543210": "Bhai" }
      if (parsed && typeof parsed === 'object') {
        for (const [key, value] of Object.entries(parsed)) push(key, value);
        return rows;
      }
      die('Could not find a list of numbers in that JSON.');
    }

    for (const item of list) push(item);
    return rows;
  }

  // Plain text or CSV: one number per line, first column wins.
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [first, second] = trimmed.split(/[,;\t]/);
    push(first.trim(), second ? second.trim() : null);
  }
  return rows;
}

async function main() {
  if (!file) {
    die('Usage: node scripts/import-bypass.js <file.json> [--dry] [--replace]');
  }

  const full = path.resolve(file);
  if (!fs.existsSync(full)) die(`File not found: ${full}`);

  const rows = extract(fs.readFileSync(full, 'utf8'), full.toLowerCase());
  if (!rows.length) die('That file has no numbers in it.');

  // Normalise, drop anything unusable, and keep the first name seen per number.
  const valid = new Map();
  const skipped = [];

  for (const row of rows) {
    const phone = config.normalisePhone(row.raw);
    // A real Indian number lands at 12 digits (91 + 10). Shorter is a typo,
    // an extension or a header row, and guessing at those is how a customer
    // ends up silently unanswerable.
    if (!phone || phone.length < 11) {
      skipped.push(row.raw);
      continue;
    }
    if (!valid.has(phone)) valid.set(phone, row.name || null);
  }

  const existing = unwrap(
    await supabase.from('bypass_numbers').select('phone,active'),
    'bypass.list'
  );
  const known = new Map((existing || []).map((row) => [row.phone, row.active]));

  const toInsert = [];
  const toReactivate = [];
  let alreadyActive = 0;

  for (const [phone, name] of valid) {
    if (!known.has(phone)) toInsert.push({ phone, name: name || 'imported', active: true });
    else if (known.get(phone) === false) toReactivate.push(phone);
    else alreadyActive += 1;
  }

  console.log(`\nFile:      ${path.basename(full)}`);
  console.log(`Read:      ${rows.length} entries`);
  console.log(`Valid:     ${valid.size} numbers`);
  console.log(`New:       ${toInsert.length}`);
  console.log(`Re-enable: ${toReactivate.length}`);
  console.log(`Already:   ${alreadyActive}`);
  console.log(`Skipped:   ${skipped.length}`);

  if (skipped.length) {
    console.log(`\n  Skipped (not phone numbers):`);
    for (const value of skipped.slice(0, 10)) console.log(`    ${value}`);
    if (skipped.length > 10) console.log(`    … and ${skipped.length - 10} more`);
  }

  if (dryRun) {
    console.log('\n--dry: nothing was written.\n');
    return;
  }

  if (replace) {
    // Only the ones this file does not mention, so numbers added by hand
    // from WhatsApp are not wiped by an old export.
    const keep = [...valid.keys()];
    const { error } = await supabase
      .from('bypass_numbers')
      .update({ active: false })
      .not('phone', 'in', `(${keep.map((p) => `"${p}"`).join(',')})`);
    if (error) die(`Could not deactivate the others: ${error.message}`);
    console.log('\n--replace: numbers not in the file were switched off.');
  }

  if (toInsert.length) {
    // Chunked: a few thousand contacts in one statement is how a request
    // times out halfway and leaves the list half applied.
    for (let i = 0; i < toInsert.length; i += 500) {
      const chunk = toInsert.slice(i, i + 500);
      const { error } = await supabase.from('bypass_numbers').insert(chunk);
      if (error) die(`Insert failed at row ${i}: ${error.message}`);
    }
  }

  if (toReactivate.length) {
    const { error } = await supabase
      .from('bypass_numbers')
      .update({ active: true })
      .in('phone', toReactivate);
    if (error) die(`Could not re-enable: ${error.message}`);
  }

  const after = unwrap(
    await supabase.from('bypass_numbers').select('phone', { count: 'exact' }).eq('active', true),
    'bypass.count'
  );

  console.log(`\n✅ Done. ${(after || []).length} numbers are now bypassed.`);
  console.log('   The bot picks this up within 10 seconds - no restart needed.\n');
}

main().catch((err) => {
  console.error('\n❌ Import failed:', err && err.message);
  process.exit(1);
});
