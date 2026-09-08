/* ============================================================
   RAIDHANI - Admin Manajemen Kupon & Voucher (PRD v2.1 §9 FR-18)
   Monitor usage quota, activate/deactivate campaigns
   ============================================================ */

(function(window) {
  'use strict';

  let coupons = [];

  const RaidhaniAdminCoupons = {
    async init() {
      coupons = await window.RaidhaniData.getCoupons();
      this.renderCoupons();

      const newCouponForm = document.getElementById('new-coupon-form');
      if (newCouponForm) {
        newCouponForm.addEventListener('submit', this.handleCreateCoupon.bind(this));
      }
    },

    renderCoupons() {
      const container = document.getElementById('admin-coupons-container');
      if (!container) return;

      const sidebarBadge = document.getElementById('sidebar-coupon-badge');
      if (sidebarBadge) sidebarBadge.textContent = `${coupons.filter(c => c.is_active).length} Aktif`;

      container.innerHTML = '';
      coupons.forEach(c => {
        const percentUsed = Math.min(100, Math.round((c.quota_used / c.quota_max) * 100));
        const div = document.createElement('div');
        div.className = 'coupon-manage-card';

        div.innerHTML = `
          <div class="flex items-center justify-between">
            <span class="font-bold text-terracotta-rich tracking-wider text-sm">${c.code}</span>
            <div class="flex items-center gap-2">
              <span class="badge ${c.is_active ? 'badge-sage' : ''}" style="${!c.is_active ? 'background:#FFE4E6;color:#9F1239;' : ''}">
                ${c.is_active ? 'Aktif' : 'Non-Aktif'}
              </span>
              <button class="btn-tertiary text-xs" onclick="RaidhaniAdminCoupons.toggleStatus('${c.code}')">
                ${c.is_active ? 'Nonaktifkan' : 'Aktifkan'}
              </button>
            </div>
          </div>
          <p class="text-xs text-espresso-deep">
            Potongan: <strong>${c.discount_type === 'fixed_amount' ? 'Rp ' + c.discount_value.toLocaleString('id-ID') : 'Harga Tetap Rp ' + c.discount_value.toLocaleString('id-ID')}</strong>
          </p>
          <div class="flex flex-col gap-1 mt-1">
            <div class="coupon-progress-bar">
              <div class="coupon-progress-fill" style="width: ${percentUsed}%"></div>
            </div>
            <div class="flex items-center justify-between text-espresso-muted" style="font-size:11px;">
              <span>${c.quota_used} / ${c.quota_max} kupon terpakai</span>
              <span class="font-semibold text-sage-olive">${percentUsed}% Kuota</span>
            </div>
          </div>
        `;

        container.appendChild(div);
      });
    },

    async toggleStatus(code) {
      const c = coupons.find(item => item.code === code);
      if (c) {
        c.is_active = !c.is_active;
        await window.RaidhaniData.saveCoupons(coupons);
        this.renderCoupons();
        if (window.showToast) {
          window.showToast(`Status kupon ${code} diubah.`);
        }
      }
    },

    async handleCreateCoupon(e) {
      e.preventDefault();
      const code = document.getElementById('coupon-code-input').value.trim().toUpperCase();
      const value = parseInt(document.getElementById('coupon-val-input').value, 10);
      const quota = parseInt(document.getElementById('coupon-quota-input').value, 10);

      if (!code || isNaN(value) || isNaN(quota)) {
        alert('Lengkapi seluruh field kupon.');
        return;
      }

      coupons.push({
        code: code,
        discount_type: 'fixed_amount',
        discount_value: value,
        quota_max: quota,
        quota_used: 0,
        valid_from: new Date().toISOString(),
        valid_until: new Date(Date.now() + 90 * 86400000).toISOString(),
        is_active: true
      });

      await window.RaidhaniData.saveCoupons(coupons);
      this.renderCoupons();

      const modal = document.getElementById('new-coupon-modal');
      if (modal) modal.close();

      if (window.showToast) {
        window.showToast(`Kupon ${code} berhasil dibuat!`);
      }
    }
  };

  window.RaidhaniAdminCoupons = RaidhaniAdminCoupons;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => RaidhaniAdminCoupons.init());
  } else {
    RaidhaniAdminCoupons.init();
  }

})(window);
