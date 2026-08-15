-- =====================================================================
-- Repli v1 - indexes for the queries the bot runs on every message
--
-- Note: customers.phone, conversations.phone, orders.order_id,
-- product_variants.sku and bypass_numbers.phone already have unique
-- indexes from their UNIQUE constraints in 001. The ones below cover the
-- remaining lookups (and messages.message_id, which is only unique for
-- INCOMING rows via a partial index).
-- =====================================================================

-- every incoming message: "have I already processed this id?"
create index if not exists idx_messages_message_id on messages (message_id);
create index if not exists idx_messages_phone_time on messages (phone, created_at desc);

-- order lookups
create index if not exists idx_orders_customer_id on orders (customer_id);
create index if not exists idx_orders_phone       on orders (phone);
create index if not exists idx_orders_status      on orders (status);
create index if not exists idx_orders_created_at  on orders (created_at desc);
-- "the open order for this customer" - the hottest order query in the flow
create index if not exists idx_orders_phone_open
  on orders (phone, created_at desc)
  where status in ('PENDING_PAYMENT', 'PAYMENT_VERIFYING');

create index if not exists idx_order_items_order_id on order_items (order_id);
create index if not exists idx_order_items_variant  on order_items (variant_id);

create index if not exists idx_payments_order_id on payments (order_id);
create index if not exists idx_payments_status   on payments (status);

-- catalogue: active products and their variants
create index if not exists idx_products_active on products (active, sort_order);
create index if not exists idx_variants_product on product_variants (product_id);
create index if not exists idx_variants_in_stock
  on product_variants (product_id)
  where active = true and stock_quantity > 0;

-- access control lists
create index if not exists idx_bypass_active on bypass_numbers (phone) where active = true;
create index if not exists idx_admin_active  on admin_numbers (phone)  where active = true;

create index if not exists idx_conversations_customer on conversations (customer_id);
create index if not exists idx_conversations_mode     on conversations (mode);
