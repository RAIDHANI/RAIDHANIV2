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
  SUPABASE_URL: 'https://tmztpfolztohpiutmjzc.supabase.co/rest/v1/',

  // Project Settings -> API -> Project API keys -> anon public
  // Aman ditaruh di frontend: anon key memang didesain publik,
  // seluruh proteksi data ada di Row Level Security (RLS) & RPC
  // di supabase/migrations/, BUKAN di kerahasiaan key ini.
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtenRwZm9senRvaHBpdXRtanpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3OTIyNzIsImV4cCI6MjEwNDM2ODI3Mn0.q6S3kU-yS5Bb79LtAm34zl5qR3tXzmQ3EUuS9pTzNlg',

  // Nomor WhatsApp admin (format internasional tanpa '+'), opsional
  // — kalau kosong, whatsapp-link.js pakai default bawaan.
  ADMIN_WA_NUMBER: ''
};
