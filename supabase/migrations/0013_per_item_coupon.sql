-- ============================================================
-- 0013_per_item_coupon.sql
--
-- Fitur: kupon "kelipatan per jumlah pesanan" — discount_type baru
-- 'per_item_amount', di mana discount_value dikalikan qty barang
-- dalam satu checkout (beli 1 pcs = potongan 1x, beli 3 pcs = 3x).
-- Opt-in per kupon (admin pilih lewat toggle saat membuat kupon),
-- kupon lama (fixed_amount / fixed_price) tidak terpengaruh sama
-- sekali. Kuota (quota_used) tetap +1 per checkout, bukan per qty.
--
-- redeem_coupon perlu tahu qty, jadi signature-nya berubah dari
-- (text, integer) -> (text, integer, integer). Drop dulu signature
-- lama karena daftar parameternya beda (create or replace hanya bisa
-- menimpa fungsi dengan signature persis sama).
-- ============================================================

drop function if exists public.redeem_coupon(text, integer);

create or replace function public.redeem_coupon(p_code text, p_original_price integer, p_qty integer default 1)
returns table(valid boolean, final_price integer, message text, discount_type text, discount_value integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  c coupons%rowtype;
  effective_qty integer := greatest(coalesce(p_qty, 1), 1);
  effective_discount integer;
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
  elsif c.discount_type = 'per_item_amount' then
    effective_discount := c.discount_value * effective_qty;
    return query select true, greatest(p_original_price - effective_discount, 0),
      format('Kupon ''%s'' diterapkan untuk %s pcs: potongan Rp %s!', c.code, effective_qty, to_char(effective_discount, 'FM999G999G999')),
      c.discount_type, effective_discount;
  else
    return query select true, greatest(p_original_price - c.discount_value, 0), 'Kupon berhasil diterapkan!', c.discount_type, c.discount_value;
  end if;
end;
$function$;

revoke execute on function public.redeem_coupon(text, integer, integer) from public;
grant execute on function public.redeem_coupon(text, integer, integer) to anon, authenticated;
