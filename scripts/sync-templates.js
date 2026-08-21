'use strict';

/**
 * Push a message's wording from the code into the database.
 *
 *   node scripts/sync-templates.js chartReceived chooseColorOnChart
 *   node scripts/sync-templates.js --list chart
 *
 * The bot reads its wording from `message_templates`, not from the file. The
 * file is the seed: on start-up any key missing from the table is inserted,
 * and rows that already exist are deliberately left alone, so that a wording
 * the owner edited in the panel is never silently reverted by a deploy.
 *
 * That is the right default and it has one sharp edge: editing a template in
 * the code changes nothing at all for a key that has already been seeded. It
 * bit exactly that way here - a message was rewritten to ask the customer
 * how many they wanted, the tests passed, the bot was restarted, and it went
 * on sending the previous sentence because the row was already there.
 *
 * So this exists to say "no, really, take the version in the code". Named
 * keys only. There is no --all, because the whole point of the table is that
 * some of those rows are the owner's, not ours.
 */

const templates = require('../src/bot/templates');
const { supabase, unwrap } = require('../src/db/supabase');

function definitionFor(key) {
  return templates.CATALOGUE.find((entry) => entry.key === key) || null;
}

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === '--list') {
    const needle = (args[1] || '').toLowerCase();
    for (const entry of templates.CATALOGUE) {
      if (!needle || entry.key.toLowerCase().includes(needle)) {
        console.log(`  ${entry.key.padEnd(28)} ${entry.label || ''}`);
      }
    }
    return;
  }

  if (!args.length) {
    console.log('Give the template keys to push. --list [text] to search.');
    process.exit(1);
  }

  for (const key of args) {
    const definition = definitionFor(key);
    if (!definition) {
      console.log(`${key.padEnd(26)} not in the code - nothing to push`);
      continue;
    }

    for (const language of templates.LANGUAGES) {
      const body = definition[language];
      if (!body) continue;

      /**
       * Keyed on (key, language). The table has no id column - the pair is
       * the identity, which is also why an update has to match on both.
       */
      const { data: existing } = await supabase
        .from('message_templates')
        .select('body')
        .eq('key', key)
        .eq('language', language)
        .maybeSingle();

      if (!existing) {
        unwrap(
          await supabase
            .from('message_templates')
            /**
             * default_body is what "reset to default" restores, so a new row
             * has to carry it as well as the live body - the column is NOT
             * NULL for exactly that reason.
             */
            .insert({
              key,
              language,
              body,
              default_body: body,
              category: definition.category,
              label: definition.label,
              description: definition.description,
              placeholders: definition.placeholders || [],
            })
            .select('key'),
          'sync.insert'
        );
        console.log(`${key.padEnd(26)} ${language}  inserted`);
        continue;
      }

      if (existing.body === body) {
        console.log(`${key.padEnd(26)} ${language}  already matches`);
        continue;
      }

      unwrap(
        await supabase
          .from('message_templates')
          .update({ body })
          .eq('key', key)
          .eq('language', language)
          .select('key'),
        'sync.update'
      );
      console.log(`${key.padEnd(26)} ${language}  updated`);
    }
  }

  // The running bot caches these; without this it keeps serving the old row.
  await templates.invalidate().catch(() => {});
  console.log('\ncache invalidated - a running bot picks this up on its next refresh');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
