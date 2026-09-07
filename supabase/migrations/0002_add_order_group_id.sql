-- ============================================================
-- 0002_add_order_group_id.sql: Dukungan Checkout Multi-Produk
-- Satu transaksi keranjang bisa menghasilkan >1 baris order,
-- dikelompokkan lewat order_group_id agar tetap bisa ditelusuri
-- sebagai satu pembayaran oleh customer.
-- ============================================================

alter table orders add column if not exists order_group_id text;

update orders set order_group_id = order_id where order_group_id is null;

create index if not exists idx_orders_order_group_id on orders (order_group_id);

-- ============================================================
-- Perbarui create_order agar menyimpan order_group_id
-- (default ke order_id sendiri jika tidak dikirim, untuk order tunggal)
-- ============================================================
create or replace function create_order(order_data jsonb)
returns text
language plpgsql
security definer as $$
declare
  new_id text;
begin
  new_id := 'RDH-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('order_seq')::text, 4, '0');

  insert into orders (
    order_id,
    order_group_id,
    product_id,
    product_name,
    color,
    size,
    qty,
    unit_price,
    total_price,
    coupon_code,
    buyer_name,
    buyer_whatsapp,
    buyer_address,
    buyer_city_district,
    buyer_postal_code,
    buyer_notes,
    consent_pdp
  ) select
    new_id,
    coalesce(order_data->>'order_group_id', new_id),
    order_data->>'product_id',
    order_data->>'product_name',
    order_data->>'color',
    order_data->>'size',
    coalesce((order_data->>'qty')::integer, 1),
    (order_data->>'unit_price')::integer,
    (order_data->>'total_price')::integer,
    order_data->>'coupon_code',
    order_data->>'buyer_name',
    order_data->>'buyer_whatsapp',
    order_data->>'buyer_address',
    order_data->>'buyer_city_district',
    order_data->>'buyer_postal_code',
    order_data->>'buyer_notes',
    (order_data->>'consent_pdp')::boolean;

  return new_id;
end;
$$;
