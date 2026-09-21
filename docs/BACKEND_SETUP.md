# RAIDHANI — Setup Backend (Supabase + Cloudflare + Google Sheets)

Semua kode di repo ini sudah siap jalan (lihat "Yang sudah disiapkan di kode" per bagian). Bagian yang **tidak bisa dilakukan lewat kode** — membuat akun, project, dan secret di dashboard masing-masing layanan — ada di "Yang perlu Anda lakukan sendiri". Ikuti urutan A → B → C → D.

Selama langkah-langkah di bawah belum dilakukan, seluruh situs (landing page + admin) tetap jalan penuh di **mode lokal** (localStorage) seperti sekarang — tidak ada yang rusak kalau setup ini ditunda.

---

## A. Supabase (Database + Auth + Storage)

**Yang sudah disiapkan di kode:**
- `supabase/migrations/0001_init.sql` s.d. `0006_rpc_full_response_shape.sql` — skema tabel, RLS, RPC (`create_order`, `redeem_coupon`, `attach_payment_proof`), bucket Storage.
- `assets/js/supabase-client.js` — otomatis pakai Supabase asli begitu `env.js` terisi, fallback ke localStorage kalau belum.
- `assets/js/admin/admin-auth.js` — otomatis pakai Supabase Auth asli begitu live.

**Yang perlu Anda lakukan sendiri:**
1. Buat project baru di [supabase.com](https://supabase.com) — pilih region **Singapore** (latensi terendah ke Indonesia).
2. Buka **SQL Editor**, jalankan seluruh file di `supabase/migrations/` **berurutan** dari `0001` sampai `0006` (copy-paste isi tiap file, jalankan satu-satu).
   - Atau kalau sudah pakai Supabase CLI: `supabase link --project-ref <ref-project-anda>` lalu `supabase db push`.
3. Cek **Database → API**: pastikan tabel `products`, `coupons`, `orders`, `sync_failures` berstatus "exposed" (kebijakan Supabase pasca-Mei 2026 mengharuskan expose eksplisit per tabel).
4. Buka **Authentication → Users → Add user**, buat 1-3 akun staf admin (email + password). Ini akun yang dipakai login di `admin.html` setelah live — password mock lama (`raidhani2026`) **tidak berlaku lagi**.
5. Buka **Project Settings → API**, salin **Project URL** dan **anon public key**.
6. Di komputer Anda: `cp assets/js/env.example.js assets/js/env.js`, lalu isi `SUPABASE_URL` dan `SUPABASE_ANON_KEY` dengan nilai dari langkah 5. File `env.js` sudah di-`.gitignore`, aman diisi kredensial asli.
7. (Opsional, isi ulang data awal) Buka **Table Editor → products**, insert 2 baris produk sesuai `data/products.json` — atau jalankan INSERT manual dari SQL Editor.

---

## B. Cloudflare (Hosting)

**Yang sudah disiapkan di kode:** `wrangler.jsonc` di root repo (Workers + Static Assets, tanpa build step).

**Yang perlu Anda lakukan sendiri:**
1. Push repo ini ke GitHub/GitLab.
2. Login ke [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages → Create → Connect to Git** → pilih repo ini.
3. Build settings: kosongkan **Build command** (situs statis, tanpa build step), **Deploy command**: `npx wrangler deploy`.
4. Setelah deploy pertama sukses, tiap push ke branch utama auto-deploy; tiap PR dapat preview URL otomatis.
5. Tambahkan domain kustom (mis. `raidhani.com`) di tab **Custom Domains** pada Worker ini — SSL terbit otomatis.
6. **Jangan** taruh `SUPABASE_SERVICE_ROLE_KEY` atau kredensial rahasia lain di sini — situs ini murni statis, seluruh secret backend hidup di Supabase Edge Function (bagian C), bukan di Cloudflare.

---

## C. Sinkronisasi Google Sheets (Metode A: Edge Function)

**Prinsip:** satu arah, Supabase → Sheets. Sheets adalah cermin baca-saja untuk laporan/backup — **jangan** edit data pesanan langsung di Sheets dan mengharap itu berefek balik ke sistem (lihat catatan di `supabase/functions/sheets-sync/index.ts`).

**Yang sudah disiapkan di kode:**
- `supabase/functions/sheets-sync/index.ts` — Edge Function lengkap (autentikasi Google Service Account, append/update baris, fire-and-forget, log kegagalan ke `sync_failures`).
- `supabase/migrations/0005_sync_failures.sql` — tabel log kegagalan sync.

**Yang perlu Anda lakukan sendiri:**
1. Buka [console.cloud.google.com](https://console.cloud.google.com), buat/pilih project, aktifkan **Google Sheets API**.
2. **IAM & Admin → Service Accounts → Create Service Account**. Setelah dibuat, buka tab **Keys → Add Key → Create new key → JSON**, download file JSON-nya.
3. Buat spreadsheet baru di Google Sheets. Baris pertama (header) isi manual sesuai urutan ini:
   ```
   order_id | created_at | product_name | color | size | qty | unit_price | total_price | coupon_code | buyer_name | buyer_whatsapp | buyer_address | buyer_city_district | buyer_postal_code | status | payment_proof_url
   ```
4. Klik **Share** di spreadsheet tsb, tambahkan email service account (format `xxx@xxx.iam.gserviceaccount.com`, ada di file JSON) dengan akses **Editor**.
5. Salin **Spreadsheet ID** dari URL-nya (`https://docs.google.com/spreadsheets/d/<INI-ID-NYA>/edit`).
6. Deploy Edge Function: `supabase functions deploy sheets-sync`
7. Set secrets (nilai `private_key` dari file JSON, ganti literal `\n` tetap apa adanya — kode sudah menangani unescape-nya):
   ```bash
   supabase secrets set \
     GOOGLE_SERVICE_ACCOUNT_EMAIL="xxx@xxx.iam.gserviceaccount.com" \
     GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n" \
     GOOGLE_SHEET_ID="<spreadsheet id dari langkah 5>" \
     GOOGLE_SHEET_NAME="Orders"
   ```
8. Buka **Supabase Dashboard → Database → Webhooks → Create a new hook**:
   - Table: `orders`
   - Events: `Insert`, `Update`
   - Type: `HTTP Request` → `POST` ke URL hasil deploy langkah 6 (format `https://<project-ref>.supabase.co/functions/v1/sheets-sync`)
   - Header tambahan: `Authorization: Bearer <anon key atau service_role key>` (isi salah satu sesuai kebijakan project Anda)
9. Uji: buat 1 order dari landing page, cek baris baru muncul di Google Sheets dalam < 30 detik. Kalau tidak muncul, cek tabel `sync_failures` di Supabase untuk pesan errornya.

---

## D. Konfirmasi Pembayaran QRIS — Tier 1 (Aktif Sekarang)

**Yang sudah disiapkan di kode (tidak perlu setup tambahan, jalan begitu A selesai):**
- Checkout Tahap 2 (`index.html`) punya kotak upload bukti transfer langsung dari web (selain jalur WhatsApp yang sudah ada).
- Upload naik ke Supabase Storage bucket `payment-proofs` (live) atau tersimpan sementara di browser (mode lokal/demo).
- Dashboard admin (`admin.html`) menampilkan foto bukti transfer itu langsung di panel detail pesanan, tinggal klik **Konfirmasi Lunas**.

**Tidak ada langkah manual tambahan untuk Tier 1** selain menyelesaikan bagian A di atas (migrasi termasuk bucket Storage-nya).

**Catatan untuk Tier 2/3 (upgrade nanti):** lihat riwayat perencanaan — Tier 2 (Moota/Mutasibank + nominal kode unik) dan Tier 3 (QRIS dinamis via Midtrans/Xendit) belum diimplementasikan di kode ini karena butuh keputusan bisnis (jenis QRIS yang dipakai, entitas terdaftar) yang belum dikonfirmasi. Beri tahu saya kapan siap dan bagian mana yang mau dikerjakan lebih dulu.

---

## E. Tautan Toko Shopee

**Yang sudah disiapkan di kode:**
- `assets/js/shopee-link.js` — tombol **Beli di Shopee** di modal produk, tombol **Checkout di Shopee** di keranjang, dan tautan **Toko Shopee RAIDHANI** di footer. Semua tombol otomatis tersembunyi selama belum ada tautan Shopee, jadi situs tetap normal sebelum langkah di bawah dikerjakan.
- `supabase/migrations/0015_products_shopee_url.sql` — kolom `products.shopee_url`.
- Field **Link Produk Shopee** di form edit produk `admin.html`.

**Yang perlu Anda lakukan sendiri:**
1. Buka **SQL Editor**, jalankan `supabase/migrations/0015_products_shopee_url.sql` (aman diulang, tidak mengubah data).
2. Isi `SHOPEE_SHOP_URL` di `assets/js/env.js` dengan alamat toko (mis. `https://shopee.co.id/<username>`). Dipakai sebagai cadangan bila produk belum punya link sendiri, dan untuk footer.
3. Di `admin.html` → Edit Produk, isi **Link Produk Shopee** untuk tiap produk (salin dari halaman produk di Shopee). Hanya `https` ke `shopee.co.id`, `shope.ee`, atau `shp.ee` yang diterima.
4. Opsional: tambahkan URL toko ke `sameAs` pada JSON-LD `Organization` di `index.html`.

**Perlu diketahui:** Shopee tidak bisa menerima isi keranjang atau pilihan warna/ukuran dari situs lain, jadi pembeli memilih ulang di Shopee. Kupon website hanya berlaku di jalur Pesan Langsung, dan stok di website dan Shopee dikelola terpisah.

---

## Checklist Ringkas

- [ ] A1-A7: Project Supabase jalan, migrasi diterapkan, `env.js` terisi
- [ ] B1-B6: Repo ter-deploy di Cloudflare Workers, domain tersambung
- [ ] C1-C9: Edge Function `sheets-sync` aktif, webhook terpasang, baris pertama sukses masuk Sheets
- [ ] D: otomatis aktif begitu A selesai — tinggal uji upload bukti transfer dari checkout
- [ ] E1-E4: migrasi 0015 dijalankan, `SHOPEE_SHOP_URL` terisi, link produk Shopee diisi di admin
