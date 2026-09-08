-- ============================================================
-- 0009_require_login_for_checkout.sql
-- Menutup celah "wajib login untuk bayar" agar benar-benar
-- ditegakkan di level database, bukan cuma tampilan.
--
-- Sebelumnya create_order, redeem_coupon, dan attach_payment_proof
-- bisa dipanggil role `anon` (pengunjung tanpa login) langsung lewat
-- /rest/v1/rpc/<nama_fungsi> memakai publishable key — terbukti lewat
-- pengujian curl manual. Sekarang customer wajib login (Google Sign-In
-- via Supabase Auth, lihat assets/js/auth.js) sebelum checkout, jadi
-- akses `anon` ke RPC ini dicabut. Akses `authenticated` TETAP
-- dipertahankan dengan sengaja — itu justru yang dibutuhkan supaya
-- customer yang sudah login bisa checkout.
--
-- Catatan: `REVOKE ... FROM anon` saja tidak cukup — PostgreSQL
-- otomatis memberi EXECUTE ke pseudo-role PUBLIC saat fungsi dibuat,
-- dan `anon` ikut kebagian lewat itu (bukan lewat grant eksplisit).
-- Harus dicabut dari PUBLIC supaya benar-benar tertutup untuk anon,
-- sementara grant eksplisit ke `authenticated`/`service_role` (dibuat
-- terpisah di migrasi sebelumnya) tetap utuh.
-- ============================================================

revoke execute on function public.create_order(jsonb) from public;
revoke execute on function public.redeem_coupon(text, integer) from public;
revoke execute on function public.attach_payment_proof(text, text) from public;

grant execute on function public.create_order(jsonb) to authenticated, service_role;
grant execute on function public.redeem_coupon(text, integer) to authenticated, service_role;
grant execute on function public.attach_payment_proof(text, text) to authenticated, service_role;
