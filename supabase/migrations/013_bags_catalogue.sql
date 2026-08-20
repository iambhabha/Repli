-- =====================================================================
-- 013 - 3POINTER.CLUB bags, and catalogue images
--
-- The bag range is one product in a lot of colours, all at the same price,
-- so it is modelled as a single product whose variants are colours with no
-- size. Colours and price come straight off the shop's own catalogue card.
--
-- That card is also the best way to show the range: twenty-four colour names
-- as text is a wall, one image is a shop window. `product_categories` gets an
-- image column so any category can have one.
-- =====================================================================

alter table product_categories add column if not exists image_path text;

comment on column product_categories.image_path is
  'Optional catalogue picture, relative to the project root. Sent to the '
  'customer when this category is shown.';

update product_categories
   set image_path = 'data/catalogue/bags.png',
       label      = 'Bags'
 where key = 'bag';

-- ---- the bag itself --------------------------------------------------
--
-- booking_amount is 0: bags are in hand, so they are paid for in full. The
-- T-shirts and hoodies are the made-to-order half of the business.

insert into products
  (code, name, design, description, emoji, price, booking_amount, brand, category,
   cod_available, cod_charge, keywords, sort_order, active)
values
  ('3PC-BAG-ELITE', 'Nike Elite Backpack', 'Nike Elite Backpack',
   'Spacious compartments, padded ergonomic straps, durable and lightweight.',
   '🎒', 2499, 0, '3POINTER.CLUB', 'bag',
   false, 0,
   array['bag', 'bags', 'backpack', 'back pack', 'elite', 'nike', 'nike bag',
         'basketball bag', 'sports bag', 'jhola', 'baig'],
   5, true)
on conflict (code) do update set
  name           = excluded.name,
  design         = excluded.design,
  description    = excluded.description,
  emoji          = excluded.emoji,
  price          = excluded.price,
  booking_amount = excluded.booking_amount,
  brand          = excluded.brand,
  category       = excluded.category,
  keywords       = excluded.keywords,
  sort_order     = excluded.sort_order,
  active         = true;

-- ---- one variant per colour -----------------------------------------
--
-- No size: a backpack is one size. Stock starts at 0 for every colour, the
-- same rule as everywhere else - the bot must never reserve a colour the
-- shop cannot ship. The owner sets the real counts in the panel.

insert into product_variants (product_id, color, size, sku, stock_quantity, active)
select p.id, c.colour, null, '3PC-BAG-' || upper(replace(replace(c.colour, ' ', '-'), '&', 'AND')), 0, true
  from products p
  cross join (values
    ('Sky Blue'), ('Black'), ('Lake Blue'), ('Ocean Blue'), ('Orange'),
    ('Blue'), ('Light Purple'), ('Dark Purple'), ('Original Pink'), ('White'),
    ('Pink Pattern'), ('Original Dark Blue'), ('Black & White'),
    ('Black White Logo'), ('Black Gold Logo'), ('White & Gold'),
    ('Speckled White'), ('Dark Gray'), ('Black & Green'), ('Dark Blue'),
    ('Red'), ('Black & Pink'), ('Black & Gold'), ('Gray')
  ) as c (colour)
 where p.code = '3PC-BAG-ELITE'
on conflict (sku) do nothing;

-- ---- facts the bot may state about bags ------------------------------

insert into app_settings (key, value) values
  ('bag_note', 'Nike Elite style backpack, ₹2499 in every colour. Spacious compartments, padded straps, lightweight.')
on conflict (key) do nothing;
