-- ============================================================
-- 0004_storage_payment_proofs.sql: Bucket Storage Bukti Transfer
-- ============================================================

insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', true)
on conflict (id) do nothing;

-- Baca publik: dibutuhkan agar dashboard admin & customer bisa
-- menampilkan foto lewat public URL tanpa proses auth tambahan.
-- Ini hanya foto bukti transfer, bukan data pribadi sensitif
-- di luar apa yang sudah ada di tabel orders itu sendiri.
drop policy if exists "payment_proofs_public_read" on storage.objects;
create policy "payment_proofs_public_read" on storage.objects
  for select using (bucket_id = 'payment-proofs');

-- Upload: dibuka untuk anon KARENA customer checkout tidak login
-- ke Supabase Auth (akun RAIDHANI di auth.js masih terpisah/mock).
-- Nama file di sisi klien harus diawali order_id agar tertelusuri;
-- ini tidak dipaksakan lewat RLS (Storage RLS tak bisa memvalidasi
-- isi path terhadap tabel lain dengan mudah) — risiko diterima
-- karena bucket ini hanya menampung gambar non-destruktif.
drop policy if exists "payment_proofs_anon_insert" on storage.objects;
create policy "payment_proofs_anon_insert" on storage.objects
  for insert with check (bucket_id = 'payment-proofs');

-- Update/Delete: staf admin saja (Supabase Auth terautentikasi).
drop policy if exists "payment_proofs_admin_update" on storage.objects;
create policy "payment_proofs_admin_update" on storage.objects
  for update using (bucket_id = 'payment-proofs' and auth.role() = 'authenticated');

drop policy if exists "payment_proofs_admin_delete" on storage.objects;
create policy "payment_proofs_admin_delete" on storage.objects
  for delete using (bucket_id = 'payment-proofs' and auth.role() = 'authenticated');
