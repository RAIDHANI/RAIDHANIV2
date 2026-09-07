# RAIDHANI - Media Assets

Folder ini adalah satu-satunya tempat untuk menyimpan semua foto yang digunakan di website RAIDHANI.
Ganti file placeholder (warna solid) dengan foto asli sesuai nama dan lokasi yang sudah ditentukan.

---

## Struktur Folder

```
media/
├── hero/
│   ├── hero.jpg              <- Foto utama hero section (ukuran ideal: 1440x900 px)
│   └── hero-mobile.jpg       <- Versi portrait hero untuk mobile (640x900 px)
│
├── dokumentasi/              <- Foto lookbook / dokumentasi brand (6 foto)
│   ├── dok-1.jpg             <- Ukuran ideal: 800x1067 px (rasio 3:4, portrait)
│   ├── dok-2.jpg
│   ├── dok-3.jpg
│   ├── dok-4.jpg
│   ├── dok-5.jpg
│   └── dok-6.jpg
│
├── produk-1-halwa/           <- Foto Produk 1: Halwa Luxury Syar'i Set
│   ├── mocca-sand/           <- Variasi warna Mocca Sand (#A66E58)
│   │   ├── foto-1.jpg        <- Foto utama (tampil saat klik tombol warna)
│   │   ├── foto-2.jpg        <- Foto angle/detail ke-2
│   │   ├── foto-3.jpg        <- Foto angle/detail ke-3
│   │   └── foto-4.jpg        <- Foto angle/detail ke-4
│   │
│   ├── olive-sage/           <- Variasi warna Olive Sage (#737965)
│   │   ├── foto-1.jpg
│   │   ├── foto-2.jpg
│   │   ├── foto-3.jpg
│   │   └── foto-4.jpg
│   │
│   └── espresso-earth/       <- Variasi warna Espresso Earth (#2E221E)
│       ├── foto-1.jpg
│       ├── foto-2.jpg
│       ├── foto-3.jpg
│       └── foto-4.jpg
│
├── produk-2-najla/           <- Foto Produk 2: Najla Silk Maharani Syar'i Set
│   ├── champagne-gold/       <- Variasi warna Champagne Gold (#D5C4A1)
│   │   ├── foto-1.jpg        <- Foto utama (tampil saat klik tombol warna)
│   │   ├── foto-2.jpg
│   │   ├── foto-3.jpg
│   │   └── foto-4.jpg
│   │
│   └── noir-onyx/            <- Variasi warna Noir Onyx (#1A1817)
│       ├── foto-1.jpg
│       ├── foto-2.jpg
│       ├── foto-3.jpg
│       └── foto-4.jpg
│
└── brand/
    └── logo.png              <- Logo RAIDHANI (PNG transparan, ideal: 300x80 px)
```

---

## Cara Kerja Sync Tombol Warna

Ketika pengunjung mengklik tombol warna di halaman produk, website secara otomatis menampilkan
foto-1.jpg dari folder variasi warna yang dipilih.

Contoh: Klik tombol Olive Sage -> website load media/produk-1-halwa/olive-sage/foto-1.jpg

Galeri thumbnail juga berubah ke foto-1.jpg s/d foto-4.jpg dari variasi yang sama.

---

## Panduan Ukuran Foto

| Lokasi                    | Ukuran Ideal  | Rasio    | Format           |
|---------------------------|---------------|----------|------------------|
| hero/hero.jpg             | 1440 x 900 px | 16:10    | JPG              |
| hero/hero-mobile.jpg      | 640 x 900 px  | portrait | JPG              |
| dokumentasi/dok-*.jpg     | 800 x 1067 px | 3:4      | JPG              |
| Foto produk foto-*.jpg    | 800 x 1067 px | 3:4      | JPG              |
| brand/logo.png            | 300 x 80 px   | landscape| PNG transparan   |

Tips: Gunakan background solid/netral (putih, krem, abu-abu muda) agar konsisten dengan
estetika Serene Modest Luxury brand RAIDHANI.

---

## Cara Mengganti Foto

1. Siapkan foto asli sesuai ukuran dan rasio di tabel atas
2. Rename foto persis sama dengan nama file placeholder (contoh: foto-1.jpg)
3. Drag & drop / replace file placeholder di folder yang sesuai
4. Refresh browser -- website langsung menampilkan foto baru, tanpa perlu edit kode apapun

---
File ini dibuat otomatis. Jangan hapus atau rename folder/file -- hanya ganti isinya dengan foto asli.
