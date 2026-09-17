-- ============================================================
-- 0014_fix_per_item_coupon_message.sql
--
-- Fix: pesan redeem_coupon untuk discount_type 'per_item_amount'
-- (ditambahkan di 0013) memakai to_char(..., 'FM999G999G999') yang
-- separator ribuannya ikut locale server (koma, gaya Inggris) —
-- ketahuan lewat tes langsung ke RPC live: hasilnya "Rp 50,000"
-- padahal seluruh situs ini pakai format Indonesia "Rp 50.000".
-- Semua pesan redeem_coupon lain (fixed_amount/fixed_price) memang
-- sengaja TIDAK menyisipkan nominal berformat di dalam SQL sama
-- sekali — nominalnya ditampilkan oleh client lewat discount_value
-- (assets/js/*.js sudah pakai toLocaleString('id-ID') yang benar).
-- Ikuti pola yang sama: sebut jumlah pcs saja, tanpa nominal, biar
-- tidak ada lagi angka yang salah format datang dari SQL.
-- ============================================================

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
      format('Kupon ''%s'' diterapkan untuk %s pcs!', c.code, effective_qty),
      c.discount_type, effective_discount;
  else
    return query select true, greatest(p_original_price - c.discount_value, 0), 'Kupon berhasil diterapkan!', c.discount_type, c.discount_value;
  end if;
end;
$function$;
