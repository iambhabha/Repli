-- =====================================================================
-- 010 - AESTHURA & 3POINTER.CLUB
--
-- Replaces the generic demo catalogue with the real one, and teaches the
-- schema three things it did not know before:
--
--   category  - "I need a T-shirt" must show T-shirts, not everything.
--   brand     - two businesses share one bot.
--   booking   - the customer does not pay the full price. ₹500 reserves a
--               size in the current lot; the rest is paid when the piece is
--               manufactured. That is two amounts per order, not one, so it
--               has to live in the schema rather than in someone's head.
--
-- Old rows are deactivated, never deleted: existing orders point at them.
-- =====================================================================

-- ---- products -------------------------------------------------------

alter table products add column if not exists brand text not null default 'AESTHURA';
alter table products add column if not exists category text not null default 'tshirt';
alter table products add column if not exists design text;

-- What the customer pays now to reserve a size. 0 = pay in full.
alter table products add column if not exists booking_amount numeric(10, 2) not null default 0
  check (booking_amount >= 0);

-- Made to order: no stock is held, every size is "subject to confirmation".
alter table products add column if not exists made_to_order boolean not null default false;

alter table products add column if not exists cod_charge numeric(10, 2) not null default 0
  check (cod_charge >= 0);
alter table products add column if not exists cod_available boolean not null default false;

create index if not exists products_category_idx on products (category, active, sort_order);
create index if not exists products_brand_idx on products (brand, active);

-- ---- orders ---------------------------------------------------------

-- total stays the full price of the goods. These three record how it is
-- being collected, which is what the customer is actually told.
alter table orders add column if not exists booking_amount numeric(10, 2) not null default 0;
alter table orders add column if not exists remaining_amount numeric(10, 2) not null default 0;
alter table orders add column if not exists payment_mode text not null default 'BOOKING'
  check (payment_mode in ('BOOKING', 'FULL', 'COD'));
alter table orders add column if not exists brand text;

-- ---- retire the demo catalogue --------------------------------------

update product_variants
   set active = false
 where product_id in (select id from products where code in ('TS001', 'BAG001'));

update products set active = false where code in ('TS001', 'BAG001');

-- ---- AESTHURA: T-shirts ---------------------------------------------
--
-- A design IS the choice the customer makes ("Spider-Man" or "Venom"), and
-- each design comes in exactly one colour. Modelling designs as products
-- means the bot asks one question - which design - instead of asking for a
-- product and then a colour that was already implied.

insert into products
  (code, name, design, description, emoji, price, booking_amount, brand, category,
   cod_available, cod_charge, sort_order, active)
values
  ('AES-TS-SPIDER', 'Spider-Man T-Shirt', 'Spider-Man',
   'Cotton with a little stretch, high-quality print, raised web lines and raised web logo.',
   '🔴', 2499, 500, 'AESTHURA', 'tshirt', true, 200, 1, true),
  ('AES-TS-VENOM', 'Venom T-Shirt', 'Venom',
   'Cotton with a little stretch, high-quality print, raised web lines and raised web logo.',
   '⚫', 2499, 500, 'AESTHURA', 'tshirt', true, 200, 2, true)
on conflict (code) do update set
  name           = excluded.name,
  design         = excluded.design,
  description    = excluded.description,
  emoji          = excluded.emoji,
  price          = excluded.price,
  booking_amount = excluded.booking_amount,
  brand          = excluded.brand,
  category       = excluded.category,
  cod_available  = excluded.cod_available,
  cod_charge     = excluded.cod_charge,
  sort_order     = excluded.sort_order,
  active         = true;

-- Sizes for both designs. Stock starts at 0 on purpose: a fake number here
-- would let the bot reserve a size that does not exist. The owner sets the
-- real lot quantities in the admin panel.
insert into product_variants (product_id, color, size, sku, stock_quantity, active)
select p.id,
       case p.code when 'AES-TS-SPIDER' then 'Red' else 'Black' end,
       s.size,
       p.code || '-' || s.size,
       0,
       true
  from products p
  cross join (values ('S'), ('M'), ('L'), ('XL'), ('XXL')) as s (size)
 where p.code in ('AES-TS-SPIDER', 'AES-TS-VENOM')
on conflict (sku) do nothing;

-- ---- AESTHURA: hoodies ----------------------------------------------
--
-- Special order from China, so no stock is held and every size/colour is
-- "subject to confirmation". Only BAPE has confirmed prices; the other
-- brands are answered as "on request" in the FAQ rather than guessed at.

insert into products
  (code, name, design, description, emoji, price, booking_amount, brand, category,
   made_to_order, sort_order, active)
values
  ('AES-HD-BAPE-S', 'BAPE Single Hood', 'BAPE Single Hood',
   'BAPE single hood, special order.', '🧥', 3999, 1500, 'AESTHURA', 'hoodie', true, 3, true),
  ('AES-HD-BAPE-D', 'BAPE Double Hood', 'BAPE Double Hood',
   'BAPE double hood, special order.', '🧥', 4599, 1500, 'AESTHURA', 'hoodie', true, 4, true)
on conflict (code) do update set
  name           = excluded.name,
  design         = excluded.design,
  description    = excluded.description,
  emoji          = excluded.emoji,
  price          = excluded.price,
  booking_amount = excluded.booking_amount,
  brand          = excluded.brand,
  category       = excluded.category,
  made_to_order  = excluded.made_to_order,
  sort_order     = excluded.sort_order,
  active         = true;

insert into product_variants (product_id, color, size, sku, stock_quantity, active)
select p.id, null, s.size, p.code || '-' || s.size, 0, true
  from products p
  cross join (values ('S'), ('M'), ('L'), ('XL'), ('XXL')) as s (size)
 where p.code in ('AES-HD-BAPE-S', 'AES-HD-BAPE-D')
on conflict (sku) do nothing;

-- ---- 3POINTER.CLUB: bags --------------------------------------------
--
-- Intentionally empty. The memory says "provide only confirmed current
-- prices, stock, colours and details - never invent information", and no
-- bag prices were supplied. Rows are added from the admin panel once the
-- real numbers exist; until then the bot says it will confirm and hands the
-- conversation to a human instead of making a price up.

-- ---- business facts the bot is allowed to state ---------------------
--
-- These live in app_settings so the owner can correct them in the panel
-- without a deploy. The bot answers from these strings only.

insert into app_settings (key, value) values
  ('business_name',        'AESTHURA'),
  ('brand_secondary',      '3POINTER.CLUB'),
  ('location_city',        'Dadar, Mumbai'),
  ('shipping_note',        'Ships all over India. Pickup from Dadar is available; exact pickup location is shared when the product is ready.'),
  ('tshirt_lead_time',     'Manufacturing generally takes around 15-20 days, so the overall waiting period is approximately 20-30 days.'),
  ('hoodie_lead_time',     'Special order from China, generally 15-20 days.'),
  ('tshirt_material',      'It''s cotton material with a little stretch, with high-quality printing, raised web lines/texture and a raised web logo.'),
  ('hoodie_brands',        'BAPE, Denim Tears, Valley Dreams and others on request.'),
  ('lot_note',             'T-shirts are limited. The booking amount reserves your selected size in the current lot. If the current lot is fully booked, the next lot is the wait.')
on conflict (key) do nothing;
