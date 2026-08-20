-- =====================================================================
-- 015 - AI usage, in enough detail to act on
--
-- `ai_usage` already answered "how much did the model cost this month".
-- It could not answer the two questions that actually drive the bill:
--
--   WHICH kind of call?   Every call except the rewriter logged itself as
--                         'understand' - reading an intent, picking an
--                         option, detecting a language and composing a whole
--                         reply all shared one label, so "we cut the number
--                         of calls" was not a measurable claim.
--
--   Was it USED?          A reply the guards rejected costs exactly as much
--                         as one that reached the customer. Without a reason
--                         column, a model quietly failing verification looks
--                         identical to one working perfectly.
--
-- Both are additive. Existing rows keep their old 'understand' label and a
-- null latency; nothing is rewritten.
-- =====================================================================

alter table ai_usage add column if not exists latency_ms  integer;
alter table ai_usage add column if not exists fallback_reason text;

comment on column ai_usage.purpose is
  'What the call was for: language | intent | understand | reply | converse | humanise. Rows written before migration 015 use ''understand'' for all of the first four.';

comment on column ai_usage.latency_ms is
  'Wall clock for the request, including the customer waiting on WhatsApp.';

comment on column ai_usage.fallback_reason is
  'Null when the output was sent. Otherwise why it was discarded and a template was sent instead - the model was paid for either way.';

-- "What did each kind of call cost, and how often was it thrown away."
create index if not exists ai_usage_purpose_created_idx
  on ai_usage (purpose, created_at desc);
