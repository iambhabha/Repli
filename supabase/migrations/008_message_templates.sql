-- =====================================================================
-- Repli v1 - editable bot messages
--
-- Every customer-facing sentence, editable by the owner from the admin
-- panel instead of by a developer in messages.js.
--
-- Defaults still live in code (src/bot/templates.js) and are copied in on
-- startup for any row that does not exist yet. An existing row is NEVER
-- overwritten - the owner's wording always wins, and `default_body` keeps
-- the original around so "Reset" can put it back.
--
-- Safe to re-run.
-- =====================================================================

create table if not exists message_templates (
  key          text not null,
  language     text not null default 'hi' check (language in ('hi', 'en')),
  body         text not null,
  default_body text not null,
  label        text not null,
  description  text,
  placeholders text[] not null default '{}',
  category     text not null default 'general',
  sort_order   integer not null default 0,
  updated_at   timestamptz not null default now(),
  primary key (key, language)
);

comment on table message_templates is
  'Customer-facing bot messages, one row per key+language. The bot reads body; default_body is what Reset restores.';
comment on column message_templates.placeholders is
  'Which {{variables}} this message may use. The panel shows them; unknown ones are left as-is rather than blanked.';

create index if not exists message_templates_category_idx
  on message_templates (category, sort_order);

drop trigger if exists set_updated_at on message_templates;
create trigger set_updated_at before update on message_templates
  for each row execute function repli_set_updated_at();

-- Same lockdown as everything else: secret key only.
alter table message_templates enable row level security;
revoke all on message_templates from anon, authenticated, public;
