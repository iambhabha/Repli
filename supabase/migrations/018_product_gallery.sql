-- =====================================================================
-- 018 - More than one photo of the same shirt
--
-- Migration 016 gave every product a picture, and that was enough to answer
-- "red wali dikhao". It is not enough to answer what customers actually
-- ask next, which is what the back looks like. A compression tee has the
-- web print across the chest and a second spider across the shoulders; one
-- photograph can show one of those and never both.
--
-- 016's columns stay exactly as they are:
--
--   products.image_path          still the design's photo
--   product_variants.image_path  still that one colour's photo
--
-- Neither is redefined and neither is dropped, because the single-photo
-- path is the fallback: a product with no gallery rows behaves today
-- exactly as it did yesterday. The gallery is read first and the column is
-- read when the gallery is empty.
--
-- Deliberately paths, never URLs - the same rule as 016. Each row holds
-- either a storage:bucket/key reference or a path under the bot's own root,
-- and the sending code resolves it to a file on disk before WhatsApp ever
-- sees it. Nothing here can become a link the shop did not write.
--
-- variant_id is nullable and means what it says: null is a photo of the
-- design whatever colour it is in, and a value is a photo of that one
-- colour. A customer who has already chosen Red is shown the Red rows when
-- there are any, and the design's own rows when there are not.
-- =====================================================================

create table if not exists product_images (
  id         bigserial   primary key,

  product_id uuid        not null references products(id) on delete cascade,

  -- null = a photo of the design in general. Set = this exact colour.
  variant_id uuid        references product_variants(id) on delete cascade,

  -- storage:bucket/key, or a path relative to the bot's root. Never a URL;
  -- the resolver refuses anything that parses as one.
  image_path text        not null,

  -- The order they are sent in. 1 is the photo to lead with - normally the
  -- front - because it is the one a customer sees first and often the only
  -- one they need.
  sort_order int         not null default 1,

  created_at timestamptz not null default now()
);

comment on table product_images is
  'Every photo of a product, in the order they should be sent. Empty for a product means fall back to products.image_path from migration 016.';

comment on column product_images.variant_id is
  'null: a photo of the design, any colour. Set: a photo of that one colour, preferred once the customer has chosen it.';

comment on column product_images.image_path is
  'storage:bucket/key in the private bucket, or a path under the bot root. Never a public URL - the sender resolves this to a local file first.';

comment on column product_images.sort_order is
  'Ascending. 1 is sent first and should be the front of the garment.';

-- How the bot reads it, every time: this product's rows, in order.
create index if not exists product_images_product_idx
  on product_images (product_id, sort_order);

-- The same photo twice in one gallery is always a mistake - usually an
-- upload run twice - and the customer would receive it twice.
--
-- A gallery is (product, colour), not just product: the front of the shirt
-- can legitimately be both the design's photo and the Red one's, and those
-- are never sent together because imagesFor() picks one set or the other.
-- variant_id is coalesced because a unique index does not treat two NULLs
-- as equal, which would let the design's own rows duplicate freely.
drop index if exists product_images_unique_idx;

create unique index if not exists product_images_gallery_unique_idx
  on product_images (
    product_id,
    coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid),
    image_path
  );

-- Same posture as every other table: RLS on, no policies, so anon and
-- authenticated can read nothing. The bot and the panel both reach it
-- through the service role, which bypasses RLS by design.
alter table product_images enable row level security;

revoke all on product_images from anon, authenticated;
