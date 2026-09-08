-- ============================================================
-- 0008_security_advisor_fixes.sql
-- Menindaklanjuti temuan Supabase Security Advisor:
--   - function_search_path_mutable (WARN)
--   - public_bucket_allows_listing (WARN)
-- ============================================================

-- ------------------------------------------------------------
-- 1. Kunci search_path pada fungsi SECURITY DEFINER.
--
-- Tanpa search_path eksplisit, fungsi SECURITY DEFINER rentan
-- "search path hijacking": pemanggil yang bisa membuat objek di
-- schema lain berpotensi menyisipkan schema itu lebih dulu di
-- search_path sesi mereka, sehingga referensi tabel tak-terkualifikasi
-- di dalam fungsi (mis. `from coupons`, `insert into orders`) bisa
-- diarahkan ke tabel palsu buatan penyerang alih-alih public.coupons/
-- public.orders yang asli. Mengunci ke 'public, pg_temp' menutup celah
-- ini tanpa mengubah perilaku fungsi sama sekali.
-- ------------------------------------------------------------

create or replace function public.create_order(order_data jsonb)
returns orders
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
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
$function$;

create or replace function public.redeem_coupon(p_code text, p_original_price integer)
returns table(valid boolean, final_price integer, message text, discount_type text, discount_value integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
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
$function$;

create or replace function public.attach_payment_proof(p_order_id text, p_proof_url text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  update orders set payment_proof_url = p_proof_url where order_id = p_order_id;
end;
$function$;

-- ------------------------------------------------------------
-- 2. Cabut policy SELECT yang membolehkan listing penuh isi bucket.
--
-- Kedua bucket ini sudah diset public = true saat dibuat (lihat
-- 0004/0007), yang berarti akses baca per-objek lewat
-- /storage/v1/object/public/<bucket>/<path> SUDAH otomatis jalan
-- tanpa perlu policy SELECT apa pun di storage.objects — jalur itu
-- memang didesain Supabase untuk melewati RLS selama path-nya
-- sudah diketahui pemanggil (persis cara getPublicUrl() dipakai di
-- assets/js/supabase-client.js).
--
-- Policy SELECT broad yang ada sebelumnya (qual: bucket_id = 'x',
-- tanpa syarat lain) py tidak menambah kegunaan untuk itu — efek
-- SATU-SATUNYA adalah membuka storage.objects.list() /
-- GET /storage/v1/object/list/<bucket> sehingga SIAPA PUN bisa
-- enumerasi seluruh nama file di bucket. Untuk `payment-proofs`
-- ini berarti siapa pun bisa menjelajahi bukti transfer SELURUH
-- pelanggan, bukan cuma milik sendiri. Mencabut policy ini menutup
-- celah listing tanpa mematikan akses gambar via URL publik yang
-- memang dipakai situs.
-- ------------------------------------------------------------

drop policy if exists "payment_proofs_public_read" on storage.objects;
drop policy if exists "product_images_public_read" on storage.objects;
