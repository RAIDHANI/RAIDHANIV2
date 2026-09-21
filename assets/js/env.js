/* ============================================================
   RAIDHANI - Konfigurasi Environment (ASLI)
   Sengaja ikut di-commit: SUPABASE_ANON_KEY di sini adalah
   "Publishable key" (format sb_publishable_...) — didesain resmi
   oleh Supabase untuk aman terlihat publik di browser. Proteksi
   data ada di Row Level Security (RLS) & RPC di supabase/migrations/,
   BUKAN di kerahasiaan key ini. Kalau butuh contoh strukturnya
   lihat assets/js/env.example.js.
   ============================================================ */

window.RAIDHANI_ENV = {
  // Project Settings -> API -> Project URL
  SUPABASE_URL: 'https://tmztpfolztohpiutmjzc.supabase.co',

  // Project Settings -> API Keys -> Publishable and secret API keys -> Publishable key
  SUPABASE_ANON_KEY: 'sb_publishable_YhQpPJoZVBH0OosNj7EotQ_28qsW0i1',

  // Nomor WhatsApp admin (format internasional tanpa '+'), opsional
  ADMIN_WA_NUMBER: '',

  // Alamat toko Shopee RAIDHANI, mis. 'https://shopee.co.id/<username>'.
  // Kosong = tombol Shopee disembunyikan (kecuali produk punya link sendiri).
  SHOPEE_SHOP_URL: ''
};
