'use strict';

/**
 * Categories, and the words customers use for them.
 *
 * All of it comes from `product_categories`, nothing from code. Adding
 * "Caps" to the shop means adding a row - the bot understands "cap", "topi"
 * and "caps" the moment the row exists, with no deploy and no developer.
 *
 * Cached like the catalogue, for the same reason: a burst of messages should
 * not turn into a burst of queries.
 */

const { supabase, unwrap } = require('../db/supabase');
const cache = require('../db/cache');
const storage = require('../db/storage');
const config = require('../config');
const productService = require('./productService');

/** Memory is cleared synchronously inside cache.del(), before any await. */
async function invalidate() {
  await cache.del(cache.KEYS.categories);
}

async function load() {
  return cache.remember(cache.KEYS.categories, config.CATEGORY_TTL_MS, async () => {
    const rows = unwrap(
      await supabase
        .from('product_categories')
        .select('*')
        .eq('active', true)
        .order('sort_order', { ascending: true }),
      'categories.list'
    );
    return rows || [];
  });
}

const normalise = (text) =>
  String(text == null ? '' : text)
    .toLowerCase()
    .replace(/[-_]/g, ' ')
    .replace(/[^\p{L}\p{N}\s/+]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Categories that actually have something to sell right now.
 *
 * A category whose products are all sold out is not offered: being asked to
 * choose T-shirts and then told there are none is worse than not being
 * offered them. Made-to-order products (the hoodies) always count as
 * available - they are ordered, not stocked.
 */
async function availableCategories() {
  const [categories, products] = await Promise.all([load(), productService.activeProducts()]);

  const out = [];
  for (const category of categories) {
    const inCategory = products.filter((product) => product.category === category.key);
    if (!inCategory.length) continue;

    let sellable = false;
    for (const product of inCategory) {
      if (product.made_to_order) {
        sellable = true;
        break;
      }
      const variants = await productService.variantsOf(product.id);
      if (variants.some((variant) => Number(variant.stock_quantity) > 0)) {
        sellable = true;
        break;
      }
    }
    if (sellable) out.push(category);
  }

  return out;
}

/** Every keyword a category answers to, including its own key and label. */
function keywordsOf(category) {
  const words = new Set((category.keywords || []).map(normalise).filter(Boolean));
  words.add(normalise(category.key));
  words.add(normalise(category.label));
  return [...words];
}

/**
 * Which category the customer named, or null.
 *
 * Longest keyword first, so "t shirt" beats "shirt" and a two-word category
 * is not shadowed by a one-word one.
 */
async function detect(text) {
  const haystack = normalise(text);
  if (!haystack) return null;

  const candidates = [];
  for (const category of await load()) {
    for (const word of keywordsOf(category)) candidates.push({ category, word });
  }
  candidates.sort((a, b) => b.word.length - a.word.length);

  const words = haystack.split(' ');
  for (const { category, word } of candidates) {
    const hit = word.includes(' ')
      ? haystack.includes(word)
      : words.includes(word);
    if (hit) return category;
  }
  return null;
}

/** Menu position: "1" picks the first category shown. */
function byIndex(categories, text) {
  const match = /^(\d{1,2})$/.exec(normalise(text));
  if (!match) return null;
  const index = parseInt(match[1], 10);
  return index >= 1 && index <= categories.length ? categories[index - 1] : null;
}

/** Absolute path to a category's catalogue picture, if it has one. */
function imageOf(category) {
  const relative = category && category.image_path;
  if (!relative) return null;
  const path = require('path');
  const fs = require('fs');
  const full = path.isAbsolute(relative) ? relative : path.join(config.ROOT, relative);
  return fs.existsSync(full) ? full : null;
}

/**
 * The same picture, when it lives in the shop's private bucket.
 *
 * imageOf() above is unchanged and still means "a local file under our own
 * root, or nothing" - a storage reference does not resolve through it and
 * never will. This is the separate, validated route, exactly as
 * productService.resolveImage() is for a product photo.
 *
 * @returns {Promise<string|null>} an absolute local path, or null
 */
async function resolveImage(category) {
  const raw = category && category.image_path;
  if (storage.isReference(raw)) return storage.localCopy(raw);
  return imageOf(category);
}

async function getByKey(key) {
  return (await load()).find((category) => category.key === key) || null;
}

module.exports = {
  load,
  invalidate,
  availableCategories,
  detect,
  byIndex,
  getByKey,
  imageOf,
  resolveImage,
  keywordsOf,
};
