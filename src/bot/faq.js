'use strict';

/**
 * Answers the questions customers ask mid-sale.
 *
 * "Kitne ka hai?", "cotton hai?", "kitne din lagenge?", "COD hai?" - these
 * arrive in the middle of choosing a size, and the sales flow used to read
 * them as a failed size answer. Here they get a straight answer and the
 * conversation carries on exactly where it was: no state is changed, nothing
 * is reset.
 *
 * Every answer is a stored fact - a template, a catalogue price, a settings
 * row. Nothing on this path is generated, because these are precisely the
 * details the business memory says must never be invented. If a fact is
 * missing, the customer gets a human instead of a guess.
 */

const { supabase, unwrap } = require('../db/supabase');
const cache = require('../db/cache');
const config = require('../config');
const logger = require('../logger');
const productService = require('../services/productService');

const FACT_KEYS = [
  'location_city',
  'shipping_note',
  'tshirt_lead_time',
  'hoodie_lead_time',
  'tshirt_material',
  'hoodie_brands',
  'lot_note',
];

/** The editable business facts, read straight from app_settings. */
async function facts() {
  return cache.remember(cache.KEYS.faq, config.FAQ_TTL_MS, async () => {
    const rows = unwrap(
      await supabase.from('app_settings').select('key,value').in('key', FACT_KEYS),
      'faq.facts'
    );
    return Object.fromEntries((rows || []).map((row) => [row.key, row.value]));
  });
}

/**
 * The product the question is about: whatever they are already choosing, or
 * the first active one so a price question at "hello" still gets an answer.
 */
async function subjectOf(convo) {
  if (convo && convo.selected_product_id) {
    const chosen = await productService.getById(convo.selected_product_id);
    if (chosen) return chosen;
  }
  const products = await productService.activeProducts();
  return products[0] || null;
}

/**
 * @returns {Promise<string|null>} the answer, or null when we have no stored
 *          fact for it - the caller then falls through to its normal flow.
 */
async function answer(topic, { pack, convo }) {
  const stored = await facts();
  const product = await subjectOf(convo);
  const isHoodie = product && product.category === 'hoodie';

  switch (topic) {
    case 'refund':
      // Deliberately not answered from a policy string. Refunds, returns and
      // exchanges are money decisions the shop makes case by case, so the
      // only correct reply is to put a person on it.
      return pack.refundAnswer();

    case 'bargain':
      // Same source as the price answer - the number is never softened,
      // because a discount the shop did not agree to is a promise it has to
      // honour.
      return product ? pack.priceFixedAnswer(product) : null;

    case 'price':
      // No catalogue, no price. Silence here beats a made-up number.
      return product ? pack.priceAnswer(product) : null;

    case 'material':
      // Only T-shirts have a described fabric; hoodies are special orders.
      return stored.tshirt_material && !isHoodie
        ? pack.materialAnswer(stored.tshirt_material)
        : null;

    case 'waiting': {
      const lead = isHoodie ? stored.hoodie_lead_time : stored.tshirt_lead_time;
      return lead ? pack.waitingTimeAnswer(lead) : null;
    }

    case 'cod':
      return product && product.cod_available ? pack.codAnswer(product) : null;

    case 'stock':
      return stored.lot_note ? pack.limitedPiecesAnswer(stored.lot_note) : null;

    case 'brands':
      return stored.hoodie_brands ? pack.hoodieBrandsAnswer(stored.hoodie_brands) : null;

    case 'location':
      return stored.location_city
        ? pack.locationAnswer(stored.location_city, stored.shipping_note || '')
        : null;

    default:
      return null;
  }
}

/**
 * Answer if we can, and say whether we did.
 *
 * A question mid-flow is not a reason to restart anything, so this never
 * touches conversation state - the next message continues from wherever the
 * customer already was.
 */
async function tryAnswer(bot, phone, topic, { pack, convo }) {
  try {
    const text = await answer(topic, { pack, convo });
    if (!text) return false;
    await bot.sendMessage(phone, text);
    logger.info('faq.answered', { phone, action: topic });
    return true;
  } catch (err) {
    logger.error('faq.failed', { phone, action: topic, error: err.message });
    return false;
  }
}

/** Memory is cleared synchronously inside cache.del(), before any await. */
async function invalidate() {
  await cache.del(cache.KEYS.faq);
}

module.exports = { answer, tryAnswer, facts, invalidate };
