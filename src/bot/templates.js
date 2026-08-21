'use strict';

/**
 * Every customer-facing sentence Repli can say, as an editable template.
 *
 * The owner edits these in the admin panel; the defaults below are only the
 * starting point. On startup any missing row is copied into
 * `message_templates`, and existing rows are never touched - a wording the
 * owner chose must survive a deploy.
 *
 * Templates use {{placeholders}}. Anything a message needs is passed in
 * already formatted (prices with the currency symbol, lists already
 * numbered), so the owner never has to write logic - only words.
 */

const { supabase } = require('../db/supabase');
const cache = require('../db/cache');
const config = require('../config');
const logger = require('../logger');

const LANGUAGES = ['hi', 'en'];

/**
 * One number for both the cache entry and the background re-read.
 *
 * They have to move together. The sync timer calls refresh(force) which
 * DELETES the cache entry before reloading, so a fifteen-second timer made a
 * five-minute cache entry meaningless - four re-reads a minute regardless.
 * Now that the panel invalidates a template the moment it is edited, the
 * timer is only the safety net for a message that never arrived.
 */
const TTL_MS = config.TEMPLATE_TTL_MS;

/**
 * key, what it is for, which {{placeholders}} it may use, and the default
 * wording in both languages.
 */
const CATALOGUE = [
  // ------------------------------------------------------------- greeting
  {
    key: 'welcome',
    category: 'greeting',
    label: 'Welcome / menu',
    description: 'First reply when Repli cannot tell which product they mean.',
    placeholders: ['products'],
    // No price here, deliberately. The sales memory is explicit: show the
    // options first, let them choose, and let price come up only when they
    // ask or once design and size are settled.
    hi: `Sure! 😊 Abhi ye available hai:

{{products}}

Kaunsa chahiye?`,
    en: `Sure! 😊 We currently have:

{{products}}

Which one would you like?`,
  },
  {
    key: 'greeting',
    category: 'greeting',
    label: 'Greeting (first message)',
    description: 'Sent before the options. Just a hello - no products, no prices.',
    placeholders: ['brands'],
    hi: `Hey 👋 {{brands}} me aapka swagat hai!`,
    en: `Hey 👋 Welcome to {{brands}}!`,
  },
  {
    key: 'chooseCategory',
    category: 'greeting',
    label: 'What are you looking for?',
    description: 'Second message: the categories that currently have stock.',
    placeholders: ['categories'],
    hi: `Aapko kya chahiye?

{{categories}}`,
    en: `What are you looking for?

{{categories}}`,
  },
  {
    key: 'categoryNotUnderstood',
    category: 'greeting',
    label: 'Category not understood',
    description: 'They replied, but it matched no category.',
    placeholders: ['categories'],
    hi: `Samajh nahi aaya bhai 😅 In me se koi ek bhej do:

{{categories}}`,
    en: `Sorry, I didn't catch that 😅 Pick one of these:

{{categories}}`,
  },
  {
    key: 'productNotUnderstood',
    category: 'greeting',
    label: 'Product not understood',
    description: 'They replied, but it did not match any product.',
    placeholders: ['products'],
    hi: `Bhai samajh nahi aaya 😅

{{products}}

Number bhej do ya product ka naam likh do.`,
    en: `Sorry, I didn't catch that 😅

{{products}}

Send the number or type the product name.`,
  },

  // -------------------------------------------------------------- product
  {
    key: 'chooseColor',
    category: 'product',
    label: 'Ask for colour',
    description: 'Product picked, more than one colour available.',
    placeholders: ['emoji', 'colors'],
    hi: `Perfect bhai {{emoji}}🔥

Kaunsa color chahiye?

{{colors}}`,
    en: `Great choice {{emoji}}🔥

Which colour would you like?

{{colors}}`,
  },
  {
    key: 'chooseColorOnChart',
    category: 'product',
    label: 'Ask for colour, off the printed chart',
    /**
     * Used where the colours are sold off a card rather than listed.
     *
     * The bag comes in twenty-four, and printing twenty-four names into a
     * chat is not a choice anybody can make - it is a wall the customer has
     * to read before they can answer. The card is already on their screen,
     * every colour on it named and priced, so the card is the interface:
     * they mark the one they want and send it back.
     *
     * Asking for a tick rather than a name is also what the shop actually
     * does. It keeps no count of colours; a person confirms availability
     * with the supplier afterwards, and a marked picture is the least
     * ambiguous way of saying which one was meant.
     *
     * One route is offered, not two. Naming a colour still works - the flow
     * reads a typed name exactly as it did before - but the message does not
     * mention it, because a customer given two ways to answer stops to pick
     * between them, and half the names on this card ("Black & White",
     * "Original Dark Blue") are ones people get slightly wrong when typing.
     * A tick cannot be typed slightly wrong.
     */
    description:
      'Too many colours to list. The customer marks the chart and sends it back.',
    placeholders: ['emoji'],
    hi: `Perfect bhai {{emoji}}🔥

Jo image bheji hai usme aapko jo bag chahiye, us par tick kar ke wapas bhej do 👆

Konsa bag chahiye aapko?`,
    en: `Great choice {{emoji}}🔥

On the picture I sent, mark the bag you want and send it back 👆

Which one would you like?`,
  },
  {
    key: 'chartReceived',
    category: 'product',
    label: 'Marked chart received',
    /**
     * Says what happened and nothing more.
     *
     * It does not name a colour, because nothing on this side read the tick;
     * it does not say the colour is available, because the shop keeps no
     * count and finds out from its supplier. What it can honestly say is
     * that the picture arrived and somebody will confirm it.
     *
     * And then it prices the thing and asks the next question, in the same
     * shape and the same order as the message a T-shirt customer gets:
     * total, what reserves it, what is left. A bag buyer should not be
     * walked through a different-looking sale to everyone else.
     *
     * Stopping to confirm the colour first would be the shop putting its own
     * admin ahead of the customer: that confirmation happens in the
     * background either way, so the quantity, the address and the advance
     * can all be taken while it does.
     */
    description:
      'They marked the chart and sent it back. Acknowledge, price it, ask how many.',
    placeholders: ['item', 'price', 'booking', 'remaining'],
    hi: `Mil gayi bhai 👍 Colour note kar liya - team confirm karke bata degi.

{{item}} — done ✅

{{price}} total
{{booking}} abhi, reserve karne ke liye
{{remaining}} baad me, jab piece ready ho jaye

Kitne chahiye?`,
    en: `Got it 👍 Your colour is noted - we'll confirm it and let you know.

{{item}} — done ✅

{{price}} total
{{booking}} now, to reserve it
{{remaining}} once the piece is ready

How many would you like?`,
  },
  {
    key: 'colorNotUnderstoodOnChart',
    category: 'product',
    label: 'Colour not understood, off the printed chart',
    description:
      'Their reply matched no colour, and there are too many to list back at them.',
    placeholders: [],
    hi: `Bhai samajh nahi aaya 😅

Jo image bheji hai usme us bag par tick kar ke photo wapas bhej do 👆`,
    en: `Sorry, I didn't catch that 😅

On the picture I sent, mark the bag you want and send it back 👆`,
  },
  {
    key: 'colorNotUnderstood',
    category: 'product',
    label: 'Colour not understood',
    description: 'Their reply did not match any available colour.',
    placeholders: ['colors'],
    hi: `Bhai color samajh nahi aaya 😅

{{colors}}`,
    en: `I didn't catch the colour 😅

{{colors}}`,
  },
  {
    key: 'chooseSize',
    category: 'product',
    label: 'Ask for size',
    description: 'Colour picked, now the size.',
    placeholders: ['sizes'],
    hi: `Kaunsa size chahiye bhai?

{{sizes}}`,
    en: `Which size?

{{sizes}}`,
  },
  {
    key: 'colorPickedNowSize',
    category: 'product',
    label: 'Colour understood, ask size',
    description: 'They named product and colour in one message ("black tshirt chahiye").',
    placeholders: ['emoji', 'item', 'sizes'],
    hi: `Bilkul bhai {{emoji}}🔥

{{item}} available hai.

Kaunsa size chahiye?
{{sizes}}`,
    en: `Perfect {{emoji}}🔥

{{item}} is available.

Which size?
{{sizes}}`,
  },
  {
    key: 'sizeNotUnderstood',
    category: 'product',
    label: 'Size not understood',
    description: 'Their reply did not match any available size.',
    placeholders: ['sizes'],
    hi: `Bhai size samajh nahi aaya 😅

Ye sizes hain:
{{sizes}}`,
    en: `I didn't catch the size 😅

Available sizes:
{{sizes}}`,
  },
  {
    key: 'available',
    category: 'product',
    label: 'In stock, ask quantity',
    description: 'Everything picked and in stock.',
    placeholders: ['item', 'price', 'booking', 'remaining'],
    hi: `{{item}} — done ✅

{{price}} total
{{booking}} abhi, size reserve karne ke liye
{{remaining}} baad me, jab piece ready ho jaye`,
    en: `{{item}} — done ✅

{{price}} total
{{booking}} now, to reserve your size
{{remaining}} once the piece is ready`,
  },
  {
    key: 'outOfStock',
    category: 'product',
    label: 'Out of stock (other sizes left)',
    description: 'That size is gone, but the colour has other sizes.',
    placeholders: ['item', 'sizesLeft'],
    hi: `Sorry bhai 😕
{{item}} abhi out of stock hai.

Dusra size try kar sakte ho:
{{sizesLeft}}`,
    en: `Sorry 😕
{{item}} is out of stock right now.

These sizes are still available:
{{sizesLeft}}`,
  },
  {
    key: 'outOfStockNothingLeft',
    category: 'product',
    label: 'Out of stock (nothing left in colour)',
    description: 'That colour has nothing left at all.',
    placeholders: ['item'],
    hi: `Sorry bhai 😕
{{item}} abhi out of stock hai.

Is color me abhi kuch available nahi hai. Dusra color try karo ya "menu" bhej do.`,
    en: `Sorry 😕
{{item}} is out of stock right now.

Nothing is available in this colour at the moment. Try another colour, or send "menu".`,
  },
  {
    key: 'colorOutOfStock',
    category: 'product',
    label: 'Colour out of stock',
    description: 'The whole colour is gone, other colours remain.',
    placeholders: ['item', 'colorsLeft'],
    hi: `Sorry bhai 😕
{{item}} abhi out of stock hai.

Ye color available hain:
{{colorsLeft}}`,
    en: `Sorry 😕
{{item}} is out of stock right now.

These colours are available:
{{colorsLeft}}`,
  },
  {
    key: 'colorOutOfStockNothingLeft',
    category: 'product',
    label: 'Product fully out of stock',
    description: 'No colour of this product is available.',
    placeholders: ['item'],
    hi: `Sorry bhai 😕
{{item}} abhi out of stock hai.

Abhi ye product available nahi hai. "menu" bhej ke dusra product dekh lo.`,
    en: `Sorry 😕
{{item}} is out of stock right now.

This product is not available at the moment. Send "menu" to see the others.`,
  },

  // ------------------------------------------------------------- quantity
  {
    key: 'quantityPrompt',
    category: 'quantity',
    label: 'Ask quantity',
    description: 'Asking how many pieces.',
    placeholders: [],
    hi: 'Kitni quantity chahiye bhai?',
    en: 'How many would you like?',
  },
  {
    key: 'quantityNotUnderstood',
    category: 'quantity',
    label: 'Quantity not understood',
    description: 'Their reply was not a number.',
    placeholders: [],
    hi: `Bhai number me bata do 🙏

Jaise: 1, 2, 3`,
    en: `Please send a number 🙏

For example: 1, 2, 3`,
  },
  {
    key: 'quantityTooHigh',
    category: 'quantity',
    label: 'Above the per-order limit',
    description: 'They asked for more than MAX_QTY.',
    placeholders: ['max'],
    hi: `Bhai ek baar me max {{max}} hi le sakte ho.

Itne me se kitne chahiye?`,
    en: `You can order up to {{max}} at a time.

How many of those would you like?`,
  },
  {
    key: 'onlyNAvailable',
    category: 'quantity',
    label: 'Less stock than asked',
    description: 'They asked for more than is in stock.',
    placeholders: ['count', 'countNumber'],
    hi: `Bhai abhi sirf {{count}} available hain ❤️

{{countNumber}} kar dein?`,
    en: `Only {{count}} are available right now ❤️

Shall I make it {{countNumber}}?`,
  },

  // -------------------------------------------------------------- details
  {
    key: 'askDetails',
    category: 'details',
    label: 'Ask for delivery details',
    description: 'Asking for name and address in one go.',
    placeholders: [],
    hi: `Order complete karne ke liye details bhej do bhai:

Name:
Full Address:
City:
State:
PIN Code:`,
    en: `To complete your order, please send:

Name:
Full Address:
City:
State:
PIN Code:`,
  },
  {
    key: 'paidBeforeDetails',
    category: 'details',
    /**
     * The screenshot that arrives too early.
     *
     * The scanner goes out WITH this form, so a customer who is ready to buy
     * pays first and sends the proof before typing an address - which is the
     * sensible order from where they are sitting. The shop used to answer
     * that with "you don't have a pending order right now", which is true
     * and useless: they had just paid, and were being told nothing existed.
     *
     * There is genuinely no order yet - it is created once the summary is
     * agreed - so this must not confirm anything about the money. It says
     * the picture arrived, says what is still missing, and repeats the form
     * so they do not have to scroll for it.
     */
    label: 'Screenshot arrived before the address',
    description:
      'They paid from the scanner sent with the form. Acknowledge, do not confirm, and ask for the address again.',
    placeholders: [],
    hi: `Screenshot mil gaya bhai 👍

Bas address reh gaya hai - wo bhej do, phir order confirm karke payment check kar lenge:

Name:
Full Address:
City:
State:
PIN Code:`,
    en: `Got your screenshot 👍

Just the address left - send it and we'll confirm the order and check the payment:

Name:
Full Address:
City:
State:
PIN Code:`,
  },
  {
    key: 'confirmSavedAddress',
    category: 'details',
    label: 'Reuse saved address?',
    description: 'A repeat customer - confirm the address already on file.',
    placeholders: ['name', 'address', 'city', 'state', 'pin'],
    hi: `Bhai aapki purani details ye hain 👇

{{name}}
{{address}}
{{city}}, {{state}} - {{pin}}

Isi address par bhej dein?

YES - same address
NO - nayi details bhejunga`,
    en: `Here are your saved details 👇

{{name}}
{{address}}
{{city}}, {{state}} - {{pin}}

Should I ship to this address?

YES - same address
NO - I'll send new details`,
  },
  {
    key: 'askDetailsKnownName',
    category: 'details',
    label: 'Ask details (name already known)',
    description: 'WhatsApp gave us the name, so only the address is asked for.',
    placeholders: ['name'],
    hi: `Order {{name}} ke naam se bana dunga 👍

Delivery ke liye ye bhej do:

Full Address:
City:
State:
PIN Code:`,
    en: `I'll put the order under {{name}} 👍

Send these for delivery:

Full Address:
City:
State:
PIN Code:`,
  },
  {
    key: 'confirmName',
    category: 'details',
    label: 'Confirm the WhatsApp name',
    description: 'WhatsApp already gives us their profile name - confirm it instead of asking.',
    placeholders: ['name'],
    hi: `{{name}} — yahi naam likh du order pe?`,
    en: `{{name}} — should I put that on the order?`,
  },
  {
    key: 'askName',
    category: 'details',
    label: 'Ask name',
    description: '',
    placeholders: [],
    hi: 'Aapka pura naam bata do bhai:',
    en: 'What is your full name?',
  },
  {
    key: 'askAddress',
    category: 'details',
    label: 'Ask address',
    description: '',
    placeholders: [],
    hi: 'Full address bhej do bhai (house/flat, street, landmark):',
    en: 'Please send your full address (house/flat, street, landmark):',
  },
  {
    key: 'askCity',
    category: 'details',
    label: 'Ask city',
    description: '',
    placeholders: [],
    hi: 'City ka naam bata do:',
    en: 'Which city?',
  },
  {
    key: 'askState',
    category: 'details',
    label: 'Ask state',
    description: '',
    placeholders: [],
    hi: 'State ka naam bata do:',
    en: 'Which state?',
  },
  {
    key: 'askPin',
    category: 'details',
    label: 'Ask PIN code',
    description: '',
    placeholders: [],
    hi: 'PIN code bhej do (6 digit):',
    en: 'Please send your PIN code (6 digits):',
  },
  {
    key: 'invalidName',
    category: 'details',
    label: 'Name looked wrong',
    description: '',
    placeholders: [],
    hi: 'Bhai naam thoda sahi se likh do (sirf naam) 🙏',
    en: 'Please send just your name 🙏',
  },
  {
    key: 'invalidAddress',
    category: 'details',
    label: 'Address looked wrong',
    description: '',
    placeholders: [],
    hi: 'Address thoda detail me bhej do bhai (house/flat, street, landmark) 🙏',
    en: 'Please send a more complete address (house/flat, street, landmark) 🙏',
  },
  {
    key: 'invalidCity',
    category: 'details',
    label: 'City looked wrong',
    description: '',
    placeholders: [],
    hi: 'City ka naam sahi se likh do bhai 🙏',
    en: 'Please send a valid city name 🙏',
  },
  {
    key: 'invalidState',
    category: 'details',
    label: 'State looked wrong',
    description: '',
    placeholders: [],
    hi: 'State ka naam sahi se likh do bhai 🙏',
    en: 'Please send a valid state name 🙏',
  },
  {
    key: 'invalidPin',
    category: 'details',
    label: 'PIN looked wrong',
    description: '',
    placeholders: [],
    hi: 'PIN code 6 digit ka hota hai bhai. Dobara bhej do 🙏',
    en: 'A PIN code has 6 digits. Please send it again 🙏',
  },
  {
    key: 'invalidField',
    category: 'details',
    label: 'Detail looked wrong (other)',
    description: 'Fallback when a detail does not fit any of the above.',
    placeholders: [],
    hi: 'Ye detail sahi nahi lagi bhai, dobara bhej do 🙏',
    en: "That detail didn't look right, please send it again 🙏",
  },

  // ---------------------------------------------------------------- order
  {
    key: 'orderSummary',
    category: 'order',
    label: 'Order summary',
    description: 'The confirm-before-ordering summary. {{sizeLine}} disappears for products without sizes.',
    placeholders: [
      'product', 'color', 'sizeLine', 'quantity', 'unitPrice',
      'subtotal', 'shipping', 'total', 'name', 'address', 'city', 'state', 'pin',
    ],
    hi: `🛍️ ORDER SUMMARY

Product: {{product}}
Color: {{color}}
{{sizeLine}}
Quantity: {{quantity}}

Price: {{unitPrice}} × {{quantity}}
Subtotal: {{subtotal}}

Shipping: {{shipping}}

TOTAL: {{total}}

Name: {{name}}
Address: {{address}}
City: {{city}}
State: {{state}}
PIN: {{pin}}

Sab details correct hain?

YES / NO`,
    en: `🛍️ ORDER SUMMARY

Product: {{product}}
Colour: {{color}}
{{sizeLine}}
Quantity: {{quantity}}

Price: {{unitPrice}} × {{quantity}}
Subtotal: {{subtotal}}

Shipping: {{shipping}}

TOTAL: {{total}}

Name: {{name}}
Address: {{address}}
City: {{city}}
State: {{state}}
PIN: {{pin}}

Is everything correct?

YES / NO`,
  },
  {
    key: 'summaryNotUnderstood',
    category: 'order',
    label: 'Summary reply not understood',
    description: 'They replied to the summary with something other than yes/no.',
    placeholders: [],
    hi: `Bhai YES ya NO bhej do 🙏

YES - order confirm
NO - details dobara bhejunga`,
    en: `Please reply YES or NO 🙏

YES - confirm the order
NO - I'll send the details again`,
  },
  {
    key: 'yesOrNo',
    category: 'order',
    label: 'Yes or no',
    description: 'Short nudge when a yes/no answer is expected.',
    placeholders: [],
    hi: 'Bhai YES ya NO bhej do 🙏',
    en: 'Please reply YES or NO 🙏',
  },
  {
    key: 'cancelled',
    category: 'order',
    label: 'Order cancelled',
    description: 'They sent "cancel".',
    placeholders: [],
    hi: `Theek hai bhai 👍
Current order process cancel kar diya.

Dobara order karna ho toh "start" bhej dena.`,
    en: `No problem 👍
The current order has been cancelled.

Send "start" whenever you want to order again.`,
  },
  {
    key: 'needOrderFirst',
    category: 'order',
    label: 'No pending order',
    description: 'They sent a payment screenshot with no open order.',
    placeholders: [],
    hi: `Bhai abhi koi pending order nahi hai 🙂

Order karne ke liye "start" bhej do.`,
    en: `You don't have a pending order right now 🙂

Send "start" to place one.`,
  },

  // -------------------------------------------------------------- payment
  {
    key: 'paymentInstructions',
    category: 'payment',
    label: 'Payment link',
    description: 'Sent the moment an order is created.',
    /**
     * `payTo` is empty whenever the scanner is going out with this message,
     * which is almost always. A QR and a typed UPI id in the same breath is
     * two payment destinations for one payment - and when they disagree, as
     * this shop's did, the customer has to guess. The picture wins because
     * it is what people actually scan; the text is what is left when there
     * is no picture to send.
     */
    placeholders: ['orderId', 'total', 'booking', 'remaining', 'payTo'],
    hi: `Booking #{{orderId}} 🙌

Abhi dena hai: {{booking}}
Baaki {{remaining}} tab, jab piece ready ho jaye.

{{payTo}}

Payment ke baad screenshot yahin bhej dena — verify karke booking confirm kar dunga.`,
    en: `Booking #{{orderId}} 🙌

To pay now: {{booking}}
The remaining {{remaining}} once your piece is ready.

{{payTo}}

Send the screenshot here after paying — I'll verify it and confirm your booking.`,
  },
  {
    key: 'waitingForPayment',
    category: 'payment',
    label: 'Payment reminder',
    description: 'They wrote again while an order is still unpaid.',
    placeholders: ['orderId', 'total', 'payTo'],
    hi: `Bhai order #{{orderId}} abhi payment ka wait kar raha hai.

Total: {{total}}

{{payTo}}

Payment ke baad screenshot yahin bhej dena 🙏`,
    en: `Order #{{orderId}} is still waiting for payment.

Total: {{total}}

{{payTo}}

Please send the screenshot here once you have paid 🙏`,
  },
  {
    key: 'paymentProofReceived',
    category: 'payment',
    label: 'Screenshot received',
    description: 'Their payment proof arrived. Nothing is confirmed yet.',
    placeholders: [],
    hi: `Thank you bhai ❤️

Payment proof mil gaya.

Main abhi apne agent se confirm karwa raha hoon - bas thodi hi der me bata deta hoon 🙏`,
    en: `Thank you ❤️

Got your payment proof.

I'm getting it confirmed with my agent right now - I'll let you know in just a bit 🙏`,
  },
  {
    key: 'confirmSwitch',
    category: 'flow',
    label: 'Switching to another item?',
    /**
     * Asked, not assumed.
     *
     * A customer half way through buying the Spider-Man who types "venom"
     * might be changing their mind - or might be asking a question about it,
     * or comparing, or have typed it by accident. Switching outright throws
     * away the colour and size they already chose; asking costs one line and
     * makes the shop sound like it is listening.
     */
    description:
      'They named a different item while already choosing one. Confirms the switch before dropping what they had picked.',
    placeholders: ['item'],
    hi: `{{item}} ki baat kar rahe ho bhai? 🤔

Haan bolo to wahi dikha deta hoon.`,
    en: `Did you mean {{item}}? 🤔

Say yes and I'll pull it up.`,
  },
  {
    key: 'paymentProofRead',
    category: 'payment',
    label: 'Screenshot received, amount read off it',
    /**
     * Sent instead of the plain acknowledgement when the screenshot could
     * actually be read.
     *
     * Every word here is about the PICTURE, never about the money: it says
     * what the screenshot shows, not what the shop has received. A customer
     * who is told "₹500 mil gaya" believes the transfer has landed, and if
     * the screenshot was edited, of somebody else's payment, or simply of a
     * failed attempt, the shop has just confirmed a payment it never got.
     *
     * So it repeats the figure back and says a person is checking, which is
     * exactly what is true at that moment.
     */
    description:
      'Proof arrived and the amount was legible. States what the image SHOWS - never that payment is received or confirmed.',
    placeholders: ['amount'],
    hi: `Thank you bhai ❤️

Screenshot mil gaya, usme ₹{{amount}} dikh raha hai.

Main abhi apne agent se confirm karwa raha hoon - bas thodi hi der me bata deta hoon 🙏`,
    en: `Thank you ❤️

Got your screenshot - it shows ₹{{amount}}.

I'm getting it confirmed with my agent right now - I'll let you know in just a bit 🙏`,
  },
  {
    key: 'proofNotAPayment',
    category: 'payment',
    label: 'Image received, but not a payment screenshot',
    description:
      'They sent a picture while a payment was pending and it was not a payment screen. Ask, never accuse.',
    placeholders: [],
    hi: `Image mil gayi bhai, par ye payment screenshot nahi lag rahi 🤔

Payment ki screenshot bhej do, main verify karwa deta hoon 🙏`,
    en: `Got the image, but it doesn't look like a payment screenshot 🤔

Could you send the payment screenshot? I'll get it verified 🙏`,
  },
  {
    key: 'verificationPending',
    category: 'payment',
    label: 'Still verifying',
    description: 'They asked again while you were verifying.',
    placeholders: ['orderId'],
    hi: `Bhai aapka order #{{orderId}} verify ho raha hai ⏳

Team check kar rahi hai. Thoda sa wait karo ❤️`,
    en: `Your order #{{orderId}} is being verified ⏳

The team is checking it. Please hold on ❤️`,
  },
  {
    key: 'orderConfirmed',
    category: 'payment',
    label: 'Payment verified',
    description: 'Sent when you verify the payment - from WhatsApp or the panel.',
    placeholders: ['orderId', 'product', 'color', 'sizeLine', 'quantity', 'total'],
    hi: `Payment received successfully bhai ❤️✅

Aapka order #{{orderId}} confirm ho gaya! 🎉

Product: {{product}}
Color: {{color}}
{{sizeLine}}
Quantity: {{quantity}}

Total Paid: {{total}}

Abhi aapko hamara agent personally assist karega.
Thoda sa wait karo bhai ❤️`,
    en: `Payment received successfully ❤️✅

Your order #{{orderId}} is confirmed! 🎉

Product: {{product}}
Colour: {{color}}
{{sizeLine}}
Quantity: {{quantity}}

Total Paid: {{total}}

Our agent will assist you personally from here.
Please hold on ❤️`,
  },
  {
    key: 'paymentRejected',
    category: 'payment',
    label: 'Payment rejected',
    description: 'Sent when you reject a payment.',
    placeholders: [],
    hi: `Bhai payment verify nahi ho paayi 😕
Hamari team abhi aapse personally baat karegi.

Thoda sa wait karo ❤️`,
    en: `We could not verify your payment 😕
Our team will get in touch with you personally.

Please hold on ❤️`,
  },
  {
    key: 'orderCancelledByAdmin',
    category: 'payment',
    label: 'Order cancelled by you',
    description: 'Sent when you cancel an order from the panel.',
    placeholders: ['orderId'],
    hi: `Bhai aapka order #{{orderId}} cancel kar diya gaya hai.

Koi dikkat ho toh yahin message karo, hamari team help karegi ❤️`,
    en: `Your order #{{orderId}} has been cancelled.

If something is wrong, just message us here and our team will help ❤️`,
  },

  // -------------------------------------------------------------- closing
  {
    key: 'handoff',
    category: 'closing',
    label: 'Handing over to a human',
    description: 'They asked for a person, or you took over.',
    placeholders: [],
    hi: `Bilkul bhai ❤️

Abhi aapko hamari team ka agent personally assist karega.

Thoda sa wait karo 🙏`,
    en: `Of course ❤️

Someone from our team will assist you personally.

Please hold on 🙏`,
  },
  // ------------------------------------------------------------------ FAQ
  //
  // Answers to the things customers actually ask. Each one is a fixed
  // sentence the owner can edit, never something the bot works out: price,
  // wait, material, COD and pickup are exactly the facts that must not be
  // improvised. The values inside come from the catalogue and app_settings.
  {
    key: 'priceAnswer',
    category: 'faq',
    label: 'Price asked',
    description: 'Customer asked the price before choosing. Answer, then carry on.',
    placeholders: ['item', 'price', 'booking', 'remaining'],
    hi: `{{item}} {{price}} ka hai.

{{booking}} dekar size reserve ho jata hai
{{remaining}} tab, jab piece ready ho jaye.`,
    en: `The {{item}} is {{price}}.

{{booking}} to reserve your size
{{remaining}} remaining once it's ready.`,
  },
  {
    key: 'bookingProcessAnswer',
    category: 'faq',
    label: 'How do I book? / what is the process?',
    description:
      'Customer has chosen and wants to know what happens next. The three steps, in order, with the shop’s own numbers.',
    placeholders: ['item', 'booking', 'remaining'],
    hi: `{{item}} book karne ke liye {{booking}} advance dena hota hai — isse aapka size reserve ho jata hai.

Scanner par {{booking}} bhejiye, phir uska screenshot yahan bhej dijiye. Screenshot check hone ke baad hi booking pakki hoti hai.

Baaki {{remaining}} tab, jab piece ban kar ready ho jaye.`,
    en: `To book the {{item}} there’s a {{booking}} advance — that reserves your size.

Pay {{booking}} on the scanner, then send the screenshot here. The booking is confirmed only once that screenshot is checked.

The remaining {{remaining}} is paid when the piece is ready.`,
  },
  {
    key: 'refundAnswer',
    category: 'faq',
    label: 'Refund / return / exchange asked',
    description: 'Never answered by the bot - a person handles money going back.',
    placeholders: [],
    hi: `Refund, return ya exchange ke liye aapko hamare agent se baat karni hogi 🙏

Main abhi unko bata deta hoon, wo aapse jald baat karenge.`,
    en: `For a refund, return or exchange you'll need to speak to our agent 🙏

I'm letting them know now — they'll get back to you shortly.`,
  },
  {
    key: 'priceFixedAnswer',
    category: 'faq',
    label: 'Customer asks for a discount',
    description: 'Polite, warm, and firm. The price does not move.',
    placeholders: ['item', 'price', 'booking'],
    hi: `Bhai {{item}} ka price fix hai — {{price}}. Ismein discount nahi hota 🙏

{{booking}} dekar size reserve ho jata hai.`,
    en: `The {{item}} is fixed at {{price}} — we don't do discounts 🙏

{{booking}} reserves your size.`,
  },
  {
    key: 'whichPhoto',
    category: 'faq',
    label: 'Photo asked, but of what?',
    description: 'They asked to see something before choosing a design. Ask which one - never guess.',
    placeholders: ['products'],
    hi: `Kaunse ki photo chahiye bhai?

{{products}}`,
    en: `Which one would you like to see?

{{products}}`,
  },
  {
    key: 'photoHere',
    category: 'faq',
    label: 'Sending a product photo',
    description: 'Sent just before the picture itself, so the arrow points at it.',
    placeholders: ['item'],
    hi: `Ye {{item}} hai bhai 👇`,
    en: `Here is the {{item}} 👇`,
  },
  {
    key: 'noPhoto',
    category: 'faq',
    label: 'No photo available',
    description: 'The shop has no picture of this one. Never send another product instead.',
    placeholders: ['item'],
    hi: `{{item}} ki photo abhi mere paas nahi hai bhai 😅`,
    en: `I do not have a photo of the {{item}} right now 😅`,
  },
  {
    key: 'materialAnswer',
    category: 'faq',
    label: 'Material / quality asked',
    description: 'Kept short and natural, as the sales memory asks.',
    placeholders: ['material'],
    hi: `{{material}} 👌`,
    en: `{{material}} 👌`,
  },
  {
    key: 'waitingTimeAnswer',
    category: 'faq',
    label: 'Waiting time asked',
    description: 'Only ever sent when asked - never volunteered.',
    placeholders: ['leadTime'],
    hi: `Booking ke baad piece manufacturing me chala jata hai.
{{leadTime}}`,
    en: `After booking, it goes into manufacturing.
{{leadTime}}`,
  },
  {
    key: 'codAnswer',
    category: 'faq',
    label: 'COD asked',
    description: 'Only sent when asked. COD is never offered on its own.',
    placeholders: ['charge', 'total'],
    hi: `COD ho jayega, {{charge}} extra lagega — total {{total}}.`,
    en: `COD is available with an extra {{charge}} — {{total}} in total.`,
  },
  {
    key: 'limitedPiecesAnswer',
    category: 'faq',
    label: 'Stock / limited pieces asked',
    description: 'States the lot honestly. No fake urgency, ever.',
    placeholders: ['lotNote'],
    hi: `{{lotNote}}`,
    en: `{{lotNote}}`,
  },
  {
    key: 'hoodieBrandsAnswer',
    category: 'faq',
    label: 'Hoodie brands asked',
    description: 'Brands we carry. Anything else is "on request", not a promise.',
    placeholders: ['brands'],
    hi: `Hoodies me: {{brands}}`,
    en: `For hoodies we have: {{brands}}`,
  },
  {
    key: 'locationAnswer',
    category: 'faq',
    label: 'Location / shipping / pickup asked',
    placeholders: ['city', 'shipping'],
    hi: `Hum {{city}} me hain.
{{shipping}}`,
    en: `We're based in {{city}}.
{{shipping}}`,
  },
  {
    key: 'help',
    category: 'closing',
    label: 'Help',
    description: 'They sent "help".',
    placeholders: [],
    hi: `Repli help 🙌

Order karne ke liye bas product ka naam likho.

Ye commands use kar sakte ho:
• start / menu - naya order shuru
• address - delivery details badalna
• cancel - current order cancel
• help - ye message
• human - team se baat karna`,
    en: `Repli help 🙌

To order, just type the product name.

You can also use:
• start / menu - start a new order
• address - change delivery details
• cancel - cancel the current order
• help - this message
• human - talk to the team`,
  },
  {
    key: 'technicalError',
    category: 'closing',
    label: 'Something broke',
    description: 'Shown when Repli hits an error. The customer is handed to a human.',
    placeholders: [],
    hi: `Bhai ek small technical issue aa gaya 😅

Main aapko team se connect kar raha hoon.
Thoda sa wait karo ❤️`,
    en: `Sorry, we hit a small technical issue 😅

I'm connecting you to our team.
Please hold on ❤️`,
  },
];

const BY_KEY = new Map(CATALOGUE.map((entry) => [entry.key, entry]));

// ------------------------------------------------------------------ cache
let overrides = new Map(); // `${key}:${lang}` -> body
let loadedAt = 0;

function cacheKey(key, language) {
  return `${key}:${language}`;
}

/**
 * One language's rows, through the shared cache.
 *
 * Split by language so the key matches the rest of the scheme
 * (`repli:templates:hi`) and the panel can later drop just the language it
 * edited. Two small queries instead of one is not a cost worth avoiding.
 */
async function rowsFor(language, force) {
  const key = cache.KEYS.templates(language);
  if (force) await cache.del(key);

  return cache.remember(key, config.TEMPLATE_TTL_MS, async () => {
    const { data, error } = await supabase
      .from('message_templates')
      .select('key,body')
      .eq('language', language);
    if (error) throw new Error(error.message);
    return data || [];
  });
}

/** Reload the owner's edits. Cheap: one small table, cached for TTL_MS. */
async function refresh(force = false) {
  if (!force && Date.now() - loadedAt < TTL_MS) return overrides;

  try {
    const lists = await Promise.all(LANGUAGES.map((language) => rowsFor(language, force)));
    const next = new Map();
    LANGUAGES.forEach((language, index) => {
      for (const row of lists[index]) next.set(cacheKey(row.key, language), row.body);
    });
    overrides = next;
    loadedAt = Date.now();
  } catch (err) {
    // Keep serving whatever we had; defaults still work if we never loaded.
    logger.error('templates.load_failed', { error: err.message });
  }

  return overrides;
}

/** Memory is cleared synchronously inside cache.delPrefix(), before any await. */
async function invalidate() {
  loadedAt = 0;
  await cache.delPrefix(cache.KEYS.templatesPrefix);
}

function startTemplateSync(intervalMs = TTL_MS) {
  const timer = setInterval(() => {
    refresh(true).catch((err) => logger.error('templates.sync_failed', { error: err.message }));
  }, intervalMs);
  if (timer.unref) timer.unref();
  return () => clearInterval(timer);
}

/**
 * Startup: make sure every template exists in the table so the panel can list
 * them. Insert-only - an existing row belongs to the owner.
 */
async function ensureTemplates() {
  const { data, error } = await supabase.from('message_templates').select('key,language');
  if (error) {
    logger.error('templates.ensure_failed', { error: error.message });
    return 0;
  }

  const existing = new Set((data || []).map((row) => cacheKey(row.key, row.language)));
  const missing = [];

  CATALOGUE.forEach((entry, index) => {
    for (const language of LANGUAGES) {
      if (existing.has(cacheKey(entry.key, language))) continue;
      missing.push({
        key: entry.key,
        language,
        body: entry[language],
        default_body: entry[language],
        label: entry.label,
        description: entry.description || null,
        placeholders: entry.placeholders,
        category: entry.category,
        sort_order: index,
      });
    }
  });

  if (missing.length) {
    const { error: insertError } = await supabase.from('message_templates').insert(missing);
    if (insertError) {
      logger.error('templates.seed_failed', { error: insertError.message });
      return 0;
    }
    logger.info('templates.seeded', { action: `${missing.length} rows` });
  }

  await refresh(true);
  return missing.length;
}

/**
 * Fill {{placeholders}}.
 *
 * Unknown placeholders are left visible on purpose: a typo showing up as
 * `{{totl}}` in a test message is far easier to spot and fix than a silently
 * empty line in a real customer's chat.
 */
function fill(template, vars) {
  return String(template).replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name] ?? '') : match
  );
}

/** Optional lines like {{sizeLine}} leave a blank line behind when empty. */
function tidy(text) {
  return text
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

/** The owner's text if they edited it, otherwise the default from above. */
function render(key, language, vars = {}) {
  const entry = BY_KEY.get(key);
  const lang = LANGUAGES.includes(language) ? language : 'hi';
  const template = overrides.get(cacheKey(key, lang)) || (entry && entry[lang]) || '';

  if (!template) {
    logger.error('templates.missing', { action: `${key}:${lang}` });
    return '';
  }

  return tidy(fill(template, vars));
}

module.exports = {
  CATALOGUE,
  LANGUAGES,
  render,
  refresh,
  invalidate,
  ensureTemplates,
  startTemplateSync,
};
