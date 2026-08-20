'use strict';

/**
 * Catalogue + stock, straight from Supabase.
 *
 * Products and variants are cached for a few seconds so a burst of messages
 * does not hammer the database; anything that changes stock clears the cache
 * immediately, so the bot never quotes stale availability.
 *
 * Catalogue and stock are cached SEPARATELY - `repli:catalogue` holds the
 * products, `repli:stock:{productId}` holds one product's variants and their
 * quantities. They were one entry, which meant a price and a stock count had
 * to share a lifetime even though they do not change at the same rate or
 * cost the same when wrong: a stale price is embarrassing, a stale stock
 * count sells something the shop does not have. Split, they can be given
 * different timers and invalidated independently.
 */

const { supabase, unwrap } = require('../db/supabase');
const cache = require('../db/cache');
const storage = require('../db/storage');
const config = require('../config');

/** Every product row, active or not. */
async function catalogue() {
  return cache.remember(cache.KEYS.catalogue, config.CATALOGUE_TTL_MS, async () => {
    const rows = unwrap(
      await supabase.from('products').select('*').order('sort_order', { ascending: true }),
      'products.list'
    );
    return rows || [];
  });
}

/** One product's variant rows, active or not. The stock cache, per product. */
async function rawVariants(productId) {
  if (!productId) return [];
  return cache.remember(cache.KEYS.stock(productId), config.STOCK_TTL_MS, async () => {
    const rows = unwrap(
      await supabase.from('product_variants').select('*').eq('product_id', productId),
      'product_variants.list'
    );
    return rows || [];
  });
}

/**
 * Kept for callers that want the whole picture at once.
 *
 * Built out of the same cache entries as everything else, so it never
 * re-reads what is already known.
 */
async function load() {
  const products = await catalogue();
  const lists = await Promise.all(products.map((product) => rawVariants(product.id)));
  return { products, variants: lists.flat() };
}

/** Drop both halves. Memory is cleared synchronously inside cache.del(). */
async function invalidate() {
  await Promise.all([
    cache.del(cache.KEYS.catalogue),
    cache.delPrefix(cache.KEYS.stockPrefix),
  ]);
}

const sizeKey = (v) => (v == null ? '' : String(v).trim());
const norm = (v) => sizeKey(v).toLowerCase();

/**
 * Colours compare with "no colour" and "Default" meaning the same thing.
 *
 * Products that are ordered by size alone - the hoodies - store NULL in the
 * variant, while colorsOf() shows the word "Default" so the rest of the code
 * always has a string to pass around. Without this the two never match and
 * every such product looks permanently out of stock.
 */
const colourKey = (v) => {
  const key = norm(v);
  return key === 'default' ? '' : key;
};

async function activeProducts() {
  const products = await catalogue();
  return products.filter((p) => p.active);
}

async function getById(productId) {
  const products = await catalogue();
  return products.find((p) => p.id === productId) || null;
}

async function getByCode(code) {
  const products = await catalogue();
  return products.find((p) => p.code === code) || null;
}

async function variantsOf(productId) {
  const rows = await rawVariants(productId);
  return rows.filter((v) => v.active);
}

/** Distinct colours configured for a product, in insertion order. */
async function colorsOf(product) {
  const rows = await variantsOf(product.id);
  const seen = [];
  for (const row of rows) {
    const color = sizeKey(row.color) || 'Default';
    if (!seen.includes(color)) seen.push(color);
  }
  return seen.length ? seen : ['Default'];
}

/** Sizes configured for a product ([] when the product has no sizes). */
async function sizesOf(product) {
  const rows = await variantsOf(product.id);
  const order = ['S', 'M', 'L', 'XL', 'XXL'];
  const seen = [];
  for (const row of rows) {
    const size = sizeKey(row.size);
    if (size && !seen.includes(size)) seen.push(size);
  }
  return seen.sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    if (ia === -1 || ib === -1) return a.localeCompare(b);
    return ia - ib;
  });
}

async function hasSizes(product) {
  return (await sizesOf(product)).length > 0;
}

async function findVariant(productId, color, size) {
  const rows = await variantsOf(productId);
  return (
    rows.find((v) => colourKey(v.color) === colourKey(color) && norm(v.size) === norm(size)) || null
  );
}

async function getVariantById(variantId) {
  if (!variantId) return null;
  const products = await catalogue();
  for (const product of products) {
    const hit = (await rawVariants(product.id)).find((v) => v.id === variantId);
    if (hit) return hit;
  }
  return null;
}

/** Available quantity. No variant row means zero - stock is never invented. */
async function stockOf(productId, color, size) {
  const variant = await findVariant(productId, color, size);
  if (!variant) return 0;
  const qty = Number(variant.stock_quantity);
  return Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 0;
}

/** Sizes of a colour that actually have stock right now. */
async function availableSizes(productId, color) {
  const rows = await variantsOf(productId);
  const sizes = await sizesOf({ id: productId });
  return sizes.filter((size) =>
    rows.some(
      (v) =>
        colourKey(v.color) === colourKey(color) && norm(v.size) === norm(size) && v.stock_quantity > 0
    )
  );
}

/** Colours with stock in at least one size. */
async function availableColors(productId) {
  const rows = await variantsOf(productId);
  const product = await getById(productId);
  const colors = product ? await colorsOf(product) : [];
  return colors.filter((color) =>
    rows.some((v) => colourKey(v.color) === colourKey(color) && v.stock_quantity > 0)
  );
}

/**
 * Grouped stock listing for /stock, ordered colour-by-colour and S→XXL
 * inside each colour (Postgres returns rows in no particular order).
 */
async function stockReport() {
  const products = await catalogue();
  const SIZE_ORDER = ['S', 'M', 'L', 'XL', 'XXL'];

  const out = [];
  for (const product of products.slice().sort((a, b) => a.sort_order - b.sort_order)) {
    const colors = await colorsOf(product);
    const rank = (list, value) => {
      const index = list.indexOf(value);
      return index === -1 ? list.length : index;
    };

    out.push({
      product: product.name,
      code: product.code,
      active: product.active,
      rows: (await rawVariants(product.id))
        .map((v) => ({
          color: sizeKey(v.color) || '-',
          size: sizeKey(v.size),
          sku: v.sku,
          quantity: Math.max(0, Number(v.stock_quantity) || 0),
        }))
        .sort(
          (a, b) =>
            rank(colors, a.color) - rank(colors, b.color) ||
            rank(SIZE_ORDER, a.size) - rank(SIZE_ORDER, b.size) ||
            a.size.localeCompare(b.size)
        ),
    });
  }
  return out;
}

async function productReport() {
  const products = await catalogue();
  const out = [];
  for (const product of products) {
    out.push({
      code: product.code,
      name: product.name,
      price: Number(product.price),
      active: product.active,
      colors: await colorsOf(product),
      sizes: await sizesOf(product),
    });
  }
  return out;
}

const priceOf = (product) => Math.max(0, Math.round(Number(product.price) || 0));

/**
 * The picture of this thing, if the shop actually has one.
 *
 * Resolved here rather than anywhere near the model: a path comes out of the
 * database, is turned into an absolute path under the bot's own root, and is
 * returned only if that file exists on disk. Nothing else can produce an
 * image, so nothing else can invent one.
 *
 * The variant's own photo wins when there is one - "the red one" should show
 * the red one, not the design in whatever colour was photographed first.
 *
 * @returns {string|null} an absolute path, or null when there is no picture
 */
function imageFor(product, variant = null) {
  const relative = (variant && variant.image_path) || (product && product.image_path) || null;
  if (!relative || typeof relative !== 'string') return null;

  const path = require('path');
  const fs = require('fs');

  const trimmed = relative.trim();
  if (!trimmed) return null;

  /**
   * A path, never a link, and never one that climbs out of the shop's own
   * folder. These values come from the panel, and a path is exactly the kind
   * of field somebody eventually pastes a URL into.
   */
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return null;
  if (trimmed.includes('..')) return null;

  const full = path.isAbsolute(trimmed) ? trimmed : path.join(config.ROOT, trimmed);
  if (path.relative(config.ROOT, full).startsWith('..')) return null;

  return fs.existsSync(full) ? full : null;
}

/**
 * The same question, for a picture that lives in Supabase Storage.
 *
 * imageFor() above is unchanged and still refuses anything that is not a
 * local file under the bot's own root - that rule is what stops a URL in a
 * database column becoming something the bot sends to a customer.
 *
 * A storage reference is not a URL and is not treated like one: the bucket
 * and key are validated, the object is downloaded with the shop's own
 * credentials, and what comes back is a local path in the bot's cache. By the
 * time WhatsApp sees it, it is a file on disk exactly as before.
 *
 * @returns {Promise<string|null>} an absolute local path, or null
 */
async function resolveImage(product, variant = null) {
  const raw = (variant && variant.image_path) || (product && product.image_path) || null;
  if (storage.isReference(raw)) return storage.localCopy(raw);
  return imageFor(product, variant);
}

/**
 * Every photo of this product, in the order they should be sent.
 *
 * resolveImage() above answers "the picture", singular, and that was the
 * whole answer while a product had one. It is the wrong shape for a
 * compression tee: the web print is on the chest and the spider is across
 * the shoulders, so the front photo and the back photo are both the product
 * and neither one is it.
 *
 * The gallery from migration 018 is read first. When a customer has already
 * chosen a colour, that colour's rows win - a photo of the black one is not
 * an answer to somebody holding the red one. Rows with no variant belong to
 * the design whatever colour it is in, and are used when the chosen colour
 * has no photographs of its own.
 *
 * When there is no gallery at all this falls back to resolveImage(), so a
 * product carrying only the single image_path from migration 016 behaves
 * exactly as it did before this existed.
 *
 * Every path is resolved to a real file on disk here, and one that fails to
 * resolve is dropped rather than reported: a missing object should cost the
 * customer that photo, not the other four.
 *
 * @returns {Promise<string[]>} absolute local paths, possibly empty
 */
async function imagesFor(product, variant = null) {
  if (!product || !product.id) return [];

  const rows =
    unwrap(
      await supabase
        .from('product_images')
        .select('image_path,variant_id,sort_order')
        .eq('product_id', product.id)
        .order('sort_order', { ascending: true }),
      'product_images.list'
    ) || [];

  let chosen = [];
  if (variant && variant.id) chosen = rows.filter((row) => row.variant_id === variant.id);
  if (!chosen.length) chosen = rows.filter((row) => !row.variant_id);
  if (!chosen.length) chosen = rows;

  const files = [];
  for (const row of chosen) {
    const local = storage.isReference(row.image_path)
      ? await storage.localCopy(row.image_path).catch(() => null)
      : imageFor({ image_path: row.image_path });
    // A path that no longer resolves is one photo lost, not the whole set.
    if (local && !files.includes(local)) files.push(local);
  }

  if (files.length) return files;

  // No gallery, or nothing in it survived: the single-photo path, unchanged.
  const single = await resolveImage(product, variant);
  return single ? [single] : [];
}

/**
 * What else the shop could actually sell this customer, right now.
 *
 * Called when the thing they asked for is not available. Everything here is
 * a live variant row with stock above zero - the model is handed the result
 * and may phrase it, but it never decides what is in stock, and it is never
 * given the chance to suggest something the shop cannot post today.
 *
 * Ordered so the smallest change comes first, because that is the one a
 * customer is most likely to accept:
 *
 *   1. same design, same colour, a different size
 *   2. same design, a different colour, the size they asked for
 *   3. a different design, the size they asked for
 *
 * @returns {Promise<Array<{product: string, colour: string|null, size: string|null, kind: string}>>}
 */
async function alternativesFor({ productId, color = null, size = null, limit = 3 } = {}) {
  const out = [];
  const seen = new Set();

  const add = (productName, colour, itemSize, kind) => {
    const key = `${productName}|${colour || ''}|${itemSize || ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ product: productName, colour: colour || null, size: itemSize || null, kind });
  };

  const inStock = (variant) => Number(variant.stock_quantity) > 0;

  const product = productId ? await getById(productId) : null;

  if (product) {
    const rows = (await variantsOf(productId)).filter(inStock);

    // 1. same design and colour, another size
    if (size) {
      for (const row of rows) {
        if (colourKey(row.color) !== colourKey(color)) continue;
        if (norm(row.size) === norm(size)) continue;
        add(product.design || product.name, sizeKey(row.color) || null, sizeKey(row.size), 'size');
      }
    }

    // 2. same design, another colour, the size they wanted
    for (const row of rows) {
      if (colourKey(row.color) === colourKey(color)) continue;
      if (size && norm(row.size) !== norm(size)) continue;
      add(product.design || product.name, sizeKey(row.color) || null, sizeKey(row.size), 'colour');
    }
  }

  /**
   * 3. Another design in the size they asked for.
   *
   * Only when the same design has nothing left, and only within the same
   * category - offering a hoodie to someone asking about a T-shirt is not
   * help, it is noise. Made-to-order products are skipped: they are never
   * "in stock", so they cannot honestly be offered as the quick alternative.
   */
  if (out.length < limit && size) {
    for (const other of await activeProducts()) {
      if (product && other.id === product.id) continue;
      if (product && other.category !== product.category) continue;
      if (other.made_to_order) continue;

      for (const row of (await variantsOf(other.id)).filter(inStock)) {
        if (norm(row.size) !== norm(size)) continue;
        add(other.design || other.name, sizeKey(row.color) || null, sizeKey(row.size), 'design');
      }
    }
  }

  return out.slice(0, Math.max(0, limit));
}

module.exports = {
  load,
  catalogue,
  invalidate,
  activeProducts,
  getById,
  getByCode,
  variantsOf,
  colorsOf,
  sizesOf,
  hasSizes,
  findVariant,
  getVariantById,
  stockOf,
  availableSizes,
  availableColors,
  stockReport,
  productReport,
  priceOf,
  imageFor,
  resolveImage,
  imagesFor,
  alternativesFor,
};
