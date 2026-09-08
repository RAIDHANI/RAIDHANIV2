/* ============================================================
   RAIDHANI - Customer Auth (Google Sign-In via Supabase Auth)
   Login asli (bukan mock) — memakai sesi Supabase Auth sungguhan,
   supaya RLS `auth.role() = 'authenticated'` di orders/coupons benar-
   benar terpenuhi saat checkout, bukan sekadar status di localStorage.
   ============================================================ */

(function(window) {
  'use strict';

  function showToast(message, icon = 'check_circle') {
    if (window.showToast) return window.showToast(message, icon);
    let toast = document.getElementById('global-toast');
    if (!toast) return;
    toast.innerHTML = `<span class="material-symbols-outlined" style="color: var(--color-accent-1); font-size: 18px;">${icon}</span><span>${message}</span>`;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  }

  const RaidhaniAuth = {
    currentUser: null,
    _afterLoginCallback: null,
    _ready: false,

    async init() {
      const client = window.RaidhaniData?.supabaseClient;

      if (!client) {
        // Mode lokal (env.js belum diisi) — login Google butuh project
        // Supabase asli, tidak ada padanan mode lokalnya.
        this._ready = true;
        this.updateAccountUI();
        this.bindEvents();
        return;
      }

      // Sesi yang sudah ada saat halaman dimuat (mis. reload setelah login,
      // atau kembali dari redirect Google).
      const { data } = await client.auth.getSession();
      this.currentUser = data?.session?.user ?? null;
      this._ready = true;
      this.updateAccountUI();

      client.auth.onAuthStateChange((event, session) => {
        this.currentUser = session?.user ?? null;
        this.updateAccountUI();

        if (event === 'SIGNED_IN') {
          this.closeLoginModal();
          showToast('Berhasil masuk. Selamat datang!');
          if (window.RaidhaniAnalytics) window.RaidhaniAnalytics.trackEvent('login_success');

          const callback = this._afterLoginCallback;
          this._afterLoginCallback = null;
          if (callback) callback();
        } else if (event === 'SIGNED_OUT') {
          showToast('Anda telah keluar dari akun.', 'logout');
          if (window.RaidhaniAnalytics) window.RaidhaniAnalytics.trackEvent('logout');
        }
      });

      this.bindEvents();
    },

    bindEvents() {
      const dialog = document.getElementById('login-modal');
      if (dialog) {
        dialog.addEventListener('click', (e) => {
          if (e.target === dialog) this.closeLoginModal();
        });
      }
    },

    isLoggedIn() {
      return !!this.currentUser;
    },

    updateAccountUI() {
      const navLabel = document.getElementById('account-nav-label');
      const mobileLabel = document.getElementById('mobile-account-label');
      const navBtn = document.getElementById('btn-account-nav');

      const identity = this.currentUser
        ? (this.currentUser.user_metadata?.full_name || this.currentUser.email || 'Akun')
        : null;

      if (identity) {
        const shortLabel = identity.length > 16 ? identity.slice(0, 14) + '…' : identity;
        if (navLabel) navLabel.textContent = shortLabel;
        if (mobileLabel) mobileLabel.textContent = `${identity} · Keluar`;
        if (navBtn) navBtn.title = 'Klik untuk keluar dari akun';
      } else {
        if (navLabel) navLabel.textContent = 'Masuk';
        if (mobileLabel) mobileLabel.textContent = 'Masuk ke Akun';
        if (navBtn) navBtn.title = 'Masuk / Akun Saya';
      }
    },

    handleAccountClick() {
      if (this.currentUser) {
        this.logout();
      } else {
        this.openLoginModal();
      }
    },

    // requireLogin: jalankan callback kalau sudah login. Kalau belum,
    // buka modal login dan simpan callback untuk dijalankan otomatis
    // setelah SIGNED_IN (lihat onAuthStateChange di init()) — SELAMA
    // login terjadi tanpa full-page redirect (mis. sudah ada sesi aktif
    // di tab lain). Redirect OAuth penuh me-reload halaman, jadi untuk
    // kasus itu pengguna cukup mengulang aksinya (klik Beli lagi) setelah
    // kembali — state checkout tidak dipertahankan lintas redirect di V1 ini.
    requireLogin(callback) {
      if (this.currentUser) {
        callback();
        return true;
      }
      this._afterLoginCallback = callback;
      showToast('Silakan masuk untuk melanjutkan pembelian.', 'lock');
      this.openLoginModal();
      return false;
    },

    openLoginModal() {
      const errorEl = document.getElementById('login-google-error');
      if (errorEl) { errorEl.textContent = ''; errorEl.style.display = 'none'; }

      const dialog = document.getElementById('login-modal');
      if (dialog && typeof dialog.showModal === 'function') {
        dialog.showModal();
        if (window.RaidhaniAnalytics) window.RaidhaniAnalytics.trackEvent('login_modal_open');
      }
    },

    closeLoginModal() {
      const dialog = document.getElementById('login-modal');
      if (dialog && dialog.open) dialog.close();
    },

    async signInWithGoogle() {
      const client = window.RaidhaniData?.supabaseClient;
      const btn = document.getElementById('btn-google-signin');
      const errorEl = document.getElementById('login-google-error');

      if (!client) {
        if (errorEl) {
          errorEl.textContent = 'Login belum tersedia — situs sedang berjalan di mode lokal (belum tersambung ke Supabase).';
          errorEl.style.display = 'block';
        }
        return;
      }

      if (btn) btn.disabled = true;

      const { error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.href }
      });

      if (error) {
        if (btn) btn.disabled = false;
        if (errorEl) {
          errorEl.textContent = 'Gagal membuka login Google: ' + error.message;
          errorEl.style.display = 'block';
        }
        return;
      }

      // Browser akan redirect ke Google sebelum baris ini sempat berjalan
      // dalam kondisi normal; tidak perlu aksi tambahan di sini.
    },

    async logout() {
      const client = window.RaidhaniData?.supabaseClient;
      this._afterLoginCallback = null;
      if (client) {
        await client.auth.signOut();
      } else {
        this.currentUser = null;
        this.updateAccountUI();
      }
    }
  };

  window.RaidhaniAuth = RaidhaniAuth;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => RaidhaniAuth.init());
  } else {
    RaidhaniAuth.init();
  }

})(window);
