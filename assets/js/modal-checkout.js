/* ============================================================
   RAIDHANI - 2-Stage Instant Checkout & Modals Engine (PRD v2.1 §8 FR-7 & FR-9)
   Native HTML5 <dialog> with Safari backdrop fallback & UU PDP compliance
   ============================================================ */

(function(window) {
  'use strict';

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

  function copyToClipboard(text, label = 'Teks') {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showToast(`${label} berhasil disalin ke clipboard!`);
      }).catch(() => {
        fallbackCopy(text, label);
      });
    } else {
      fallbackCopy(text, label);
    }
  }

  function fallbackCopy(text, label) {
    const input = document.createElement('input');
    input.value = text;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    showToast(`${label} berhasil disalin!`);
  }

  const RaidhaniModal = {
    currentOrder: null,

    init() {
      // Backdrop click fallback sesuai PRD §17.B
      ['checkout-modal', 'sizeguide-modal', 'product-detail-modal', 'cart-drawer-modal'].forEach(id => {
        const dialog = document.getElementById(id);
        if (!dialog) return;

        dialog.addEventListener('click', (e) => {
          if (e.target !== dialog) return;
          const r = dialog.getBoundingClientRect();
          const inside = r.top <= e.clientY && e.clientY <= r.top + r.height && r.left <= e.clientX && e.clientX <= r.left + r.width;
          if (!inside) dialog.close();
        });
      });

      // Hook Form Checkout Submit
      const form = document.getElementById('checkout-order-form');
      if (form) {
        form.addEventListener('submit', this.handleOrderSubmit.bind(this));
      }

      // Hook Coupon Apply Button
      const applyCouponBtn = document.getElementById('btn-apply-modal-coupon');
      if (applyCouponBtn) {
        applyCouponBtn.addEventListener('click', this.handleApplyCoupon.bind(this));
      }
    },

    openSizeGuide() {
      const dialog = document.getElementById('sizeguide-modal');
      if (dialog && typeof dialog.showModal === 'function') {
        dialog.showModal();
        if (window.RaidhaniAnalytics) window.RaidhaniAnalytics.trackEvent('size_guide_open');
      }
    },

    closeSizeGuide() {
      const dialog = document.getElementById('sizeguide-modal');
      if (dialog) dialog.close();
    },

    openCheckout(productId, qty = 1) {
      // Pembelian di website memerlukan akun terverifikasi terlebih dahulu.
      // Catatan: callback yang dikirim ke requireLogin HANYA boleh berisi
      // logika "setelah lolos gate" (_doOpenCheckout), bukan openCheckout
      // itu sendiri — kalau tidak, saat sudah login requireLogin akan
      // memanggil openCheckout lagi -> memanggil requireLogin lagi -> rekursi tak berhenti.
      const proceed = () => this._doOpenCheckout(productId, qty);
      if (window.RaidhaniAuth) {
        window.RaidhaniAuth.requireLogin(proceed);
      } else {
        proceed();
      }
    },

    _doOpenCheckout(productId, qty = 1) {
      if (window.RaidhaniState) {
        window.RaidhaniState.setCheckoutProduct(productId, qty);
      }

      const active = window.RaidhaniState?.activeCheckout;
      if (!active) return;

      this.populateStage1(active);

      // Tampilkan Tahap 1, sembunyikan Tahap 2
      document.getElementById('checkout-stage-1').style.display = 'block';
      document.getElementById('checkout-stage-2').style.display = 'none';

      const dialog = document.getElementById('checkout-modal');
      if (dialog && typeof dialog.showModal === 'function') {
        dialog.showModal();
        if (window.RaidhaniAnalytics) window.RaidhaniAnalytics.trackEvent('checkout_modal_open', { product_id: productId });
      }
    },

    openCheckoutFromCart(cartItems) {
      const proceed = () => this._doOpenCheckoutFromCart(cartItems);
      if (window.RaidhaniAuth) {
        window.RaidhaniAuth.requireLogin(proceed);
      } else {
        proceed();
      }
    },

    _doOpenCheckoutFromCart(cartItems) {
      if (window.RaidhaniState) {
        window.RaidhaniState.setCheckoutFromCart(cartItems);
      }

      const active = window.RaidhaniState?.activeCheckout;
      if (!active) return;

      this.populateStage1(active);

      document.getElementById('checkout-stage-1').style.display = 'block';
      document.getElementById('checkout-stage-2').style.display = 'none';

      const dialog = document.getElementById('checkout-modal');
      if (dialog && typeof dialog.showModal === 'function') {
        dialog.showModal();
        if (window.RaidhaniAnalytics) window.RaidhaniAnalytics.trackEvent('checkout_modal_open', { cart_item_count: cartItems.length });
      }
    },

    populateStage1(item) {
      const singleBox = document.getElementById('checkout-single-item-summary');
      const cartBox = document.getElementById('checkout-cart-items-summary');

      if (item.isCart && item.items && item.items.length) {
        if (singleBox) singleBox.style.display = 'none';
        if (cartBox) cartBox.style.display = 'block';

        const listEl = document.getElementById('checkout-cart-items-list');
        if (listEl) {
          listEl.innerHTML = item.items.map(it => `
            <div style="display: flex; align-items: center; gap: 12px;">
              <img src="${it.image || 'media/brand/logo.png'}" alt="${it.productName}" style="width: 44px; height: 56px; object-fit: cover; border-radius: var(--radius-md); background: var(--color-surface-warm); flex-shrink: 0;">
              <div style="flex: 1; min-width: 0;">
                <div style="font-size: 13px; font-weight: 600; color: var(--color-text-primary);">${it.productName}</div>
                <div style="font-size: 11px; color: var(--color-text-muted);">${it.color} / ${it.size} &times; ${it.qty}</div>
              </div>
              <div style="font-size: 13px; font-weight: 600; color: var(--color-text-primary); white-space: nowrap;">${window.RaidhaniState.formatPrice(it.lineTotal)}</div>
            </div>
          `).join('');
        }

        const countEl = document.getElementById('checkout-cart-item-count');
        if (countEl) countEl.textContent = item.items.length;

        this.updateCartSubtotalDisplay(item);
      } else {
        if (cartBox) cartBox.style.display = 'none';
        if (singleBox) singleBox.style.display = 'flex';

        const img = document.getElementById('checkout-img');
        const title = document.getElementById('checkout-product-title');
        const color = document.getElementById('checkout-color-label');
        const size = document.getElementById('checkout-size-label');
        const qtyLine = document.getElementById('checkout-qty-line');
        const qtyValue = document.getElementById('checkout-qty-value');
        const priceNormal = document.getElementById('checkout-price-normal');
        const priceFinal = document.getElementById('checkout-price-final');

        const qty = item.qty || 1;

        if (img) img.src = item.image;
        if (title) title.textContent = item.productName;
        if (color) color.textContent = item.color;
        if (size) size.textContent = item.size;
        if (qtyLine) qtyLine.style.display = qty > 1 ? 'block' : 'none';
        if (qtyValue) qtyValue.textContent = qty;
        if (priceNormal) priceNormal.textContent = window.RaidhaniState.formatPrice(item.priceNormal * qty);
        if (priceFinal) priceFinal.textContent = window.RaidhaniState.formatPrice(item.finalTotal);
      }

      const activeCoupon = window.RaidhaniState?.activeCoupon;
      const input = document.getElementById('modal-coupon-code');
      const statusEl = document.getElementById('modal-coupon-msg');
      if (activeCoupon && activeCoupon.valid) {
        if (input) input.value = activeCoupon.code;
        if (statusEl) {
          statusEl.textContent = `Voucher ${activeCoupon.code} terpasang (-${window.RaidhaniState.formatPrice(activeCoupon.discount_value || 100000)})`;
          statusEl.style.color = 'var(--color-success)';
        }
      }
    },

    updateCartSubtotalDisplay(item) {
      const beforeEl = document.getElementById('checkout-cart-subtotal-before');
      const afterEl = document.getElementById('checkout-cart-subtotal');
      if (afterEl) afterEl.textContent = window.RaidhaniState.formatPrice(item.finalTotal);
      if (beforeEl) {
        if (item.subtotal > item.finalTotal) {
          beforeEl.textContent = window.RaidhaniState.formatPrice(item.subtotal);
          beforeEl.style.display = 'block';
        } else {
          beforeEl.style.display = 'none';
        }
      }
    },

    async handleApplyCoupon(e) {
      e.preventDefault();
      const input = document.getElementById('modal-coupon-code');
      const statusEl = document.getElementById('modal-coupon-msg');
      if (!input || !statusEl) return;

      const code = input.value.trim();
      if (!code) {
        statusEl.textContent = 'Silakan masukkan kode voucher.';
        statusEl.style.color = 'var(--color-error)';
        return;
      }

      await this.claimPromoCode(code);
    },

    // Klaim dari landing page (tiket kupon & announcement bar), idempoten per
    // sesi: redeemCoupon menambah quota_used di SETIAP panggilan (localStore
    // maupun RPC redeem_coupon), jadi klik berulang pada kupon yang sudah
    // terpasang cukup menyalin ulang kodenya. Kolom kupon di modal checkout
    // tetap lewat claimPromoCode agar diskon per-pcs dihitung ulang untuk qty terbaru.
    async claimFromPromo(code) {
      const applied = window.RaidhaniState?.activeCoupon;
      if (applied && applied.valid && String(applied.code).toUpperCase() === String(code).trim().toUpperCase()) {
        copyToClipboard(applied.code, 'Kode Kupon ' + applied.code);
        return;
      }
      await this.claimPromoCode(code);
    },

    async claimPromoCode(code) {
      code = (code || 'RAIDHANI100K').trim().toUpperCase();
      copyToClipboard(code, 'Kode Kupon ' + code);

      const active = window.RaidhaniState?.activeCheckout;
      const originalPrice = active ? (active.subtotal ?? (active.pricePromo || active.priceNormal)) : 380000;
      const qty = active?.qty || 1;

      const res = await window.RaidhaniData.redeemCoupon(code, originalPrice, qty);
      if (res.valid) {
        if (window.RaidhaniState) {
          window.RaidhaniState.setCoupon(res);
        }

        // Update modal coupon fields if open
        const input = document.getElementById('modal-coupon-code');
        const statusEl = document.getElementById('modal-coupon-msg');
        if (input) input.value = code;
        if (statusEl) {
          statusEl.textContent = res.message;
          statusEl.style.color = 'var(--color-success)';
        }

        const active = window.RaidhaniState?.activeCheckout;
        if (active && active.isCart) {
          this.updateCartSubtotalDisplay(active);
        } else {
          const finalPriceEl = document.getElementById('checkout-price-final');
          if (finalPriceEl && window.RaidhaniState) {
            finalPriceEl.textContent = window.RaidhaniState.formatPrice(res.final_price);
          }
        }

        // State "terpasang" di tiket kupon & announcement bar diselaraskan oleh
        // coupon-ticket.js lewat event raidhani:coupon-updated (dari setCoupon di atas).

        // Show coupon applied tags in product cards
        document.querySelectorAll('.coupon-active-badge').forEach(el => {
          el.style.display = 'inline-flex';
          el.textContent = `Voucher Aktif: ${code} (-${window.RaidhaniState.formatPrice(res.discount_value)})`;
        });

        showToast(`Kupon '${code}' berhasil diklaim & disalin! Potongan telah terpasang.`);
        if (window.RaidhaniAnalytics) window.RaidhaniAnalytics.trackEvent('coupon_applied', { code });
      } else {
        showToast(res.message, 'error');
      }
    },

    async handleOrderSubmit(e) {
      e.preventDefault();
      const active = window.RaidhaniState?.activeCheckout;
      if (!active) return;

      const name = document.getElementById('cust-name').value.trim();
      const whatsapp = document.getElementById('cust-wa').value.trim();
      const address = document.getElementById('cust-address').value.trim();
      const city = document.getElementById('cust-city').value.trim();
      const postal = document.getElementById('cust-postal').value.trim();
      const notes = document.getElementById('cust-notes') ? document.getElementById('cust-notes').value.trim() : '';
      const consentPdp = document.getElementById('cust-consent-pdp').checked;

      // Validasi form (Tabel Validasi FR-9)
      if (name.length < 3) {
        showToast('Nama lengkap minimal 3 karakter.', 'warning');
        return;
      }
      if (!/^(\+?62|08)[0-9]{8,13}$/.test(whatsapp)) {
        showToast('Format WhatsApp harus nomor Indonesia (08... atau 62...).', 'warning');
        return;
      }
      if (address.length < 10) {
        showToast('Alamat lengkap minimal 10 karakter.', 'warning');
        return;
      }
      if (!/^[0-9]{5}$/.test(postal)) {
        showToast('Kode pos harus 5 digit angka.', 'warning');
        return;
      }
      if (!consentPdp) {
        showToast('Persetujuan UU PDP wajib dicentang untuk memproses pesanan.', 'warning');
        return;
      }

      // Normalisasi WA ke format internasional 62xxx
      let normalizedWa = whatsapp.replace(/\D/g, '');
      if (normalizedWa.startsWith('0')) {
        normalizedWa = '62' + normalizedWa.substring(1);
      }

      // Hitung 3-digit kode unik acak untuk verifikasi transfer bank
      const uniqueDigits = Math.floor(100 + Math.random() * 899);
      const couponCode = window.RaidhaniState?.activeCoupon?.code || null;
      const buyerFields = {
        buyer_name: name,
        buyer_whatsapp: normalizedWa,
        buyer_address: address,
        buyer_city_district: city,
        buyer_postal_code: postal,
        buyer_notes: notes,
        consent_pdp: true
      };

      let createdOrder;

      try {
      if (active.isCart && active.items && active.items.length) {
        // Checkout dari keranjang: buat SATU order per produk agar semua item
        // (bukan hanya produk pertama) ikut tercatat & terhitung dalam total.
        const totalWithDigits = active.finalTotal + uniqueDigits;
        const discountApplied = Math.max(0, active.subtotal - active.finalTotal);
        const lastIndex = active.items.length - 1;
        const createdItems = [];
        let groupId = null;

        for (let i = 0; i < active.items.length; i++) {
          const lineItem = active.items[i];
          let lineTotalPrice = lineItem.lineTotal;
          if (i === lastIndex) {
            // Item terakhir menyerap diskon kupon + kode unik verifikasi,
            // sehingga total gabungan tetap presisi sama dengan yang ditampilkan ke customer.
            lineTotalPrice = lineItem.lineTotal - discountApplied + uniqueDigits;
          }

          const order = await window.RaidhaniData.createOrder({
            product_id: lineItem.productId,
            product_name: lineItem.productName,
            color: lineItem.color,
            size: lineItem.size,
            qty: lineItem.qty,
            unit_price: lineItem.price,
            total_price: Math.round(lineTotalPrice),
            coupon_code: couponCode,
            order_group_id: groupId || undefined,
            ...buyerFields
          });

          if (!groupId) groupId = order.order_id;
          createdItems.push(order);
        }

        createdOrder = {
          ...createdItems[0],
          total_price: totalWithDigits,
          items: createdItems
        };

        if (window.RaidhaniCart) {
          window.RaidhaniCart.clearCart();
        }
      } else {
        const totalFinalWithDigits = active.finalTotal + uniqueDigits;

        createdOrder = await window.RaidhaniData.createOrder({
          product_id: active.productId,
          product_name: active.productName,
          color: active.color,
          size: active.size,
          qty: active.qty || 1,
          unit_price: active.currentPrice,
          total_price: totalFinalWithDigits,
          coupon_code: couponCode,
          ...buyerFields
        });
      }

      this.currentOrder = createdOrder;

      // Render ke Tahap 2
      this.populateStage2(createdOrder);

      // Transisi lembut ke Tahap 2
      const stage1 = document.getElementById('checkout-stage-1');
      const stage2 = document.getElementById('checkout-stage-2');
      
      stage1.style.opacity = '0';
      setTimeout(() => {
        stage1.style.display = 'none';
        stage2.style.display = 'block';
        stage2.style.opacity = '1';
      }, 150);

      showToast('Pesanan berhasil dicatat!');
      if (window.RaidhaniAnalytics) window.RaidhaniAnalytics.trackEvent('checkout_submit', { order_id: createdOrder.order_id });
      } catch (err) {
        console.error('[RAIDHANI] Gagal membuat pesanan:', err);
        showToast('Gagal mencatat pesanan. Silakan coba lagi atau hubungi kami via WhatsApp.', 'error');
      }
    },

    populateStage2(order) {
      const orderIdEl = document.getElementById('stage2-order-id');
      const totalAmountEl = document.getElementById('stage2-total-transfer');
      const waBtn = document.getElementById('stage2-wa-confirm-btn');

      if (orderIdEl) orderIdEl.textContent = order.order_id;
      if (totalAmountEl) totalAmountEl.textContent = window.RaidhaniState.formatPrice(order.total_price);

      if (waBtn && window.RaidhaniWA) {
        waBtn.href = window.RaidhaniWA.getPaymentConfirmationUrl(order);
      }

      this.resetPaymentProofUI();
    },

    // --------------------------------------------------------------
    // Konfirmasi Pembayaran Tier 1: Upload Bukti Transfer di Web
    // (pelengkap jalur WhatsApp yang sudah ada, bukan pengganti)
    // --------------------------------------------------------------
    _pendingProofFile: null,

    handlePaymentProofSelected(event) {
      const file = event.target.files && event.target.files[0];
      const statusEl = document.getElementById('payment-proof-status');
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        if (statusEl) { statusEl.textContent = 'File harus berupa gambar (JPG/PNG).'; statusEl.style.color = 'var(--color-error)'; }
        event.target.value = '';
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        if (statusEl) { statusEl.textContent = 'Ukuran file maksimal 5MB.'; statusEl.style.color = 'var(--color-error)'; }
        event.target.value = '';
        return;
      }

      this._pendingProofFile = file;
      if (statusEl) statusEl.textContent = '';

      const previewWrap = document.getElementById('payment-proof-preview');
      const previewImg = document.getElementById('payment-proof-preview-img');
      const filenameEl = document.getElementById('payment-proof-filename');
      const dropzone = document.getElementById('payment-proof-dropzone');
      const uploadBtn = document.getElementById('btn-upload-payment-proof');

      if (previewImg) previewImg.src = URL.createObjectURL(file);
      if (filenameEl) filenameEl.textContent = file.name;
      if (previewWrap) previewWrap.style.display = 'flex';
      if (dropzone) dropzone.style.display = 'none';
      if (uploadBtn) uploadBtn.style.display = 'flex';
    },

    clearPaymentProof() {
      this._pendingProofFile = null;
      const input = document.getElementById('payment-proof-input');
      const previewWrap = document.getElementById('payment-proof-preview');
      const dropzone = document.getElementById('payment-proof-dropzone');
      const uploadBtn = document.getElementById('btn-upload-payment-proof');
      const statusEl = document.getElementById('payment-proof-status');

      if (input) input.value = '';
      if (previewWrap) previewWrap.style.display = 'none';
      if (dropzone) dropzone.style.display = 'flex';
      if (uploadBtn) uploadBtn.style.display = 'none';
      if (statusEl) statusEl.textContent = '';
    },

    resetPaymentProofUI() {
      this.clearPaymentProof();
    },

    async submitPaymentProof() {
      const statusEl = document.getElementById('payment-proof-status');
      const uploadBtn = document.getElementById('btn-upload-payment-proof');
      const uploadBtnText = document.getElementById('btn-upload-payment-proof-text');

      if (!this._pendingProofFile || !this.currentOrder) return;

      if (uploadBtn) uploadBtn.disabled = true;
      if (uploadBtnText) uploadBtnText.textContent = 'Mengunggah...';
      if (statusEl) { statusEl.textContent = ''; }

      try {
        await window.RaidhaniData.uploadPaymentProof(this.currentOrder.order_id, this._pendingProofFile);

        const isLive = window.RaidhaniData.isLiveSupabase;
        if (statusEl) {
          statusEl.textContent = isLive
            ? 'Bukti transfer berhasil diupload. Admin akan segera memverifikasi.'
            : 'Bukti tersimpan (mode demo — backend Supabase belum terhubung).';
          statusEl.style.color = 'var(--color-success)';
        }
        if (uploadBtnText) uploadBtnText.textContent = 'Bukti Terupload ✓';
        showToast('Bukti transfer berhasil diupload!', 'cloud_done');
        if (window.RaidhaniAnalytics) window.RaidhaniAnalytics.trackEvent('payment_proof_uploaded', { order_id: this.currentOrder.order_id });
      } catch (err) {
        console.error('[RAIDHANI] Upload bukti transfer gagal:', err);
        if (statusEl) { statusEl.textContent = 'Upload gagal. Silakan kirim bukti via WhatsApp sebagai alternatif.'; statusEl.style.color = 'var(--color-error)'; }
        if (uploadBtn) uploadBtn.disabled = false;
        if (uploadBtnText) uploadBtnText.textContent = 'Coba Upload Lagi';
      }
    },

    returnToStage1() {
      const stage1 = document.getElementById('checkout-stage-1');
      const stage2 = document.getElementById('checkout-stage-2');

      stage2.style.opacity = '0';
      setTimeout(() => {
        stage2.style.display = 'none';
        stage1.style.display = 'block';
        stage1.style.opacity = '1';
      }, 150);
    },

    closeCheckout() {
      const dialog = document.getElementById('checkout-modal');
      if (dialog) dialog.close();
    }
  };

  window.RaidhaniModal = RaidhaniModal;
  window.copyToClipboard = copyToClipboard;
  window.showToast = showToast;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => RaidhaniModal.init());
  } else {
    RaidhaniModal.init();
  }

})(window);
