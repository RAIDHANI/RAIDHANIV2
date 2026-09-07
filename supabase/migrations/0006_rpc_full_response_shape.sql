-- ============================================================
-- 0006_rpc_full_response_shape.sql
-- Menyamakan bentuk respons redeem_coupon & create_order dengan
-- yang sudah dipakai frontend (assets/js/supabase-client.js mode
-- lokal, assets/js/state.js) — ditemukan saat menyambungkan
-- Supabase asli bahwa versi awal di 0001_init.sql kurang lengkap:
--   - redeem_coupon hanya balas {valid, final_price, message},
--     padahal state.js butuh discount_type & discount_value untuk
--     menghitung ulang total saat checkout multi-item dari keranjang.
--   - create_order hanya balas order_id (text), padahal frontend
--     langsung memakai objek order penuh untuk mengisi Tahap 2
--     checkout & pesan konfirmasi WhatsApp.
-- ============================================================

drop function if exists redeem_coupon(text, integer);

create or replace function redeem_coupon(p_code text, p_original_price integer)
returns table(
  valid boolean,
  final_price integer,
  message text,
  discount_type text,
  discount_value integer
)
language plpgsql
security definer as $$
declare
  c coupons%rowtype;
begin
  select * into c from coupons where code = upper(p_code) for update;
  if not found then
    return query select false, p_original_price, 'Kode kupon tidak ditemukan.', null::text, null::integer;
    return;
  end if;
  if not c.is_active then
    return query select false, p_original_price, 'Kupon sudah tidak aktif.', null::text, null::integer;
    return;
  end if;
  if now() < c.valid_from or now() > c.valid_until then
    return query select false, p_original_price, 'Kupon di luar masa berlaku.', null::text, null::integer;
    return;
  end if;
  if c.quota_used >= c.quota_max then
    return query select false, p_original_price, 'Kuota kupon telah habis terpakai.', null::text, null::integer;
    return;
  end if;

  update coupons set quota_used = quota_used + 1 where code = c.code;

  if c.discount_type = 'fixed_price' then
    return query select true, c.discount_value, 'Kupon berhasil diterapkan!', c.discount_type, c.discount_value;
  else
    return query select true, greatest(p_original_price - c.discount_value, 0), 'Kupon berhasil diterapkan!', c.discount_type, c.discount_value;
  end if;
end;
$$;

grant execute on function redeem_coupon(text, integer) to anon, authenticated;

-- --------------------------------------------------------------
drop function if exists create_order(jsonb);

create or replace function create_order(order_data jsonb)
returns orders
language plpgsql
security definer as $$
declare
  new_id text;
  result orders;
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
  ) values (
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
    (order_data->>'consent_pdp')::boolean
  )
  returning * into result;

  return result;
end;
$$;

grant execute on function create_order(jsonb) to anon, authenticated;
