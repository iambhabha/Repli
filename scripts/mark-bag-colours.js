'use strict';

/**
 * One copy of the bag chart per colour, with that colour ticked.
 *
 *   node scripts/mark-bag-colours.js          build them
 *   node scripts/mark-bag-colours.js --upload build, upload, and point each
 *                                             variant at its own copy
 *
 * The shop sells this backpack in twenty-four colours off a single printed
 * card, and does not track which colour is in the room - availability is
 * something the owner confirms with their supplier after the customer
 * chooses. So the bot's job is not to gate on stock here; it is to show the
 * card with the customer's colour marked, so there is no doubt which one
 * they asked for and none about which one the shop is checking.
 *
 * Marking happens here rather than at reply time on purpose. Twenty-four
 * images built once and uploaded is twenty-four fewer image libraries in the
 * bot, and nothing to go wrong while a customer is waiting.
 *
 * Nothing new is needed to send them: migration 016 already gives every
 * variant an `image_path`, and productService.imagesFor() already prefers a
 * variant's own picture over the design's. Setting that column is the whole
 * integration.
 *
 * The positions below were read off the card by eye and then checked by
 * drawing them and looking at the result - every box, twice. A tick on the
 * wrong bag would tell a customer the shop is checking a colour they did not
 * ask for, which is worse than no tick at all.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'IMG_2292.PNG');
const OUT_DIR = path.join(ROOT, 'data', 'catalogue', 'bag-colours');

/**
 * Where each colour appears on the card, as (x1, y1, x2, y2) boxes around
 * the bag, its label and its price.
 *
 * Several colours are printed more than once - Black three times, Sky Blue,
 * Red, Orange, White, Blue and Black & White twice. Every occurrence is
 * marked, because a customer scanning the card should not have to wonder
 * why one of the three black bags is circled and the others are not.
 *
 * Keys are the colour names as they appear in product_variants, which differ
 * from the printed labels in two places ("Black / White Logo" on the card is
 * "Black White Logo" in the database).
 */
const POSITIONS = {
  'Sky Blue': [[40, 200, 165, 445], [16, 1030, 105, 1240], [908, 805, 996, 1015]],
  Black: [[196, 200, 320, 445], [520, 262, 625, 498], [795, 505, 895, 720]],
  'Lake Blue': [[18, 462, 110, 700]],
  'Ocean Blue': [[120, 462, 215, 700]],
  Orange: [[228, 462, 322, 700], [464, 505, 554, 720]],
  Blue: [[378, 262, 490, 498], [356, 1030, 455, 1240]],
  'Light Purple': [[352, 505, 442, 720]],
  'Dark Purple': [[576, 505, 662, 720]],
  'Original Pink': [[688, 200, 780, 445]],
  White: [[796, 200, 890, 445], [330, 790, 428, 1015]],
  'Pink Pattern': [[906, 200, 1000, 445]],
  'Original Dark Blue': [[688, 505, 780, 720]],
  'Black & White': [[906, 505, 1000, 720], [908, 1025, 996, 1240]],
  'Black White Logo': [[30, 790, 138, 1015]],
  'Black Gold Logo': [[180, 790, 290, 1015]],
  Red: [[118, 1030, 225, 1240], [596, 1025, 682, 1240]],
  Gray: [[240, 1030, 342, 1240]],
  'White & Gold': [[492, 805, 578, 1015]],
  'Speckled White': [[596, 805, 682, 1015]],
  'Dark Gray': [[698, 805, 784, 1015]],
  'Black & Green': [[802, 805, 890, 1015]],
  'Dark Blue': [[492, 1025, 578, 1240]],
  'Black & Pink': [[698, 1025, 784, 1240]],
  'Black & Gold': [[802, 1025, 890, 1240]],
};

/** Pillow does the drawing; node has no image library and needs none. */
const PY = `
import io, json, sys
from PIL import Image, ImageDraw, ImageFont

source, out_dir, spec = sys.argv[1], sys.argv[2], json.loads(sys.argv[3])
bold = ImageFont.truetype(r'C:\\\\Windows\\\\Fonts\\\\arialbd.ttf', 40)
GREEN, BAND = (34, 220, 110), 96

for colour, boxes in spec.items():
    base = Image.open(source).convert('RGB')
    w, h = base.size
    im = Image.new('RGB', (w, h + BAND), (0, 0, 0))
    im.paste(base, (0, BAND))
    d = ImageDraw.Draw(im)

    d.rectangle((0, 0, w, BAND - 6), fill=(12, 40, 24))
    d.rectangle((0, BAND - 6, w, BAND), fill=GREEN)
    msg = 'AAPKA COLOUR:  ' + colour.upper()
    d.text(((w - d.textlength(msg, font=bold)) / 2, 20), msg, font=bold, fill=GREEN)

    for (x1, y1, x2, y2) in boxes:
        d.rounded_rectangle((x1, y1 + BAND, x2, y2 + BAND), radius=12, outline=GREEN, width=6)
        cx, cy, r = x2 - 4, y1 + BAND + 4, 19
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=GREEN)
        d.line([(cx - 9, cy), (cx - 3, cy + 7), (cx + 9, cy - 8)], fill=(0, 0, 0), width=4)

    safe = ''.join(c if c.isalnum() else '-' for c in colour.lower()).strip('-')
    while '--' in safe:
        safe = safe.replace('--', '-')
    im.save(out_dir + '/' + safe + '.png')
    print(safe)
`;

function build() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const made = execFileSync('python', ['-c', PY, SOURCE, OUT_DIR, JSON.stringify(POSITIONS)], {
    encoding: 'utf8',
  });
  return made.split('\n').map((line) => line.trim()).filter(Boolean);
}

async function upload() {
  const storage = require('../src/db/storage');
  const { supabase, unwrap } = require('../src/db/supabase');
  const productService = require('../src/services/productService');

  const product = unwrap(
    await supabase.from('products').select('id').eq('code', '3PC-BAG-ELITE').single(),
    'bag.find'
  );
  const variants = unwrap(
    await supabase.from('product_variants').select('id,color').eq('product_id', product.id),
    'bag.variants'
  );

  let done = 0;
  for (const variant of variants) {
    const slug = String(variant.color).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const file = path.join(OUT_DIR, `${slug}.png`);
    if (!fs.existsSync(file)) {
      console.log(`  no card for ${variant.color}`);
      continue;
    }

    const reference = await storage.upload(`bags/${slug}.png`, fs.readFileSync(file), {
      contentType: 'image/png',
    });
    if (!reference) {
      console.log(`  upload failed for ${variant.color}`);
      continue;
    }

    unwrap(
      await supabase.from('product_variants').update({ image_path: reference }).eq('id', variant.id).select('id'),
      'bag.setImage'
    );
    done += 1;
  }

  await productService.invalidate();
  console.log(`\n${done}/${variants.length} colours now carry their own marked card.`);
}

/**
 * Put every bag variant back on the shop's own chart.
 *
 *   node scripts/mark-bag-colours.js --revert
 *
 * The marked cards were built, uploaded and then taken back out of the
 * conversation: the owner's decision is that the plain chart goes out and the
 * customer points at what they want on it themselves, with a person picking
 * it up from there. Clearing image_path is all that is needed - imagesFor()
 * falls back to the design's own picture, which is the chart.
 *
 * The uploaded files are left in storage. They cost nothing sitting there,
 * and deleting somebody's uploaded media to undo a display decision is a
 * bigger action than the decision was.
 */
async function revert() {
  const { supabase, unwrap } = require('../src/db/supabase');
  const productService = require('../src/services/productService');

  const product = unwrap(
    await supabase.from('products').select('id').eq('code', '3PC-BAG-ELITE').single(),
    'bag.find'
  );
  const cleared = unwrap(
    await supabase
      .from('product_variants')
      .update({ image_path: null })
      .eq('product_id', product.id)
      .not('image_path', 'is', null)
      .select('id'),
    'bag.clearImages'
  );

  await productService.invalidate();
  console.log(`${cleared.length} variants back on the plain chart.`);
}

if (process.argv.includes('--revert')) {
  revert()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(`
${err.message}
`);
      process.exit(1);
    });
  return;
}

const made = build();
console.log(`built ${made.length} cards in data/catalogue/bag-colours/`);

if (process.argv.includes('--upload')) {
  upload()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(`\n${err.message}\n`);
      process.exit(1);
    });
}
