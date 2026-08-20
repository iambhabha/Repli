'use strict';

/**
 * Carries out what the brain decided - after checking it is true.
 *
 * The split this file exists to enforce:
 *
 *   ai/brain.js   decides what the customer meant
 *   this file     checks whether that is real, and does it
 *   the database  is what "real" means
 *
 * The brain works from a list of names it was shown. That is not the same as
 * the row still being there, still active, and still in stock by the time the
 * decision comes back - so every id is looked up again here, against live
 * data, and a decision that no longer holds is dropped rather than repaired.
 * Nothing in this file takes the model's word for a price, a stock count or
 * an order status; those are read fresh every time.
 *
 * What it will not do at all:
 *
 *   - Create an order. `confirm_order` asks the flow to show the summary and
 *     wait. The order itself is created where the customer's own yes is
 *     read, and that has not moved.
 *   - Confirm a payment. That is an admin command and nothing here can
 *     reach it.
 *
 * A decision this file cannot execute returns null, and the caller falls back
 * to the ordinary flow. The brain gets the first word, never the last one.
 */

const logger = require('../logger');
const productService = require('../services/productService');
const categoryService = require('../services/categoryService');
const conversationService = require('../services/conversationService');
const faq = require('./faq');

const { STATES } = conversationService;

/**
 * Resolve a design NAME the brain returned to a live product row.
 *
 * The name came from a list built out of this same table moments ago, so a
 * miss here means the catalogue changed underneath the call - which is
 * exactly when acting on it would be wrong.
 */
async function resolveProduct(name) {
  if (!name) return null;
  const products = await productService.activeProducts();
  return products.find((item) => (item.design || item.name) === name) || null;
}

/**
 * Everything the executor is allowed to touch, and nothing else.
 *
 * Passed in rather than imported so this file cannot reach into the flow on
 * its own: the state machine hands over the exact operations it is willing
 * to have driven by a model.
 */
function createExecutor(handlers) {
  const {
    sendGreeting,
    sendWelcome,
    showCatalogue,
    sendProductImage,
    afterProductSelected,
    afterColorSelected,
    goToDetails,
    goToHuman,
    cancelOrder,
    freeTextOrder,
  } = handlers;

  /**
   * @param {object} decision  a validated decision from ai/brain.js
   * @returns {Promise<string|null>} the action taken, or null to carry on
   */
  return async function execute(bot, phone, convo, text, decision) {
    if (!decision) return null;

    const { selection } = decision;

    /**
     * The reference the brain resolved, checked against live rows.
     *
     * `chosen` is what the conversation already holds. `named` is what the
     * brain says this message refers to - which may be the same thing said a
     * different way ("iska", "ye wala"), or a different design entirely.
     */
    const chosen = convo.selected_product_id
      ? await productService.getById(convo.selected_product_id).catch(() => null)
      : null;
    const named = await resolveProduct(selection.product);
    const subject = named || chosen;

    const act = (what) => {
      logger.info('brain.executed', {
        phone,
        action: `${decision.decision}${what ? ` ${what}` : ''}`,
      });
    };

    switch (decision.decision) {
      /**
       * Ambiguity, answered with a question instead of a guess.
       *
       * "Red" when two designs both come in red used to pick one. The words
       * are the brain's and have already passed the same safety gate as any
       * other reply, so no number or link can be in them.
       */
      case 'clarify': {
        if (!decision.clarification) return null;
        await bot.sendMessage(phone, decision.clarification);
        act('asked');
        return 'brain_clarify';
      }

      /**
       * A department, but only one the shop can sell from today. The brain
       * naming a sold-out department changes nothing - the same rule the
       * greeting has always applied.
       */
      case 'show_products': {
        if (!selection.category) return null;
        const sellable = await categoryService.availableCategories();
        if (!sellable.some((row) => row.key === selection.category)) return null;

        /**
         * Not while they are part-way through choosing something.
         *
         * Opening a department resets what they are shopping for, and a
         * customer who has picked the Spider-Man and is choosing a size did
         * not ask for that by saying "kapda kaisa hai". Read as browsing,
         * it put them back at the design list with their choice gone - the
         * failure that showed up as SELECT_SIZE becoming SELECT_PRODUCT.
         *
         * Leaving a chosen design IS a switch, so it goes through the path
         * that asks first. Declining here hands the message to it.
         */
        const midSelection =
          Boolean(convo.selected_product_id) &&
          (convo.state === STATES.SELECT_COLOR ||
            convo.state === STATES.SELECT_SIZE ||
            convo.state === STATES.SELECT_QUANTITY);
        if (midSelection) return null;

        const busy =
          convo.state === STATES.COLLECT_DETAILS ||
          convo.state === STATES.ORDER_SUMMARY ||
          convo.state === STATES.WAITING_FOR_PAYMENT ||
          convo.state === STATES.PAYMENT_VERIFYING;

        // Browsing must not throw away a half-typed address or an order they
        // have already agreed to.
        if (busy) await showCatalogue(bot, phone, selection.category);
        else await sendWelcome(bot, phone, selection.category);

        act(selection.category);
        return `brain_products_${selection.category}`;
      }

      /**
       * Photographs, of whatever they were referring to.
       *
       * The variant is only passed when it belongs to this product: asking
       * for the Venom while holding a red Spider-Man must not hand the
       * Venom's photo lookup a Spider-Man variant.
       */
      case 'show_image': {
        if (!subject) return null;
        const owns = convo.selected_product_id === subject.id ? convo : null;
        await sendProductImage(bot, phone, subject, owns, decision.imageKind);
        act(subject.design || subject.name);
        return 'brain_image';
      }

      case 'select_product': {
        if (!named) return null;
        if (named.id === convo.selected_product_id) return null;

        /**
         * A design and a size in the same breath.
         *
         * "bape single hood L" and "XL me spider man" are one decision, not
         * two, and the free-text path is what checks the size against stock
         * before promising anything. Routing them through the plain product
         * selection instead asked for a size they had already given - and
         * dropped the customer a step behind where they thought they were.
         *
         * The size goes back in as text rather than as a value, because that
         * path re-reads and re-validates it against what is actually in
         * stock. The brain naming a size does not make it available.
         */
        if (selection.size) {
          act(`${named.design || named.name} ${selection.size}`);
          return freeTextOrder(bot, phone, `${text} ${selection.size}`, named);
        }

        await conversationService.save(
          phone,
          conversationService.clearedCart({
            state: STATES.SELECT_PRODUCT,
            selected_product_id: named.id,
          })
        );
        act(named.design || named.name);
        return afterProductSelected(bot, phone, named);
      }

      /**
       * A colour, checked against the colours this product actually has.
       *
       * The brain is shown every colour in the shop, so it can return one
       * that belongs to a different design entirely - which is the shape of
       * the bug this whole change exists to remove.
       */
      case 'select_colour': {
        if (!subject || !selection.colour) return null;
        const colours = await productService.colorsOf(subject).catch(() => []);
        if (!colours.includes(selection.colour)) return null;

        /**
         * A decision that changes nothing is not a decision to act on.
         *
         * A design with one colour means the brain can "select" the colour
         * the customer already holds - and running that again re-asks the
         * size question, wiping out an out-of-stock answer they had just
         * been given. Nothing has changed, so nothing happens.
         */
        const already =
          (!named || named.id === convo.selected_product_id) &&
          (convo.data && convo.data.color) === selection.colour;
        if (already) return null;

        if (named && named.id !== convo.selected_product_id) {
          await conversationService.save(
            phone,
            conversationService.clearedCart({
              state: STATES.SELECT_PRODUCT,
              selected_product_id: named.id,
            })
          );
        }
        act(`${subject.design || subject.name} ${selection.colour}`);
        return afterColorSelected(bot, phone, subject, selection.colour);
      }

      /**
       * Deliberately absent: select_size, select_quantity, collect_details,
       * confirm_order.
       *
       * Each of those is a step towards spending money, and each already has
       * a handler that checks stock, quantity and consent in the order the
       * shop needs. Returning null hands the message to them unchanged - the
       * brain having understood it does not entitle it to skip the checks.
       */
      case 'answer_question': {
        if (!decision.question) return null;
        const answered = await faq
          .tryAnswer(bot, phone, decision.question, { pack: bot.t, convo })
          .catch(() => false);
        if (!answered) return null;
        act(decision.question);
        return `brain_${decision.question}`;
      }

      case 'cancel_order': {
        await cancelOrder(bot, phone);
        act();
        return 'brain_cancel';
      }

      case 'handoff':
        act();
        return goToHuman(bot, phone, 'brain decided a person is needed');

      case 'reply': {
        if (!decision.reply) return null;
        await bot.sendMessage(phone, decision.reply);
        act();
        return 'brain_reply';
      }

      default:
        return null;
    }
  };
}

module.exports = { createExecutor, resolveProduct };
