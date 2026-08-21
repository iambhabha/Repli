/**
 * What the shop sells, written down.
 *
 * These are the real rows from the bot's catalogue - the same names, prices
 * and booking amounts a customer is quoted on WhatsApp. Keeping them in one
 * file is what makes the site static today and easy to make live tomorrow:
 * every component takes a `Product`, so when this file starts reading
 * Supabase instead of holding literals, nothing above it changes.
 *
 * Two rules borrowed from the bot, because a shop front can lie in exactly
 * the same ways a chat can:
 *
 *   - No price appears here that is not the price. A number on a website is
 *     a promise, and the shop has to honour it.
 *   - Nothing is described as in stock. The bag is sold off a printed chart
 *     in twenty-four colours and the shop confirms availability with its
 *     supplier after you choose one; saying "in stock" would be inventing a
 *     fact nobody has.
 */

export type Category = 'tshirt' | 'hoodie' | 'bag';

export type Product = {
  slug: string;
  name: string;
  brand: string;
  category: Category;
  price: number;
  /** What reserves it. Zero means the shop takes no advance for this one. */
  booking: number;
  colour: string;
  sizes: string[];
  images: string[];
  /**
   * How the photograph sits in the card.
   *
   * 'cover' fills the frame and crops, which is what a garment shot wants.
   * The bag's photograph is not a garment shot - it is the shop's printed
   * colour chart, and cropping an infographic cuts colours off it. That one
   * is shown whole.
   */
  fit: 'cover' | 'contain';
  blurb: string;
};

export const SHOP = {
  whatsapp: '919799757664',
  city: 'Dadar, Mumbai',
  shipping: 'Ships all over India. Pickup from Dadar available.',
  returns: '2 day return & exchange',
} as const;

/** The message that opens when someone taps a product's button. */
export function whatsappLink(text: string): string {
  return `https://wa.me/${SHOP.whatsapp}?text=${encodeURIComponent(text)}`;
}

export const PRODUCTS: Product[] = [
  {
    slug: 'spiderman',
    name: 'Spider-Man',
    brand: 'AESTHURA',
    category: 'tshirt',
    price: 2499,
    booking: 500,
    colour: 'Red',
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    images: [
      '/products/spiderman-front.png',
      '/products/spiderman-full.png',
      '/products/spiderman-back.png',
    ],
    fit: 'cover',
    blurb:
      'Cotton with a little stretch. Raised web lines across the body and a raised web logo, printed to hold its edge.',
  },
  {
    slug: 'venom',
    name: 'Venom',
    brand: 'AESTHURA',
    category: 'tshirt',
    price: 2499,
    booking: 500,
    colour: 'Black',
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    images: [
      '/products/venom-front.jpeg',
      '/products/venom-full.jpeg',
      '/products/venom-back.jpeg',
    ],
    fit: 'cover',
    blurb:
      'The black cut of the same build - cotton with a little stretch, raised texture, high-quality print.',
  },
  {
    slug: 'bape-single-hood',
    name: 'BAPE Single Hood',
    brand: 'AESTHURA',
    category: 'hoodie',
    price: 3999,
    booking: 1500,
    colour: 'On request',
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    images: [],
    fit: 'cover',
    blurb:
      'Special order from China, generally 15-20 days. All sizes and colours can be ordered subject to confirmation.',
  },
  {
    slug: 'bape-double-hood',
    name: 'BAPE Double Hood',
    brand: 'AESTHURA',
    category: 'hoodie',
    price: 4599,
    booking: 1500,
    colour: 'On request',
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    images: [],
    fit: 'cover',
    blurb:
      'The double hood cut. Special order, generally 15-20 days, sizes and colours confirmed before booking.',
  },
  {
    slug: 'nike-elite-backpack',
    name: 'Nike Elite Backpack',
    brand: '3POINTER.CLUB',
    category: 'bag',
    price: 2499,
    booking: 0,
    colour: '24 colours',
    sizes: [],
    images: ['/products/bag-chart.png'],
    fit: 'contain',
    blurb:
      'Spacious compartments, padded straps, built for daily carry. Twenty-four colours on the chart - pick one and we confirm it for you.',
  },
];

export const CATEGORIES: { key: Category; label: string; note: string }[] = [
  { key: 'tshirt', label: 'T-Shirts', note: 'AESTHURA' },
  { key: 'hoodie', label: 'Hoodies', note: 'BAPE & more' },
  { key: 'bag', label: 'Bags', note: '3POINTER.CLUB' },
];

export const BAG_COLOURS = [
  'Sky Blue', 'Black', 'Lake Blue', 'Ocean Blue', 'Orange', 'Blue',
  'Light Purple', 'Dark Purple', 'Original Pink', 'White', 'Pink Pattern',
  'Original Dark Blue', 'Black & White', 'Black / White Logo',
  'Black / Gold Logo', 'Red', 'Gray', 'White & Gold', 'Speckled White',
  'Dark Gray', 'Black & Green', 'Dark Blue', 'Black & Pink', 'Black & Gold',
];

export const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;
