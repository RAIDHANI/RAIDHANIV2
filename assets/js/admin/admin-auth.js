/* ============================================================
   RAIDHANI - Admin Auth Gate Module (PRD v2.1 §9 FR-13)
   Session validation, login modal gate, and sign-out
   ============================================================ */

(function(window) {
  'use strict';

  const AUTH_STORAGE_KEY = 'raidhani_admin_session';

  const RaidhaniAdminAuth = {
    async init() {
      const authOverlay = document.getElementById('admin-auth-overlay');
      const loginForm = document.getElementById('admin-login-form');
      const logoutBtn = document.getElementById('btn-admin-logout');
      const isLive = Boolean(window.RaidhaniData?.isLiveSupabase);

      const authed = isLive ? await this.hasLiveSession() : this.isAuthenticated();
      if (authOverlay) authOverlay.classList.toggle('hidden', authed);

      this.renderSyncStatus(isLive);

      if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const email = document.getElementById('admin-email').value.trim();
          const password = document.getElementById('admin-password').value;

          if (isLive) {
            await this.loginLive(email, password, authOverlay);
          } else {
            this.loginMock(email, password, authOverlay);
          }
        });
      }

      if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          if (isLive && window.RaidhaniData.supabaseClient) {
            await window.RaidhaniData.supabaseClient.auth.signOut();
          } else {
            localStorage.removeItem(AUTH_STORAGE_KEY);
          }
          window.location.reload();
        });
      }
    },

    renderSyncStatus(isLive) {
      const dot = document.getElementById('sync-status-dot');
      const label = document.getElementById('sync-status-label');
      const value = document.getElementById('sync-status-value');
      if (!dot || !label || !value) return;

      if (isLive) {
        dot.style.backgroundColor = '#059669';
        label.textContent = 'Supabase Live Sync';
        label.style.color = '#059669';
        value.textContent = 'Online';
      } else {
        dot.style.backgroundColor = '#D97706';
        label.textContent = 'Mode Lokal (Offline)';
        label.style.color = '#D97706';
        value.textContent = 'env.js belum diisi';
      }
    },

    async hasLiveSession() {
      const client = window.RaidhaniData?.supabaseClient;
      if (!client) return false;
      const { data } = await client.auth.getSession();
      return Boolean(data?.session);
    },

    // Backend nyata tersambung: ini REAL Supabase Auth, bukan mock lagi.
    // Buat akun staf lewat Supabase Dashboard -> Authentication -> Add
    // user (email + password) — password mock lama TIDAK berlaku di sini,
    // karena RLS di orders/products/coupons mensyaratkan sesi Supabase
    // Auth yang sah (auth.role() = 'authenticated'), bukan sekadar flag
    // di localStorage.
    async loginLive(email, password, authOverlay) {
      const client = window.RaidhaniData.supabaseClient;
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) {
        alert('Login gagal: ' + error.message);
        return;
      }
      if (authOverlay) authOverlay.classList.add('hidden');
      if (window.showToast) window.showToast('Login berhasil. Selamat bertugas!', 'verified');
    },

    loginMock(email, password, authOverlay) {
      if (email && password.length >= 6) {
        const session = {
          email: email,
          role: 'authenticated',
          token: 'mock-jwt-token-' + Date.now(),
          expires_at: Date.now() + 24 * 3600 * 1000
        };
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
        if (authOverlay) authOverlay.classList.add('hidden');
        if (window.showToast) window.showToast('Login berhasil. Selamat bertugas!', 'verified');
      } else {
        alert('Kredensial tidak valid. Password minimal 6 karakter.');
      }
    },

    isAuthenticated() {
      const session = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!session) return false;
      try {
        const parsed = JSON.parse(session);
        return parsed.expires_at > Date.now();
      } catch (e) {
        return false;
      }
    }
  };

  window.RaidhaniAdminAuth = RaidhaniAdminAuth;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => RaidhaniAdminAuth.init());
  } else {
    RaidhaniAdminAuth.init();
  }

})(window);
