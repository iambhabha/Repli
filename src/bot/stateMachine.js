'use strict';

/**
 * The controlled conversation flow.
 *
 * State lives in Supabase (`conversations`), one row per normalised phone,
 * so conversations never mix and a restart loses nothing.
 *
 * Access control (bypass / admin / HUMAN mode / bot switch) happens in
 * router.js before anything here runs.
 */

const config = require('../config');
const logger = require('../logger');
const parser = require('./parser');
const categoryService = require('../services/categoryService');
const settingsService = require('../services/settingsService');
const faq = require('./faq');
const replyComposer = require('../ai/reply');
const converse = require('../ai/converse');
const brain = require('../ai/brain');
const { createExecutor } = require('./execute');
const aiProof = require('../ai/proof');
const redact = require('../ai/redact');
const context = require('./context');
const messageService = require('../services/messageService');
const messages = require('./messages');
const conversationService = require('../services/conversationService');
const customerService = require('../services/customerService');
const productService = require('../services/productService');
const orderService = require('../services/orderService');
const paymentService = require('../services/paymentService');

const { MODE, STATES } = conversationService;
const DETAIL_FIELDS = customerService.DETAIL_FIELDS;

const NAME_LIKE = /^[\p{L}\p{M}][\p{L}\p{M}.'\-\s]{1,59}$/u;

const VALIDATORS = {
  name: (v) => NAME_LIKE.test(v) && !looksLikeSentence(v),
  address: (v) => v.length >= 10 && v.length <= 300 && !looksLikeSentence(v) && /[0-9]/.test(v),
  city: (v) => NAME_LIKE.test(v) && v.length <= 50 && !looksLikeSentence(v),
  state: (v) => NAME_LIKE.test(v) && v.length <= 50 && !looksLikeSentence(v),
  pin: (v) => /^[1-9][0-9]{5}$/.test(v),
};

/**
 * Things a person never writes into a form field.
 *
 * A real transcript: the customer pasted the bot's own prompt back, and
 * "Address thoda detail me bhej do bhai (house/flat, street, landmark)."
 * became their delivery address and went onto a live order. An address needs
 * a number in it; a name, city or state is a couple of words, not a sentence
 * with a question mark in it.
 */
/**
 * Words that appear in requests and never in a person's name.
 *
 * Three real ones got stored as customers' names in a single afternoon:
 * "Red photos", "Black ka", and "Inphoto batana mujhe". None of them was a
 * name, all three were valid under a rule that only asked "is this letters
 * and spaces?", and all three were saved without a word to the customer.
 *
 * The point is not to guess what they meant - it is to stop guessing that
 * they meant a name. Anything caught here fails validation, and failing
 * validation is what hands the message to offScript(), which reads the whole
 * sentence with the model and answers it. So this does not reject the
 * customer; it stops the form swallowing them.
 *
 * Deliberately whole words only. "Kartik" contains "kar" and is a name.
 */
const NOT_IN_A_NAME = new RegExp(
  '\\b(' +
    [
      // asking
      'kya', 'kyu', 'kyun', 'kaun', 'kaunsa', 'konsa', 'kitna', 'kitne', 'kaise', 'kaisa',
      'kahan', 'kaha', 'kidhar', 'what', 'which', 'how', 'where', 'when', 'why',
      // telling us to do something
      'bhejo', 'bhejna', 'bhej', 'bhejdo', 'dikhao', 'dikhana', 'dikha', 'batao', 'batana',
      'bata', 'dena', 'dedo', 'karo', 'karna', 'chahiye', 'chaiye', 'send', 'show', 'give',
      'want', 'need',
      // pronouns and fillers
      'mujhe', 'muje', 'mereko', 'mera', 'meri', 'aapka', 'apka', 'yeh', 'ye', 'wo', 'woh',
      'hai', 'hain', 'nahi', 'please', 'thoda', 'dobara',
      // things they are shopping for
      'photo', 'photos', 'pic', 'pics', 'picture', 'image', 'images', 'size', 'price',
      'rate', 'order', 'payment', 'colour', 'color', 'tshirt', 'hoodie', 'bag', 'bags',
      // colours, because for this shop the colour IS how a design is named
      'black', 'white', 'red', 'blue', 'green', 'grey', 'gray', 'pink', 'purple',
      'orange', 'yellow', 'brown',
      // the particles that turn a word into "the black one"
      'ka', 'ki', 'ke', 'wala', 'wali', 'vala', 'vali',
    ].join('|') +
    ')\\b',
  'i'
);

function looksLikeSentence(value) {
  const text = String(value || '');
  if (/[?:！!]/.test(text)) return true;
  if (/(bhej do|bata do|batao|kya hai|please|thoda|dobara|likh do)/i.test(text)) return true;
  if (NOT_IN_A_NAME.test(text)) return true;
  return false;
}

function cleanField(field, raw) {
  const value = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim();
  if (field === 'pin') return value.replace(/\D/g, '').slice(0, 10);
  if (field === 'address') return String(raw).replace(/[ \t]+/g, ' ').trim().slice(0, 300);
  return value.slice(0, 60);
}

const draftOf = (convo) => (convo.data && convo.data.draft) || {};
const colorOf = (convo) => (convo.data && convo.data.color) || null;
const sizeOf = (convo) => (convo.data && convo.data.size) || null;

// --------------------------------------------------------------- flow steps

/**
 * First contact: hello, then "what are you looking for?".
 *
 * Two messages rather than one wall of text - that is how a person opens a
 * conversation, and it keeps the second message to a single question. The
 * categories come from the database and only the ones with something to sell
 * are offered.
 */
async function sendGreeting(bot, phone) {
  const categories = await categoryService.availableCategories();

  // Nothing sellable at all: do not pretend otherwise, hand over to a human.
  if (!categories.length) {
    return goToHuman(bot, phone, 'no category has stock');
  }

  const brands = await settingsService
    .value('greeting_brands')
    .catch(() => null);

  await bot.sendMessage(phone, bot.t.greeting(brands || config.BUSINESS_NAME));
  await bot.sendMessage(phone, bot.t.chooseCategory(categories));

  await conversationService.save(
    phone,
    conversationService.clearedCart({ state: STATES.SELECT_CATEGORY })
  );
  return 'greeting';
}

/**
 * @param {string} [category] show only this category's designs, when the
 *        customer named one ("T-shirt chahiye"). Without it, everything.
 */
/**
 * The shop window, and nothing else.
 *
 * Sends the category's card and the designs in it, and changes NOTHING -
 * no state, no selection, no cleared cart. sendWelcome() below is this plus
 * the bookkeeping, and the split exists because there is a second caller who
 * must not have the bookkeeping: somebody who has already ordered.
 *
 * A customer waiting to pay for a T-shirt asked "aap ke paas kaunse bags
 * hai" and was told, twice, to send the payment screenshot. The shop had the
 * answer - a bag card and a colour in stock - and gave a brush-off instead,
 * to a person who had just spent money. Answering that question through
 * sendWelcome() would have been worse: it would have wiped their order's
 * conversation and dropped them back at the design menu.
 *
 * @returns {Promise<object[]>} the products that were shown
 */
async function showCatalogue(bot, phone, category = null) {
  const all = await productService.activeProducts();
  const products = category ? all.filter((item) => item.category === category) : all;
  if (!products.length) products.push(...all);

  const withColour = await Promise.all(
    products.map(async (product) => {
      const colours = await productService.colorsOf(product).catch(() => []);
      const only = colours.length === 1 ? colours[0] : null;
      return { ...product, colour: only && only !== 'Default' ? only : null };
    })
  );

  if (category) {
    const row = await categoryService.getByKey(category).catch(() => null);
    const picture = row ? await categoryService.resolveImage(row) : null;
    if (picture) await bot.sendImage(phone, picture, '');
  }

  await bot.sendMessage(phone, bot.t.welcome(withColour));
  return products;
}

async function sendWelcome(bot, phone, category = null) {
  const all = await productService.activeProducts();
  const products = category ? all.filter((item) => item.category === category) : all;
  if (!products.length) products.push(...all);

  // The list shows "🔴 Spider-Man — Red", so each design needs its colour.
  // Colour lives on the variants, and a design has exactly one, so it is
  // resolved here rather than making the template do a lookup.
  const withColour = await Promise.all(
    products.map(async (product) => {
      const colours = await productService.colorsOf(product).catch(() => []);
      // "Default" is the internal placeholder for a product that has no
      // colour at all (the hoodies). It is a database detail, not something
      // a customer should ever read.
      const only = colours.length === 1 ? colours[0] : null;
      return { ...product, colour: only && only !== 'Default' ? only : null };
    })
  );

  /**
   * The catalogue picture, when the category has one.
   *
   * The bags come in twenty-four colours; as a list that is a wall of text,
   * as the shop's own card it is a shop window. Sent before the list so the
   * customer sees what they are choosing from first.
   */
  if (category) {
    const row = await categoryService.getByKey(category).catch(() => null);
    const picture = row ? await categoryService.resolveImage(row) : null;
    if (picture) await bot.sendImage(phone, picture, '');
  }

  await bot.sendMessage(phone, bot.t.welcome(withColour));

  /**
   * Remember the list we just showed.
   *
   * "1" means the first item on the customer's screen. Resolving it against
   * the whole catalogue instead meant someone who chose Hoodies and typed
   * "1" was sold a Spider-Man T-shirt - and the confirmation does not repeat
   * the product name, so they only found out when it arrived.
   */
  await conversationService.save(
    phone,
    conversationService.clearedCart({
      state: STATES.SELECT_PRODUCT,
      data: { shown: products.map((item) => item.id) },
    })
  );
}

/**
 * The words for each step, used to check a composed sentence points at the
 * step the shop is actually on.
 *
 * A live trace: the customer was choosing a size, the turn could not be
 * executed, and the composer - told the phase was "choosing a size" - wrote
 * "Kaunsa design dekhna hai?". The design was chosen two messages earlier.
 * Nothing caught it, because free prose was allowed to be the question: it
 * invented no number, claimed nothing done, and was still wrong.
 *
 * So when the shop is waiting on one specific answer, a sentence that names
 * a DIFFERENT step and not this one is dropped and the shop asks in its own
 * words instead. Only that case - a reply that names neither, or names this
 * step, is left exactly as written.
 */
const STEP_WORDS = {
  [STATES.SELECT_PRODUCT]: ['design', 'product', 'style', 'brand'],
  [STATES.SELECT_COLOR]: ['colour', 'color', 'rang'],
  [STATES.SELECT_SIZE]: ['size', 'saiz', 'naap'],
  [STATES.SELECT_QUANTITY]: ['quantity', 'kitne', 'piece'],
  [STATES.COLLECT_DETAILS]: ['address', 'pata', 'pincode', 'pin code'],
};

/** True when `written` asks about some other step and never mentions this one. */
function pointsAtTheWrongStep(written, state) {
  const mine = STEP_WORDS[state];
  if (!mine) return false;

  const body = String(written || '').toLowerCase();
  if (mine.some((word) => body.includes(word))) return false;

  return Object.entries(STEP_WORDS).some(
    ([other, words]) => other !== state && words.some((word) => body.includes(word))
  );
}


/**
 * The reply for when the script has nothing good to say.
 *
 * Sends an AI-composed answer built from the shop's own facts, and falls
 * back to the template if the model is unavailable or its answer fails the
 * safety check. Also counts how many turns this step has failed: three in a
 * row and a person takes over, because by then the customer has been told
 * the same thing three times and it is not working.
 *
 * @param {string} phase        where the conversation is, in plain words
 * @param {string} needed       the one thing being asked for
 * @param {string} fallbackText the template that would have been sent
 */
async function offScript(bot, phone, convo, text, { phase, needed = '', fallbackText, composed = '' }) {
  /**
   * "spider man dikha raha tha, ab bag chahiye" - checked before anything
   * else in here.
   *
   * A person shopping does not finish one thread before starting another.
   * They ask about the red T-shirt, then about a bag, then go back. The bot
   * allowed that only at the very start: name a design on the first message
   * and it switched, name one while choosing a size and the word fell
   * through to the model, which cannot change the selection and so replied
   * about a bag while the conversation stayed pointed at a T-shirt.
   *
   * This is exactly the right place for it. offScript() is where every state
   * lands when its own rules did not understand the message - so a size has
   * already had its chance to be a size and a colour to be a colour, and
   * whatever is left naming a product can only be a customer changing their
   * mind.
   *
   * Only while they are still browsing. Once details are being collected or
   * money is owed, switching would throw away a half-typed address or an
   * order they have already agreed to; those states answer the question
   * without moving (see tryBrowseWhilePaying), and COLLECT_DETAILS keeps its
   * own behaviour because a delivery address is free text and "Bag Bazaar
   * Road" is not a customer asking about bags.
   */
  const browsing =
    convo.state === STATES.SELECT_COLOR ||
    convo.state === STATES.SELECT_SIZE ||
    convo.state === STATES.SELECT_QUANTITY;

  if (browsing) {
    const switched = await trySwitchItem(bot, phone, convo, text);
    if (switched) return switched;
  }

  /**
   * No second reading of the same message.
   *
   * This used to make its own converse() call and run its own dispatcher,
   * which meant two models decided about one sentence in one turn - the
   * scattered decision-making the whole refactor exists to remove. The brain
   * has already read this message and already declined to act on it; asking
   * again would cost a second call to be told the same thing.
   *
   * The words it wrote are reused when it wrote any, so the composer below
   * is only paid for when there is genuinely nothing to say yet.
   */
  if (!composed && convo.data && convo.data.composed) composed = convo.data.composed;

  const stuck = Number((convo.data && convo.data.stuck) || 0) + 1;

  /**
   * When something is needed from the customer and three attempts have not
   * produced it, a person takes over. When nothing is needed - they have
   * paid and are asking questions while they wait - being curious is not
   * being stuck, so they get more room before the handover.
   */
  const waitingOnThem = Boolean(needed) && !needed.startsWith('nothing');
  if (stuck >= (waitingOnThem ? 4 : 7)) {
    return goToHuman(bot, phone, `customer stuck at ${phase}`);
  }
  await conversationService.save(phone, { data: { ...convo.data, stuck } });

  /**
   * A reply the combined call already wrote and that already passed the same
   * safety gate. Using it saves a second round trip to the model for the same
   * question - but the escalation above still runs, so a customer going in
   * circles is still handed to a person on the same schedule.
   */
  if (composed) {
    await bot.sendMessage(phone, composed, { raw: true });
    return `ai_reply_${phase}`;
  }

  const order = convo.current_order_id
    ? await orderService.getById(convo.current_order_id).catch(() => null)
    : await orderService.openFor(phone).catch(() => null);

  /**
   * Scoped the same way: the design they are already on, the question they
   * actually asked, and their own order if they have one. A customer stuck
   * on a size does not need the hoodie brands explained to them.
   */
  const product = convo.selected_product_id
    ? await productService.getById(convo.selected_product_id).catch(() => null)
    : null;

  const [scoped, rawHistory] = await Promise.all([
    context.forTurn({
      product,
      colour: colorOf(convo),
      topic: parser.detectQuestion(text),
      order,
      catalogue: !product,
      /**
       * When a design and a size are already on the table, say plainly
       * whether that exact thing is available and - if it is not - what the
       * shop can actually post today. Both come from the database, so the
       * model can phrase an alternative but can never invent one.
       */
      requested:
        product && sizeOf(convo)
          ? {
              productId: product.id,
              product: product.design || product.name,
              colour: colorOf(convo),
              size: sizeOf(convo),
            }
          : null,
    }),
    messageService.recentHistory(phone, 4).catch(() => []),
  ]);
  const facts = scoped.facts;

  /**
   * The transcript is the other way a postal address reaches the API. The
   * summary and the saved-address message are already sent raw; a customer
   * who typed their address two turns ago and then asked a question would
   * still have had it quoted into this prompt.
   */
  const history = redact.history(rawHistory, {
    detailsPhase: convo.state === STATES.COLLECT_DETAILS || convo.state === STATES.ORDER_SUMMARY,
  });

  const written = await replyComposer
    .compose({ text, phase, needed, facts, history, phone })
    .catch(() => null);

  if (written && !(waitingOnThem && pointsAtTheWrongStep(written, convo.state))) {
    // raw: the model wrote this one; rewriting it again would only blur it.
    await bot.sendMessage(phone, written, { raw: true });
    return `ai_reply_${phase}`;
  }

  await bot.sendMessage(phone, fallbackText);
  return `template_${phase}`;
}

/**
 * "red wali kaisi lagegi?" - send the actual picture, or say there isn't one.
 *
 * Which product this is about is decided here, from the conversation and the
 * catalogue, never by the model: the most a model contributes is the signal
 * that a picture was asked for. The file comes out of the database, is
 * checked to exist on disk, and is sent through the same adapter the payment
 * proofs use. There is no path by which a URL from anywhere else could be
 * sent, because no URL is ever used.
 *
 * @returns {Promise<boolean>} true when this turn has been answered
 */
/**
 * @param {string|null} [kind] 'front' | 'back' | 'all' - which photographs
 *        they asked for. The gallery does not label its rows, but migration
 *        018 defines sort_order 1 as the front, so "front" is the first and
 *        "back" is everything after it. Unknown or absent means all of them.
 *        Never invents: if the split leaves nothing, the whole set is sent
 *        rather than a photo of something else.
 */
async function sendProductImage(bot, phone, product, convo, kind = null) {
  if (!product) return false;

  const variant = convo && convo.selected_variant_id
    ? await productService.getVariantById(convo.selected_variant_id).catch(() => null)
    : null;

  const gallery = await productService.imagesFor(product, variant);

  let pictures = gallery;
  if (kind === 'front') pictures = gallery.slice(0, 1);
  else if (kind === 'back') pictures = gallery.slice(1);
  if (!pictures.length) pictures = gallery;

  if (!pictures.length) {
    // No photo is a fact like any other. Another product's picture would be
    // worse than none at all.
    await bot.sendMessage(phone, bot.t.noPhoto(product));
    logger.info('image.none', { phone, action: product.code || product.name });
    return true;
  }

  // Text first, then the pictures: the arrow in the message points at what is
  // about to arrive under it.
  await bot.sendMessage(phone, bot.t.photoHere(product));

  /**
   * Sent one at a time, in order, and awaited.
   *
   * WhatsApp makes each of these its own message, so the order they arrive
   * in is the order they are sent in - which is why the front of the shirt
   * is sort_order 1. Firing them together would be faster and would deliver
   * the back of the garment first often enough to matter.
   *
   * A send that throws stops the rest: the customer has already been told a
   * photo is coming, and the failure belongs in the log rather than in five
   * more attempts at a connection that has just refused one.
   */
  let sent = 0;
  for (const picture of pictures) {
    try {
      await bot.sendImage(phone, picture, '');
      sent += 1;
    } catch (err) {
      logger.warn('image.send_failed', {
        phone,
        action: product.code || product.name,
        error: err.message,
      });
      break;
    }
  }

  logger.info('image.sent', {
    phone,
    action: product.code || product.name,
    count: `${sent}/${pictures.length}`,
  });
  return true;
}

/**
 * "iski photo bhej do" - understood, but they did not say which one.
 *
 * The rule parser recognises the ask perfectly well; what was missing was
 * anywhere to act on it unless the customer happened to repeat the design
 * name in the same breath. Nobody does that - they say "iski", meaning the
 * one we have been talking about.
 *
 * So the product comes from whatever the conversation already knows, and
 * when it knows nothing we ask which one rather than dropping a question we
 * understood.
 *
 * @returns {Promise<string|null>} the action taken, or null to carry on
 */
async function tryImageRequest(bot, phone, convo, text, product = null) {
  if (parser.detectQuestion(text) !== 'image') return null;

  const products = await productService.activeProducts();

  /**
   * A design named in the same breath wins over whatever is selected.
   * "venom ki photo bhejo" while holding the Spider-Man is a request to see
   * the Venom, not the shirt already in hand.
   */
  const named = null;

  /**
   * Naming a design while still browsing also CHOOSES it - that is plainly
   * what was meant, and it is how this has always behaved.
   *
   * Past that point it must not. A customer half way through typing an
   * address who asks to see the Venom wants a photograph, not to be sent
   * back to the design menu with their draft thrown away.
   */
  const browsing =
    convo.state === STATES.START ||
    convo.state === STATES.CANCELLED ||
    convo.state === STATES.SELECT_CATEGORY ||
    convo.state === STATES.SELECT_PRODUCT;

  if (named && browsing) {
    await conversationService.save(phone, {
      state: STATES.SELECT_PRODUCT,
      selected_product_id: named.id,
    });
  }

  const wanted =
    named ||
    product ||
    (convo.selected_product_id
      ? await productService.getById(convo.selected_product_id).catch(() => null)
      : null);

  if (wanted) {
    /**
     * The chosen variant only describes the product it belongs to. Asking
     * for the Venom while the Red Spider-Man is selected must not hand the
     * Venom's photo lookup a Spider-Man variant.
     */
    const selected = convo.selected_product_id === wanted.id ? convo : null;
    await sendProductImage(bot, phone, wanted, selected);
    return named && browsing ? 'image_by_keyword' : 'image_request';
  }

  // Understood, but ambiguous. Asking beats silence.
  if (!products.length) return null;
  await bot.sendMessage(phone, bot.t.whichPhoto(products));
  return 'image_which';
}

/**
 * The model reads every message first, and the rules decide what is true.
 *
 * This is the inversion. The shop used to work the other way round: keyword
 * lists chose the action and the model was handed the finished sentence to
 * make prettier. Over one live afternoon that came to seventeen model calls,
 * thirteen of which were rewording a line the rules had already picked - and
 * every single action, from "show the T-shirts" to "that is your name", came
 * out of a regular expression. It read as a form with a chatbot painted on,
 * because that is what it was.
 *
 * So the order is reversed. The model gets the sentence and says what the
 * customer wants; the rules then check whether that thing is true and do it.
 * The model can say "they want the red one" - it cannot say the red one is
 * in stock, what it costs, or that an order exists. Those come from the
 * database exactly as they always did, and anything the model names that the
 * catalogue does not have is thrown away by converse's own validation before
 * it ever reaches here.
 *
 * Two things are deliberately NOT the model's to decide:
 *
 *   - Creating an order. `confirm` is acted on only where a summary is
 *     actually on screen, and only when the customer's own words are a yes
 *     the rule parser recognises. A model that answers "yes" on somebody's
 *     behalf spends their money.
 *   - Confirming a payment. That is an admin, through /paid, and nothing in
 *     this file can reach it.
 *
 * Returning null means "no confident read" - the message falls through to
 * the state machine below, which is unchanged and still handles everything
 * it always did. The model gets the first word here, never the last one.
 *
 * @returns {Promise<string|null>} the action taken, or null to carry on
 */
/** Where the conversation is, in the plain words the model is given. */
function phaseOf(convo) {
  switch (convo.state) {
    case STATES.SELECT_CATEGORY:
      return 'choosing a department';
    case STATES.SELECT_PRODUCT:
      return 'choosing a design';
    case STATES.SELECT_COLOR:
      return 'choosing a colour';
    case STATES.SELECT_SIZE:
      return 'choosing a size';
    case STATES.SELECT_QUANTITY:
      return 'choosing how many';
    case STATES.COLLECT_DETAILS:
      return 'giving delivery details';
    case STATES.ORDER_SUMMARY:
      return 'looking at the order summary';
    case STATES.WAITING_FOR_PAYMENT:
      return 'waiting for the payment screenshot';
    case STATES.PAYMENT_VERIFYING:
      return 'payment sent, a person is verifying it';
    default:
      return 'just arrived';
  }
}

async function aiDecide(bot, phone, convo, text, intent) {
  if (!intent) return null;

  const named = intent.product
    ? (await productService.activeProducts()).find(
        (item) => (item.design || item.name) === intent.product
      )
    : null;

  const selected = convo.selected_product_id
    ? await productService.getById(convo.selected_product_id).catch(() => null)
    : null;

  switch (intent.intent) {
    /**
     * "iski photo bhejo" - the one the rules were worst at, because the
     * customer says "iski" and means whatever they were just talking about.
     */
    case 'ask_image': {
      const wanted = named || selected;
      if (!wanted) return null;
      const owns = convo.selected_product_id === wanted.id ? convo : null;
      await sendProductImage(bot, phone, wanted, owns);
      logger.info('ai.action', { phone, action: `image ${wanted.design || wanted.name}` });
      return 'ai_image';
    }

    /** They named a design, wherever they happen to be in the conversation. */
    case 'pick_product': {
      if (!named || named.id === convo.selected_product_id) return null;
      return trySwitchItem(bot, phone, convo, text);
    }

    /** "kaunse bags hai" - show that department, without losing their place. */
    case 'browse': {
      if (!intent.category) return null;
      const sellable = await categoryService.availableCategories();
      if (!sellable.some((row) => row.key === intent.category)) return null;

      const busy =
        convo.state === STATES.COLLECT_DETAILS ||
        convo.state === STATES.ORDER_SUMMARY ||
        convo.state === STATES.WAITING_FOR_PAYMENT ||
        convo.state === STATES.PAYMENT_VERIFYING;

      if (busy) {
        await showCatalogue(bot, phone, intent.category);
        logger.info('ai.action', { phone, action: `browse ${intent.category} (kept state)` });
        return `ai_browse_${intent.category}`;
      }

      await sendWelcome(bot, phone, intent.category);
      logger.info('ai.action', { phone, action: `browse ${intent.category}` });
      return `ai_browse_${intent.category}`;
    }

    /**
     * A question the shop has a stored answer for. The words are the shop's
     * own - the model only worked out which question was being asked.
     */
    case 'ask_price':
    case 'ask_stock':
    case 'ask_cod':
    case 'ask_delivery':
    case 'ask_material':
    case 'ask_location':
    case 'ask_brands':
    case 'bargain':
    case 'refund': {
      if (!intent.question) return null;
      const answered = await faq
        .tryAnswer(bot, phone, intent.question, { pack: bot.t, convo })
        .catch(() => false);
      if (!answered) return null;
      logger.info('ai.action', { phone, action: `answered ${intent.question}` });
      return `ai_${intent.question}`;
    }

    case 'human':
      return goToHuman(bot, phone, 'customer asked for a person');

    default:
      return null;
  }
}

/**
 * Changing their mind, mid-conversation.
 *
 * Called from offScript() while the customer is still browsing, so by the
 * time it runs the message has already failed to be a size, a colour, a
 * quantity or a yes. What is left that names a product is somebody moving on
 * to something else, and the shop should move with them.
 *
 * A named design goes straight to that design and its next question. A
 * category with no design named shows that category's designs. Either way
 * the cart is cleared first: the size they picked for the Spider-Man is not
 * a size they picked for a bag, and carrying it across is how a customer
 * ends up with an order they never described.
 *
 * @returns {Promise<string|null>} the action taken, or null to carry on
 */
async function trySwitchItem(bot, phone, convo, text) {
  const products = await productService.activeProducts();

  const named = null;
  const category = named ? named.category : parser.detectCategory(text);
  if (!category) return null;

  // Already on this exact design: nothing to switch to, and answering as if
  // there were would repeat a question they are in the middle of.
  if (named && named.id === convo.selected_product_id) return null;

  const sellable = await categoryService.availableCategories();
  if (!sellable.some((row) => row.key === category)) return null;

  /**
   * Ask before throwing anything away.
   *
   * They have a design selected and have answered at least one question
   * about it. "venom" at that point probably means they changed their mind -
   * but it might be a question, a comparison, or a typo, and acting on it
   * silently costs them the colour and size they already picked.
   *
   * So the switch is offered rather than made, and the answer is remembered
   * for exactly one turn. Nothing is cleared until they say yes.
   */
  if (convo.selected_product_id) {
    const label = named
      ? await describeForSwitch(named)
      : (await categoryService.getByKey(category).catch(() => null))?.label || category;

    await bot.sendMessage(phone, bot.t.confirmSwitch(label));
    await conversationService.save(phone, {
      data: {
        ...convo.data,
        pendingSwitch: { product: named ? named.id : null, category },
      },
    });
    logger.info('switch.asked', { phone, action: label });
    return 'switch_confirm';
  }

  return applySwitch(bot, phone, convo, { product: named ? named.id : null, category });
}

/**
 * "black Venom" - because that is what people call it.
 *
 * These two designs ARE their colours: one is the red one, the other is the
 * black one, and a customer who typed "black" and is asked about "Venom" has
 * to work out for themselves that those are the same shirt. The colour lives
 * on the variants rather than the product, so it is looked up rather than
 * read off the row - which is also why the first version of this line said
 * only "Venom".
 */
async function describeForSwitch(product) {
  const name = product.design || product.name;
  const colours = await productService.colorsOf(product).catch(() => []);
  const only = colours.length === 1 ? colours[0] : null;
  return only && only !== 'Default' ? `${only} ${name}` : name;
}

/**
 * Do the switch the customer just agreed to.
 *
 * The cart is cleared on the way: a size chosen for a T-shirt is not a size
 * chosen for a bag, and carrying one across is how somebody ends up with an
 * order they never described.
 */
async function applySwitch(bot, phone, convo, { product, category }) {
  if (product) {
    const chosen = await productService.getById(product).catch(() => null);
    if (chosen) {
      await conversationService.save(
        phone,
        conversationService.clearedCart({
          state: STATES.SELECT_PRODUCT,
          selected_product_id: chosen.id,
        })
      );
      logger.info('switch.design', { phone, action: chosen.design || chosen.name });
      return afterProductSelected(bot, phone, chosen);
    }
  }

  await sendWelcome(bot, phone, category);
  logger.info('switch.category', { phone, action: category });
  return `switched_${category}`;
}

/**
 * "aap ke paas kaunse bags hai?" - asked with a payment outstanding.
 *
 * Somebody who has just placed an order is the best customer the shop has
 * that day, and asking what else is sold is them trying to spend more money.
 * They were getting "please send the payment screenshot", twice, because
 * every payment state routed straight to the off-script composer - which has
 * no catalogue, cannot send the bag card, and so produced "mujhe check karna
 * padega" about a bag the shop had in stock.
 *
 * So the question gets answered: the card, the designs, the colours, exactly
 * as a browsing customer would see them. What does NOT happen is any change
 * to their order. The state stays where it was, the selection stays where it
 * was, and the reminder about the outstanding payment goes out after the
 * answer rather than instead of it.
 *
 * While a payment is still owed the reminder follows. Once they have sent a
 * screenshot and are waiting on us, it does not: chasing somebody for money
 * they have already sent is the fastest way to lose them.
 *
 * @returns {Promise<string|null>} the action taken, or null to carry on
 */
/**
 * True when the shop has a scanner at all.
 *
 * A reminder does not re-send the QR - the customer already has it, and a
 * shop that fires the same picture at somebody every time they say anything
 * is a shop that looks broken. But it must not print the typed UPI id
 * either, because that is the second destination this whole change exists to
 * remove. So the reminder simply carries no payment details, and "payment
 * kaha karu" is what puts the scanner back on their screen.
 *
 * Only when there is no scanner at all do the words come back, because then
 * they are the only thing the customer has.
 */
const hasScanner = async () =>
  Boolean(await paymentService.paymentQrImage().catch(() => null));

async function tryBrowseWhilePaying(bot, phone, text, order, { remind = true } = {}) {
  const products = await productService.activeProducts();

  const named = null;
  const category = named ? named.category : parser.detectCategory(text);
  if (!category) return null;

  /**
   * Only for a category the shop can actually sell today. Offering an empty
   * one is the same lie the greeting is careful not to tell.
   */
  const sellable = await categoryService.availableCategories();
  if (!sellable.some((row) => row.key === category)) return null;

  await showCatalogue(bot, phone, category);
  if (remind) {
    await bot.sendMessage(phone, bot.t.waitingForPayment(order, { scanner: await hasScanner() }));
  }

  logger.info('browse.during_payment', { phone, action: `${category} (${order.order_id})` });
  return `browsed_${category}`;
}

/** Product chosen -> ask colour, or skip when there is only one. */
async function afterProductSelected(bot, phone, product, extra = {}) {
  const colors = await productService.colorsOf(product);

  // One colour, or none at all (hoodies are ordered by size only). Either
  // way there is nothing to ask - asking would be a question with one
  // possible answer, which the sales memory calls overloading the customer.
  if (colors.length <= 1) {
    return afterColorSelected(bot, phone, product, colors[0] || null, extra);
  }

  /**
   * The picture goes with the question.
   *
   * Twenty-four colour names in a message is not a choice anybody can make.
   * The shop's own photograph of the bag is its printed colour chart - every
   * colour, named, with the price under each - so the question and the thing
   * being asked about arrive together and the customer can point at one.
   *
   * The chart is sent plain. Marked-up copies with the chosen colour ticked
   * were built and uploaded, and the owner's decision was to leave them out:
   * the customer marks the one they want themselves and a person picks it up
   * from there. scripts/mark-bag-colours.js still builds them if that is
   * ever revisited.
   */
  const chart = (await productService.imagesFor(product).catch(() => []))[0] || null;
  if (chart) await bot.sendImage(phone, chart, '');

  await bot.sendMessage(phone, bot.t.chooseColor(product, colors));
  await conversationService.save(
    phone,
    conversationService.clearedCart({
      state: STATES.SELECT_COLOR,
      selected_product_id: product.id,
    })
  );
  return 'product_selected';
}

/** Colour chosen -> ask size, or run the stock check for sizeless products. */
async function afterColorSelected(bot, phone, product, color, extra = {}) {
  const hasSizes = await productService.hasSizes(product);

  if (hasSizes) {
    const sizesLeft = await productService.availableSizes(product.id, color);
    if (!sizesLeft.length) {
      await bot.sendMessage(
        phone,
        bot.t.colorOutOfStock(product, color, await productService.availableColors(product.id))
      );
      await conversationService.save(phone, {
        state: STATES.SELECT_COLOR,
        selected_product_id: product.id,
        selected_variant_id: null,
        data: { color },
      });
      return 'out_of_stock';
    }

    const allSizes = await productService.sizesOf(product);

    /**
     * Silent when a size is already coming.
     *
     * "red wala L" gives the colour and the size at once. Asking "kaunsa
     * size chahiye?" and answering it in the same breath makes the shop look
     * like it was not listening - the customer reads a question they had
     * already answered, immediately followed by the answer.
     */
    if (!extra.quiet) {
      await bot.sendMessage(
        phone,
        extra.combined
          ? bot.t.colorPickedNowSize(product, color, sizesLeft)
          : bot.t.chooseSize(allSizes)
      );
    }
    await conversationService.save(phone, {
      state: STATES.SELECT_SIZE,
      selected_product_id: product.id,
      selected_variant_id: null,
      quantity: null,
      data: { color },
    });
    return 'color_selected';
  }

  // sizeless product (Bag)
  const variant = await productService.findVariant(product.id, color, null);
  const stock = await productService.stockOf(product.id, color, null);

  if (stock <= 0) {
    await bot.sendMessage(
      phone,
      bot.t.colorOutOfStock(product, color, await productService.availableColors(product.id))
    );
    await conversationService.save(phone, {
      state: STATES.SELECT_COLOR,
      selected_product_id: product.id,
      data: { color },
    });
    return 'out_of_stock';
  }

  await bot.sendMessage(
    phone,
    bot.t.available(product, color, '', productService.priceOf(product))
  );
  await conversationService.save(phone, {
    state: STATES.SELECT_QUANTITY,
    selected_product_id: product.id,
    selected_variant_id: variant ? variant.id : null,
    quantity: null,
    data: { color, size: null },
  });
  return 'color_selected';
}

/**
 * Ask for one field - and for the name, offer the WhatsApp one instead.
 *
 * Used wherever the bot has to put the question again (a greeting arrived, an
 * answer did not validate). A customer who is stuck on "what is your name?"
 * is much better served by "Rahul hi likh du na?", which is one tap.
 */
async function askFor(bot, phone, convo, field, action) {
  await bot.sendMessage(phone, bot.t.askField(field));
  await conversationService.save(phone, {
    state: STATES.COLLECT_DETAILS,
    data: { ...convo.data, awaiting: field },
  });
  return action;
}

/**
 * Say hello back, then ask again whatever this conversation was waiting for.
 *
 * Used when a greeting lands mid-order. Every branch keeps the customer's
 * product, colour and size exactly where they were.
 */
async function repeatCurrentStep(bot, phone, convo) {
  const product = convo.selected_product_id
    ? await productService.getById(convo.selected_product_id)
    : null;

  switch (convo.state) {
    case STATES.SELECT_CATEGORY:
      await bot.sendMessage(
        phone,
        bot.t.chooseCategory(await categoryService.availableCategories())
      );
      return 'greeting_repeat_category';

    case STATES.SELECT_PRODUCT:
      await sendWelcome(bot, phone);
      return 'greeting_repeat_products';

    case STATES.SELECT_COLOR:
      if (product) {
        await bot.sendMessage(phone, bot.t.chooseColor(product, await productService.colorsOf(product)));
        return 'greeting_repeat_colour';
      }
      break;

    case STATES.SELECT_SIZE:
      if (product) {
        await bot.sendMessage(phone, bot.t.chooseSize(await productService.sizesOf(product)));
        return 'greeting_repeat_size';
      }
      break;

    case STATES.COLLECT_DETAILS: {
      const awaiting = (convo.data && convo.data.awaiting) || 'name';
      await bot.sendMessage(
        phone,
        awaiting === 'address_confirm' ? bot.t.askDetails() : bot.t.askField(awaiting)
      );
      return 'greeting_repeat_details';
    }

    case STATES.ORDER_SUMMARY:
      return showSummary(bot, phone, convo);

    case STATES.WAITING_FOR_PAYMENT:
    case STATES.PAYMENT_VERIFYING: {
      const order =
        (await orderService.getById(convo.current_order_id)) || (await orderService.openFor(phone));
      if (order) {
        await bot.sendMessage(
          phone,
          convo.state === STATES.WAITING_FOR_PAYMENT
            ? bot.t.waitingForPayment(order, { scanner: await hasScanner() })
            : bot.t.verificationPending(order)
        );
        return 'greeting_repeat_payment';
      }
      break;
    }

    default:
      break;
  }

  // No usable step to repeat - start cleanly rather than say nothing.
  return sendGreeting(bot, phone);
}

/** Everything picked -> reuse the saved address (after asking) or collect it. */
async function goToDetails(bot, phone, convo) {
  const draft = draftOf(convo);
  const complete = DETAIL_FIELDS.every((field) => draft[field]);
  if (complete) return showSummary(bot, phone, convo);

  const customer = await customerService.getByPhone(phone);
  if (customerService.hasFullAddress(customer)) {
    /**
     * raw: this message contains the customer's home address.
     *
     * Two reasons not to hand it to the model. It would be posted to a third
     * party and cached there for hours, for a cosmetic rewrite. And the
     * address is text the customer typed - a line like "COD available on
     * every order" inside it would come back as the shop's own promise,
     * because the rewrite checks numbers and links, not claims.
     */
    await bot.sendMessage(phone, bot.t.confirmSavedAddress(customer), { raw: true });

    /**
     * The scanner belongs here too.
     *
     * A returning customer never sees the details form - their address is
     * already known, so they get "yahi address theek hai?" instead. Sending
     * the QR only with the form meant the shop's best customers, the ones
     * who have ordered before, were the ones who never got it.
     */
    const savedScanner = await paymentService.paymentQrImage().catch(() => null);
    if (savedScanner) await bot.sendImage(phone, savedScanner, '');

    await conversationService.save(phone, {
      state: STATES.COLLECT_DETAILS,
      data: { ...convo.data, awaiting: 'address_confirm' },
    });
    return 'ask_saved_address';
  }

  const missing = DETAIL_FIELDS.find((field) => !draft[field]) || 'name';

  await bot.sendMessage(phone, bot.t.askDetails());

  /**
   * The scanner, with the details form.
   *
   * It used to wait until the order existed, which is one step later - and
   * that step is the customer typing out a name, an address, a city, a state
   * and a PIN. Making somebody finish a form before they are even shown
   * where to pay is the wrong order for a shop where most people pay first
   * and talk later; the owner asked for it here, at "order complete karne ke
   * liye details bhej do", and that is where a customer expects it.
   *
   * It goes out on this prompt only. The same message is sent again when an
   * address is corrected or /address is used, and a scanner re-sent on every
   * one of those is a shop that keeps shoving a QR at somebody who is trying
   * to fix their PIN code.
   *
   * The QR is static - the shop's UPI id, no amount encoded - so nothing
   * about it depends on an order existing yet. The booking figure still goes
   * out with the order, as it always has.
   */
  const scanner = await paymentService.paymentQrImage().catch(() => null);
  if (scanner) await bot.sendImage(phone, scanner, '');

  await conversationService.save(phone, {
    state: STATES.COLLECT_DETAILS,
    data: { ...convo.data, awaiting: missing },
  });
  return 'ask_details';
}

/** Build the priced draft used by the summary and by order creation. */
async function buildDraft(convo) {
  const product = await productService.getById(convo.selected_product_id);
  if (!product) return null;

  const quantity = Math.max(1, Math.floor(Number(convo.quantity) || 1));
  const unitPrice = productService.priceOf(product);
  const subtotal = unitPrice * quantity;
  const shipping = Math.max(0, Math.floor(config.SHIPPING_CHARGE));

  return {
    ...draftOf(convo),
    productId: product.id,
    variantId: convo.selected_variant_id,
    color: colorOf(convo),
    size: sizeOf(convo),
    quantity,
    unitPrice,
    subtotal,
    shipping,
    total: subtotal + shipping,
    product,
  };
}

async function showSummary(bot, phone, convo) {
  const draft = await buildDraft(convo);
  if (!draft) {
    await sendGreeting(bot, phone);
    return 'restart_missing_product';
  }

  // stock can move while the customer is typing - re-check before confirming
  const available = await productService.stockOf(draft.productId, draft.color, draft.size);
  if (available < draft.quantity) {
    return handleShortStock(bot, phone, convo, draft, available);
  }

  // raw: carries the full delivery address - see confirmSavedAddress above.
  await bot.sendMessage(phone, bot.t.orderSummary(draft, draft.product), { raw: true });
  await conversationService.save(phone, {
    state: STATES.ORDER_SUMMARY,
    data: { ...convo.data, awaiting: null, draft: pickDetails(draft) },
  });
  return 'summary';
}

const pickDetails = (source) => {
  const out = {};
  for (const field of DETAIL_FIELDS) if (source[field]) out[field] = source[field];
  return out;
};

/** Shared "not enough stock" routing used by several states. */
async function handleShortStock(bot, phone, convo, draft, available) {
  const product = draft.product || (await productService.getById(convo.selected_product_id));

  if (available > 0) {
    await bot.sendMessage(phone, bot.t.onlyNAvailable(available));
    await conversationService.save(phone, {
      state: STATES.SELECT_QUANTITY,
      data: { ...convo.data, offeredQty: available },
    });
    return 'quantity_capped';
  }

  if (await productService.hasSizes(product)) {
    await bot.sendMessage(
      phone,
      bot.t.outOfStock(
        product,
        draft.color,
        draft.size,
        await productService.availableSizes(product.id, draft.color)
      )
    );
    await conversationService.save(phone, {
      state: STATES.SELECT_SIZE,
      selected_variant_id: null,
      data: { ...convo.data, size: null },
    });
  } else {
    await bot.sendMessage(
      phone,
      bot.t.colorOutOfStock(product, draft.color, await productService.availableColors(product.id))
    );
    await conversationService.save(phone, { state: STATES.SELECT_COLOR, data: convo.data });
  }
  return 'out_of_stock';
}

async function createOrderAndAskPayment(bot, phone, convo) {
  const draft = await buildDraft(convo);
  if (!draft) {
    await sendGreeting(bot, phone);
    return 'restart_missing_product';
  }

  const available = await productService.stockOf(draft.productId, draft.color, draft.size);
  if (available < draft.quantity) {
    return handleShortStock(bot, phone, convo, draft, available);
  }

  const order = await orderService.create(phone, draft);

  /**
   * The booking number and the scanner go out together.
   *
   * This used to send the number alone, on the reasoning that the QR had
   * already gone out with the details form and repeating it would look like
   * the shop had not noticed a payment. The owner watched real customers
   * hit it and asked for the opposite, which is their call to make: by the
   * time the booking number arrives the scanner is several messages up the
   * chat, above a photo or two and a typed-out address, and "abhi Rs500
   * dena hai" with nothing to pay into is a dead end.
   *
   * The reasoning behind the old behaviour is kept as the condition. Nobody
   * who has already paid is shown the QR again - that was the case worth
   * protecting, and it is checked rather than assumed.
   */
  await bot.sendMessage(phone, bot.t.paymentInstructions(order, { scanner: await hasScanner() }));

  if (String(order.payment_status || '').toLowerCase() !== 'paid') {
    const scanner = await paymentService.paymentQrImage().catch(() => null);
    if (scanner) await bot.sendImage(phone, scanner, '');
  }
  await conversationService.save(phone, {
    state: STATES.WAITING_FOR_PAYMENT,
    current_order_id: order.id,
    data: { ...convo.data, awaiting: null },
  });

  if (!paymentService.isPaymentLinkConfigured()) {
    await bot.notifyAdmins(
      `⚠️ PAYMENT_LINK .env me set nahi hai. Order #${order.order_id} bina payment link ke gaya.`
    );
  }
  return 'order_created';
}

/** Hand the customer to a human and stop replying. */
async function goToHuman(bot, phone, reason, { announce = true } = {}) {
  await conversationService.save(phone, { mode: MODE.HUMAN, state: STATES.HUMAN_HANDOFF });
  if (announce) await bot.sendMessage(phone, bot.t.handoff());

  const order = await orderService.openFor(phone);
  await bot.notifyAdmins(
    `🙋 HUMAN MODE\n\nCustomer: ${phone}\nReason: ${reason}` +
      (order ? `\nOpen order: #${order.order_id} (${order.status})` : '') +
      `\n\nRepli ne is customer ko reply karna band kar diya hai.\nBot wapas chalu karne ke liye: /resume ${phone}`
  );
  logger.info('conversation.human', { phone, action: reason });
  return 'human_mode';
}

// ------------------------------------------------------------ state handlers

async function handleDetails(bot, phone, convoIn, text) {
  let convo = convoIn;
  const awaiting = (convo.data && convo.data.awaiting) || 'name';
  let draft = { ...draftOf(convo) };

  // Greetings never reach this far - handleMessage turns them back into a
  // fresh hello, so nothing here has to defend against "Hy" as a name.
  if (awaiting === 'address_confirm') {
    if (parser.isYes(text)) {
      const customer = await customerService.getByPhone(phone);
      draft = customerService.addressOf(customer) || {};
      return showSummary(bot, phone, { ...convo, data: { ...convo.data, draft, awaiting: null } });
    }
    if (parser.isNo(text)) {
      await bot.sendMessage(phone, bot.t.askDetails());
      await conversationService.save(phone, {
        state: STATES.COLLECT_DETAILS,
        data: { ...convo.data, draft: {}, awaiting: 'name' },
      });
      return 'address_new';
    }
    await bot.sendMessage(phone, bot.t.yesOrNo());
    return 'address_unclear';
  }

  // Progress clears the counter, so a customer who gets one field wrong and
  // then answers three correctly is never escalated for the first mistake.
  if (convo.data && convo.data.stuck) {
    convo = { ...convo, data: { ...convo.data, stuck: 0 } };
  }

  let found = parser.parseLabelledDetails(text);
  if (!Object.keys(found).length) {
    const block = parser.parsePlainDetailBlock(text);
    if (block) found = block;
  }

  const invalid = [];

  if (Object.keys(found).length) {
    for (const [field, raw] of Object.entries(found)) {
      const value = cleanField(field, raw);
      if (VALIDATORS[field](value)) draft[field] = value;
      else invalid.push(field);
    }
  } else {
    const value = cleanField(awaiting, text);
    if (!VALIDATORS[awaiting](value)) {
      return offScript(bot, phone, convo, text, {
        phase: `collecting the ${awaiting}`,
        needed: `their ${awaiting}`,
        fallbackText: bot.t.invalidField(awaiting),
      });
    }
    draft[awaiting] = value;
  }

  const missing = DETAIL_FIELDS.filter((field) => !draft[field]);

  if (!missing.length) {
    await customerService.saveDetails(phone, draft);
    return showSummary(bot, phone, { ...convo, data: { ...convo.data, draft, awaiting: null } });
  }

  await conversationService.save(phone, {
    state: STATES.COLLECT_DETAILS,
    data: { ...convo.data, draft, awaiting: missing[0] },
  });

  /**
   * Keep what they have given us, even if they never finish.
   *
   * Details used to reach the `customers` table only when the whole form was
   * complete, so a customer who gave a name and an address and then went
   * quiet left nothing behind. Not awaited: the reply should not wait on it.
   */
  void customerService.saveDetails(phone, draft).catch(() => {});

  if (invalid.length) await bot.sendMessage(phone, bot.t.invalidField(invalid[0]));
  await bot.sendMessage(phone, bot.t.askField(missing[0]));
  return 'detail_saved';
}

async function handleQuantity(bot, phone, convo, text) {
  const product = await productService.getById(convo.selected_product_id);
  if (!product) {
    await sendGreeting(bot, phone);
    return 'restart_missing_product';
  }

  const color = colorOf(convo);
  const size = sizeOf(convo);
  const offered = convo.data && convo.data.offeredQty;

  let quantity = parser.parseQuantity(text);
  if (quantity === null && offered && parser.isYes(text)) quantity = offered;

  if (quantity === null) {
    await bot.sendMessage(phone, bot.t.quantityNotUnderstood());
    return 'quantity_unclear';
  }

  return applyQuantity(bot, phone, convo, product, quantity);
}

/**
 * A quantity that has been decided, checked against the lot and acted on.
 *
 * Split out of handleQuantity for the same reason applySize was: so the
 * executor can carry out a number the brain resolved without handing the
 * sentence back to a parser. Everything that makes a quantity safe is here
 * rather than in the deciding - the cap, and live stock.
 */
async function applyQuantity(bot, phone, convo, product, quantity) {
  const color = colorOf(convo);
  const size = sizeOf(convo);

  if (quantity > config.MAX_QTY) {
    await bot.sendMessage(phone, bot.t.quantityTooHigh(config.MAX_QTY));
    return 'quantity_too_high';
  }

  const available = await productService.stockOf(product.id, color, size);
  if (available < quantity) {
    return handleShortStock(
      bot,
      phone,
      convo,
      { color, size, product, quantity },
      available
    );
  }

  const updated = await conversationService.save(phone, {
    state: STATES.SELECT_QUANTITY,
    quantity,
    data: { ...convo.data, offeredQty: null },
  });
  return goToDetails(bot, phone, { ...updated, data: updated.data || {} });
}

async function handleSize(bot, phone, convo, text) {
  const product = await productService.getById(convo.selected_product_id);
  if (!product) {
    await sendGreeting(bot, phone);
    return 'restart_missing_product';
  }

  const sizes = await productService.sizesOf(product);
  const size = null;
  if (!size) {
    return offScript(bot, phone, convo, text, {
      phase: 'choosing a size',
      needed: `a size: ${sizes.join(', ')}`,
      fallbackText: bot.t.sizeNotUnderstood(sizes),
    });
  }

  return applySize(bot, phone, convo, product, size);
}

/**
 * A size that has been decided, checked against stock and acted on.
 *
 * Split out of handleSize so the executor can carry out a size the brain
 * resolved without handing the raw sentence back to a parser - which would
 * be a second reading of the same message, and a second chance to disagree
 * with the first.
 *
 * Everything that makes a size safe is here rather than in the deciding:
 * stock is read live, the variant is looked up, and an unavailable size is
 * refused with the ones that are left. A model naming a size does not make
 * it available.
 */
async function applySize(bot, phone, convo, product, size) {
  const color = colorOf(convo);
  if ((await productService.stockOf(product.id, color, size)) <= 0) {
    await bot.sendMessage(
      phone,
      bot.t.outOfStock(
        product,
        color,
        size,
        await productService.availableSizes(product.id, color)
      )
    );
    return 'out_of_stock';
  }

  const variant = await productService.findVariant(product.id, color, size);

  /**
   * Design and size are chosen, so this is the first moment the price is
   * allowed to appear (see the sales memory: never lead with it).
   *
   * No quantity question. A booking reserves one piece of one size in the
   * current lot; asking "how many?" would both invite an answer the lot
   * cannot honour and add a step to a flow that is meant to be short.
   */
  const updated = await conversationService.save(phone, {
    selected_variant_id: variant ? variant.id : null,
    quantity: 1,
    data: { ...convo.data, size },
  });

  await bot.sendMessage(
    phone,
    bot.t.available(product, color, size, productService.priceOf(product))
  );

  return goToDetails(bot, phone, { ...updated, data: updated.data || {} });
}

/** A photo/PDF can only mean one thing here: payment proof. */
async function handleMedia(bot, phone, convo, msg) {
  const order = await orderService.openFor(phone);

  if (!order) {
    await bot.sendMessage(phone, bot.t.needOrderFirst());
    return 'proof_without_order';
  }

  /**
   * Read the screenshot before answering it.
   *
   * The customer has just sent proof and, until now, got the same three
   * lines whatever they sent - which reads as nobody having looked. Saying
   * the figure back is what makes it obvious somebody did.
   *
   * What this must never become is a confirmation. The reading changes no
   * order, no payment row and no status; PAYMENT_VERIFYING is set exactly as
   * before, and only an admin moves it past that. A screenshot is a picture
   * of a claim, and this treats it as one.
   *
   * Every failure lands on the old message: no key, no budget, an
   * unreadable image, a PDF receipt, a model that returned something odd.
   * The proof itself is saved and sent to the admin either way, which is the
   * part that has to work.
   */
  const seen = await aiProof
    .read({ buffer: msg.media && msg.media.buffer, mimetype: msg.media && msg.media.mimetype, phone })
    .catch(() => null);

  await paymentService.handlePaymentProof(bot, order, msg.media, messages, seen);

  if (seen && seen.looksLikePayment === false) {
    /**
     * Asked, not refused. The proof is still filed and the admin still gets
     * it - a model calling a genuine receipt "not a payment" must not be
     * able to reject a real customer's evidence. All this does is ask for
     * the right picture, and the conversation still moves on.
     */
    await bot.sendMessage(phone, bot.t.proofNotAPayment());
  } else if (seen && seen.amount !== null) {
    await bot.sendMessage(phone, bot.t.paymentProofRead(seen.amount));
  } else {
    await bot.sendMessage(phone, bot.t.paymentProofReceived());
  }

  await conversationService.save(phone, {
    state: STATES.PAYMENT_VERIFYING,
    current_order_id: order.id,
  });
  return 'payment_proof';
}

async function think(bot, phone, convo, text) {
  const askedTopic = parser.detectQuestion(text);

  /**
   * Two readings, because they answer two different questions.
   *
   * `facts` is what the shop may state, and narrowing it to the chosen
   * design is the whole reason scoping exists - nobody needs twenty-four
   * backpack colours to answer a question about a hoodie.
   *
   * The allow-lists are not that. They are the set of names a decision is
   * permitted to contain, and they have to be the live catalogue whatever
   * the customer happens to have selected. Scoped, they came back as
   * `designs: [null]` and `sizes: []` the moment a product was chosen - so
   * every decision the brain made from then on named something that was not
   * on its own list, was rejected as `bad_product`, and the shop quietly
   * fell back to keyword matching for the rest of the conversation.
   */
  const scoped = await context
    .forTurn({
      catalogue: true,
      topic: askedTopic,
      prices: ['price', 'bargain', 'cod'].includes(askedTopic),
      product: convo.selected_product_id || null,
      colour: colorOf(convo),
    })
    .catch(() => null);
  if (!scoped) return null;

  const catalogue = await context.forTurn({ catalogue: true, prices: false }).catch(() => null);
  const reading = {
    facts: scoped.facts,
    designs: (catalogue && catalogue.designs) || scoped.designs,
    colours: (catalogue && catalogue.colours) || scoped.colours,
    sizes: (catalogue && catalogue.sizes) || scoped.sizes,
  };

  /** What they already hold, named the way a customer would say it. */
  let chosen = '';
  if (convo.selected_product_id) {
    const product = await productService.getById(convo.selected_product_id).catch(() => null);
    if (product) {
      chosen = [product.design || product.name, colorOf(convo), sizeOf(convo)]
        .filter(Boolean)
        .join(' ');
    }
  }

  /** The list they are looking at, in the order they saw it. */
  let shown = [];
  const ids = (convo.data && convo.data.shown) || [];
  if (ids.length) {
    const all = await productService.activeProducts();
    shown = ids
      .map((id) => all.find((item) => item.id === id))
      .filter(Boolean)
      .map((item) => item.design || item.name);
  }

  const draft = draftOf(convo);
  const known = DETAIL_FIELDS.filter((field) => draft[field]).join(', ');

  /**
   * Which colours and sizes each design actually comes in.
   *
   * Without this the brain was handed a list of designs and a separate list
   * of every colour in the shop, with nothing joining them. Asked about
   * "Red" it answered design Venom - the black shirt - because it had no
   * way to know Red is the Spider-Man. The pairing is small enough to send
   * on every turn and it is the difference between reading a catalogue and
   * guessing from two columns.
   *
   * Read from the database each turn, so a colour that sells out stops
   * being offered without anything here changing.
   */
  const everything = await productService.activeProducts().catch(() => []);
  const pairs = [];
  for (const item of everything) {
    const [itemColours, itemSizes] = await Promise.all([
      productService.colorsOf(item).catch(() => []),
      productService.sizesOf(item).catch(() => []),
    ]);
    const wearable = itemColours.filter((value) => value && value !== 'Default');
    pairs.push(
      [
        `- ${item.design || item.name}`,
        wearable.length ? `colours: ${wearable.join('/')}` : 'one colour only',
        itemSizes.length ? `sizes: ${itemSizes.join('/')}` : 'no sizes',
      ].join(' | ')
    );
  }

  return brain.decide({
    pairs,
    phone,
    text,
    facts: reading.facts,
    phase: phaseOf(convo),
    categories: await categoryService.availableCategories(),
    designs: reading.designs,
    colours: reading.colours,
    sizes: reading.sizes,
    chosen,
    shown,
    known,
    history: redact.history(
      await messageService.recentHistory(phone, 2).catch(() => []),
      { detailsPhase: convo.state === STATES.COLLECT_DETAILS }
    ),
    language: convo.data && convo.data.lang,
  });
}

/**
 * The operations the brain is allowed to drive.
 *
 * Handed over explicitly rather than imported by execute.js, so the list of
 * things a model can cause is one short block in this file and not something
 * that grows by accident. Creating an order, confirming a payment and taking
 * a size are all deliberately absent - those keep their own handlers, which
 * check stock and consent in the order this shop needs them checked.
 */
/** The address on the summary was wrong: take the details again. */
async function editDetails(bot, phone, convo) {
  await bot.sendMessage(phone, bot.t.askDetails());
  await conversationService.save(phone, {
    state: STATES.COLLECT_DETAILS,
    data: { ...convo.data, draft: {}, awaiting: 'name' },
  });
  return 'summary_declined';
}

const runDecision = createExecutor({
  sendGreeting,
  sendWelcome,
  showCatalogue,
  sendProductImage,
  afterProductSelected,
  afterColorSelected,
  goToDetails,
  goToHuman,
  applySize,
  applyQuantity,
  editDetails,
  buildDraft,
  createOrder: createOrderAndAskPayment,
  cancelOrder: async (bot, phone) => {
    await orderService.cancelOpen(phone);
    await conversationService.save(
      phone,
      conversationService.clearedCart({ state: STATES.CANCELLED })
    );
    await bot.sendMessage(phone, bot.t.cancelled());
  },
});

async function handleMessage(bot, msg) {
  const phone = config.normalisePhone(msg.phone);
  const convo = await conversationService.get(phone);
  const text = String(msg.text || '');
  const command = parser.detectCommand(text);

  /**
   * Customer asks for a person - but not while they are giving an address.
   *
   * "aane se pehle call karo" is a delivery instruction, and treating it as
   * a request for a human silenced the bot permanently: HUMAN mode stops
   * every later message until the owner types /resume, and the half-filled
   * order is abandoned with no order row to find it by.
   */
  const collectingDetails =
    convo.state === STATES.COLLECT_DETAILS || Boolean(convo.data && convo.data.awaiting);


  /**
   * A photo counts as payment proof only when payment is what we asked for.
   *
   * `openFor()` returns any unpaid order with no time limit, so a screenshot
   * sent while browsing was filed against an order from days earlier: status
   * flipped to PAYMENT_VERIFYING, the owner got a "verify this" alert with an
   * amount, and every later message was answered "verification pending".
   */
  if (msg.isMedia) {
    const expectingPayment =
      convo.state === STATES.WAITING_FOR_PAYMENT || convo.state === STATES.PAYMENT_VERIFYING;

    if (expectingPayment) return handleMedia(bot, phone, convo, msg);

    await bot.sendMessage(phone, bot.t.needOrderFirst());
    return 'media_without_pending_payment';
  }

  /**
   * THE BRAIN, before anything reads the message for meaning.
   *
   * Everything below this point used to run first: a human-request pattern
   * list, a greeting word list, an FAQ pattern list, a product spelling
   * dictionary, a category dictionary, a colour dictionary. Each decided
   * what the customer meant, and by the time a model was asked anything the
   * decision was already made. That is how "Red" became the hoodie menu -
   * a category matcher happened to run before a colour matcher.
   *
   * Now the model reads the sentence with everything it needs to resolve it:
   * where the conversation is, what this customer already chose, what was
   * last put on their screen (so "pehla wala" and "jo dikhaya tha" mean
   * something), and the live catalogue. It returns a decision; execute()
   * checks that decision against the database and carries it out.
   *
   * The lists below still exist and still run - but only when this produced
   * nothing: no API key, no budget, a rejected read, or an honest "I am not
   * sure". They stopped being the shop's understanding and became its
   * fallback, which is the whole point of the change.
   */
  /**
   * A bare "1" is an index into the list on their screen, not a sentence.
   * There is no meaning to read and nothing a model could add, so it goes
   * straight to the flow that knows what was shown.
   */
  const isMenuNumber = parser.parseMenuIndex(text) !== null;

  if (!command && !isMenuNumber) {
    const brainDecision = await think(bot, phone, convo, text).catch((err) => {
      logger.warn('brain.failed', { phone, error: err.message });
      return null;
    });

    if (brainDecision) {
      const done = await runDecision(bot, phone, convo, text, brainDecision).catch((err) => {
        logger.warn('brain.execute_failed', { phone, error: err.message });
        return null;
      });
      if (done) return done;

      // Not executable, but the words were already written and checked.
      if (brainDecision.reply && brainDecision.decision === 'continue') {
        convo.data = { ...convo.data, composed: brainDecision.reply };
      }
    }
  }

  /**
   * Asking for a person, when the brain did not catch it.
   *
   * This used to run before anything else, which meant a pattern list
   * decided what "baat karni hai" meant while the model was never asked.
   * The brain has a `handoff` decision and reaches it from the sentence, so
   * this is now the safety valve behind it: somebody asking for a human when
   * the model is unavailable must still get one, because that request is the
   * one it is least acceptable to miss.
   *
   * Still never while they are giving an address - "aane se pehle call karo"
   * is a delivery instruction, and reading it as a handover silenced the bot
   * permanently and abandoned the half-filled order.
   */
  if (!collectingDetails && parser.wantsHuman(text)) {
    return goToHuman(bot, phone, 'customer asked for a human');
  }

  /**
   * "Hi" means hello, wherever it arrives - and never means anything else.
   *
   * Treating it as an answer is what once put "Hy" into a customer's name
   * field. But throwing their order away is not the fix either: someone who
   * says hello halfway through picking a size still wants that size. So the
   * hello is answered, and the step they were on is asked again - nothing
   * chosen is lost.
   *
   * Three of them in a row means the conversation is going nowhere, and a
   * person takes over. That is what a shop would do far sooner than a bot.
   */
  if (parser.isGreeting(text)) {
    if (convo.state === STATES.START || convo.state === STATES.CANCELLED) {
      return sendGreeting(bot, phone);
    }

    const stuck = Number((convo.data && convo.data.stuck) || 0) + 1;
    if (stuck >= 3) return goToHuman(bot, phone, 'customer only sending greetings');

    await conversationService.save(phone, { data: { ...convo.data, stuck } });
    return repeatCurrentStep(bot, phone, { ...convo, data: { ...convo.data, stuck } });
  }

  /**
   * A question gets answered where it was asked.
   *
   * "kitne ka hai?" while picking a size used to be read as a broken size
   * answer, and the customer got "size samajh nahi aaya". Now they get the
   * price and stay exactly where they were - no state change, no restart.
   */
  /**
   * Not while they are filling in the form.
   *
   * An address is full of words the FAQ patterns look for - a city, a
   * landmark, "delivery" - and answering the address with "we are in Dadar,
   * Mumbai" loses the order. In COLLECT_DETAILS every message is an answer.
   */
  const question = convo.state === STATES.COLLECT_DETAILS ? null : parser.detectQuestion(text);

  /**
   * Refunds go to a person, always.
   *
   * The bot tells them who is handling it and then stops replying, so the
   * owner sees the request instead of the bot improvising a policy. Money
   * going back out is not a decision this thing gets to make.
   */
  if (question === 'refund') {
    await bot.sendMessage(phone, bot.t.refundAnswer());
    return goToHuman(bot, phone, 'refund / return / exchange request', { announce: false });
  }

  if (question) {
    /**
     * "bape single hood" contains the word "bape", and "black tshirt" the
     * word "black" - but neither is a question about brands or colours.
     * A message that names a design is a choice; the FAQ only gets what is
     * left over.
     */
    const namesDesign = null;
    if (!namesDesign && (await faq.tryAnswer(bot, phone, question, { pack: bot.t, convo }))) {
      return `answered_${question}`;
    }
  }

  if (command === 'help') {
    await bot.sendMessage(phone, bot.t.help());
    return 'help';
  }
  if (command === 'cancel') {
    await orderService.cancelOpen(phone);
    await conversationService.save(
      phone,
      conversationService.clearedCart({ state: STATES.CANCELLED })
    );
    await bot.sendMessage(phone, bot.t.cancelled());
    return 'cancel';
  }
  if (command === 'menu') {
    await sendGreeting(bot, phone);
    return 'menu';
  }
  if (
    command === 'address' &&
    (convo.state === STATES.ORDER_SUMMARY || convo.state === STATES.COLLECT_DETAILS)
  ) {
    await bot.sendMessage(phone, bot.t.askDetails());
    await conversationService.save(phone, {
      state: STATES.COLLECT_DETAILS,
      data: { ...convo.data, draft: {}, awaiting: 'name' },
    });
    return 'redo_details';
  }

  /**
   * "photo bhejo" - answered from wherever the conversation happens to be.
   *
   * This lived inside individual states, and every state that did not have
   * it was a place a customer could ask to see the thing they were buying
   * and be told, by a model with no ability to send files, that a photo was
   * on the way. Three of those were found in one live conversation:
   * SELECT_SIZE, COLLECT_DETAILS, and again at the address step, where
   * "Red photos" was quietly stored as the customer's NAME.
   *
   * Asking to see the product is not a state-specific question, so it is
   * not answered in state-specific places any more. The rules resolve it,
   * the database supplies the file, and no model is involved.
   *
   * The exception is while a payment is outstanding: there "photo bhej
   * diya" means the screenshot they just sent, and answering it with a
   * picture of the shirt would be a non-sequitur at the worst moment.
   */
  /**
   * "Venom ki baat kar rahe ho?" - their answer, and only their next answer.
   *
   * The offer expires the moment they say anything else, because a question
   * asked two turns ago is not one they are still answering. A yes switches
   * and clears the cart; anything else drops the offer and the message
   * carries on to be read normally, so "nahi, XL chahiye" still picks a size.
   */
  const pending = convo.data && convo.data.pendingSwitch;
  if (pending) {
    const { pendingSwitch, ...rest } = convo.data || {};
    await conversationService.save(phone, { data: rest });
    // Dropped from the copy this turn is still reading, so a "no" carries on
    // through the normal path without the expired offer hanging around.
    convo.data = rest;

    if (parser.isYes(text)) return applySwitch(bot, phone, convo, pending);
  }

  const settlingUp =
    convo.state === STATES.WAITING_FOR_PAYMENT || convo.state === STATES.PAYMENT_VERIFYING;
  if (!settlingUp) {
    const shown = await tryImageRequest(bot, phone, convo, text);
    if (shown) return shown;
  }

  switch (convo.state) {
    case STATES.START:
    case STATES.CANCELLED:
    case STATES.SELECT_CATEGORY:
    case STATES.SELECT_PRODUCT: {
      const all = await productService.activeProducts();

      /**
       * No spelling dictionary here any more.
       *
       * A design used to be resolved from 'spidey', 'lal tshirt', 'jhola'
       * when the brain produced nothing - which meant the shop still had a
       * second way to turn language into a product, just a worse one. With
       * the model unavailable it would happily select something the model
       * had never been asked about.
       *
       * Now the only reference the flow resolves on its own is a number
       * into the list it just printed. Everything else waits for the brain,
       * and when the brain cannot answer the customer is asked rather than
       * guessed at.
       */
      /**
       * "T-shirt chahiye" names a category, not a design. Show that
       * category's designs and let them choose - never pick for them.
       */
      /**
       * The department, from the same read.
       *
       * `categoryService.detect` is another spelling list - 'jhola',
       * 'baig', 'tee'. It stays as the fallback for the same reason the
       * design list does, and for the same reason it is no longer first:
       * a customer saying what they are looking for should be understood,
       * not matched.
       *
       * A category the shop cannot sell today is refused here as it always
       * was, so the model naming a sold-out department changes nothing.
       */
      const named = null;

      if (named) {
        await sendWelcome(bot, phone, named.key);
        return `options_${named.key}`;
      }

      // Standing at the category menu: a bare "1" or "2" is a choice.
      if (convo.state === STATES.SELECT_CATEGORY) {
        const categories = await categoryService.availableCategories();
        const picked = categoryService.byIndex(categories, text);
        if (picked) {
          await sendWelcome(bot, phone, picked.key);
          return `options_${picked.key}`;
        }
      }

      /**
       * The rules found nothing, so read the whole sentence instead.
       *
       * "bhai ye 3pointer club hai? spider man wali red tshirt hai kya?"
       * carries a category, a design and a question at once, and no keyword
       * list will ever cover every way that gets typed. Everything the model
       * returns is one of ours - it only ever picks from the live catalogue.
       */
      let composed = '';
      if (!parser.isGreeting(text)) {
        /**
         * The second orchestrator that used to live here is gone.
         *
         * It made its own converse() call and then decided, on its own,
         * whether to send a photo, answer a question, or select a design -
         * the same decisions the brain now makes at the top of the turn,
         * made again, from a second reading of the same sentence. Two models
         * deciding about one message is precisely the scattering this
         * refactor set out to remove, and it cost a second API call to
         * arrive at an answer that had already been reached.
         *
         * What is left below is deterministic: the keyword fallback for when
         * the brain produced nothing, and the menus. offScript() does the
         * talking, using words the brain already wrote when it wrote any.
         */
      }

      if (convo.state === STATES.SELECT_CATEGORY) {
        return offScript(bot, phone, convo, text, {
          phase: 'choosing a category',
          needed: 'which category they want',
          fallbackText: bot.t.categoryNotUnderstood(await categoryService.availableCategories()),
          composed,
        });
      }

      if (convo.state !== STATES.SELECT_PRODUCT) {
        return sendGreeting(bot, phone);
      }

      // The menu the customer is looking at, not the whole catalogue.
      const shownIds = (convo.data && convo.data.shown) || [];
      const shown = shownIds.map((id) => all.find((item) => item.id === id)).filter(Boolean);
      const products = shown.length ? shown : all;

      let product = parser.chooseByNumber(text, products);

      /**
       * "Red" while looking at a list of designs.
       *
       * The menu reads "🔴 Spider-Man — Red / ⚫ Venom — Black", so answering
       * with the colour is the obvious thing to do, and a real customer did
       * exactly that in the shop's first live conversation. The rules had no
       * answer for it, so it fell through to the model - which then narrated
       * a selection the state machine never made.
       *
       * Resolved here, deterministically, and only when it is unambiguous:
       * if exactly ONE design on the visible menu has that colour, that is
       * the one they mean. Two designs sharing a colour resolves nothing and
       * falls through to asking, which is the honest outcome.
       */
      if (!product) {
        const matches = [];
        for (const item of products) {
          const colours = await productService.colorsOf(item).catch(() => []);
          if (parser.chooseByNumber(text, colours.filter((c) => c !== 'Default'))) {
            matches.push(item);
          }
        }
        if (matches.length === 1) {
          product = matches[0];
          logger.info('product.by_colour', {
            phone,
            action: `${text} -> ${product.design || product.name}`,
          });
        }
      }

      if (!product) {
        return offScript(bot, phone, convo, text, {
          phase: 'choosing a design',
          needed: 'which design they want',
          fallbackText: bot.t.productNotUnderstood(products),
          composed,
        });
      }
      return afterProductSelected(bot, phone, product);
    }

    case STATES.SELECT_COLOR: {
      const product = await productService.getById(convo.selected_product_id);
      if (!product) {
        await sendGreeting(bot, phone);
        return 'restart_missing_product';
      }
      const colors = await productService.colorsOf(product);
      const color = parser.chooseByNumber(text, colors);
      if (!color) {
        return offScript(bot, phone, convo, text, {
          phase: 'choosing a colour',
          needed: `a colour: ${colors.join(', ')}`,
          fallbackText: bot.t.colorNotUnderstood(colors),
        });
      }
      return afterColorSelected(bot, phone, product, color);
    }

    case STATES.SELECT_SIZE:
      return handleSize(bot, phone, convo, text);

    case STATES.SELECT_QUANTITY:
      return handleQuantity(bot, phone, convo, text);

    case STATES.COLLECT_DETAILS:
      return handleDetails(bot, phone, convo, text);

    case STATES.ORDER_SUMMARY: {
      /**
       * Consent is read by the brain now, not by a word list.
       *
       * This used to be `parser.isYes(text)` - thirty-four words, any one of
       * which anywhere in the message placed the order. The comment that
       * stood here said the model may resolve "no" but never "yes", and it
       * was right about the danger: a wrong yes spends somebody's money on
       * an order they never agreed to.
       *
       * What changed is where the safety lives, not whether it exists. A
       * word list cannot tell "kar do" from "haan but size change karna hai"
       * - both contain a yes word, and the second one is a customer asking
       * for something else entirely. The brain reads the sentence; the
       * backend still decides whether that reading may become an order, and
       * checks the state, the draft and live stock before it does.
       *
       * Nothing reaches createOrderAndAskPayment from here any more. It is
       * reached from execute.js, behind those gates.
       */
      const declined = parser.isNo(text);

      if (declined) {
        await bot.sendMessage(phone, bot.t.askDetails());
        await conversationService.save(phone, {
          state: STATES.COLLECT_DETAILS,
          data: { ...convo.data, draft: {}, awaiting: 'name' },
        });
        return 'summary_declined';
      }
      return offScript(bot, phone, convo, text, {
        phase: 'confirming the order summary',
        needed: 'a yes or no on the summary',
        fallbackText: bot.t.summaryNotUnderstood(),
      });
    }

    case STATES.WAITING_FOR_PAYMENT: {
      const order =
        (await orderService.getById(convo.current_order_id)) || (await orderService.openFor(phone));
      if (!order) {
        await sendGreeting(bot, phone);
        return 'restart_missing_order';
      }

      /**
       * "paisa kahan bhejun?" - the one question this step exists to answer.
       *
       * The instructions and the scanner went out when the order was
       * created, and by the time somebody has scrolled up, opened their UPI
       * app and come back, that message is often several screens away. Asked
       * again, the shop should simply send it again.
       *
       * It went to the model instead, which cannot send the QR and has no
       * UPI id it is allowed to state, so the best it could manage was a
       * paraphrase of "please pay". Sending the real thing costs nothing and
       * is the actual answer.
       */
      if (parser.asksWhereToPay(text)) {
        const asked = await paymentService.paymentQrImage().catch(() => null);
        await bot.sendMessage(phone, bot.t.paymentInstructions(order, { scanner: Boolean(asked) }));
        if (asked) await bot.sendImage(phone, asked, '');
        logger.info('payment.details_resent', { phone, action: order.order_id });
        return 'payment_details_resent';
      }

      const browsed = await tryBrowseWhilePaying(bot, phone, text, order);
      if (browsed) return browsed;

      return offScript(bot, phone, convo, text, {
        phase: 'waiting for the payment screenshot',
        needed: 'the payment screenshot',
        fallbackText: bot.t.waitingForPayment(order, { scanner: await hasScanner() }),
      });
    }

    case STATES.PAYMENT_VERIFYING: {
      const order =
        (await orderService.getById(convo.current_order_id)) || (await orderService.openFor(phone));
      if (!order) {
        await sendGreeting(bot, phone);
        return 'restart_missing_order';
      }
      const browsedWhileWaiting = await tryBrowseWhilePaying(bot, phone, text, order, {
        remind: false,
      });
      if (browsedWhileWaiting) return browsedWhileWaiting;

      return offScript(bot, phone, convo, text, {
        phase: 'payment sent, a person is verifying it',
        needed: 'nothing - they are waiting on us',
        fallbackText: bot.t.verificationPending(order),
      });
    }

    default: {
      await sendGreeting(bot, phone);
      return 'welcome_fallback';
    }
  }
}

module.exports = { MODE, STATES, handleMessage, goToHuman };
