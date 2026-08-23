'use strict';

/**
 * One numbered PDF of every hoodie colourway.
 *
 *   node scripts/build-hoodie-chart.js          build it
 *   node scripts/build-hoodie-chart.js --upload build it and attach it to
 *                                              both hoodie products
 *
 * The shop has forty-odd BAPE colourways and no names for them - they are
 * camo patterns, not "red" and "blue". Sending forty photographs to ask one
 * question is not an option, and inventing forty names so they can be listed
 * would be inventing the shop's catalogue for it.
 *
 * So they go into a single document, numbered. The customer opens one file,
 * finds the one they want, and either screenshots it or says the number -
 * both of which are unambiguous in a way "the purple one" is not, when nine
 * of them are purple.
 *
 * A PDF rather than one enormous image on purpose: forty hoodies in a single
 * picture makes each one a thumbnail, and WhatsApp will compress it further.
 * A PDF opens at full size and zooms.
 *
 * The pictures themselves are the shop's own photographs, dropped into
 * data/catalogue/hoodie-colours. Adding or removing one and re-running this
 * is the whole update process - the numbers come from the sort order, so
 * they stay stable as long as nothing is renamed.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'data', 'catalogue', 'hoodie-colours');
const OUT = path.join(SOURCE, 'hoodie-colours.pdf');

/**
 * Pictures that are not a colourway.
 *
 * The batch that arrived also held a pair of tracksuit bottoms, close-ups of
 * a zip and a label, and two group shots of everything piled together. They
 * are useful photographs and they are not choices: numbering them would have
 * a customer asking for "number 39" and meaning a zip.
 *
 * Two of them also carry a supplier's watermark stamped across the picture,
 * which is a second reason on its own - that is the shop's supply chain, and
 * it does not belong in a document the shop hands to its customers.
 */
const NOT_A_COLOURWAY = [
  // A close-up of the zip, carrying the supplier's own watermark across it.
  'WhatsApp Image 2026-08-21 at 11.40.18 AM (2).jpeg',
  'WhatsApp Image 2026-08-21 at 11.40.18 AM (1).jpeg',
  'WhatsApp Image 2026-08-21 at 11.40.18 AM.jpeg',
  'WhatsApp Image 2026-08-21 at 11.40.19 AM (1).jpeg',
  'WhatsApp Image 2026-08-21 at 11.40.19 AM (2).jpeg',
  'WhatsApp Image 2026-08-21 at 11.40.19 AM.jpeg',
];

const PY = `
import io, json, sys
from PIL import Image, ImageDraw, ImageFont

source, out, spec = sys.argv[1], sys.argv[2], json.loads(sys.argv[3])

# A4 at about 110dpi.
#
# It was 150, which made a 2.1MB file - fine on wifi and a real wait on a
# patchy connection, which is where most of these will be opened. At this
# size a hoodie still fills a phone screen when the page is zoomed, and the
# file is under a megabyte.
PAGE = (908, 1284)
COLS, ROWS = 2, 3
MARGIN, GAP, CAPTION = 44, 22, 40
INK, PAPER, HOT = (18, 18, 18), (255, 255, 255), (208, 0, 78)

bold = ImageFont.truetype(r'C:\\\\Windows\\\\Fonts\\\\arialbd.ttf', 34)
small = ImageFont.truetype(r'C:\\\\Windows\\\\Fonts\\\\arial.ttf', 24)

cell_w = (PAGE[0] - 2*MARGIN - (COLS-1)*GAP) // COLS
cell_h = (PAGE[1] - 2*MARGIN - (ROWS-1)*GAP - 68) // ROWS

pages = []
per = COLS * ROWS
for start in range(0, len(spec), per):
    page = Image.new('RGB', PAGE, PAPER)
    d = ImageDraw.Draw(page)

    d.text((MARGIN, MARGIN - 10), 'BAPE HOODIES', font=bold, fill=INK)
    head = 'Jo chahiye uska number batao, ya us photo ka screenshot bhej do'
    d.text((MARGIN, MARGIN + 22), head, font=small, fill=(110, 110, 110))
    d.line((MARGIN, MARGIN + 50, PAGE[0]-MARGIN, MARGIN + 50), fill=(220, 220, 220), width=2)

    top = MARGIN + 68
    for i, (number, filename) in enumerate(spec[start:start+per]):
        col, row = i % COLS, i // COLS
        x = MARGIN + col*(cell_w + GAP)
        y = top + row*(cell_h + GAP)

        im = Image.open(source + '/' + filename).convert('RGB')
        im.thumbnail((cell_w, cell_h - CAPTION))
        page.paste(im, (x + (cell_w - im.width)//2, y))

        # The number in a solid block, so it survives a screenshot crop.
        label_y = y + cell_h - CAPTION + 6
        d.rectangle((x, label_y, x + 54, label_y + 30), fill=HOT)
        d.text((x + 14, label_y + 2), str(number), font=bold, fill=PAPER)

    d.text((MARGIN, PAGE[1] - MARGIN + 4),
           'AESTURA  ·  page %d of %d' % (len(pages)+1, (len(spec)+per-1)//per),
           font=small, fill=(150, 150, 150))
    pages.append(page)

# quality is what actually decides the file size - the pages are stored as
# JPEG inside the PDF, and Pillow's default is generous for photographs of
# fabric, where nobody is counting threads.
pages[0].save(out, save_all=True, append_images=pages[1:], resolution=110.0, quality=68, optimize=True)
print(len(pages))
`;

function build() {
  const all = fs
    .readdirSync(SOURCE)
    .filter((f) => /\.(jpe?g|png)$/i.test(f))
    // Anything this script or a person left behind while checking the output.
    .filter((f) => !f.startsWith('_'))
    .filter((f) => !NOT_A_COLOURWAY.includes(f))
    .sort();

  const spec = all.map((filename, i) => [i + 1, filename]);
  const pages = execFileSync('python', ['-c', PY, SOURCE, OUT, JSON.stringify(spec)], {
    encoding: 'utf8',
  }).trim();

  console.log(`${spec.length} colourways over ${pages} pages`);
  console.log(`${OUT}  (${(fs.statSync(OUT).size / 1024 / 1024).toFixed(2)} MB)`);
  return spec.length;
}

async function upload(count) {
  const storage = require('../src/db/storage');
  const { supabase, unwrap } = require('../src/db/supabase');
  const productService = require('../src/services/productService');

  const reference = await storage.upload('catalogue/hoodie-colours.pdf', fs.readFileSync(OUT), {
    contentType: 'application/pdf',
  });
  if (!reference) throw new Error('upload failed');

  /**
   * Stored as a setting, not as a column on the product.
   *
   * A new column would mean a migration, and there is nothing to migrate to:
   * the chart belongs to the department, not to one product. The colourways
   * are the same for the single and the double hood - the difference between
   * those two is the hood, not the fabric - so one setting serves both, and
   * app_settings is already where the payment scanner lives.
   */
  const key = 'chart_hoodie';
  const { data: found } = await supabase.from('app_settings').select('key').eq('key', key);

  if (found && found.length) {
    unwrap(
      await supabase.from('app_settings').update({ value: reference }).eq('key', key).select('key'),
      'chart.update'
    );
  } else {
    unwrap(
      await supabase.from('app_settings').insert({ key, value: reference }).select('key'),
      'chart.insert'
    );
  }

  /**
   * How many are on it, stored beside it.
   *
   * The bot has to know the range to check a typed number against. Counting
   * pages at read time would mean opening a PDF on every message; the number
   * is known here, once, at the moment it becomes true.
   */
  const countKey = `${key}_count`;
  const { data: hasCount } = await supabase.from('app_settings').select('key').eq('key', countKey);
  if (hasCount && hasCount.length) {
    unwrap(
      await supabase.from('app_settings').update({ value: String(count) }).eq('key', countKey).select('key'),
      'chart.updateCount'
    );
  } else {
    unwrap(
      await supabase.from('app_settings').insert({ key: countKey, value: String(count) }).select('key'),
      'chart.insertCount'
    );
  }

  await productService.invalidate();
  console.log(`  ${key} → ${reference}`);
  console.log(`  ${countKey} → ${count}`);
  console.log(`
${count} colourways in one document, for every hoodie.`);
}

const count = build();

if (process.argv.includes('--upload')) {
  upload(count)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(`\n${err.message}\n`);
      process.exit(1);
    });
}
