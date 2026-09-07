/* ============================================================
   RAIDHANI - Customer Auth (Email + Kode Verifikasi)
   Status: FRONTEND SIAP, BACKEND MOCK (localStorage).
   Alur UI final (email -> kode 6 digit -> masuk) sudah lengkap.
   Titik sambung backend nyata ditandai dengan "TODO(backend)" —
   ganti requestCode()/verifyCode() dengan panggilan Supabase Auth
   (signInWithOtp / verifyOtp) tanpa perlu mengubah UI.
   ============================================================ */

(function(window) {
  'use strict';

  const STORAGE_KEY = 'raidhani_auth_session_v1';

  function showToast(message, icon = 'check_circle') {
    if (window.showToast) return window.showToast(message, icon);
    let toast = document.getElementById('global-toast');
    if (!toast) return;
    toast.innerHTML = `<span class="material-symbols-outlined" style="color: var(--color-accent-1); font-size: 18px;">${icon}</span><span>${message}</span>`;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  const RaidhaniAuth = {
    currentUser: null,
    pendingEmail: null,
    _mockCode: null,
    _afterLoginCallback: null,

    init() {
      this.load();
      this.updateAccountUI();
      this.bindEvents();
    },

    load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        this.currentUser = raw ? JSON.parse(raw) : null;
      } catch (e) {
        this.currentUser = null;
      }
    },

    persist() {
      try {
        if (this.currentUser) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(this.currentUser));
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch (e) {
        console.warn('Gagal menyimpan sesi akun:', e);
      }
    },

    isLoggedIn() {
      return !!this.currentUser;
    },

    bindEvents() {
      const dialog = document.getElementById('login-modal');
      if (dialog) {
        dialog.addEventListener('click', (e) => {
          if (e.target === dialog) this.closeLoginModal();
        });
      }

      const emailForm = document.getElementById('login-email-form');
      if (emailForm) {
        emailForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const input = document.getElementById('login-email-input');
          const email = input ? input.value.trim() : '';
          this.handleRequestCode(email);
        });
      }

      const otpForm = document.getElementById('login-otp-form');
      if (otpForm) {
        otpForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const input = document.getElementById('login-otp-input');
          const code = input ? input.value.trim() : '';
          this.handleVerifyCode(code);
        });
      }
    },

    updateAccountUI() {
      const navLabel = document.getElementById('account-nav-label');
      const mobileLabel = document.getElementById('mobile-account-label');
      const navBtn = document.getElementById('btn-account-nav');

      if (this.currentUser) {
        const shortEmail = this.currentUser.email.length > 16
          ? this.currentUser.email.slice(0, 14) + '…'
          : this.currentUser.email;
        if (navLabel) navLabel.textContent = shortEmail;
        if (mobileLabel) mobileLabel.textContent = `${this.currentUser.email} · Keluar`;
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

    // requireLogin: jalankan callback jika sudah login, kalau belum buka
    // modal login dan lanjutkan callback otomatis setelah berhasil masuk.
    requireLogin(callback) {
      if (this.currentUser) {
        callback();
        return true;
      }
      this._afterLoginCallback = callback;
      showToast('Silakan masuk dengan email untuk melanjutkan pembelian.', 'lock');
      this.openLoginModal();
      return false;
    },

    openLoginModal() {
      this.resetToEmailStage();
      const dialog = document.getElementById('login-modal');
      if (dialog && typeof dialog.showModal === 'function') {
        dialog.showModal();
        if (window.RaidhaniAnalytics) window.RaidhaniAnalytics.trackEvent('login_modal_open');
      }
    },

    closeLoginModal() {
      const dialog = document.getElementById('login-modal');
      if (dialog) dialog.close();
      this._afterLoginCallback = null;
    },

    resetToEmailStage() {
      const stageEmail = document.getElementById('login-stage-email');
      const stageOtp = document.getElementById('login-stage-otp');
      if (stageEmail) stageEmail.style.display = 'block';
      if (stageOtp) stageOtp.style.display = 'none';

      const emailInput = document.getElementById('login-email-input');
      const otpInput = document.getElementById('login-otp-input');
      if (otpInput) otpInput.value = '';
      this.clearFieldError('login-email-error');
      this.clearFieldError('login-otp-error');

      if (emailInput && !emailInput.value) {
        setTimeout(() => emailInput.focus(), 100);
      }
    },

    backToEmailStage() {
      this.resetToEmailStage();
    },

    async handleRequestCode(email) {
      this.clearFieldError('login-email-error');

      if (!isValidEmail(email)) {
        this.setFieldError('login-email-error', 'Masukkan alamat email yang valid.');
        return;
      }

      await this.requestCode(email);
    },

    // TODO(backend): ganti isi fungsi ini dengan
    // `await supabase.auth.signInWithOtp({ email })` lalu hapus _mockCode.
    async requestCode(email) {
      this.pendingEmail = email;
      this._mockCode = String(Math.floor(100000 + Math.random() * 900000));

      const stageEmail = document.getElementById('login-stage-email');
      const stageOtp = document.getElementById('login-stage-otp');
      const emailLabel = document.getElementById('login-otp-email-label');

      if (stageEmail) stageEmail.style.display = 'none';
      if (stageOtp) stageOtp.style.display = 'block';
      if (emailLabel) emailLabel.textContent = email;

      const otpInput = document.getElementById('login-otp-input');
      if (otpInput) {
        otpInput.value = '';
        setTimeout(() => otpInput.focus(), 100);
      }

      // Mode demo: backend pengiriman email belum aktif, kode ditampilkan
      // langsung agar alur bisa diuji end-to-end sebelum backend siap.
      showToast(`Mode Demo — kode verifikasi Anda: ${this._mockCode}`, 'mail');

      if (window.RaidhaniAnalytics) window.RaidhaniAnalytics.trackEvent('login_code_requested', { email });
    },

    async resendCode() {
      if (!this.pendingEmail) return;
      await this.requestCode(this.pendingEmail);
    },

    async handleVerifyCode(code) {
      this.clearFieldError('login-otp-error');

      if (!/^\d{6}$/.test(code)) {
        this.setFieldError('login-otp-error', 'Kode verifikasi harus 6 digit angka.');
        return;
      }

      await this.verifyCode(code);
    },

    // TODO(backend): ganti isi fungsi ini dengan
    // `await supabase.auth.verifyOtp({ email: this.pendingEmail, token: code, type: 'email' })`.
    async verifyCode(code) {
      if (code !== this._mockCode) {
        this.setFieldError('login-otp-error', 'Kode verifikasi salah. Silakan coba lagi.');
        return;
      }

      this.currentUser = {
        email: this.pendingEmail,
        loggedInAt: new Date().toISOString()
      };
      this.persist();
      this.updateAccountUI();

      this._mockCode = null;
      this.pendingEmail = null;

      // Ambil & kosongkan callback SEBELUM closeLoginModal(), karena
      // closeLoginModal() sendiri mengosongkan _afterLoginCallback (untuk
      // kasus modal ditutup manual oleh user tanpa menyelesaikan login).
      const callback = this._afterLoginCallback;
      this._afterLoginCallback = null;

      this.closeLoginModal();
      showToast('Berhasil masuk. Selamat datang kembali!');

      if (window.RaidhaniAnalytics) window.RaidhaniAnalytics.trackEvent('login_success');

      if (callback) callback();
    },

    logout() {
      this.currentUser = null;
      this.persist();
      this.updateAccountUI();
      showToast('Anda telah keluar dari akun.', 'logout');
      if (window.RaidhaniAnalytics) window.RaidhaniAnalytics.trackEvent('logout');
    },

    setFieldError(elId, message) {
      const el = document.getElementById(elId);
      if (el) {
        el.textContent = message;
        el.style.display = 'block';
      }
    },

    clearFieldError(elId) {
      const el = document.getElementById(elId);
      if (el) {
        el.textContent = '';
        el.style.display = 'none';
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
