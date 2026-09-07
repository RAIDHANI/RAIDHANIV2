-- ============================================================
-- 0007_storage_product_images.sql: Bucket Storage Foto Produk
-- Dipakai oleh CMS Katalog di admin dashboard supaya staf bisa
-- ganti/tambah foto produk (per varian warna) tanpa sentuh kode.
-- Beda dari payment-proofs: upload HANYA boleh oleh admin
-- terautentikasi (customer tidak pernah upload foto produk).
-- ============================================================

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "product_images_public_read" on storage.objects;
create policy "product_images_public_read" on storage.objects
  for select using (bucket_id = 'product-images');

drop policy if exists "product_images_admin_insert" on storage.objects;
create policy "product_images_admin_insert" on storage.objects
  for insert with check (bucket_id = 'product-images' and auth.role() = 'authenticated');

drop policy if exists "product_images_admin_update" on storage.objects;
create policy "product_images_admin_update" on storage.objects
  for update using (bucket_id = 'product-images' and auth.role() = 'authenticated');

drop policy if exists "product_images_admin_delete" on storage.objects;
create policy "product_images_admin_delete" on storage.objects
  for delete using (bucket_id = 'product-images' and auth.role() = 'authenticated');
