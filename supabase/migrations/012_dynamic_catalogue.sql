-- =====================================================================
-- 012 - nothing about the catalogue lives in code any more
--
-- Until now the bot knew, in JavaScript, that "tshirt" and "tee" mean
-- T-shirts and that "spidey" means the Spider-Man design. That is fine until
-- the shop adds a product - and then it needs a developer, which is exactly
-- what the owner should not need.
--
-- After this migration:
--   * categories are rows, with their own label, emoji and the words
--     customers actually use for them;
--   * every product carries its own keywords;
--   * a new product added in the admin panel is understood by the bot
--     within seconds, with no deploy.
--
-- Also adds the SELECT_CATEGORY step, so the conversation is
-- greeting -> what are you looking for -> which design -> size.
-- =====================================================================

-- ---- categories -----------------------------------------------------

create table if not exists product_categories (
  key        text primary key,                 -- matches products.category
  label      text not null,                    -- "T-Shirts", shown to customers
  emoji      text,
  -- Words a customer might use. The bot matches on these, so adding a
  -- spelling here is how you teach it a new one.
  keywords   text[] not null default '{}',
  sort_order integer not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table product_categories enable row level security;
revoke all on product_categories from anon, authenticated;

insert into product_categories (key, label, emoji, keywords, sort_order) values
  ('tshirt', 'T-Shirts', '👕',
   array['tshirt','tshirts','t shirt','t shirts','shirt','shirts','tee','tees','tisht','टीशर्ट','टी शर्ट'], 1),
  ('hoodie', 'Hoodies', '🧥',
   array['hoodie','hoodies','hood','hoody','sweatshirt','jacket','हुडी'], 2),
  ('bag', 'Bags', '🎒',
   array['bag','bags','baig','jhola','backpack','purse','बैग','झोला'], 3)
on conflict (key) do nothing;

-- ---- per-product keywords -------------------------------------------

alter table products add column if not exists keywords text[] not null default '{}';

comment on column products.keywords is
  'Extra spellings customers use for this design. The bot matches these in '
  'addition to the product name, so a new product is understood without a deploy.';

update products set keywords = array['spiderman','spider man','spider','spidey','lal wali','red wali']
 where code = 'AES-TS-SPIDER' and keywords = '{}';

update products set keywords = array['venom','vennom','kala wala','black wali']
 where code = 'AES-TS-VENOM' and keywords = '{}';

update products set keywords = array['bape single','single hood','single hoodie']
 where code = 'AES-HD-BAPE-S' and keywords = '{}';

update products set keywords = array['bape double','double hood','double hoodie']
 where code = 'AES-HD-BAPE-D' and keywords = '{}';

-- ---- the new conversation step --------------------------------------
--
-- The check constraint has to be replaced, not extended: Postgres has no
-- "add a value to this check". Dropped and recreated with the extra state.

alter table conversations drop constraint if exists conversations_state_check;

alter table conversations add constraint conversations_state_check
  check (state in ('START','SELECT_CATEGORY','SELECT_PRODUCT','SELECT_COLOR','SELECT_SIZE',
                   'SELECT_QUANTITY','COLLECT_DETAILS','ORDER_SUMMARY',
                   'WAITING_FOR_PAYMENT','PAYMENT_VERIFYING','CONFIRMED',
                   'HUMAN_HANDOFF','CANCELLED'));

-- ---- the shop's own name, for the greeting --------------------------

insert into app_settings (key, value) values
  ('greeting_brands', 'AESTHURA & 3POINTER.CLUB')
on conflict (key) do nothing;
