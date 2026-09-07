# RAIDHANI: Quiet Luxury Modest Couture

Dokumentasi implementasi frontend landing page dan admin backoffice console untuk brand busana syar'i **RAIDHANI** (@raidhani_) berbasis **PRD v2.1 (4 September 2026)**.

---

## 1. Ikhtisar Arsitektur

Platform dibangun menggunakan standar modern web vanilla (HTML5 semantik, CSS3 Custom Properties, dan Modular JavaScript ES6+) yang dioptimalkan untuk akses cepat pada perangkat seluler (90%+ traffic 4G).

- **Landing Page (`index.html`)**: Single-page e-commerce syar'i 10 section editorial (*Announcement Bar*, *Sticky Header*, *Hero*, *Manifesto & Metrics*, *Why RAIDHANI Bento*, *Katalog Produk*, *Lookbook*, *Ulasan*, *FAQ*, *Footer*).
- **Admin Dashboard (`admin.html`)**: Backoffice console terpisah untuk staf atelier (login gate, rekap pesanan, filter status, inspeksi bukti transfer, export CSV, CMS harga & stok, manajemen kupon).
- **Data & Backend Layer**: Hibrida Supabase (PostgreSQL + PostgREST + Auth + Storage + RPC atomik `redeem_coupon`, `create_order`, `attach_payment_proof`) dengan failover offline lokal transparan via `localStorage` dan `data/products.json`. Aktif otomatis begitu `assets/js/env.js` diisi kredensial proyek — lihat `docs/BACKEND_SETUP.md`.
- **Hosting**: Cloudflare Workers + Static Assets (`wrangler.jsonc`), auto-deploy dari Git.
- **Sinkronisasi Backup**: Supabase Database Webhook → Edge Function (`supabase/functions/sheets-sync`) → Google Sheets, satu arah, fire-and-forget.

---

## 2. Struktur Direktori

```
stitch_raidhani_minimalist_fashion_platform/
├── index.html                   # Master Landing Page Publik (FR-1 s.d FR-12)
├── admin.html                   # Executive Backoffice Console & CMS (FR-13 s.d FR-18)
├── assets/
│   ├── css/
│   │   ├── variables.css        # Design tokens: palet earth-tone, type scale, spacing, radii
│   │   ├── base.css             # Reset, typography Fraunces + Plus Jakarta Sans, focus ring
│   │   ├── components.css       # Buttons, cards, badges, native modal dialog, toast
│   │   ├── layout.css           # Grid 1280px lock, bento grid, responsive breakpoints
│   │   └── admin.css            # Styling high-contrast khusus console backoffice
│   └── js/
│       ├── main.js              # Entrypoint landing page: sticky observer, drawer inert, scroll
│       ├── state.js             # Reactive central state (selected color/size/price/coupon)
│       ├── supabase-client.js   # Supabase client wrapper & offline local resilience engine
│       ├── product-selector.js  # Color swatches, size buttons, dynamic price & photo switch
│       ├── modal-checkout.js    # 2-Stage native dialog: Form & UU PDP -> Rekening & Konfirmasi WA
│       ├── counter-animation.js # Metric counter animation (prefers-reduced-motion safe)
│       ├── whatsapp-link.js     # URL wa.me generator untuk 3 intent percakapan berbeda
│       ├── analytics.js         # Event tracker untuk GA4 dan Meta Pixel
│       └── admin/
│           ├── admin-auth.js    # Login gate (email & password) & session check
│           ├── admin-orders.js  # Antrean pesanan, filter status, inspeksi detail, export CSV
│           ├── admin-products.js# CMS edit harga & stok real-time tanpa sentuh kode
│           └── admin-coupons.js # Pemantauan kuota klaim voucher & aktivasi promo
├── data/
│   ├── products.json            # Seed data awal Halwa Set & Najla Silk Maharani Set
│   ├── testimonials.json        # Data ulasan terverifikasi (nama tersamar "Mba D***")
│   └── faq.json                 # Data pertanyaan umum syariat, bahan, & ukuran
├── supabase/
│   ├── migrations/               # 0001-0006: skema, RLS, RPC, storage bucket, kolom bukti transfer
│   └── functions/
│       └── sheets-sync/          # Edge Function: DB Webhook orders -> Google Sheets
├── docs/
│   └── BACKEND_SETUP.md          # Checklist setup Supabase + Cloudflare + Google Sheets
├── serene_modest_luxury/
│   └── DESIGN.md                # Dokumentasi kurasi palet warna & design system
├── wrangler.jsonc                # Konfigurasi hosting Cloudflare Workers + Static Assets
├── sitemap.xml                  # XML sitemap untuk optimasi mesin pencari
├── robots.txt                   # Robots directives (mengecualikan /admin.html)
└── README.md
```

> `assets/js/env.example.js` — salin ke `env.js` (di-gitignore) lalu isi kredensial Supabase untuk mengaktifkan mode live. Lihat `docs/BACKEND_SETUP.md` untuk panduan lengkap.

---

## 3. Palet Warna & Kontras WCAG 2.1 AA (PRD §20)

| Token CSS | Hex | Penggunaan | Status Kontras WCAG |
| :--- | :--- | :--- | :--- |
| `--color-bg-primary` | `#FAF8F5` | Kanvas utama bone/cream | Dasar |
| `--color-surface-warm` | `#F2ECE4` | Surface kartu & section bento | Dasar |
| `--color-surface-card` | `#FFFFFF` | Permukaan kartu produk | Dasar |
| `--color-text-primary` | `#2E221E` | Teks utama espresso deep | **14.53:1** (Lolos AAA) |
| `--color-accent-1` | `#A66E58` | Terracotta soft (Heading & aksen) | Digunakan untuk teks besar |
| `--color-accent-1-interactive` | `#9F6A54` | Terracotta rich (Fill tombol solid) | **4.50:1** dengan teks putih (Lolos AA) |
| `--color-accent-2` | `#737965` | Sage olive (Badge, tombol WA konfirmasi) | **4.51:1** dengan teks putih (Lolos AA) |
| `--color-border` | `#E6DDD2` | Hairline border pembatas | Kontras halus |

---

## 4. Tipografi Resmi (PRD §21)

- **Editorial Headings**: `Fraunces` (Google Variable Font dengan sumbu `opsz` 9-144, weights 400, 500, 600). Memberikan karakter serif hangat, organik, dan membedakan RAIDHANI dari pola umum Playfair Display.
- **Interface & Body**: `Plus Jakarta Sans` (weights 400, 500, 600, 700). Menjamin keterbacaan tajam pada layar smartphone beresolusi standar.

---

## 5. Cara Menjalankan & Menguji Secara Lokal

1. **Jalankan Static Web Server**:
   ```bash
   # Menggunakan Python
   python3 -m http.server 8080

   # Atau menggunakan Node.js
   npx serve .
   ```
2. Buka peramban di `http://localhost:8080`.
3. Akses Dashboard Admin di `http://localhost:8080/admin.html` (Gunakan email: `staf@raidhani.luxury` / Password: `raidhani2026`).

---

## 6. Pre-Flight Design Checklist (PRD §22)

- [x] **Zero Em Dash**: Nol pemakaian tanda hubung panjang (`—`) pada seluruh teks antarmuka.
- [x] **Page Theme Lock**: Konsistensi tema terang earth-tone di seluruh section (termasuk footer).
- [x] **Button Contrast**: Tombol solid terracotta menggunakan `#9F6A54` (rasio kontras 4.50:1).
- [x] **UU PDP Compliance**: Checkbox persetujuan data pribadi di form checkout.
- [x] **Reduced Motion**: Animasi counter menghormati preferensi pengguna via `prefers-reduced-motion`.
- [x] **No Duplicate CTA Intent**: Tiga jalur WhatsApp (Konsultasi Umum, Tanya Produk, Bukti Transfer) memiliki intent dan pesan pre-filled terpisah.
