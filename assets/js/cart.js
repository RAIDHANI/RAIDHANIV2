/* ============================================================
   RAIDHANI - Shopping Cart Module (PRD v2.1 E-Commerce Engine)
   Local Storage Persisted Cart with Reactive Badge & Modal Drawer
   ============================================================ */

(function(window) {
  'use strict';

  const STORAGE_KEY = 'raidhani_cart_v1';

  function formatIDR(amount) {
    if (typeof amount !== 'number') amount = Number(amount) || 0;
    return 'Rp ' + amount.toLocaleString('id-ID');
  }

  function showToast(message, icon = 'check_circle') {
    let toast = document.getElementById('global-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'global-toast';
      toast.className = 'toast-container';
      document.body.appendChild(toast);
    }

    toast.innerHTML = `
      <span class="material-symbols-outlined" style="color: var(--color-accent-1); font-size: 18px;">${icon}</span>
      <span>${message}</span>
    `;
    toast.classList.add('show');

    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }

  const RaidhaniCart = {
    items: [],

    init() {
      this.load();
      this.updateBadge();
      this.bindEvents();
    },

    load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        this.items = raw ? JSON.parse(raw) : [];
      } catch (e) {
        console.warn('Gagal membaca data keranjang dari localStorage:', e);
        this.items = [];
      }
    },

    save() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
      } catch (e) {
        console.warn('Gagal menyimpan keranjang ke localStorage:', e);
      }
      this.updateBadge();
      window.dispatchEvent(new CustomEvent('raidhani:cart-updated', { detail: { items: this.items } }));
    },

    bindEvents() {
      // Backdrop click on cart dialog
      const cartDialog = document.getElementById('cart-drawer-modal');
      if (cartDialog) {
        cartDialog.addEventListener('click', (e) => {
          if (e.target === cartDialog) {
            this.closeCart();
          }
        });
      }
    },

    updateBadge() {
      const count = this.getTotalCount();
      const badges = document.querySelectorAll('.cart-count-badge');
      badges.forEach(b => {
        b.textContent = count;
        b.style.display = count > 0 ? 'inline-flex' : 'none';
      });
      // Pill "Keranjang (n)" di header v2: angka selalu tampil, termasuk 0
      document.querySelectorAll('.cart-count').forEach(el => {
        el.textContent = count;
      });
    },

    getTotalCount() {
      return this.items.reduce((sum, item) => sum + (item.qty || 1), 0);
    },

    getSubtotal() {
      return this.items.reduce((sum, item) => sum + ((item.price || 0) * (item.qty || 1)), 0);
    },

    addItem(item, notify = true) {
      // Find existing item with identical productId, color, and size
      const existing = this.items.find(i => 
        i.productId === item.productId && 
        i.color === item.color && 
        i.size === item.size
      );

      const addQty = item.qty || 1;

      if (existing) {
        existing.qty += addQty;
      } else {
        this.items.push({
          productId: item.productId,
          productName: item.productName,
          color: item.color,
          size: item.size,
          price: item.price,
          image: item.image,
          qty: addQty
        });
      }

      this.save();

      if (notify) {
        showToast(`${item.productName} (${item.color} / ${item.size}) berhasil disimpan ke keranjang!`, 'shopping_bag');
      }

      // Animasi getar/bounce pada tombol keranjang navbar
      const cartBtns = document.querySelectorAll('.btn-cart-nav');
      cartBtns.forEach(btn => {
        btn.classList.add('cart-bounce');
        setTimeout(() => btn.classList.remove('cart-bounce'), 400);
      });
    },

    removeItem(index) {
      if (index >= 0 && index < this.items.length) {
        const removed = this.items.splice(index, 1);
        this.save();
        this.renderCartModal();
        if (removed.length) {
          showToast(`${removed[0].productName} dihapus dari keranjang.`, 'delete');
        }
      }
    },

    updateQty(index, delta) {
      if (index >= 0 && index < this.items.length) {
        this.items[index].qty += delta;
        if (this.items[index].qty <= 0) {
          this.removeItem(index);
          return;
        }
        this.save();
        this.renderCartModal();
      }
    },

    clearCart() {
      this.items = [];
      this.save();
      this.renderCartModal();
    },

    openCart() {
      this.renderCartModal();
      const dialog = document.getElementById('cart-drawer-modal');
      if (dialog && typeof dialog.showModal === 'function') {
        dialog.showModal();
      }
    },

    closeCart() {
      const dialog = document.getElementById('cart-drawer-modal');
      if (dialog) {
        dialog.close();
      }
    },

    renderCartModal() {
      const container = document.getElementById('cart-items-container');
      const subtotalEl = document.getElementById('cart-subtotal-display');
      const emptyState = document.getElementById('cart-empty-state');
      const footerActions = document.getElementById('cart-footer-actions');

      if (!container) return;

      if (this.items.length === 0) {
        container.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        if (footerActions) footerActions.style.display = 'none';
        if (subtotalEl) subtotalEl.textContent = 'Rp 0';
        return;
      }

      if (emptyState) emptyState.style.display = 'none';
      if (footerActions) footerActions.style.display = 'block';

      let html = '';
      this.items.forEach((item, idx) => {
        html += `
          <div class="cart-item-row">
            <img src="${item.image || 'media/brand/logo.png'}" alt="${item.productName}" class="cart-item-thumb">
            <div class="cart-item-info">
              <h4 class="cart-item-title">${item.productName}</h4>
              <p class="cart-item-variant">${item.color} / ${item.size}</p>
              <span class="cart-item-price">${formatIDR(item.price)}</span>
            </div>
            <div class="cart-item-actions">
              <div class="cart-qty-ctrl">
                <button type="button" class="cart-qty-btn" onclick="RaidhaniCart.updateQty(${idx}, -1)">-</button>
                <span class="cart-qty-val">${item.qty}</span>
                <button type="button" class="cart-qty-btn" onclick="RaidhaniCart.updateQty(${idx}, 1)">+</button>
              </div>
              <button type="button" class="cart-item-del-btn" onclick="RaidhaniCart.removeItem(${idx})" title="Hapus produk">
                <span class="material-symbols-outlined" style="font-size: 16px;">delete</span>
              </button>
            </div>
          </div>
        `;
      });

      container.innerHTML = html;

      if (subtotalEl) {
        subtotalEl.textContent = formatIDR(this.getSubtotal());
      }

      this.updateShopeeCheckout();
    },

    // Shopee tidak bisa menerima isi keranjang dari situs lain: satu produk
    // unik -> halaman produknya, lebih dari satu -> halaman toko. Tanpa
    // tautan Shopee, tombolnya disembunyikan dan "Checkout" tampil seperti semula.
    updateShopeeCheckout() {
      const shopeeBtn = document.getElementById('cart-shopee-btn');
      const hintEl = document.getElementById('cart-shopee-hint');
      const directBtn = document.getElementById('cart-direct-checkout-btn');
      const directLabel = document.getElementById('cart-direct-checkout-label');
      if (!shopeeBtn) return;

      const url = window.RaidhaniShopee ? window.RaidhaniShopee.getCartUrl(this.items) : null;
      const hasShopee = Boolean(url);

      if (hasShopee) shopeeBtn.href = url;
      shopeeBtn.style.display = hasShopee ? '' : 'none';
      if (hintEl) hintEl.style.display = hasShopee ? '' : 'none';

      if (directBtn) {
        directBtn.classList.toggle('btn-primary', !hasShopee);
        directBtn.classList.toggle('btn-secondary', hasShopee);
      }
      if (directLabel) directLabel.textContent = hasShopee ? 'Checkout Langsung' : 'Checkout';
    },

    // Hanya mencatat klik; navigasinya ditangani <a href target="_blank">.
    // Keranjang sengaja tidak dikosongkan: pembeli bisa kembali dan memakai
    // "Checkout Langsung" kalau batal di Shopee.
    trackShopeeCheckout() {
      if (!window.RaidhaniShopee) return;
      const ids = [...new Set(this.items.map(item => item.productId))];
      window.RaidhaniShopee.track('cart', ids.length === 1 ? ids[0] : undefined);
    },

    checkoutFromCart() {
      if (this.items.length === 0) {
        showToast('Keranjang belanja Anda masih kosong.', 'info');
        return;
      }

      this.closeCart();

      // Checkout membawa SELURUH item keranjang, bukan hanya item pertama
      if (window.RaidhaniModal) {
        window.RaidhaniModal.openCheckoutFromCart(this.items);
      }
    }
  };

  window.RaidhaniCart = RaidhaniCart;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => RaidhaniCart.init());
  } else {
    RaidhaniCart.init();
  }

})(window);
