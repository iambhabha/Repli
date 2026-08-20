-- =====================================================================
-- 009 - AI usage accounting
--
-- Every model call is written here, successful or not. Two reasons:
--   1. the monthly budget cap is computed from this table, so an unnoticed
--      loop cannot quietly spend the owner's money;
--   2. when the bill looks wrong, "which calls, for whom, how many tokens"
--      is answerable instead of guessable.
--
-- Cost is stored in USD because that is what OpenAI bills; rupees are a
-- display conversion done in the app with AI_USD_TO_INR.
-- =====================================================================

create table if not exists ai_usage (
  id            bigserial primary key,
  created_at    timestamptz not null default now(),

  -- 'humanise' (rewrite an outgoing reply) or 'understand' (read a message
  -- the rule parser could not).
  purpose       text        not null,
  model         text        not null,

  input_tokens  integer     not null default 0,
  output_tokens integer     not null default 0,
  cost_usd      numeric(12, 6) not null default 0,

  -- Which conversation it belonged to. Nullable: some calls are not tied to
  -- a customer. No message text is stored here - this table is for money.
  phone         text,

  ok            boolean     not null default true,
  error         text
);

create index if not exists ai_usage_created_idx on ai_usage (created_at desc);
create index if not exists ai_usage_purpose_idx on ai_usage (purpose, created_at desc);

-- Same posture as every other table: RLS on, no policies, so anon and
-- authenticated can read nothing. The bot and the panel both reach it
-- through the service role, which bypasses RLS by design.
alter table ai_usage enable row level security;

revoke all on ai_usage from anon, authenticated;
