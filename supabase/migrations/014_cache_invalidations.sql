-- =====================================================================
-- 014 - Cache invalidation, without Redis
--
-- The admin panel and the bot are different processes on different
-- machines: the panel on Vercel, the bot on a server. When the owner
-- changes a price the panel writes to Supabase, but the bot is holding a
-- cached copy and will keep quoting the old number until its timer lapses.
--
-- With REDIS_URL set that is solved by pub/sub and this table is never
-- touched. Without it there is still exactly one channel both sides can
-- reach - this database - so the panel appends a row saying WHICH key is
-- stale and the bot, which is already polling `outbound_messages` every
-- three seconds, picks it up on the same kind of loop.
--
-- Why not reuse an existing table:
--   * outbound_messages is a queue of things to SEND a customer. Putting
--     cache keys in it risks a bug turning an invalidation into a WhatsApp
--     message, which is not a risk worth taking to avoid one table.
--   * admin_actions already records every panel write, but its entity ids
--     are the wrong ones for this job (a stock change records the variant,
--     while the cache is keyed by product) and making cache correctness
--     depend on an audit trail means a change to logging silently breaks
--     the shop's prices.
--
-- Only ever appended to, and only ever read forward by id. Nothing here is
-- business data: the rows carry a cache key and nothing else, and they are
-- deleted once they are older than an hour.
-- =====================================================================

create table if not exists cache_invalidations (
  id         bigserial   primary key,

  -- The exact key to drop, e.g. 'repli:stock:3f2a…'. When is_prefix is true
  -- it is a family instead, e.g. 'repli:stock:' meaning every product.
  cache_key  text        not null,
  is_prefix  boolean     not null default false,

  -- Free text, for reading the log later: 'panel:product', 'panel:stock'.
  source     text,

  created_at timestamptz not null default now()
);

comment on table cache_invalidations is
  'Fallback invalidation channel, used when REDIS_URL is not configured. Append only; the bot reads forward by id and deletes rows older than an hour.';

comment on column cache_invalidations.is_prefix is
  'false: drop this one key. true: drop every key starting with it.';

-- The bot reads "everything newer than the last id I saw", and the cleanup
-- deletes by age.
create index if not exists cache_invalidations_created_idx
  on cache_invalidations (created_at);

-- Same posture as every other table: RLS on, no policies, so anon and
-- authenticated can read nothing. The bot and the panel both reach it
-- through the service role, which bypasses RLS by design.
alter table cache_invalidations enable row level security;

revoke all on cache_invalidations from anon, authenticated;
