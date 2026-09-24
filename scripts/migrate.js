'use strict';

/**
 * Applies supabase/migrations/*.sql in order.
 *
 *   npm run migrate
 *
 * Needs SUPABASE_DB_URL in .env (Supabase → Project Settings → Database →
 * Connection string → URI, "Session pooler"). If you would rather not put the
 * database password anywhere, just paste each .sql file into the Supabase SQL
 * Editor instead - the files are plain SQL and safe to re-run.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const config = require('../src/config');

const DIR = path.join(__dirname, '..', 'supabase', 'migrations');

async function main() {
  if (!config.SUPABASE_DB_URL) {
    console.error(
      '\n❌ SUPABASE_DB_URL .env me set nahi hai.\n\n' +
        '   Supabase → Project Settings → Database → Connection string → URI\n' +
        '   (Session pooler), password bhar ke .env me daalo.\n\n' +
        '   Ya phir supabase/migrations/*.sql ko Supabase SQL Editor me paste kar do.\n'
    );
    process.exit(1);
  }

  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
  if (!files.length) {
    console.error('No .sql files in supabase/migrations');
    process.exit(1);
  }

  const client = new Client({
    connectionString: config.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000,
  });

  await client.connect();
  console.log(`\nConnected. Applying ${files.length} migration(s)…\n`);

  for (const file of files) {
    const sql = fs.readFileSync(path.join(DIR, file), 'utf8');
    process.stdout.write(`  ${file} … `);
    try {
      await client.query(sql);
      console.log('ok');
    } catch (err) {
      console.log('FAILED');
      console.error(`\n${err.message}\n`);
      await client.end();
      process.exit(1);
    }
  }

  const { rows } = await client.query(`
    select table_name from information_schema.tables
    where table_schema = 'public' order by table_name
  `);
  console.log(`\n✅ Done. Tables: ${rows.map((r) => r.table_name).join(', ')}\n`);

  await client.end();
}

main().catch((err) => {
  console.error('\n❌ Migration failed:', err.message, '\n');
  process.exit(1);
});
