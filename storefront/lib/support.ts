import { SHOP, rupees } from '@/lib/catalogue';

/**
 * The questions the shop already has answers to.
 *
 * Every one of these is answered on WhatsApp from a stored fact rather than
 * improvised, and these are those same facts. Putting them on the site means
 * the common questions are answered the instant they are asked, without
 * anyone waiting for a person to be free.
 *
 * The rule that matters: nothing in here is invented. If the shop does not
 * have a stored answer for something - what a refund will be, whether a
 * particular colour can be had this week - it is not in this list, because
 * an answer manufactured on a website is worse than a short wait for a real
 * one.
 */
export type Topic = {
  id: string;
  /** What the customer taps, phrased the way they would say it. */
  ask: string;
  /** Words that should reach this answer when typed. */
  keys: string[];
  answer: string[];
};

export const TOPICS: Topic[] = [
  {
    id: 'price',
    ask: 'What does a tee cost?',
    keys: ['price', 'cost', 'kitna', 'kitne', 'rate', 'daam', 'paisa', 'rs', '2499'],
    answer: [
      `A tee is ${rupees(2499)}. ${rupees(500)} reserves your size, and the remaining ${rupees(1999)} is paid once the piece is ready.`,
      `BAPE Single Hood is ${rupees(3999)} and Double Hood is ${rupees(4599)}, both with ${rupees(1500)} to reserve. The bag is ${rupees(2499)}.`,
    ],
  },
  {
    id: 'booking',
    ask: 'How do I book something?',
    keys: ['book', 'booking', 'process', 'advance', 'reserve', 'kaise book', 'how do i'],
    answer: [
      'Three steps. Tell us the design and your size, pay the advance on the scanner we send, then send the screenshot.',
      'A person checks that screenshot before anything is confirmed - so a reply saying it arrived is not the same as the booking being done.',
    ],
  },
  {
    id: 'time',
    ask: 'How long will it take?',
    keys: ['time', 'long', 'days', 'din', 'kitna time', 'delivery', 'wait', 'kab'],
    answer: [
      'Tees go into manufacturing after booking. That is generally 15-20 days, so the overall wait is usually 20-30 days.',
      'Hoodies are special orders, generally 15-20 days. These are honest estimates from past orders, not guaranteed dates.',
    ],
  },
  {
    id: 'material',
    ask: 'What is the tee made of?',
    keys: ['material', 'fabric', 'cotton', 'quality', 'kapda', 'stretch'],
    answer: [
      "Cotton with a little stretch, with high-quality printing - raised web lines and a raised web logo.",
    ],
  },
  {
    id: 'cod',
    ask: 'Do you do cash on delivery?',
    keys: ['cod', 'cash', 'delivery pe', 'cash on delivery'],
    answer: [
      `COD is available on tees for ${rupees(200)} extra, so ${rupees(2699)} in total.`,
    ],
  },
  {
    id: 'colours',
    ask: 'Which bag colours can I get?',
    keys: ['colour', 'color', 'rang', 'bag colour', 'shade'],
    answer: [
      'Twenty-four, all on the printed chart on the bags section of this site.',
      'The shop does not keep a counted stock of each colour - you point at the one you want and we confirm that colour with our supplier before you pay anything.',
    ],
  },
  {
    id: 'pickup',
    ask: 'Where are you? Can I pick it up?',
    keys: ['where', 'pickup', 'location', 'address', 'shop', 'dadar', 'mumbai', 'kahan'],
    answer: [
      `${SHOP.city}. ${SHOP.shipping}`,
      'The exact pickup point is shared once your piece is ready.',
    ],
  },
  {
    id: 'returns',
    ask: 'What if it does not fit?',
    keys: ['return', 'exchange', 'refund', 'fit', 'size wrong', 'damaged', 'wapas'],
    answer: [
      `${SHOP.returns} - unworn, unwashed, in the condition it arrived in.`,
      'If it arrives damaged or is not what you ordered, that is ours to fix. Send a photograph and a person will sort it out - refunds and exchanges are always decided by a person, not automatically.',
    ],
  },
];

/**
 * Questions about somebody's own order, which no stored answer can address.
 *
 * This list is checked FIRST and overrides every other match, because the
 * generic keywords sit inside these questions. Asked "mera order REP-2384
 * kahan pahucha", the matcher below happily found the word "order", decided
 * the topic was booking, and explained how to place one - to a customer who
 * had already placed one and wanted to know where it was.
 *
 * A wrong answer delivered instantly is worse than a right one that takes a
 * minute, so anything that smells personal goes to a person untouched.
 */
const PERSONAL = [
  /\brep[-\s]?\d+/i,
  /\bmer[ai]\b/i,
  /\bmy\b/i,
  /\bwhere is\b/i,
  /\bkahan\b/i,
  /\bkab tak\b/i,
  /\bstatus\b/i,
  /\btrack/i,
  /\bnahi aay/i,
  /\bnot receiv/i,
  /\babhi tak\b/i,
  /\bcancel/i,
  /\bcomplain/i,
];

/**
 * Find the topic a typed question is asking about.
 *
 * This is a small keyword match over the shop's own topic list, and it is
 * deliberately allowed to fail. When it does - or when the question is about
 * one particular order - it goes to a person on WhatsApp instead of being
 * answered by the nearest guess.
 */
export function topicFor(text: string): Topic | null {
  const body = text.toLowerCase();
  if (body.trim().length < 2) return null;
  if (PERSONAL.some((pattern) => pattern.test(body))) return null;

  let best: { topic: Topic; score: number } | null = null;
  for (const topic of TOPICS) {
    const score = topic.keys.filter((key) => body.includes(key)).length;
    if (score > 0 && (!best || score > best.score)) best = { topic, score };
  }
  return best ? best.topic : null;
}
