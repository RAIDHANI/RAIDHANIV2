-- ============================================================
-- 0010_admin_claim_and_rls_perf.sql
--
-- CELAH KEAMANAN: products_admin_all / coupons_admin_all /
-- orders_admin_all / sync_failures_admin_all sebelumnya memakai
-- `auth.role() = 'authenticated'` — yaitu "siapa saja yang sudah
-- login", tanpa beda antara staf admin dan customer biasa. Sejak
-- login customer diganti ke Google Sign-In asli (lihat
-- assets/js/auth.js, migrasi 0009), SETIAP customer yang login di
-- storefront otomatis punya akses baca/tulis PENUH ke tabel orders
-- (nama, WA, alamat, bukti transfer semua pembeli), coupons, dan
-- products lewat REST API langsung — terbukti lewat query
-- auth.users: akun customer google (fajrinfaturrahman17@gmail.com)
-- dan akun staf (raidhani2025@gmail.com) sama-sama berstatus
-- `authenticated`.
--
-- Perbaikan: tandai akun staf lewat `raw_app_meta_data.is_admin`
-- (field ini HANYA bisa diubah lewat koneksi service_role/SQL —
-- customer tidak bisa mengubah app_metadata miliknya sendiri lewat
-- API publik manapun), lalu policy admin memeriksa klaim itu, bukan
-- sekadar status login.
--
-- Sekalian membereskan 2 warning Performance Advisor:
-- - auth_rls_initplan: bungkus auth.<fn>() dengan `(select ...)`
--   supaya dievaluasi sekali per query, bukan per baris.
-- - multiple_permissive_policies: gabungkan policy SELECT di
--   `products` (public_read + admin_all) jadi satu policy.
-- ============================================================

-- 1) Tandai akun staf sebagai admin lewat app_metadata.
--    Untuk menambah staf baru nanti, jalankan UPDATE serupa dengan
--    email akun staf yang baru dibuat di Supabase Dashboard.
update auth.users
set raw_app_meta_data = raw_app_meta_data || jsonb_build_object('is_admin', true)
where email = 'raidhani2025@gmail.com';

-- 2) Helper function: baca klaim is_admin dari JWT sesi yang aktif.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false);
$$;

revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

-- 3) Products: satu policy SELECT gabungan (baca publik ATAU admin),
--    plus policy terpisah untuk insert/update/delete khusus admin.
--    Dipisah per-aksi (bukan "for all") supaya SELECT tidak dobel
--    dievaluasi oleh dua policy permissive sekaligus.
drop policy if exists "products_public_read" on products;
drop policy if exists "products_admin_all" on products;

create policy "products_select" on products
  for select using (is_published = true or (select public.is_admin()));

create policy "products_admin_insert" on products
  for insert with check ((select public.is_admin()));

create policy "products_admin_update" on products
  for update using ((select public.is_admin()));

create policy "products_admin_delete" on products
  for delete using ((select public.is_admin()));

-- 4) Coupons & Orders & Sync Failures: tidak ada policy publik lain
--    di tabel ini (customer akses lewat RPC SECURITY DEFINER), jadi
--    cukup ganti kondisi "for all" tanpa perlu dipecah per-aksi.
drop policy if exists "coupons_admin_all" on coupons;
create policy "coupons_admin_all" on coupons
  for all using ((select public.is_admin()));

drop policy if exists "orders_admin_all" on orders;
create policy "orders_admin_all" on orders
  for all using ((select public.is_admin()));

drop policy if exists "sync_failures_admin_all" on sync_failures;
create policy "sync_failures_admin_all" on sync_failures
  for all using ((select public.is_admin()));
