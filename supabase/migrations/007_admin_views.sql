-- =====================================================================
-- Repli v1 - read models for the admin panel
--
-- "Last message per thread", "unread count" and "orders + money per
-- customer" are group-by questions. Doing them in SQL keeps the panel to one
-- paginated query per page instead of fetching rows and counting in JS.
--
-- security_invoker = true: the view runs with the caller's privileges, so it
-- can never become a hole around the RLS rules in 004_rls.sql. The panel
-- reads it with the secret key (which bypasses RLS by design); anon and
-- authenticated are revoked below and get nothing.
-- =====================================================================

-- ---------------------------------------------------------- admin_inbox
-- One row per conversation: who it is, what the last message was, how many
-- incoming messages arrived since the owner last opened the chat.
create or replace view admin_inbox
with (security_invoker = true) as
select
  c.id                       as conversation_id,
  c.phone                    as phone,
  c.mode                     as mode,
  c.state                    as state,
  c.last_read_at             as last_read_at,
  cu.id                      as customer_id,
  cu.name                    as name,
  cu.city                    as city,
  lm.text                    as last_message_text,
  lm.message_type            as last_message_type,
  lm.direction               as last_message_direction,
  coalesce(lm.created_at, c.updated_at) as last_message_at,
  coalesce(un.unread_count, 0)          as unread_count
from conversations c
left join customers cu
  on cu.phone = c.phone
left join lateral (
  select m.text, m.direction, m.message_type, m.created_at
    from messages m
   where m.phone = c.phone
   order by m.created_at desc
   limit 1
) lm on true
left join lateral (
  select count(*)::int as unread_count
    from messages m
   where m.phone = c.phone
     and m.direction = 'INCOMING'
     and (c.last_read_at is null or m.created_at > c.last_read_at)
) un on true;

comment on view admin_inbox is
  'WhatsApp-style inbox for /admin/messages. Ordered by last_message_at in the panel.';

-- ------------------------------------------------------ admin_customers
-- The CRM row: profile + mode + order totals + last message, in one place.
create or replace view admin_customers
with (security_invoker = true) as
select
  cu.id,
  cu.phone,
  cu.name,
  cu.address,
  cu.city,
  cu.state,
  cu.pin,
  cu.created_at,
  cu.updated_at,
  coalesce(c.mode, 'BOT')     as mode,
  c.state                     as conversation_state,
  c.id                        as conversation_id,
  coalesce(o.orders_count, 0) as orders_count,
  coalesce(o.total_spent, 0)  as total_spent,
  lm.text                     as last_message_text,
  lm.created_at               as last_message_at,
  coalesce(un.unread_count, 0) as unread_count
from customers cu
left join conversations c
  on c.phone = cu.phone
left join lateral (
  select count(*)::int as orders_count,
         coalesce(sum(o.total) filter (where o.status = 'CONFIRMED'), 0) as total_spent
    from orders o
   where o.phone = cu.phone
) o on true
left join lateral (
  select m.text, m.created_at
    from messages m
   where m.phone = cu.phone
   order by m.created_at desc
   limit 1
) lm on true
left join lateral (
  select count(*)::int as unread_count
    from messages m
   where m.phone = cu.phone
     and m.direction = 'INCOMING'
     and (c.last_read_at is null or m.created_at > c.last_read_at)
) un on true;

comment on view admin_customers is
  'CRM read model for /admin/customers. total_spent counts CONFIRMED orders only - unpaid carts are not revenue.';

-- --------------------------------------------------------------- lockdown
-- Supabase grants new objects in `public` to anon/authenticated by default.
-- Undo that: these views are for the secret key only.
revoke all on admin_inbox     from anon, authenticated, public;
revoke all on admin_customers from anon, authenticated, public;
