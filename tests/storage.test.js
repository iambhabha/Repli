'use strict';

/**
 * Tests for the files the shop owns and the menu the owner edits.
 *
 * Three things are being proved:
 *
 *   1. A stored file is a reference the bot validates, never a URL it fetches.
 *      `imageFor()` still refuses everything it always refused; the storage
 *      path is a separate, explicitly checked route to a LOCAL file.
 *   2. A category edited in the panel reaches the bot, and a category with
 *      nothing to sell is still hidden by stock, not by a flag someone set.
 *   3. Neither the panel nor the bot can be talked into reading something
 *      outside the shop's own bucket.
 *
 * Runs against real Supabase Storage - upload, download, delete - and puts
 * everything back afterwards.
 *
 *   node tests/storage.test.js
 */

process.env.TEST_MODE = 'true';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const config = require('../src/config');
const storage = require('../src/db/storage');
const productService = require('../src/services/productService');
const categoryService = require('../src/services/categoryService');
const cache = require('../src/db/cache');
const invalidate = require('../src/db/invalidate');
const { supabase } = require('../src/db/supabase');

let passed = 0;
let failed = 0;

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`  ❌ ${name}\n     ${err.stack.split('\n').slice(0, 3).join('\n     ')}`);
  }
}

const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000c4944415408d763f8cf00000301010018dd8db00000000049454e44ae426082',
  'hex'
);

async function run() {
  const uploaded = [];

  try {
    console.log('\n— a reference is not a URL —\n');

    await check('a well formed reference parses into a bucket and a key', async () => {
      const parsed = storage.parseReference('storage:repli-media/products/spider-1735910000.png');
      assert.deepStrictEqual(parsed, {
        bucket: 'repli-media',
        key: 'products/spider-1735910000.png',
      });
    });

    await check('anything that is not ours is refused', async () => {
      const bad = [
        'https://evil.example.com/x.png',
        'http://example.com/a.jpg',
        'data:image/png;base64,AAAA',
        'file:///etc/passwd',
        'storage:',
        'storage:/no-bucket.png',
        'storage:repli-media/',
        'storage:repli-media/../../etc/passwd',
        'storage:repli-media//etc/passwd',
        'storage:REPLI-MEDIA/x.png',
        'storage:a/../b.png',
        'storage:repli-media/a\\b.png',
        'data/catalogue/local.png',
        '',
        null,
        undefined,
        42,
      ];
      for (const value of bad) {
        assert.strictEqual(storage.parseReference(value), null, `${String(value)} must be refused`);
      }
    });

    await check('imageFor() still refuses a storage reference outright', async () => {
      // Unchanged from Phase 5, and deliberately so: that function's entire
      // job is "a local file under our own root, or nothing".
      assert.strictEqual(
        productService.imageFor({ image_path: 'storage:repli-media/products/x.png' }, null),
        null
      );
    });

    await check('the panel and the bot agree on the reference format', async () => {
      const panel = fs.readFileSync(path.join(ROOT, 'admin-panel', 'lib', 'storage.ts'), 'utf8');
      assert.ok(panel.includes("const PREFIX = 'storage:'"), 'same prefix');
      assert.ok(
        panel.includes('/^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/'),
        'same key alphabet as src/db/storage.js'
      );
      assert.ok(panel.includes('/^[a-z0-9][a-z0-9-]{1,62}$/'), 'same bucket alphabet');
      assert.ok(!panel.includes('getPublicUrl'), 'the bucket must stay private');
    });

    console.log('\n— a real round trip through Supabase Storage —\n');

    const key = `products/__test-${Date.now()}.png`;
    let reference = null;

    await check('upload returns a reference, not a link', async () => {
      reference = await storage.upload(key, PNG, { contentType: 'image/png' });
      assert.ok(reference, 'upload should have succeeded');
      uploaded.push(reference);
      assert.ok(reference.startsWith('storage:'));
      assert.ok(!/https?:\/\//.test(reference), 'a reference must never be a URL');
    });

    await check('the bot downloads it to a local file inside its own root', async () => {
      const local = await storage.localCopy(reference);
      assert.ok(local, 'should have produced a local path');
      assert.ok(fs.existsSync(local));
      assert.ok(path.isAbsolute(local));
      assert.ok(
        !path.relative(config.ROOT, local).startsWith('..'),
        'the cached file must live under the bot root'
      );
      assert.deepStrictEqual(fs.readFileSync(local), PNG, 'bytes must survive the round trip');
    });

    await check('the second read is served from the cache, not downloaded again', async () => {
      const first = await storage.localCopy(reference);
      const before = fs.statSync(first).mtimeMs;
      const second = await storage.localCopy(reference);
      assert.strictEqual(second, first);
      assert.strictEqual(fs.statSync(second).mtimeMs, before, 'no second download');
    });

    await check('resolveImage() uses the reference; imageFor() still does not', async () => {
      const product = { image_path: reference };
      assert.strictEqual(productService.imageFor(product, null), null);

      const resolved = await productService.resolveImage(product, null);
      assert.ok(resolved && fs.existsSync(resolved));
      assert.ok(!path.relative(config.ROOT, resolved).startsWith('..'));
    });

    await check('a variant reference still beats the product one', async () => {
      const other = await storage.upload(`variants/__test-${Date.now()}.png`, PNG, {
        contentType: 'image/png',
      });
      assert.ok(other);
      uploaded.push(other);

      const resolved = await productService.resolveImage(
        { image_path: reference },
        { image_path: other }
      );
      assert.ok(resolved.includes('variants'), `expected the variant file, got ${resolved}`);
    });

    await check('an upload that is too big, empty or badly named is refused', async () => {
      assert.strictEqual(await storage.upload('products/x.png', Buffer.alloc(0)), null);
      assert.strictEqual(
        await storage.upload('products/x.png', Buffer.alloc(storage.MAX_BYTES + 1)),
        null
      );
      assert.strictEqual(await storage.upload('../escape.png', PNG), null);
      assert.strictEqual(await storage.upload('/absolute.png', PNG), null);
      assert.strictEqual(await storage.upload('products/x.png', 'not a buffer'), null);
    });

    await check('a reference to an object that is not there yields nothing', async () => {
      const missing = await storage.localCopy('storage:repli-media/products/__nope-404.png');
      assert.strictEqual(missing, null, 'a missing object is "no picture", never an error');
    });

    await check('remove deletes the object and the local copy', async () => {
      const local = await storage.localCopy(reference);
      assert.ok(fs.existsSync(local));

      assert.strictEqual(await storage.remove(reference), true);
      assert.strictEqual(fs.existsSync(local), false, 'the cached file goes too');
      assert.strictEqual(await storage.localCopy(reference), null, 'and it cannot be fetched again');

      uploaded.splice(uploaded.indexOf(reference), 1);
    });

    await check('remove refuses anything that is not a reference', async () => {
      for (const value of ['https://example.com/x.png', 'data/proofs/a.png', '', null]) {
        assert.strictEqual(await storage.remove(value), false);
      }
    });

    console.log('\n— the panel never leaves a row pointing at nothing —\n');

    await check('an upload is written to the row only after it succeeds', async () => {
      const source = fs.readFileSync(
        path.join(ROOT, 'admin-panel', 'lib', 'services', 'media.ts'),
        'utf8'
      );
      const upload = source.indexOf('await uploadMedia(');
      const update = source.indexOf('.update({ image_path: upload.reference })');
      const removeOld = source.indexOf('if (previous && previous !== upload.reference)');

      assert.ok(upload > 0 && update > upload, 'upload happens before the row is written');
      assert.ok(removeOld > update, 'the old file is only deleted after the row is written');
      assert.ok(
        source.includes('await removeMedia(upload.reference)'),
        'a failed row write must clean up the file it just uploaded'
      );
    });

    await check('only real image types are accepted, by content not by name', async () => {
      const source = fs.readFileSync(path.join(ROOT, 'admin-panel', 'lib', 'storage.ts'), 'utf8');
      assert.ok(source.includes('looksLike('), 'magic numbers are checked');
      assert.ok(source.includes("'image/png'") && source.includes("'image/webp'"));
      assert.ok(!source.includes("'image/svg+xml'"), 'SVG is a script container, not a photo');
      assert.ok(source.includes('MAX_UPLOAD_BYTES'), 'there is a size cap');
    });

    console.log('\n— the bucket, as it actually is —\n');

    /**
     * These read the live bucket rather than trusting a comment. A bucket is
     * configuration, and configuration drifts: the code can be perfect and
     * still be refused by a limit somebody changed in a dashboard.
     */
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucket = (buckets || []).find((b) => b.name === config.STORAGE_BUCKET);

    await check('the bucket exists and is private', async () => {
      assert.ok(bucket, `${config.STORAGE_BUCKET} must exist`);
      assert.strictEqual(bucket.public, false, 'a public bucket would leak every payment proof');
    });

    await check('an unauthenticated public URL is refused by the server', async () => {
      // Not that the code builds one - it never does. This proves the bucket
      // would not serve it even if something one day did.
      const { data } = supabase.storage.from(config.STORAGE_BUCKET).getPublicUrl('probe/none.png');
      const response = await fetch(data.publicUrl).catch(() => null);
      assert.ok(response, 'the URL should be reachable to be refused');
      assert.ok(
        response.status >= 400,
        `expected a refusal, got ${response.status} - is the bucket public?`
      );
    });

    await check('the size limit the code enforces is not larger than the bucket allows', async () => {
      assert.ok(
        !bucket.file_size_limit || storage.MAX_BYTES <= bucket.file_size_limit,
        `code accepts ${storage.MAX_BYTES} but the bucket caps at ${bucket.file_size_limit}`
      );
    });

    await check('every type the panel offers is a type the bucket accepts', async () => {
      const allowed = bucket.allowed_mime_types;
      if (!allowed) return; // no restriction configured
      for (const type of ['image/png', 'image/jpeg', 'image/webp']) {
        assert.ok(allowed.includes(type), `the panel offers ${type} but the bucket refuses it`);
      }
    });

    await check('image/jpg is normalised, because that is what phones send', async () => {
      assert.strictEqual(storage.normaliseContentType('image/jpg'), 'image/jpeg');
      assert.strictEqual(storage.normaliseContentType('IMAGE/JPG'), 'image/jpeg');
      assert.strictEqual(storage.normaliseContentType('image/jpeg; charset=x'), 'image/jpeg');
      // And a real type is never relabelled to sneak past a limit.
      assert.strictEqual(storage.normaliseContentType('image/gif'), 'image/gif');
      assert.strictEqual(storage.normaliseContentType('application/pdf'), 'application/pdf');
    });

    await check('a jpg-labelled proof now reaches the bucket', async () => {
      const JPEG = Buffer.concat([Buffer.from('ffd8ff', 'hex'), Buffer.alloc(64), Buffer.from('ffd9', 'hex')]);
      const reference2 = await storage.upload(`proofs/__jpgtest-${Date.now()}.jpg`, JPEG, {
        contentType: 'image/jpg',
      });
      assert.ok(reference2, 'image/jpg must not be refused - it is an ordinary JPEG');
      uploaded.push(reference2);
    });

    await check('a type the bucket genuinely refuses fails safely, not loudly', async () => {
      const allowed = bucket.allowed_mime_types || [];
      if (allowed.includes('image/gif')) {
        console.log('     (the bucket now allows image/gif - this gap is closed)');
        return;
      }
      // Known and deliberate: the bucket does not allow GIF, so a GIF proof
      // stays on the bot's disk only. It must fail as null, never throw.
      const GIF = Buffer.from('47494638396101000100000000', 'hex');
      const refused = await storage.upload(`proofs/__giftest-${Date.now()}.gif`, GIF, {
        contentType: 'image/gif',
      });
      assert.strictEqual(refused, null, 'a refused upload returns null');
      console.log('     (image/gif is refused by the bucket - proof stays local, by design)');
    });

    console.log('\n— the startup preflight check —\n');

    await check('a healthy bucket produces no warnings', async () => {
      const problems = await storage.checkBucket();
      assert.deepStrictEqual(problems, [], `expected a clean bill, got: ${problems.join(' | ')}`);
    });

    await check('it names the bucket when the bucket is missing', async () => {
      const script = `
        const storage = require(${JSON.stringify(path.join(ROOT, 'src', 'db', 'storage'))});
        storage.checkBucket().then((problems) => {
          console.log(JSON.stringify(problems));
          process.exit(0);
        });
      `;
      const result = require('child_process').spawnSync(process.execPath, ['-e', script], {
        env: { ...process.env, STORAGE_BUCKET: 'repli-does-not-exist', TEST_MODE: 'true' },
        encoding: 'utf8',
        timeout: 60000,
      });
      const problems = JSON.parse(result.stdout.trim().split('\n').pop());
      assert.strictEqual(problems.length, 1);
      assert.ok(problems[0].includes('repli-does-not-exist'), problems[0]);
      assert.ok(problems[0].includes('verify:storage'), 'it should say what to run');
    });

    await check('a Storage outage is a warning, never a thrown error', async () => {
      const real = supabase.storage.listBuckets;
      supabase.storage.listBuckets = async () => {
        throw new Error('network is on fire');
      };
      try {
        const problems = await storage.checkBucket();
        assert.strictEqual(problems.length, 1);
        assert.ok(problems[0].includes('could not run'), problems[0]);
      } finally {
        supabase.storage.listBuckets = real;
      }
    });

    await check('startup surfaces it as a warning and keeps going', async () => {
      const source = fs.readFileSync(path.join(ROOT, 'src', 'index.js'), 'utf8');

      // It joins the existing warnings, rather than becoming a new failure mode.
      assert.ok(source.includes('warnings.push(...(await storage.checkBucket()'));
      assert.ok(source.includes('.catch(() => [])'), 'and it cannot throw out of preflight');

      const line = source.indexOf('storage.checkBucket()');
      const loop = source.indexOf('for (const warning of warnings)');
      assert.ok(line > 0 && line < loop, 'the check runs before the warnings are printed');

      // Nothing about it may stop the bot from starting.
      assert.ok(!/checkBucket[^\n]*process\.exit/.test(source));
      assert.ok(!/throw[^\n]*checkBucket/.test(source));
    });

    console.log('\n— the download cache is swept, and never fatally —\n');

    await check('files older than the age limit are dropped', async () => {
      const dir = storage.cacheDir();
      fs.mkdirSync(dir, { recursive: true });

      const old = path.join(dir, '__sweep-old.bin');
      const fresh = path.join(dir, '__sweep-fresh.bin');
      fs.writeFileSync(old, Buffer.alloc(64));
      fs.writeFileSync(fresh, Buffer.alloc(64));

      // Backdate one by a fortnight; the limit is a week.
      const ancient = Date.now() - 14 * 24 * 3600 * 1000;
      fs.utimesSync(old, new Date(ancient), new Date(ancient));

      const result = storage.sweepCache({ force: true });
      assert.ok(result, 'a forced sweep always runs');
      assert.strictEqual(fs.existsSync(old), false, 'the stale one goes');
      assert.strictEqual(fs.existsSync(fresh), true, 'the fresh one stays');

      fs.rmSync(fresh, { force: true });
    });

    await check('the sweep is throttled unless forced', async () => {
      fs.mkdirSync(storage.cacheDir(), { recursive: true });
      storage.sweepCache({ force: true });
      assert.strictEqual(
        storage.sweepCache(),
        null,
        'an unforced sweep straight after one must be a no-op'
      );
    });

    await check('a missing cache directory is not an error', async () => {
      const dir = storage.cacheDir();
      const moved = `${dir}__moved`;
      const existed = fs.existsSync(dir);
      if (existed) fs.renameSync(dir, moved);
      try {
        assert.deepStrictEqual(storage.sweepCache({ force: true }), {
          removed: 0,
          bytes: 0,
          kept: 0,
        });
      } finally {
        if (existed) fs.renameSync(moved, dir);
      }
    });

    await check('a file that vanishes mid-sweep does not break it', async () => {
      const dir = storage.cacheDir();
      fs.mkdirSync(dir, { recursive: true });
      const doomed = path.join(dir, '__sweep-race.bin');
      fs.writeFileSync(doomed, Buffer.alloc(32));

      // The race, forced: readdir saw it, stat will not.
      const realStat = fs.statSync;
      fs.statSync = (target, ...rest) => {
        if (String(target).includes('__sweep-race')) {
          fs.statSync = realStat;
          fs.rmSync(doomed, { force: true });
          const error = new Error('ENOENT');
          error.code = 'ENOENT';
          throw error;
        }
        return realStat(target, ...rest);
      };
      try {
        assert.ok(storage.sweepCache({ force: true }), 'it still returns a result');
      } finally {
        fs.statSync = realStat;
        fs.rmSync(doomed, { force: true });
      }
    });

    await check('a sweep that cannot read the directory reports, never throws', async () => {
      const realReaddir = fs.readdirSync;
      fs.readdirSync = () => {
        throw new Error('EACCES');
      };
      try {
        assert.deepStrictEqual(
          storage.sweepCache({ force: true }),
          { removed: 0, bytes: 0, kept: 0 },
          'it degrades quietly'
        );
      } finally {
        fs.readdirSync = realReaddir;
      }
    });

    await check('two downloads of the same file at once agree', async () => {
      const shared = await storage.upload(`products/__race-${Date.now()}.png`, PNG, {
        contentType: 'image/png',
      });
      assert.ok(shared);
      uploaded.push(shared);

      const [a, b, c] = await Promise.all([
        storage.localCopy(shared),
        storage.localCopy(shared),
        storage.localCopy(shared),
      ]);
      assert.strictEqual(a, b);
      assert.strictEqual(b, c);
      assert.ok(fs.existsSync(a));
      assert.deepStrictEqual(fs.readFileSync(a), PNG, 'concurrent writers must not corrupt it');
    });

    await check('a cached file deleted mid-use is re-fetched, not an error', async () => {
      const target = await storage.upload(`products/__midread-${Date.now()}.png`, PNG, {
        contentType: 'image/png',
      });
      assert.ok(target);
      uploaded.push(target);

      const before = await storage.localCopy(target);
      assert.ok(fs.existsSync(before));

      // A sweep runs while something else is about to read the path.
      fs.rmSync(before, { force: true });

      const after = await storage.localCopy(target);
      assert.strictEqual(after, before, 'same path');
      assert.ok(fs.existsSync(after), 'and the file is back');
    });

    await check('a sweep cannot break an image the bot is about to send', async () => {
      const target = await storage.upload(`products/__sweepsend-${Date.now()}.png`, PNG, {
        contentType: 'image/png',
      });
      assert.ok(target);
      uploaded.push(target);

      await storage.localCopy(target);
      storage.sweepCache({ force: true, now: Date.now() + 999 * 24 * 3600 * 1000 }); // evict everything

      const resolved = await productService.resolveImage({ image_path: target }, null);
      assert.ok(resolved && fs.existsSync(resolved), 'the send path still gets a real file');
    });

    await check('a swept file is simply downloaded again', async () => {
      const again = await storage.upload(`products/__resweep-${Date.now()}.png`, PNG, {
        contentType: 'image/png',
      });
      assert.ok(again);
      uploaded.push(again);

      const first = await storage.localCopy(again);
      assert.ok(first && fs.existsSync(first));

      fs.rmSync(first, { force: true }); // as a sweep would
      const second = await storage.localCopy(again);
      assert.strictEqual(second, first);
      assert.ok(fs.existsSync(second), 'nothing in the cache is precious');
    });

    console.log('\n— media still works when the cache layer is down —\n');

    await check('an image resolves with Redis pointed at nothing', async () => {
      /**
       * In its own process, deliberately.
       *
       * REDIS_URL is read once when the cache module loads, so testing this
       * in-process would mean swapping module instances underneath every
       * service that already captured one - which is exactly the sort of
       * harness cleverness that produces a failure in an unrelated test two
       * hundred lines later. A child process with a dead Redis is both
       * simpler and closer to the real thing.
       */
      const reference2 = await storage.upload(`products/__nocache-${Date.now()}.png`, PNG, {
        contentType: 'image/png',
      });
      assert.ok(reference2);
      uploaded.push(reference2);

      const script = `
        const products = require(${JSON.stringify(path.join(ROOT, 'src', 'services', 'productService'))});
        (async () => {
          const list = await products.activeProducts();
          if (!list.length) throw new Error('catalogue did not load');
          const file = await products.resolveImage({ image_path: ${JSON.stringify(reference2)} }, null);
          if (!file || !require('fs').existsSync(file)) throw new Error('no local file');
          console.log('OK');
          process.exit(0);
        })().catch((err) => { console.error(err.message); process.exit(1); });
      `;

      const result = require('child_process').spawnSync(process.execPath, ['-e', script], {
        env: {
          ...process.env,
          REDIS_URL: 'redis://127.0.0.1:1', // nothing is listening there
          REDIS_BACKOFF_MS: '50',
          REDIS_CONNECT_TIMEOUT_MS: '300',
          TEST_MODE: 'true',
        },
        encoding: 'utf8',
        timeout: 60000,
      });

      assert.strictEqual(
        result.status,
        0,
        `the photo must still arrive with no cache: ${result.stderr || result.stdout}`
      );
      assert.ok(String(result.stdout).includes('OK'));
    });

    console.log('\n— a category picture, on the same terms as a product one —\n');

    await check('a category storage reference resolves to a local file', async () => {
      const card = await storage.upload(`categories/__test-${Date.now()}.png`, PNG, {
        contentType: 'image/png',
      });
      assert.ok(card);
      uploaded.push(card);

      const local = await categoryService.resolveImage({ image_path: card });
      assert.ok(local && fs.existsSync(local));
      assert.ok(!path.relative(config.ROOT, local).startsWith('..'));
    });

    await check('imageOf() still refuses a reference, as it always has', async () => {
      assert.strictEqual(
        categoryService.imageOf({ image_path: 'storage:repli-media/categories/x.png' }),
        null
      );
    });

    await check('a category with no picture, or a bad one, yields nothing', async () => {
      assert.strictEqual(await categoryService.resolveImage({ image_path: null }), null);
      assert.strictEqual(await categoryService.resolveImage(null), null);
      for (const nasty of [
        'https://evil.example.com/card.png',
        'storage:repli-media/../../etc/passwd',
        '/etc/passwd',
      ]) {
        assert.strictEqual(await categoryService.resolveImage({ image_path: nasty }), null);
      }
    });

    console.log('\n— the category editor, and what the bot does with it —\n');

    const TEST_KEY = 'testcaps';
    await supabase.from('product_categories').delete().eq('key', TEST_KEY);

    await check('a new category reaches the bot once the invalidation lands', async () => {
      const before = (await categoryService.load()).map((c) => c.key);
      assert.ok(!before.includes(TEST_KEY));

      const { error } = await supabase.from('product_categories').insert({
        key: TEST_KEY,
        label: 'Test Caps',
        keywords: ['testcap', 'topi'],
        sort_order: 99,
        active: true,
      });
      if (error) throw new Error(error.message);

      assert.ok(
        !(await categoryService.load()).map((c) => c.key).includes(TEST_KEY),
        'still cached, which is exactly what the invalidation is for'
      );

      await invalidate.apply({ key: cache.KEYS.categories, source: 'panel:category' });
      assert.ok((await categoryService.load()).map((c) => c.key).includes(TEST_KEY));
    });

    await check('its keywords teach the bot the word immediately', async () => {
      const hit = await categoryService.detect('mujhe topi chahiye');
      assert.ok(hit, 'the bot should now understand "topi"');
      assert.strictEqual(hit.key, TEST_KEY);
    });

    await check('a category with nothing to sell is never offered', async () => {
      // It has no products at all, so availableCategories must skip it -
      // stock decides this, not the active flag.
      const offered = (await categoryService.availableCategories()).map((c) => c.key);
      assert.ok(!offered.includes(TEST_KEY), 'no products means nothing to offer');
      assert.ok((await categoryService.load()).map((c) => c.key).includes(TEST_KEY));
    });

    await check('deactivating removes it from the bot after invalidation', async () => {
      const { error } = await supabase
        .from('product_categories')
        .update({ active: false })
        .eq('key', TEST_KEY);
      if (error) throw new Error(error.message);

      await invalidate.apply({ key: cache.KEYS.categories, source: 'panel:category' });
      assert.ok(!(await categoryService.load()).map((c) => c.key).includes(TEST_KEY));
      assert.strictEqual(await categoryService.detect('mujhe topi chahiye'), null);
    });

    await check('every category write publishes an invalidation', async () => {
      const source = fs.readFileSync(
        path.join(ROOT, 'admin-panel', 'lib', 'services', 'categories.ts'),
        'utf8'
      );
      const writes = (source.match(/export async function (create|update|deactivate)Category/g) || []).length;
      const calls = (source.match(/await invalidateCategories\(\)/g) || []).length;
      assert.strictEqual(writes, 3, 'create, update, deactivate');
      assert.strictEqual(calls, writes, 'one invalidation per write, no more and no fewer');
      assert.ok(
        source.includes('A category key cannot be changed'),
        'the key is the products.category foreign key in all but name'
      );
    });

    console.log('\n— the payment QR, and the text that never stopped working —\n');

    const paymentService = require('../src/services/paymentService');
    const settingsService = require('../src/services/settingsService');
    const previousQr = await settingsService.value('payment_qr', '');

    async function setQr(value) {
      await supabase
        .from('app_settings')
        .upsert({ key: 'payment_qr', value }, { onConflict: 'key' });
      await invalidate.apply({ key: cache.KEYS.settings('payment_qr'), source: 'panel:qr' });
    }

    await check('no QR set: the shop sends the UPI id as text, as it always did', async () => {
      await setQr('');
      assert.strictEqual(await paymentService.paymentQrImage(), null);
    });

    await check('a QR reference is downloaded and sent as a local file', async () => {
      const qrRef = await storage.upload(`qr/__test-${Date.now()}.png`, PNG, {
        contentType: 'image/png',
      });
      assert.ok(qrRef);
      uploaded.push(qrRef);

      await setQr(qrRef);
      const local = await paymentService.paymentQrImage();
      assert.ok(local && fs.existsSync(local), 'the scanner should be a real local file');
      assert.ok(!path.relative(config.ROOT, local).startsWith('..'));
    });

    await check('a URL in the QR setting is refused, never fetched', async () => {
      for (const nasty of [
        'https://evil.example.com/qr.png',
        'http://example.com/qr.png',
        'data/proofs/whatever.png',
        '/etc/passwd',
        'storage:repli-media/../../etc/passwd',
      ]) {
        await setQr(nasty);
        assert.strictEqual(
          await paymentService.paymentQrImage(),
          null,
          `${nasty} must never reach a customer`
        );
      }
    });

    await check('a QR deleted from the bucket falls back to text, not an error', async () => {
      await setQr('storage:repli-media/qr/__gone-404.png');
      assert.strictEqual(await paymentService.paymentQrImage(), null);
    });

    await setQr(previousQr || '');

    console.log('\n— payment proofs keep their old contract —\n');

    await check('proof_url still means a path on the bot; the reference is separate', async () => {
      const source = fs.readFileSync(path.join(ROOT, 'src', 'services', 'paymentService.js'), 'utf8');
      assert.ok(source.includes('proof_object: proofObject'), 'the reference has its own column');
      assert.ok(
        source.includes('proof_url: proofUrl'),
        'and proof_url keeps carrying the local relative path'
      );
      // The end-to-end suite asserts the file exists under ROOT. That had to
      // stay true, which is why the reference did not take proof_url over.
      assert.ok(source.includes('path.relative(config.ROOT, absolute)'));
    });

    await check('the backfill can only ever add, never rewrite or delete', async () => {
      const source = fs.readFileSync(path.join(ROOT, 'scripts', 'backfill-proofs.js'), 'utf8');

      // The one update it performs, and the only column in it.
      const updates = [...source.matchAll(/\.update\(\{([^}]*)\}\)/g)].map((m) => m[1].trim());
      assert.deepStrictEqual(updates, ['proof_object: reference'], 'proof_object and nothing else');

      assert.ok(!/proof_url:/.test(source), 'proof_url is never written');
      assert.ok(!/\.delete\(\)/.test(source), 'no row is ever deleted');
      assert.ok(!/rmSync|unlink/.test(source), 'no local file is ever deleted');
    });

    await check('it skips what is already done, and what was never local', async () => {
      const source = fs.readFileSync(path.join(ROOT, 'scripts', 'backfill-proofs.js'), 'utf8');

      assert.ok(source.includes(".is('proof_object', null)"), 'migrated rows are filtered out in SQL');
      assert.ok(source.includes(".not('proof_url', 'is', null)"), 'and rows with nothing to move');
      assert.ok(source.includes('storage.isReference(value)'), 'a reference is left alone');
      assert.ok(/\^\[a-z\]\[a-z0-9\+\.-\]\*:\\\/\\\//.test(source), 'and so is a URL');
      assert.ok(
        source.includes("path.relative(config.ROOT, absolute).startsWith('..')"),
        'and a path climbing out of the bot folder is refused'
      );
    });

    await check('a failed upload leaves the row alone; a failed write removes the object', async () => {
      const source = fs.readFileSync(path.join(ROOT, 'scripts', 'backfill-proofs.js'), 'utf8');

      const refused = source.indexOf('if (!reference)');
      const update = source.indexOf(".update({ proof_object: reference })");
      assert.ok(refused > 0 && refused < update, 'a refused upload returns before any DB write');

      assert.ok(
        source.includes('await storage.remove(reference)'),
        'and a failed DB write cleans up the object it just made'
      );
      const cleanup = source.indexOf('await storage.remove(reference)');
      assert.ok(cleanup > update, 'in that order');
    });

    await check('--dry writes nothing at all', async () => {
      const source = fs.readFileSync(path.join(ROOT, 'scripts', 'backfill-proofs.js'), 'utf8');
      const dryBranch = source.slice(source.indexOf('if (DRY) {'), source.indexOf('try {', source.indexOf('if (DRY) {')));
      assert.ok(dryBranch.includes('continue;'), 'the dry branch does nothing but report');
      assert.ok(!dryBranch.includes('upload('), 'and never uploads');
    });

    await check('the panel prefers the reference but still opens a pre-017 proof', async () => {
      const source = fs.readFileSync(
        path.join(ROOT, 'admin-panel', 'lib', 'services', 'proofs.ts'),
        'utf8'
      );
      // Compare the USES, not the import lines at the top of the file.
      const ref = source.indexOf('parseReference(proofObject)');
      const bucket = source.indexOf('if (REPLI_PROOFS_BUCKET) {');
      const disk = source.indexOf('if (REPLI_ROOT) {');

      assert.ok(ref > 0, 'the reference is tried');
      assert.ok(ref < bucket && ref < disk, 'and tried before either pre-017 route');
      assert.ok(bucket > 0 && disk > 0, 'every pre-017 route is still there');
      assert.ok(
        source.includes('!absolute.startsWith(root + path.sep)'),
        'and the traversal guard on the old path is untouched'
      );
    });

    console.log('\n— bags are hidden by stock, not by anything else —\n');

    await check('a category is offered only when something in it is sellable', async () => {
      const categories = await categoryService.load();
      const offered = (await categoryService.availableCategories()).map((c) => c.key);
      const products = await productService.activeProducts();

      for (const category of categories) {
        const inCategory = products.filter((p) => p.category === category.key);
        let sellable = false;
        for (const product of inCategory) {
          if (product.made_to_order) { sellable = true; break; }
          const variants = await productService.variantsOf(product.id);
          if (variants.some((v) => Number(v.stock_quantity) > 0)) { sellable = true; break; }
        }
        assert.strictEqual(
          offered.includes(category.key),
          sellable,
          `${category.key}: offered=${offered.includes(category.key)} but sellable=${sellable}`
        );
      }
      console.log(`     (offered: ${offered.join(', ') || 'none'})`);
    });
  } finally {
    for (const reference of uploaded) await storage.remove(reference);
    await supabase.from('product_categories').delete().eq('key', 'testcaps');
    await categoryService.invalidate();
    await productService.invalidate();
  }

  console.log(`\n${passed}/${passed + failed} passed\n`);
  process.exit(failed ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
