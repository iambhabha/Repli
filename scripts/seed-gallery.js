'use strict';

/**
 * Puts the shop's own photographs into the gallery from migration 018.
 *
 *   node scripts/seed-gallery.js
 *
 * Safe to run twice: every object is uploaded to a fixed key and every row
 * is matched on (product_id, image_path), so a second run updates the order
 * and adds nothing. Nothing is ever deleted from the bucket here.
 *
 * The files listed below are the ones the shop supplied, in the order a
 * customer should see them: the front of the garment first, because it is
 * the photograph that answers the question, then the rest.
 */

const fs = require('fs');
const path = require('path');

const storage = require('../src/db/storage');
const { supabase, unwrap } = require('../src/db/supabase');
const productService = require('../src/services/productService');

const ROOT = path.join(__dirname, '..');

const GALLERIES = [
  {
    product: '720ac287-0ccd-4528-9f21-b15d42e43336',
    label: 'Spider-Man (Red)',
    photos: [
      ['spder_man_red/IMG_2358.PNG', 'products/spiderman-red-front.png', 'image/png'],
      ['spder_man_red/IMG_2359.PNG', 'products/spiderman-red-front-full.png', 'image/png'],
      ['spder_man_red/IMG_8348.PNG', 'products/spiderman-red-back-1.png', 'image/png'],
      ['spder_man_red/IMG_8349.PNG', 'products/spiderman-red-back-2.png', 'image/png'],
      ['spder_man_red/IMG_8350.PNG', 'products/spiderman-red-back-3.png', 'image/png'],
    ],
  },
  {
    product: '0cea5914-67ab-4a33-85f1-c3eff7d73258',
    label: 'Venom (Black)',
    photos: [
      // The fourth file in this folder is the AESTHURA brand logo, not a
      // photograph of the shirt, so it is deliberately not listed.
      [
        'spder_man_black_veonm/WhatsApp Image 2026-08-19 at 5.54.17 PM.jpeg',
        'products/venom-black-front.jpeg',
        'image/jpeg',
      ],
      [
        'spder_man_black_veonm/WhatsApp Image 2026-08-19 at 5.54.18 PM.jpeg',
        'products/venom-black-full.jpeg',
        'image/jpeg',
      ],
      [
        'spder_man_black_veonm/WhatsApp Image 2026-08-19 at 5.54.18 PM (1).jpeg',
        'products/venom-black-back.jpeg',
        'image/jpeg',
      ],
    ],
  },
];

async function main() {
  for (const gallery of GALLERIES) {
    console.log(`\n${gallery.label}`);
    let order = 0;

    for (const [file, key, type] of gallery.photos) {
      order += 1;
      const full = path.join(ROOT, file);

      if (!fs.existsSync(full)) {
        console.log(`  ${order}. MISSING ${file}`);
        continue;
      }

      const buffer = fs.readFileSync(full);
      const reference = await storage.upload(key, buffer, { contentType: type });
      if (!reference) {
        console.log(`  ${order}. UPLOAD FAILED ${file}`);
        continue;
      }

      const existing = unwrap(
        await supabase
          .from('product_images')
          .select('id')
          .eq('product_id', gallery.product)
          .eq('image_path', reference),
        'gallery.find'
      );

      if (existing && existing.length) {
        unwrap(
          await supabase
            .from('product_images')
            .update({ sort_order: order })
            .eq('id', existing[0].id)
            .select('id'),
          'gallery.update'
        );
        console.log(`  ${order}. updated  ${path.basename(file)} -> ${key}`);
      } else {
        unwrap(
          await supabase
            .from('product_images')
            .insert({ product_id: gallery.product, image_path: reference, sort_order: order })
            .select('id'),
          'gallery.insert'
        );
        console.log(`  ${order}. added    ${path.basename(file)} -> ${key}`);
      }
    }
  }

  await productService.invalidate();
  console.log('\nCatalogue cache cleared.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`\n${err.message}\n`);
    process.exit(1);
  });
