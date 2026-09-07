/* ============================================================
   RAIDHANI - Konfigurasi Environment (Contoh)
   ------------------------------------------------------------
   Cara pakai:
   1. Salin file ini menjadi `env.js` di folder yang sama
      (assets/js/env.js) — file itu sudah di-.gitignore, aman
      untuk diisi kredensial asli, tidak akan ter-commit.
   2. Isi SUPABASE_URL & SUPABASE_ANON_KEY dari
      Supabase Dashboard -> Project Settings -> API.
   3. Selama env.js belum ada / masih kosong, seluruh situs
      otomatis jalan di MODE LOKAL (localStorage) seperti
      sekarang — tidak ada yang rusak.
   ============================================================ */

window.RAIDHANI_ENV = {
  // Project Settings -> API -> Project URL
  SUPABASE_URL: '',

  // Project Settings -> API -> Project API keys -> anon public
  // Aman ditaruh di frontend: anon key memang didesain publik,
  // seluruh proteksi data ada di Row Level Security (RLS) & RPC
  // di supabase/migrations/, BUKAN di kerahasiaan key ini.
  SUPABASE_ANON_KEY: '',

  // Nomor WhatsApp admin (format internasional tanpa '+'), opsional
  // — kalau kosong, whatsapp-link.js pakai default bawaan.
  ADMIN_WA_NUMBER: ''
};
