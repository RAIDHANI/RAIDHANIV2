-- ============================================================
-- 0015_products_shopee_url.sql
--
-- Tautan halaman produk di toko Shopee RAIDHANI, satu per produk.
-- Dipakai tombol "Beli di Shopee" di landing page (assets/js/shopee-link.js)
-- dan diedit lewat admin CMS. Kolom nullable: produk tanpa tautan
-- memakai RAIDHANI_ENV.SHOPEE_SHOP_URL sebagai cadangan, dan kalau itu
-- juga kosong tombol Shopee disembunyikan.
--
-- Tidak ada perubahan RLS: policy products_select / products_admin_*
-- (0010) berbasis baris, jadi kolom baru otomatis ikut terbaca publik
-- dan hanya bisa ditulis admin.
--
-- Validasi domain (hanya https ke shopee.co.id / shope.ee / shp.ee)
-- dilakukan di sisi klien oleh RaidhaniShopee.sanitize(), bukan lewat
-- CHECK constraint, supaya domain tautan pendek Shopee yang berubah
-- tidak perlu migrasi baru.
--
-- Aman dijalankan ulang (if not exists) dan tidak mengubah data yang ada.
-- ============================================================

alter table products
  add column if not exists shopee_url text;
