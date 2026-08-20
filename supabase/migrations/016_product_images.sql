-- =====================================================================
-- 016 - A picture of the actual product
--
-- "red wali kaisi lagegi?" is one of the most common things a customer
-- asks, and until now the shop had no answer to it. The only picture
-- anywhere was the bags catalogue card, on `product_categories` - a whole
-- category's worth of colours in one image, which is right for a menu and
-- useless for "show me the red one".
--
-- Two columns, both nullable, both a path the shop already controls:
--
--   products.image_path          the design, whatever colour
--   product_variants.image_path  that exact colour, when it is worth
--                                photographing separately
--
-- The variant wins when both exist. A missing path is not an error - the
-- bot says it does not have a photo rather than inventing one, which is the
-- same rule that applies to prices and stock.
--
-- Deliberately a path, not a URL. The bot sends the file over WhatsApp
-- through the same adapter the payment proofs use; a URL would be one more
-- thing a model could be talked into making up.
--
-- product_categories.image_path from migration 013 is untouched and still
-- used for the catalogue card.
-- =====================================================================

alter table products         add column if not exists image_path text;
alter table product_variants add column if not exists image_path text;

comment on column products.image_path is
  'Relative to the bot''s root (data/catalogue/spiderman.png) or absolute. NULL means the shop has no photo of this design - say so, never substitute another.';

comment on column product_variants.image_path is
  'Same, for one exact colour/size. Takes precedence over the product''s own picture.';
