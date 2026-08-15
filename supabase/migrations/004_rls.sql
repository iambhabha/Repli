-- =====================================================================
-- Repli v1 - Row Level Security
--
-- Repli is a server-side bot. It talks to Supabase with the SECRET
-- (service-role) key, which bypasses RLS by design.
--
-- Nothing else should ever read this data, so every table gets RLS
-- enabled with NO policies = deny everything for anon/authenticated.
-- That way, if the publishable key ever leaks or ends up in a browser,
-- customer addresses, orders and payment proofs stay unreadable.
-- =====================================================================

alter table customers        enable row level security;
alter table products         enable row level security;
alter table product_variants enable row level security;
alter table orders           enable row level security;
alter table order_items      enable row level security;
alter table payments         enable row level security;
alter table conversations    enable row level security;
alter table messages         enable row level security;
alter table bypass_numbers   enable row level security;
alter table admin_numbers    enable row level security;
alter table app_settings     enable row level security;

-- belt and braces: no table privileges for the public API roles either
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

-- the payment functions must only ever be called by the bot (service role)
revoke all on function confirm_order_payment(text, text) from public, anon, authenticated;
revoke all on function reject_order_payment(text, text)  from public, anon, authenticated;

-- If you later build a customer-facing web page, do NOT loosen this file.
-- Add a narrow policy for exactly the rows that page needs instead, e.g.:
--
--   create policy "public may read active products"
--     on products for select to anon
--     using (active = true);
