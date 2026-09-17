-- ============================================================
-- 0012_public_featured_coupon.sql
--
-- Bug: promo banner & voucher strip di landing page (index.html)
-- sebelumnya HARDCODE kode kupon "RAIDHANI100K" langsung di HTML,
-- jadi tidak pernah ikut berubah walau admin membuat kupon baru.
-- Setelah dibuat dinamis (assets/js/state.js), storefront tetap
-- tidak bisa menampilkan kupon manapun karena tabel `coupons` sengaja
-- tidak punya policy SELECT publik (lihat komentar di
-- 0010_admin_claim_and_rls_perf.sql: "customer akses lewat RPC
-- SECURITY DEFINER") — anon select selalu balas 0 baris tanpa error.
--
-- Perbaikan: RPC publik khusus, mengikuti pola redeem_coupon, yang
-- HANYA membocorkan kolom yang memang aman ditampilkan ke publik
-- (code, tipe & nilai diskon) untuk satu kupon yang paling baru dibuat
-- dan benar-benar masih bisa diklaim — bukan seluruh isi tabel
-- (kuota terpakai, tanggal, kupon non-aktif lain, dll tetap privat).
-- ============================================================

create or replace function public.get_featured_coupon()
returns table(code text, discount_type text, discount_value integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select code, discount_type, discount_value
  from coupons
  where is_active
    and now() between valid_from and valid_until
    and quota_used < quota_max
  order by created_at desc
  limit 1;
$$;

revoke execute on function public.get_featured_coupon() from public;
grant execute on function public.get_featured_coupon() to anon, authenticated;
