-- =====================================================================
-- Repli v1 - initial schema
-- Run this first (Supabase → SQL Editor → New query → paste → Run),
-- or use:  npm run migrate
-- Safe to re-run: everything is IF NOT EXISTS / idempotent.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- customers
create table if not exists customers (
  id         uuid primary key default gen_random_uuid(),
  phone      text not null unique,          -- always normalised: 919876543210
  name       text,
  address    text,
  city       text,
  state      text,
  pin        text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column customers.phone is
  'Normalised digits with country code. +91 98765 43210 / 09876543210 / 9876543210 all become 919876543210, so one human = one row.';

-- ----------------------------------------------------------------- products
create table if not exists products (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,         -- stable business key: TS001, BAG001
  name        text not null,
  description text,
  emoji       text,
  price       numeric(10,2) not null default 0 check (price >= 0),
  active      boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- --------------------------------------------------------- product_variants
create table if not exists product_variants (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references products (id) on delete cascade,
  color          text,
  size           text,                      -- NULL for products without sizes (Bag)
  sku            text unique,
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- one row per product/colour/size (NULLs must not create duplicates)
create unique index if not exists product_variants_combo_unique
  on product_variants (product_id, coalesce(color, ''), coalesce(size, ''));

comment on column product_variants.stock_quantity is
  'Only ever decreased by confirm_order_payment(), i.e. after a human verified the payment.';

-- ------------------------------------------------------------------- orders
create table if not exists orders (
  id            uuid primary key default gen_random_uuid(),
  order_id      text not null unique,       -- REP-1001
  customer_id   uuid references customers (id) on delete set null,
  phone         text not null,
  status        text not null default 'PENDING_PAYMENT'
                check (status in ('PENDING_PAYMENT','PAYMENT_VERIFYING','CONFIRMED',
                                  'CANCELLED','PAYMENT_FAILED')),
  -- delivery snapshot: the address as it was when the order was placed
  customer_name text,
  address       text,
  city          text,
  state         text,
  pin           text,
  subtotal      numeric(10,2) not null default 0,
  shipping      numeric(10,2) not null default 0,
  total         numeric(10,2) not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- -------------------------------------------------------------- order_items
create table if not exists order_items (
  id                    uuid primary key default gen_random_uuid(),
  order_id              uuid not null references orders (id) on delete cascade,
  product_id            uuid references products (id) on delete set null,
  variant_id            uuid references product_variants (id) on delete set null,
  product_name_snapshot text not null,
  color_snapshot        text,
  size_snapshot         text,
  unit_price            numeric(10,2) not null,
  quantity              integer not null check (quantity > 0),
  subtotal              numeric(10,2) not null,
  created_at            timestamptz not null default now()
);

comment on table order_items is
  'Snapshots name/colour/size/price so a later price change never rewrites an old order.';

-- ----------------------------------------------------------------- payments
create table if not exists payments (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references orders (id) on delete cascade,
  amount      numeric(10,2) not null default 0,
  status      text not null default 'PENDING'
              check (status in ('PENDING','PROOF_RECEIVED','VERIFIED','REJECTED')),
  proof_url   text,
  verified_by text,
  verified_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ------------------------------------------------------------ conversations
create table if not exists conversations (
  id                  uuid primary key default gen_random_uuid(),
  customer_id         uuid references customers (id) on delete cascade,
  phone               text not null unique,
  state               text not null default 'START'
                      check (state in ('START','SELECT_PRODUCT','SELECT_COLOR','SELECT_SIZE',
                                       'SELECT_QUANTITY','COLLECT_DETAILS','ORDER_SUMMARY',
                                       'WAITING_FOR_PAYMENT','PAYMENT_VERIFYING','CONFIRMED',
                                       'HUMAN_HANDOFF','CANCELLED')),
  mode                text not null default 'BOT' check (mode in ('BOT','HUMAN')),
  selected_product_id uuid references products (id) on delete set null,
  selected_variant_id uuid references product_variants (id) on delete set null,
  quantity            integer,
  current_order_id    uuid references orders (id) on delete set null,
  data                jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on column conversations.mode is
  'HUMAN = a person took over. Repli must stay completely silent for this number.';
comment on column conversations.data is
  'Small scratch pad for the flow: which detail field is being collected, the address draft, a capped-quantity offer.';

-- ----------------------------------------------------------------- messages
create table if not exists messages (
  id           uuid primary key default gen_random_uuid(),
  message_id   text,                        -- WhatsApp id (NULL for outgoing)
  phone        text not null,
  direction    text not null check (direction in ('INCOMING','OUTGOING')),
  message_type text not null default 'text',
  text         text,
  media_url    text,
  created_at   timestamptz not null default now()
);

-- duplicate protection: one incoming row per WhatsApp message id
create unique index if not exists messages_incoming_unique
  on messages (message_id)
  where direction = 'INCOMING' and message_id is not null;

-- ----------------------------------------------------------- bypass_numbers
create table if not exists bypass_numbers (
  id         uuid primary key default gen_random_uuid(),
  phone      text not null unique,
  name       text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table bypass_numbers is
  'Personal / family / friend numbers. Repli NEVER replies to an active row here.';

-- ------------------------------------------------------------ admin_numbers
create table if not exists admin_numbers (
  id         uuid primary key default gen_random_uuid(),
  phone      text not null unique,
  name       text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------- app_settings
create table if not exists app_settings (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);

comment on table app_settings is
  'Runtime switches the admin can flip from WhatsApp, e.g. bot_enabled (/bot on|off).';
