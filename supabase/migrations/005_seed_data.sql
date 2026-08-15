-- =====================================================================
-- Repli v1 - starter catalogue (T-Shirt + Bag)
--
-- Safe to re-run: products are matched on `code` and variants on
-- product/colour/size, so re-running updates instead of duplicating.
-- Change prices and stock here, in the Supabase table editor, or with SQL.
-- =====================================================================

insert into products (code, name, description, emoji, price, active, sort_order)
values
  ('TS001',  'T-Shirt', 'Cotton round-neck t-shirt', '👕', 699,  true, 1),
  ('BAG001', 'Bag',     'Everyday carry bag',        '👜', 999,  true, 2)
on conflict (code) do update
  set name        = excluded.name,
      description = excluded.description,
      emoji       = excluded.emoji,
      sort_order  = excluded.sort_order;

-- T-Shirt variants -----------------------------------------------------
insert into product_variants (product_id, color, size, sku, stock_quantity)
select p.id, v.color, v.size, v.sku, v.qty
from products p
join (values
    ('Black', 'S',   'TS-BLK-S',    5),
    ('Black', 'M',   'TS-BLK-M',   10),
    ('Black', 'L',   'TS-BLK-L',    3),
    ('Black', 'XL',  'TS-BLK-XL',   4),
    ('Black', 'XXL', 'TS-BLK-XXL',  2),
    ('White', 'S',   'TS-WHT-S',    4),
    ('White', 'M',   'TS-WHT-M',    6),
    ('White', 'L',   'TS-WHT-L',    0),
    ('White', 'XL',  'TS-WHT-XL',   3),
    ('White', 'XXL', 'TS-WHT-XXL',  1)
  ) as v(color, size, sku, qty) on true
where p.code = 'TS001'
on conflict (product_id, coalesce(color, ''), coalesce(size, '')) do nothing;

-- Bag variant (no size) ------------------------------------------------
insert into product_variants (product_id, color, size, sku, stock_quantity)
select p.id, 'Black', null, 'BAG-BLK', 15
from products p
where p.code = 'BAG001'
on conflict (product_id, coalesce(color, ''), coalesce(size, '')) do nothing;

-- default runtime settings --------------------------------------------
insert into app_settings (key, value)
values ('bot_enabled', 'true')
on conflict (key) do nothing;
