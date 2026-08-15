-- =====================================================================
-- Repli v1 - triggers, safe order-id generation and the atomic
-- payment-confirmation function.
-- =====================================================================

-- --------------------------------------------------- updated_at maintenance
create or replace function repli_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'customers','products','product_variants','orders','payments','conversations'
  ] loop
    execute format('drop trigger if exists set_updated_at on %I', t);
    execute format(
      'create trigger set_updated_at before update on %I
         for each row execute function repli_set_updated_at()', t);
  end loop;
end;
$$;

-- ------------------------------------------------------- order id sequence
-- A sequence can never hand out the same number twice, even if two customers
-- confirm at the same millisecond.
create sequence if not exists repli_order_seq start with 1001 increment by 1;

create or replace function next_order_id(p_prefix text default 'REP')
returns text
language sql
as $$
  select p_prefix || '-' || nextval('repli_order_seq')::text;
$$;

-- ------------------------------------------------ atomic payment confirmation
-- Everything /paid must do, in ONE transaction:
--   payment  -> VERIFIED
--   order    -> CONFIRMED
--   stock    -> decreased (never below zero)
--   customer -> HUMAN mode
-- If any step fails the whole thing rolls back: no half-confirmed orders.
create or replace function confirm_order_payment(
  p_order_id     text,
  p_admin_phone  text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order   orders%rowtype;
  v_item    record;
  v_before  integer;
  v_after   integer;
  v_short   boolean := false;
  v_moves   jsonb   := '[]'::jsonb;
begin
  -- lock the order so two admins tapping /paid cannot double-confirm
  select * into v_order from orders where order_id = upper(p_order_id) for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'NOT_FOUND');
  end if;
  if v_order.status = 'CONFIRMED' then
    return jsonb_build_object('ok', false, 'reason', 'ALREADY_CONFIRMED');
  end if;
  if v_order.status = 'CANCELLED' then
    return jsonb_build_object('ok', false, 'reason', 'CANCELLED');
  end if;

  -- stock comes down only here
  for v_item in
    select * from order_items where order_id = v_order.id
  loop
    if v_item.variant_id is not null then
      select stock_quantity into v_before
        from product_variants where id = v_item.variant_id for update;

      v_after := greatest(0, coalesce(v_before, 0) - v_item.quantity);
      if v_item.quantity > coalesce(v_before, 0) then
        v_short := true;
      end if;

      update product_variants
         set stock_quantity = v_after
       where id = v_item.variant_id;

      v_moves := v_moves || jsonb_build_object(
        'variant_id', v_item.variant_id,
        'product',    v_item.product_name_snapshot,
        'color',      v_item.color_snapshot,
        'size',       v_item.size_snapshot,
        'before',     coalesce(v_before, 0),
        'after',      v_after
      );
    end if;
  end loop;

  update payments
     set status      = 'VERIFIED',
         verified_by = p_admin_phone,
         verified_at = now()
   where order_id = v_order.id;

  update orders set status = 'CONFIRMED' where id = v_order.id;

  -- mandatory: after payment confirmation the customer belongs to a human
  update conversations
     set mode  = 'HUMAN',
         state = 'CONFIRMED'
   where phone = v_order.phone;

  return jsonb_build_object(
    'ok',       true,
    'order_id', v_order.order_id,
    'phone',    v_order.phone,
    'short',    v_short,
    'stock',    v_moves
  );
end;
$$;

-- --------------------------------------------------------- payment rejection
-- Stock is deliberately NOT touched here.
create or replace function reject_order_payment(
  p_order_id    text,
  p_admin_phone text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders%rowtype;
begin
  select * into v_order from orders where order_id = upper(p_order_id) for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'NOT_FOUND');
  end if;
  if v_order.status = 'CONFIRMED' then
    return jsonb_build_object('ok', false, 'reason', 'ALREADY_CONFIRMED');
  end if;

  update payments
     set status      = 'REJECTED',
         verified_by = p_admin_phone,
         verified_at = now()
   where order_id = v_order.id;

  update orders set status = 'PAYMENT_FAILED' where id = v_order.id;

  update conversations set mode = 'HUMAN' where phone = v_order.phone;

  return jsonb_build_object('ok', true, 'order_id', v_order.order_id, 'phone', v_order.phone);
end;
$$;
