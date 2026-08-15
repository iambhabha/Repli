'use strict';

/**
 * Catalogue + stock, straight from Supabase.
 *
 * Products and variants are cached for a few seconds so a burst of messages
 * does not hammer the database; anything that changes stock clears the cache
 * immediately, so the bot never quotes stale availability.
 */

const { supabase, unwrap } = require('../db/supabase');
const config = require('../config');

let cache = null;
let cacheAt = 0;

function invalidate() {
  cache = null;
  cacheAt = 0;
}

async function load() {
  if (cache && Date.now() - cacheAt < config.CATALOGUE_TTL_MS) return cache;

  const products = unwrap(
    await supabase.from('products').select('*').order('sort_order', { ascending: true }),
    'products.list'
  );
  const variants = unwrap(
    await supabase.from('product_variants').select('*'),
    'product_variants.list'
  );

  cache = {
    products: products || [],
    variants: variants || [],
  };
  cacheAt = Date.now();
  return cache;
}

const sizeKey = (v) => (v == null ? '' : String(v).trim());
const norm = (v) => sizeKey(v).toLowerCase();

async function activeProducts() {
  const { products } = await load();
  return products.filter((p) => p.active);
}

async function getById(productId) {
  const { products } = await load();
  return products.find((p) => p.id === productId) || null;
}

async function getByCode(code) {
  const { products } = await load();
  return products.find((p) => p.code === code) || null;
}

async function variantsOf(productId) {
  const { variants } = await load();
  return variants.filter((v) => v.product_id === productId && v.active);
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
    rows.find((v) => norm(v.color) === norm(color) && norm(v.size) === norm(size)) || null
  );
}

async function getVariantById(variantId) {
  if (!variantId) return null;
  const { variants } = await load();
  return variants.find((v) => v.id === variantId) || null;
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
      (v) => norm(v.color) === norm(color) && norm(v.size) === norm(size) && v.stock_quantity > 0
    )
  );
}

/** Colours with stock in at least one size. */
async function availableColors(productId) {
  const rows = await variantsOf(productId);
  const product = await getById(productId);
  const colors = product ? await colorsOf(product) : [];
  return colors.filter((color) =>
    rows.some((v) => norm(v.color) === norm(color) && v.stock_quantity > 0)
  );
}

/**
 * Grouped stock listing for /stock, ordered colour-by-colour and S→XXL
 * inside each colour (Postgres returns rows in no particular order).
 */
async function stockReport() {
  const { products, variants } = await load();
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
      rows: variants
        .filter((v) => v.product_id === product.id)
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
  const { products } = await load();
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

module.exports = {
  load,
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
};
