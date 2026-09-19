'use strict';

/**
 * The turn.
 *
 * Read the conversation, let the model think with tools in its hands until it
 * has something to say, say it. That is the whole design, and it replaces
 * stateMachine.js - two thousand eight hundred lines whose job was to guess,
 * from the state and a keyword list, which of a hundred written-out replies
 * to send. The guess is what customers noticed: answer something the list did
 * not cover and it repeated the last question it had asked.
 *
 * Two things are NOT the model's decision, and both are here rather than in a
 * tool because they must happen whether the model cooperates or not:
 *
 *   a payment screenshot   filed and sent to the owner before the model sees
 *                          the turn. A picture of money is evidence for a
 *                          person, and "did the shop record my proof" must not
 *                          depend on the model choosing to call something.
 *   the reply going out    one message per turn, sent here, recorded here.
 *
 * When the model cannot be reached - no key, budget spent, API down, timeout -
 * this does not improvise. It hands the customer to a person. A shop that
 * says nothing is recoverable; a shop that guesses about an order is not.
 */

const logger = require('../logger');
const ai = require('../ai/chat');
const proof = require('../ai/proof');
const promptBuilder = require('./prompt');
const { DEFINITIONS, handlers } = require('./tools');
const messageService = require('../services/messageService');
const conversationService = require('../services/conversationService');
const orderService = require('../services/orderService');
const paymentService = require('../services/paymentService');
const messages = require('../bot/messages');

/**
 * How many times the model may call tools before it has to speak.
 *
 * Six is enough for the longest real chain - list products, check stock, read
 * saved details, save the new ones, create the order, send payment details -
 * and small enough that a model looping on a tool that keeps refusing costs
 * six calls rather than a month's budget.
 */
const MAX_STEPS = 6;

/**
 * A screenshot against an open order, handled before the model runs.
 *
 * Returns a note for the model describing what happened, or null when the
 * image was not a payment proof and is the model's problem after all.
 */
async function handleMedia(bot, phone, msg) {
  if (!msg.isMedia || !msg.media || !msg.media.buffer) return null;

  const order = await orderService.openFor(phone);
  if (!order) {
    return 'The customer sent an image but has no open order. Ask what it is about; do not assume it is a payment.';
  }

  // Best-effort reading, for the owner's eyes only - it decides nothing here.
  const seen = await proof.read(msg.media).catch(() => null);
  await paymentService.handlePaymentProof(bot, order, msg.media, messages, seen);

  return (
    `The customer sent an image against order ${order.order_id}. It has been saved and sent ` +
    'to the owner to check. Tell them it has gone for verification and they will hear back ' +
    'shortly. You must NOT say the payment is confirmed, received or successful.'
  );
}

/**
 * Run the model until it produces text, carrying out the tools it asks for.
 * @returns {Promise<string|null>} what to say, or null if the model failed
 */
async function think(bot, phone, msg, mediaNote) {
  const tools = handlers(bot, phone);

  const history = await messageService.recentTurns(phone, 20);
  const body = msg.isMedia ? '[image]' : String(msg.text || '').trim();

  /**
   * The transcript already ends with this message - router claimed it into
   * `messages` before handing over - so it is not appended again. The media
   * note rides as a system line after it, which is also what keeps it out of
   * the stored transcript: it describes this turn only.
   */
  const conversation = [
    { role: 'system', content: await promptBuilder.build(phone) },
    ...history,
  ];
  if (history.length === 0 && body) conversation.push({ role: 'user', content: body });
  if (mediaNote) conversation.push({ role: 'system', content: mediaNote });

  for (let step = 0; step < MAX_STEPS; step += 1) {
    const result = await ai.chat({
      messages: conversation,
      tools: DEFINITIONS,
      purpose: 'agent',
      phone,
    });

    if (!result) return null;

    const { message } = result;
    const calls = message.tool_calls || [];

    if (!calls.length) {
      const text = String(message.content || '').trim();
      return text || null;
    }

    // The assistant message holding the calls must go back verbatim, or the
    // tool results below have nothing to answer.
    conversation.push(message);

    for (const call of calls) {
      const name = call.function && call.function.name;
      let args = {};
      try {
        args = JSON.parse((call.function && call.function.arguments) || '{}');
      } catch (err) {
        args = {};
      }

      let output;
      const handler = tools[name];
      if (!handler) {
        output = { ok: false, reason: `no tool called ${name}` };
      } else {
        try {
          output = await handler(args);
        } catch (err) {
          logger.error('agent.tool_failed', { phone, action: name, error: err.message });
          output = { ok: false, reason: 'that failed on our side - do not retry it' };
        }
      }

      logger.info('agent.tool', {
        phone,
        action: `${name} ${output && output.ok === false ? `refused: ${output.reason}` : 'ok'}`.slice(0, 120),
      });

      conversation.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(output),
      });
    }
  }

  /**
   * Out of steps with nothing said. Rather than let it run on, ask for one
   * final answer with the tools taken away - by this point it has read
   * everything it asked for and only has to put it into a sentence.
   */
  const last = await ai.chat({
    messages: [
      ...conversation,
      {
        role: 'system',
        content: 'Stop using tools. Reply to the customer now, in one or two short lines.',
      },
    ],
    purpose: 'agent_final',
    phone,
    toolChoice: 'none',
  });

  return last && last.message ? String(last.message.content || '').trim() || null : null;
}

/**
 * @returns {Promise<string>} a short label for the turn log
 */
async function handleMessage(bot, msg) {
  const phone = msg.phone;

  const mediaNote = await handleMedia(bot, phone, msg).catch((err) => {
    logger.error('agent.media_failed', { phone, error: err.message });
    return null;
  });

  const reply = await think(bot, phone, msg, mediaNote).catch((err) => {
    logger.error('agent.think_failed', { phone, error: err.message });
    return null;
  });

  if (!reply) {
    /**
     * No answer, so no guess. The owner is told and the conversation stops
     * being the bot's - the customer is mid-purchase and a shop that invents
     * a reply here is worse than one that goes quiet and fetches a person.
     */
    logger.warn('agent.no_reply', { phone });
    await conversationService.setMode(phone, conversationService.MODE.HUMAN);
    await bot
      .notifyAdmins(`⚠️ ${phone} ko jawab nahi de paaye (AI unavailable). Aap dekh lo.`)
      .catch(() => {});
    return 'agent_unavailable';
  }

  // HUMAN means a person owns this conversation now - including when the
  // agent itself just handed it over mid-turn.
  const convo = await conversationService.get(phone);
  if (convo.mode === conversationService.MODE.HUMAN) {
    await bot.sendMessage(phone, reply);
    return 'agent_handoff';
  }

  await bot.sendMessage(phone, reply);
  return 'agent_reply';
}

module.exports = { handleMessage, MAX_STEPS };
