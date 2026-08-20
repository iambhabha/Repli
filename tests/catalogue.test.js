'use strict';

/**
 * Tests for the three things Phase 5 added, all of which are about the same
 * principle: the model may choose the words, the database chooses the facts.
 *
 *   - a product photo comes off disk, never from anything a model said
 *   - an out-of-stock alternative is a live variant row, or there isn't one
 *   - the longer cache lifetimes are only as long as their invalidation
 *
 * Real Supabase, real stock values (put back afterwards), no network to
 * OpenAI - the converse parts here are validation, not calls.
 *
 *   node tests/catalogue.test.js
 */

process.env.TEST_MODE = 'true';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const config = require('../src/config');
const parser = require('../src/bot/parser');
const productService = require('../src/services/productService');
const context = require('../src/bot/context');
const converse = require('../src/ai/converse');
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

async function setStock(variantId, quantity) {
  const { error } = await supabase
    .from('product_variants')
    .update({ stock_quantity: quantity })
    .eq('id', variantId);
  if (error) throw new Error(error.message);
  await productService.invalidate();
}

async function setImage(table, id, value) {
  const { error } = await supabase.from(table).update({ image_path: value }).eq('id', id);
  if (error) throw new Error(error.message);
  await productService.invalidate();
}

async function run() {
  const products = await productService.activeProducts();
  const product =
    products.find((p) => (p.design || p.name).toLowerCase().includes('spider')) || products[0];
  assert.ok(product, 'the test database needs an active product');

  const variants = await productService.variantsOf(product.id);
  assert.ok(variants.length >= 2, 'this product needs at least two variants to test with');

  const original = {
    productImage: product.image_path || null,
    stock: variants.map((v) => ({ id: v.id, qty: v.stock_quantity, image: v.image_path || null })),
  };

  // A real file on disk, inside the bot's own root, for the happy path.
  const relative = path.join('data', 'catalogue', '__test_image.png');
  const absolute = path.join(config.ROOT, relative);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, Buffer.from('89504e470d0a1a0a', 'hex'));

  /**
   * The gallery tests need a product the shop has not photographed, so that
   * inserting and deleting rows here can never disturb a real gallery. Any
   * product with no product_images rows will do.
   */
  const photographed = new Set(
    ((await supabase.from('product_images').select('product_id')).data || []).map(
      (row) => row.product_id
    )
  );
  const spare = products.find((p) => p.id !== product.id && !photographed.has(p.id));
  assert.ok(spare, 'the test database needs one active product with no gallery rows');
  const spareImage = spare.image_path || null;

  const [first, second, third] = ['__g1.png', '__g2.png', '__g3.png'].map((name) =>
    path.join('data', 'catalogue', name)
  );
  const [firstAbs, secondAbs, thirdAbs] = [first, second, third].map((rel) =>
    path.join(config.ROOT, rel)
  );
  for (const file of [firstAbs, secondAbs, thirdAbs]) {
    fs.writeFileSync(file, Buffer.from('89504e470d0a1a0a', 'hex'));
  }

  try {
    console.log('\n— the picture comes off disk, or there is no picture —\n');

    await check('a product image resolves to an absolute path that exists', async () => {
      await setImage('products', product.id, relative);
      const fresh = await productService.getById(product.id);
      const file = productService.imageFor(fresh, null);
      assert.strictEqual(file, absolute);
      assert.ok(fs.existsSync(file));
    });

    await check('a variant image beats the product image', async () => {
      const other = path.join('data', 'catalogue', '__test_variant.png');
      const otherAbs = path.join(config.ROOT, other);
      fs.writeFileSync(otherAbs, Buffer.from('89504e470d0a1a0a', 'hex'));
      try {
        await setImage('product_variants', variants[0].id, other);
        const fresh = await productService.getById(product.id);
        const variant = (await productService.variantsOf(product.id)).find(
          (v) => v.id === variants[0].id
        );
        assert.strictEqual(productService.imageFor(fresh, variant), otherAbs);
        // ... and the product's own picture is still used for a different variant.
        const plain = (await productService.variantsOf(product.id)).find(
          (v) => v.id !== variants[0].id
        );
        assert.strictEqual(productService.imageFor(fresh, plain), absolute);
      } finally {
        await setImage('product_variants', variants[0].id, null);
        fs.rmSync(otherAbs, { force: true });
      }
    });

    await check('no image_path means no picture, not a substitute', async () => {
      await setImage('products', product.id, null);
      const fresh = await productService.getById(product.id);
      assert.strictEqual(productService.imageFor(fresh, null), null);
      assert.strictEqual(productService.imageFor(null, null), null);
    });

    await check('a path pointing at a file that is not there returns nothing', async () => {
      await setImage('products', product.id, 'data/catalogue/does-not-exist.png');
      const fresh = await productService.getById(product.id);
      assert.strictEqual(productService.imageFor(fresh, null), null);
    });

    /**
     * The gallery from migration 018. Run against a product that has no
     * photographs of its own, so the shop's real galleries are never read,
     * written or reordered by a test run.
     */
    console.log('\n— every photo, in the order they should arrive —\n');

    const gallery = [];
    const addRow = async (imagePath, sortOrder, variantId = null) => {
      const { data, error } = await supabase
        .from('product_images')
        .insert({
          product_id: spare.id,
          variant_id: variantId,
          image_path: imagePath,
          sort_order: sortOrder,
        })
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      gallery.push(data.id);
      return data.id;
    };

    await check('a gallery comes back in sort_order, not insertion order', async () => {
      await addRow(third, 3);
      await addRow(first, 1);
      await addRow(second, 2);
      const files = await productService.imagesFor(spare, null);
      assert.deepStrictEqual(files, [firstAbs, secondAbs, thirdAbs]);
    });

    await check('a photo whose file is gone costs that photo, not the others', async () => {
      await addRow('data/catalogue/__gallery_missing.png', 4);
      const files = await productService.imagesFor(spare, null);
      assert.deepStrictEqual(files, [firstAbs, secondAbs, thirdAbs]);
    });

    await check('the chosen colour wins over the design when it has its own photos', async () => {
      const spareVariants = await productService.variantsOf(spare.id);
      assert.ok(spareVariants.length, 'the spare product needs a variant');
      const variant = spareVariants[0];
      await addRow(third, 1, variant.id);

      // Asked about that colour: only that colour's photographs.
      assert.deepStrictEqual(await productService.imagesFor(spare, variant), [thirdAbs]);

      // Asked about the design: the design's own photographs, unchanged.
      assert.deepStrictEqual(await productService.imagesFor(spare, null), [
        firstAbs,
        secondAbs,
        thirdAbs,
      ]);
    });

    await check('a colour with no photos of its own falls back to the design', async () => {
      const spareVariants = await productService.variantsOf(spare.id);
      const bare = spareVariants.find((v) => v.id !== spareVariants[0].id) || null;
      if (!bare) return; // one-variant product: nothing to fall back from
      assert.deepStrictEqual(await productService.imagesFor(spare, bare), [
        firstAbs,
        secondAbs,
        thirdAbs,
      ]);
    });

    await check('no gallery at all still returns the single image_path', async () => {
      for (const id of gallery.splice(0)) {
        await supabase.from('product_images').delete().eq('id', id);
      }
      await setImage('products', spare.id, first);
      const fresh = await productService.getById(spare.id);
      assert.deepStrictEqual(await productService.imagesFor(fresh, null), [firstAbs]);
    });

    await check('no gallery and no image_path means an empty list, not a substitute', async () => {
      await setImage('products', spare.id, null);
      const fresh = await productService.getById(spare.id);
      assert.deepStrictEqual(await productService.imagesFor(fresh, null), []);
      assert.deepStrictEqual(await productService.imagesFor(null, null), []);
    });

    await check('the ways a customer asks to see something', () => {
      /**
       * Every one of these was somebody asking for a photograph. The
       * negatives matter as much: "bhejo" on its own is whatever the
       * conversation was already about, and answering it with a picture
       * would interrupt an address or a payment.
       */
      const asks = [
        'photo bhejo', 'image bhej do', 'pic dikhao', 'photo send karo',
        'photo send karu', 'image chahiye', 'tasveer bhejo', 'iski photo',
        'koi image hai kya', 'send photo', 'show me', 'dikha do',
        'picture bhejo', 'snap bhejo', 'pictures dikhao', 'ek snap bhej do',
        'kaisa dikhta hai', 'red wali kaisi lagegi', 'dekhna hai',
      ];
      for (const ask of asks) {
        assert.strictEqual(parser.detectQuestion(ask), 'image', `should be an image ask: ${ask}`);
      }

      const notAsks = ['bhejo', 'kaise ho bhai', 'order confirm karo', 'address bhej do'];
      for (const other of notAsks) {
        assert.notStrictEqual(parser.detectQuestion(other), 'image', `not an image ask: ${other}`);
      }
    });

    await check('a URL smuggled into a gallery row is refused like any other', async () => {
      await addRow('https://evil.example.com/x.png', 1);
      const fresh = await productService.getById(spare.id);
      assert.deepStrictEqual(await productService.imagesFor(fresh, null), []);
    });

    await check('a URL in the image field is refused outright', async () => {
      for (const nasty of [
        'https://evil.example.com/x.png',
        'http://example.com/a.jpg',
        'file:///etc/passwd',
        'data:image/png;base64,AAAA',
      ]) {
        assert.strictEqual(
          productService.imageFor({ image_path: nasty }, null),
          null,
          `${nasty} must never be sent`
        );
      }
    });

    await check('a path climbing out of the shop folder is refused', async () => {
      for (const nasty of ['../../../etc/passwd', 'data/../../secrets.png', '   ']) {
        assert.strictEqual(productService.imageFor({ image_path: nasty }, null), null);
      }
      // An absolute path outside the root is refused even if the file exists.
      const outside = path.join(os.tmpdir(), '__repli_outside.png');
      fs.writeFileSync(outside, 'x');
      try {
        assert.strictEqual(productService.imageFor({ image_path: outside }, null), null);
      } finally {
        fs.rmSync(outside, { force: true });
      }
    });

    console.log('\n— alternatives are live rows, or nothing —\n');

    const colour = (await productService.colorsOf(product))[0];
    const sizes = await productService.sizesOf(product);
    const wanted = sizes[sizes.length - 1];
    const variantWanted = await productService.findVariant(product.id, colour, wanted);
    assert.ok(variantWanted, 'need a variant to take out of stock');

    await check('in stock: the context says so and offers nothing', async () => {
      await setStock(variantWanted.id, 5);
      const scoped = await context.forTurn({
        product,
        requested: { productId: product.id, product: product.design || product.name, colour, size: wanted },
      });
      assert.ok(scoped.facts.includes('available.'));
      assert.ok(!scoped.facts.includes('In stock instead'), 'nothing to offer when it is there');
    });

    await check('out of stock: another size of the same design is offered first', async () => {
      await setStock(variantWanted.id, 0);
      const options = await productService.alternativesFor({
        productId: product.id,
        color: colour,
        size: wanted,
      });
      assert.ok(options.length, 'other sizes of this design are in stock');
      assert.strictEqual(options[0].kind, 'size', 'the smallest change comes first');
      assert.strictEqual(options[0].product, product.design || product.name);
      for (const option of options) {
        assert.notStrictEqual(option.size, wanted, 'never offer back the thing they asked for');
      }
    });

    await check('a sold-out alternative is never offered', async () => {
      const all = await productService.variantsOf(product.id);
      const previous = all.map((v) => ({ id: v.id, qty: v.stock_quantity }));
      try {
        // Everything gone except one size.
        for (const v of all) await setStock(v.id, 0);
        const keep = all.find((v) => v.id !== variantWanted.id);
        await setStock(keep.id, 2);

        const options = await productService.alternativesFor({
          productId: product.id,
          color: colour,
          size: wanted,
        });
        const offeredSizes = options
          .filter((o) => o.product === (product.design || product.name))
          .map((o) => o.size);
        assert.deepStrictEqual(offeredSizes, [keep.size], 'only the one with stock');
      } finally {
        for (const p of previous) await setStock(p.id, p.qty);
      }
    });

    await check('nothing in stock anywhere: no suggestion is fabricated', async () => {
      const all = await productService.variantsOf(product.id);
      const previous = all.map((v) => ({ id: v.id, qty: v.stock_quantity }));
      const others = (await productService.activeProducts()).filter(
        (p) => p.id !== product.id && p.category === product.category && !p.made_to_order
      );
      const otherPrevious = [];
      try {
        for (const v of all) await setStock(v.id, 0);
        for (const other of others) {
          for (const v of await productService.variantsOf(other.id)) {
            otherPrevious.push({ id: v.id, qty: v.stock_quantity });
            await setStock(v.id, 0);
          }
        }

        const options = await productService.alternativesFor({
          productId: product.id,
          color: colour,
          size: wanted,
        });
        assert.deepStrictEqual(options, [], 'no stock anywhere means no alternatives');

        const scoped = await context.forTurn({
          product,
          requested: { productId: product.id, product: product.design || product.name, colour, size: wanted },
        });
        assert.ok(scoped.facts.includes('NOT available'));
        assert.ok(
          scoped.facts.includes('Do not suggest one'),
          'the model must be told there is nothing, not left to fill the silence'
        );
      } finally {
        for (const p of [...previous, ...otherPrevious]) await setStock(p.id, p.qty);
      }
    });

    await check('the ordering is deterministic across repeated calls', async () => {
      await setStock(variantWanted.id, 0);
      const a = await productService.alternativesFor({ productId: product.id, color: colour, size: wanted });
      const b = await productService.alternativesFor({ productId: product.id, color: colour, size: wanted });
      assert.deepStrictEqual(a, b);
      assert.ok(a.length <= 3, 'kept compact - this must not grow back into a catalogue dump');
    });

    await check('the alternatives block stays small', async () => {
      await setStock(variantWanted.id, 0);
      const scoped = await context.forTurn({
        product,
        requested: { productId: product.id, product: product.design || product.name, colour, size: wanted },
      });
      assert.ok(
        scoped.facts.length < 400,
        `the whole scoped block should stay small, got ${scoped.facts.length} chars`
      );
      console.log(`     (${scoped.facts.length} chars ≈ ${Math.round(scoped.facts.length / 3.6)} tokens)`);
    });

    await check('a stock change still invalidates through the shared cache', async () => {
      await setStock(variantWanted.id, 0);
      assert.strictEqual(await productService.stockOf(product.id, colour, wanted), 0);

      // Change it behind the cache's back, the way the panel does.
      await supabase.from('product_variants').update({ stock_quantity: 7 }).eq('id', variantWanted.id);
      assert.strictEqual(
        await productService.stockOf(product.id, colour, wanted),
        0,
        'still cached, which is what the invalidation is for'
      );

      await invalidate.apply({ key: cache.KEYS.stock(product.id), source: 'panel:stock' });
      assert.strictEqual(await productService.stockOf(product.id, colour, wanted), 7);
    });

    console.log('\n— the longer lifetimes, and what keeps them honest —\n');

    await check('only the domains the panel publishes for were lengthened', async () => {
      assert.strictEqual(config.CATALOGUE_TTL_MS, 300000);
      assert.strictEqual(config.CATEGORY_TTL_MS, 300000);
      assert.strictEqual(config.TEMPLATE_TTL_MS, 300000);

      // Everything with partial or no invalidation coverage is untouched.
      assert.strictEqual(config.STOCK_TTL_MS, 15000, 'stock stays short whatever else happens');
      assert.strictEqual(config.SETTINGS_TTL_MS, 30000);
      assert.strictEqual(config.FAQ_TTL_MS, 30000);
      assert.strictEqual(config.BYPASS_TTL_MS, 10000);
      assert.strictEqual(config.ADMIN_TTL_MS, 10000);
    });

    await check('a five-minute catalogue still turns over the moment the panel says so', async () => {
      const before = productService.priceOf(await productService.getById(product.id));

      await supabase.from('products').update({ price: before + 77 }).eq('id', product.id);
      assert.strictEqual(
        productService.priceOf(await productService.getById(product.id)),
        before,
        'a five minute timer would have held this for five minutes'
      );

      await invalidate.apply({ key: cache.KEYS.catalogue, source: 'panel:product' });
      assert.strictEqual(productService.priceOf(await productService.getById(product.id)), before + 77);

      await supabase.from('products').update({ price: before }).eq('id', product.id);
      await invalidate.apply({ key: cache.KEYS.catalogue, source: 'panel:product' });
    });

    await check('with no invalidation the entry simply survives to its TTL', async () => {
      let loads = 0;
      const key = 'repli:test:ttl-survives';
      await cache.del(key);
      const load = async () => {
        loads += 1;
        return loads;
      };
      assert.strictEqual(await cache.remember(key, 300000, load), 1);
      assert.strictEqual(await cache.remember(key, 300000, load), 1, 'no reload without an invalidation');
      await cache.del(key);
      assert.strictEqual(await cache.remember(key, 300000, load), 2);
    });

    await check('the bot survives the cache being unavailable', async () => {
      const key = 'repli:test:cache-down';
      await cache.del(key);
      // Whatever Redis does, the loader is the fallback and it must answer.
      const value = await cache.remember(key, 300000, async () => 'from supabase');
      assert.strictEqual(value, 'from supabase');
      await cache.del(key);
    });

    console.log('\n— the empty reply guard —\n');

    const LISTS = {
      categories: ['tshirt'],
      designs: ['Spider-Man'],
      colours: ['Red'],
      sizes: ['S', 'M', 'L', 'XL'],
      facts: 'Spider-Man | S/M/L/XL\nPrices fixed, no discounts.',
    };
    const base = {
      intent: 'ask_stock', confidence: 0.9, category: 'tshirt', product: 'Spider-Man',
      colour: 'Red', size: 'XL', language: 'hi', action: 'reply',
      reply: 'Haan bhai, XL hai.',
    };
    const build = (patch) => JSON.stringify({ ...base, ...patch });

    await check('an empty reply on a talking action is refused', async () => {
      assert.strictEqual(converse.validate(build({ reply: '' }), LISTS).reason, 'empty_reply');
    });

    await check('a whitespace-only reply counts as empty', async () => {
      for (const blank of ['   ', '\n\n', '\t \n']) {
        assert.strictEqual(converse.validate(build({ reply: blank }), LISTS).reason, 'empty_reply');
      }
    });

    await check('clarify and handover must also produce words', async () => {
      for (const action of ['clarify', 'handover', 'show_image']) {
        assert.strictEqual(
          converse.validate(build({ action, reply: '' }), LISTS).reason,
          'empty_reply',
          `${action} promised words`
        );
      }
    });

    await check('continue_flow may stay silent - the shop answers instead', async () => {
      const result = converse.validate(build({ action: 'continue_flow', reply: '' }), LISTS);
      assert.ok(!result.reason);
      assert.strictEqual(result.value.reply, '');
    });

    await check('a normal reply still passes untouched', async () => {
      const result = converse.validate(build({}), LISTS);
      assert.ok(!result.reason);
      assert.strictEqual(result.value.reply, 'Haan bhai, XL hai.');
    });

    await check('malformed JSON is still rejected before any of this', async () => {
      assert.strictEqual(converse.validate('haan bhai hai', LISTS).reason, 'unparsable');
      assert.strictEqual(converse.validate('{"reply":', LISTS).reason, 'unparsable');
    });

    await check('the prompt itself now says a reply is never empty', async () => {
      const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'ai', 'converse.js'), 'utf8');
      assert.ok(source.includes('never empty'), 'the rule should be stated, not only enforced');
    });
  } finally {
    // Put the shop back exactly as it was.
    await setImage('products', product.id, original.productImage);
    for (const row of original.stock) {
      await supabase
        .from('product_variants')
        .update({ stock_quantity: row.qty, image_path: row.image })
        .eq('id', row.id);
    }
    // Every gallery row this file created, whether or not its check passed.
    await supabase.from('product_images').delete().eq('product_id', spare.id);
    await setImage('products', spare.id, spareImage);

    await productService.invalidate();
    for (const file of [absolute, firstAbs, secondAbs, thirdAbs]) {
      fs.rmSync(file, { force: true });
    }
  }

  console.log(`\n${passed}/${passed + failed} passed\n`);
  process.exit(failed ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
