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
    applySize,
    applyQuantity,
    editDetails,
    buildDraft,
    createOrder,
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
        /**
         * A colour cannot choose a department.
         *
         * "Red" came back as browse-the-hoodies, with a colour and a
         * category the customer never named - and Red is not even a hoodie
         * colour. Acted on, it answered a one-word message with the wrong
         * department's menu, which is the bug this whole refactor was
         * started for.
         *
         * Declining sends it to the flow, which asks which design they mean.
         * That is the honest answer to a genuinely ambiguous word.
         */
        if (selection.colour && !selection.product && !convo.selected_product_id) {
          logger.info('brain.refused', { phone, action: 'category inferred from a colour' });
          return null;
        }

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
        /**
         * "bag ki images dena" names a department, not a design.
         *
         * The brain identified the department and left product null, which
         * left this with nothing to photograph - so the shop asked "kaunse
         * ki photo chahiye?" about a department that sells one thing.
         *
         * The database settles it: if that department has exactly one
         * product, there is no ambiguity to ask about. More than one and
         * this declines, and the flow asks which - because then the question
         * is a real one.
         */
        let wanted = subject;
        if (!wanted && selection.category) {
          const inCategory = (await productService.activeProducts()).filter(
            (item) => item.category === selection.category
          );
          if (inCategory.length === 1) [wanted] = inCategory;
        }
        if (!wanted) return null;
        const subjectForImage = wanted;
        const owns = convo.selected_product_id === subjectForImage.id ? convo : null;
        await sendProductImage(bot, phone, subjectForImage, owns, decision.imageKind);
        act(subjectForImage.design || subjectForImage.name);
        return 'brain_image';
      }

      case 'select_product': {
        if (!named) return null;
        if (named.id === convo.selected_product_id) return null;

        /**
         * Not once they are past choosing.
         *
         * A customer half way through typing their address asked for the
         * black one's photo - "black wali bhi dena please" - and it was read
         * as picking the Venom. Selecting it cleared their cart and dropped
         * them back at the size question, mid-order, for asking to see
         * something.
         *
         * show_products has had this guard since the same thing happened
         * with a department; this is the same rule for a design. Naming
         * something while committed is a request to LOOK, or at most a
         * switch that has to be confirmed - it is never a silent restart.
         * Declining hands it to the flow, which asks.
         */
        const committed =
          convo.state === STATES.COLLECT_DETAILS ||
          convo.state === STATES.ORDER_SUMMARY ||
          convo.state === STATES.WAITING_FOR_PAYMENT ||
          convo.state === STATES.PAYMENT_VERIFYING;
        if (committed) {
          logger.info('brain.refused', { phone, action: 'design change mid-order' });
          return null;
        }

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
          /**
           * The decision is executed, not re-read.
           *
           * This used to hand the sentence back to a free-text parser with
           * the size appended - a second interpretation of a message the
           * brain had already understood, and the exact shape of "two
           * brains" this refactor exists to remove. The product is selected,
           * the colour settles itself, and the size is applied from the
           * decision.
           */
          const sizes = await productService.sizesOf(named).catch(() => []);
          if (sizes.includes(selection.size)) {
            await afterProductSelected(bot, phone, named, { quiet: true });
            const ready = await conversationService.get(phone);
            act(`${named.design || named.name} ${selection.size}`);
            return applySize(bot, phone, ready, named, selection.size);
          }
        }

        await conversationService.save(
          phone,
          conversationService.clearedCart({
            state: STATES.SELECT_PRODUCT,
            selected_product_id: named.id,
          })
        );

        /**
         * A design and a colour in one message.
         *
         * "black wala" after the bags were shown names both the backpack and
         * the colour, and selecting only the design asked which colour they
         * wanted - the word they had just used. Checked against the colours
         * this design really has, because the brain is shown every colour in
         * the shop.
         */
        if (selection.colour) {
          const colours = await productService.colorsOf(named).catch(() => []);
          if (colours.includes(selection.colour)) {
            act(`${named.design || named.name} ${selection.colour}`);
            return afterColorSelected(bot, phone, named, selection.colour);
          }
        }

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
        /**
         * The size question is suppressed when a size is coming with it, so
         * the customer is not asked something they answered in the same
         * message. Checked against the real sizes first - a size the shop
         * does not have must still produce the question.
         */
        const sizesHere = await productService.sizesOf(subject).catch(() => []);
        const sizeFollows = Boolean(selection.size && sizesHere.includes(selection.size));

        const afterColour = await afterColorSelected(bot, phone, subject, selection.colour, {
          quiet: sizeFollows,
        });

        /**
         * A colour and a size in one message.
         *
         * "red wala L" identified both, and applying only the colour asked
         * the customer for a size they had just given. The colour has to
         * land first - it decides which sizes are even in stock - so the
         * conversation is re-read before the size is applied to it.
         *
         * Only when the colour step actually succeeded. An out-of-stock
         * colour has already been answered, and stacking a size question on
         * top of that would be answering a question nobody asked.
         */
        if (sizeFollows && afterColour !== 'out_of_stock') {
          const withColour = await conversationService.get(phone);
          act(`${subject.design || subject.name} ${selection.colour} ${selection.size}`);
          return applySize(bot, phone, withColour, subject, selection.size);
        }

        return afterColour;
      }

      /**
       * A size the brain resolved, checked against stock before it counts.
       *
       * The decision is executed, not re-read: applySize() is handed the
       * size itself rather than the sentence, so there is no second parse to
       * disagree with the first. What it does NOT skip is the check - stock
       * is read live and an unavailable size is refused with the ones that
       * remain, exactly as when a customer types a bare "L".
       */
      case 'select_size': {
        if (!subject || !selection.size) return null;

        const sizes = await productService.sizesOf(subject).catch(() => []);
        if (!sizes.includes(selection.size)) return null;

        // Only for the design they are actually on. A size for something
        // they have not chosen is a decision missing its subject.
        if (!convo.selected_product_id || subject.id !== convo.selected_product_id) return null;

        act(`${subject.design || subject.name} ${selection.size}`);
        return applySize(bot, phone, convo, subject, selection.size);
      }

      /**
       * How many, checked against the lot before it counts.
       *
       * The cap and live stock are read here, not taken from the decision -
       * the brain naming a number does not make that many pieces exist.
       */
      case 'select_quantity': {
        if (!subject || !selection.quantity) return null;
        if (!convo.selected_product_id || subject.id !== convo.selected_product_id) return null;
        act(`${subject.design || subject.name} x${selection.quantity}`);
        return applyQuantity(bot, phone, convo, subject, selection.quantity);
      }

      /**
       * "nahi, address galat hai" on the order summary.
       *
       * Only where a summary is actually on screen. Anywhere else this would
       * wipe a draft the customer is part-way through typing.
       */
      case 'edit_details': {
        if (convo.state !== STATES.ORDER_SUMMARY) return null;
        act();
        return editDetails(bot, phone, convo);
      }

      /**
       * They agreed to the summary.
       *
       * The brain REQUESTS this; it does not place the order. Every gate
       * that stood behind parser.isYes still stands here, in the same
       * order, and any one of them failing means no order:
       *
       *   the summary must actually be on screen
       *   buildDraft must produce a complete draft
       *   createOrderAndAskPayment re-reads live stock before writing
       *
       * The words that got us here are the brain's reading of a sentence.
       * Whether that reading may become an order is the backend's.
       */
      case 'confirm_order': {
        if (convo.state !== STATES.ORDER_SUMMARY) {
          logger.info('brain.refused', { phone, action: 'confirm outside the summary' });
          return null;
        }
        const draft = await buildDraft(convo);
        if (!draft) {
          logger.info('brain.refused', { phone, action: 'confirm on an incomplete draft' });
          return null;
        }
        act();
        return createOrder(bot, phone, convo);
      }

      /**
       * They do not want it as it stands.
       *
       * Nothing is cancelled and nothing is deleted - the order does not
       * exist yet. They are taken back to the details, which is where the
       * refusal was already handled.
       */
      case 'decline_order': {
        if (convo.state !== STATES.ORDER_SUMMARY) return null;
        act();
        return editDetails(bot, phone, convo);
      }

      /**
       * Deliberately absent: collect_details.
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
