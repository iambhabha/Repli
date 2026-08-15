-- =====================================================================
-- Repli v1 - admin panel support
--
-- Everything the Next.js Admin Panel needs that the bot alone did not:
--   admin_users        who is allowed to log into the panel (email allowlist)
--   admin_actions      audit log of every action taken from the panel
--   outbound_messages  queue: panel writes, the bot sends over WhatsApp
--   conversations.last_read_at   unread badge in the inbox
--   realtime publication so the panel can subscribe to live changes
--
-- Safe to re-run: everything is IF NOT EXISTS / idempotent.
-- =====================================================================

-- -------------------------------------------------------------- admin_users
-- The panel authenticates with Supabase Auth. Being able to log in is NOT
-- enough: the email must also exist here and be active. Checked server-side
-- on every request, never in the browser.
create table if not exists admin_users (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  name       text,
  phone      text,                         -- optional: links a panel admin to
                                           -- their WhatsApp admin number
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table admin_users is
  'Email allowlist for the Next.js admin panel. A Supabase Auth user with no active row here is rejected server-side.';

create unique index if not exists admin_users_email_lower
  on admin_users (lower(email));

-- ------------------------------------------------------------ admin_actions
-- Audit log. Written by the panel (and by /paid from WhatsApp) for every
-- action that changes money, stock or bot behaviour.
create table if not exists admin_actions (
  id          uuid primary key default gen_random_uuid(),
  actor       text not null,               -- admin email or WhatsApp number
  actor_type  text not null default 'PANEL'
              check (actor_type in ('PANEL','WHATSAPP','SYSTEM')),
  action      text not null,               -- PAYMENT_VERIFIED, STOCK_CHANGED, ...
  entity_type text,                        -- order / product / variant / ...
  entity_id   text,                        -- REP-1024, uuid, phone number
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists admin_actions_created_idx on admin_actions (created_at desc);
create index if not exists admin_actions_entity_idx  on admin_actions (entity_type, entity_id);

comment on table admin_actions is
  'Append-only audit trail. Never updated or deleted by the application.';

-- -------------------------------------------------------- outbound_messages
-- The panel runs on Vercel; WhatsApp runs on the owner''s machine inside the
-- bot process. The panel therefore never talks to WhatsApp directly - it
-- queues a row here and the bot''s outbox worker sends it and records the
-- message in `messages`.
create table if not exists outbound_messages (
  id           uuid primary key default gen_random_uuid(),
  phone        text not null,
  text         text not null,
  status       text not null default 'PENDING'
               check (status in ('PENDING','SENT','FAILED')),
  attempts     integer not null default 0,
  error        text,
  requested_by text,                       -- admin email
  sent_at      timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists outbound_messages_pending_idx
  on outbound_messages (created_at)
  where status = 'PENDING';

comment on table outbound_messages is
  'Admin -> WhatsApp queue. Only the bot process drains it; the panel never speaks the WhatsApp protocol.';

drop trigger if exists set_updated_at on outbound_messages;
create trigger set_updated_at before update on outbound_messages
  for each row execute function repli_set_updated_at();

drop trigger if exists set_updated_at on admin_users;
create trigger set_updated_at before update on admin_users
  for each row execute function repli_set_updated_at();

-- ------------------------------------------------- conversations.last_read_at
-- Unread badge: an INCOMING message newer than last_read_at is unread.
alter table conversations
  add column if not exists last_read_at timestamptz;

comment on column conversations.last_read_at is
  'Set by the admin panel when the owner opens a chat. Unread = INCOMING messages newer than this.';

-- ----------------------------------------------------------------- indexes
create index if not exists messages_phone_created_idx on messages (phone, created_at desc);
create index if not exists payments_status_idx        on payments (status);
create index if not exists orders_status_created_idx  on orders (status, created_at desc);
create index if not exists variants_stock_idx         on product_variants (stock_quantity);

-- ---------------------------------------------------------------- defaults
insert into app_settings (key, value)
values
  ('business_name',       'Repli'),
  ('payment_link',        ''),
  ('shipping_charge',     '0'),
  ('low_stock_threshold', '3')
on conflict (key) do nothing;

-- --------------------------------------------------------------------- RLS
-- Same rule as 004_rls.sql: RLS on, no policies. Only the secret key gets in,
-- and the secret key only ever lives on the server.
alter table admin_users       enable row level security;
alter table admin_actions     enable row level security;
alter table outbound_messages enable row level security;

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

-- ---------------------------------------------------------------- realtime
-- The panel's live updates come from a server-side subscription (secret key),
-- so these tables must be part of the realtime publication.
do $$
declare t text;
begin
  foreach t in array array[
    'messages','orders','payments','product_variants','conversations',
    'customers','app_settings'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
exception
  when undefined_object then
    raise notice 'publication supabase_realtime not found - skipping realtime setup';
end;
$$;
