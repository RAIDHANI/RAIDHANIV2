/* ============================================================
   RAIDHANI - Product Detail Modal & Selector Engine
   Marketplace-Style Interactive Modal with Color/Size/Gallery/Cart
   Sumber data: RaidhaniState.products (Supabase live / localStorage
   fallback) — TIDAK ADA data produk hardcode di sini, supaya seluruh
   katalog 100% bisa diubah dari admin dashboard tanpa sentuh kode.
   ============================================================ */

(function(window) {
  'use strict';

  function formatIDR(amount) {
    if (typeof amount !== 'number') amount = Number(amount) || 0;
    return 'Rp ' + amount.toLocaleString('id-ID');
  }

  function getProductById(productId) {
    const products = window.RaidhaniState?.products || [];
    return products.find(p => p.id === productId) || null;
  }

  function buildStockText(data) {
    if (data.stock_status === 'sold_out') return 'Stok Habis';
    if (data.stock_status === 'limited') return `Sisa ${data.stock_count ?? 0} pcs (Stok Terbatas)`;
    return `Stok Tersedia / Sisa ${data.stock_count ?? 0} pcs`;
  }

  function buildDiscountText(data) {
    const diff = (data.price_normal || 0) - (data.price_promo || data.price_normal || 0);
    if (diff <= 0) return '';
    return `Hemat ${formatIDR(diff)}`;
  }

  function buildRatingText(data) {
    const rating = data.rating ?? 0;
    const count = data.review_count ?? 0;
    return `${rating} (${count} ulasan)`;
  }

  // Ambil array galeri foto untuk satu varian warna. Menerima bentuk
  // { gallery: [...] } (skema baru) maupun { image: '...' } (fallback
  // data lama) supaya tidak patah kalau ada baris lama yang belum
  // dimigrasikan admin.
  function getColorGallery(color) {
    if (Array.isArray(color?.gallery) && color.gallery.length) return color.gallery;
    if (color?.image) return [color.image];
    return ['media/brand/logo.png'];
  }

  const RaidhaniProductDetail = {
    activeProductId: null,
    activeColor: null,
    activeSize: '',
    activeQty: 1,
    activeThumbIndex: 0,

    init() {
      const modal = document.getElementById('product-detail-modal');
      if (modal) {
        modal.addEventListener('click', (e) => {
          if (e.target === modal) {
            this.close();
          }
        });
      }
    },

    open(productId, autoFocusBuy = false) {
      const data = getProductById(productId);
      if (!data) {
        // Data produk belum selesai dimuat (mis. fetch Supabase belum
        // resolve) — coba lagi begitu state siap, alih-alih diam saja.
        if (window.RaidhaniState && !window.RaidhaniState.products?.length) {
          window.addEventListener('raidhani:state-ready', () => this.open(productId, autoFocusBuy), { once: true });
        }
        return;
      }

      this.activeProductId = productId;
      this.activeQty = 1;
      this.activeThumbIndex = 0;

      const colors = data.colors || [];
      const sizes = data.sizes || [];

      // Set default selected color & size, atau ambil dari RaidhaniState
      const stateSelected = window.RaidhaniState?.selectedOptions?.[productId];
      if (stateSelected && stateSelected.color) {
        this.activeColor = colors.find(c => c.name === stateSelected.color) || colors[0];
        this.activeSize = stateSelected.size || sizes[0];
      } else {
        this.activeColor = colors[0] || null;
        this.activeSize = sizes[0] || '';
      }

      // Populate text info
      const titleEl = document.getElementById('detail-modal-title');
      if (titleEl) titleEl.textContent = data.name;

      const taglineEl = document.getElementById('detail-modal-tagline');
      if (taglineEl) taglineEl.textContent = data.tagline || '';

      const badgeEl = document.getElementById('detail-modal-badge');
      if (badgeEl) badgeEl.textContent = data.badge || '';

      const ratingEl = document.getElementById('detail-modal-rating');
      if (ratingEl) ratingEl.textContent = buildRatingText(data);

      const currentPriceEl = document.getElementById('detail-modal-current-price');
      if (currentPriceEl) currentPriceEl.textContent = formatIDR(data.price_promo || data.price_normal);

      const originalPriceEl = document.getElementById('detail-modal-original-price');
      if (originalPriceEl) originalPriceEl.textContent = formatIDR(data.price_normal);

      const discountBadgeEl = document.getElementById('detail-modal-discount-badge');
      if (discountBadgeEl) {
        const discountText = buildDiscountText(data);
        discountBadgeEl.textContent = discountText;
        discountBadgeEl.style.display = discountText ? '' : 'none';
      }

      const stockTagEl = document.getElementById('detail-modal-stock-tag');
      if (stockTagEl) stockTagEl.textContent = buildStockText(data);

      const descEl = document.getElementById('detail-modal-desc');
      if (descEl) descEl.textContent = data.description || '';

      const qtyEl = document.getElementById('detail-modal-qty');
      if (qtyEl) qtyEl.textContent = this.activeQty;

      this.renderSwatches(data);
      this.renderSizes(data);
      this.renderGallery();
      this.updateModalWhatsAppLink(data);

      const modal = document.getElementById('product-detail-modal');
      if (modal && typeof modal.showModal === 'function') {
        modal.showModal();
        if (window.RaidhaniAnalytics) {
          window.RaidhaniAnalytics.trackEvent('product_detail_open', { product_id: productId });
        }
      }
    },

    close() {
      const modal = document.getElementById('product-detail-modal');
      if (modal) modal.close();
    },

    renderGallery() {
      if (!this.activeColor) return;
      const gallery = getColorGallery(this.activeColor);
      const safeIndex = Math.min(this.activeThumbIndex, gallery.length - 1);

      const mainImg = document.getElementById('detail-modal-main-img');
      const thumbsContainer = document.getElementById('detail-modal-thumbs');

      if (mainImg) {
        mainImg.style.opacity = '0.7';
        setTimeout(() => {
          mainImg.src = gallery[safeIndex];
          mainImg.alt = `${this.activeColor.name} Foto ${safeIndex + 1}`;
          mainImg.style.opacity = '1';
        }, 120);
      }

      if (thumbsContainer) {
        let html = '';
        gallery.forEach((src, i) => {
          const isActive = (i === safeIndex);
          html += `
            <img src="${src}"
                 alt="Foto ${i + 1}"
                 class="detail-modal-thumb ${isActive ? 'active' : ''}"
                 onclick="RaidhaniProductDetail.selectThumb(${i})">
          `;
        });
        thumbsContainer.innerHTML = html;
      }
    },

    selectThumb(index) {
      this.activeThumbIndex = index;
      this.renderGallery();
    },

    renderSwatches(data) {
      const container = document.getElementById('detail-modal-swatches');
      const labelEl = document.getElementById('detail-modal-color-label');
      if (labelEl && this.activeColor) labelEl.textContent = this.activeColor.name;

      if (!container) return;
      let html = '';
      (data.colors || []).forEach(c => {
        const isActive = this.activeColor && (c.name === this.activeColor.name);
        html += `
          <button type="button"
                  class="color-swatch-btn ${isActive ? 'active' : ''}"
                  style="background-color: ${c.hex};"
                  title="${c.name}"
                  onclick="RaidhaniProductDetail.selectColor('${c.name.replace(/'/g, "\\'")}')">
            <span class="material-symbols-outlined" style="font-size: 14px; color: #FFFFFF; display: ${isActive ? 'block' : 'none'};">check</span>
          </button>
        `;
      });
      container.innerHTML = html;
    },

    selectColor(colorName) {
      const data = getProductById(this.activeProductId);
      if (!data) return;

      const found = (data.colors || []).find(c => c.name === colorName);
      if (!found) return;

      this.activeColor = found;
      this.activeThumbIndex = 0;
      this.renderSwatches(data);
      this.renderGallery();

      if (window.RaidhaniState) {
        window.RaidhaniState.selectColor(this.activeProductId, found.name, found.hex, getColorGallery(found)[0]);
      }
      const cardImg = document.getElementById(`product-img-${this.activeProductId}`);
      if (cardImg) {
        cardImg.src = getColorGallery(found)[0];
      }

      this.updateModalWhatsAppLink(data);
    },

    renderSizes(data) {
      const container = document.getElementById('detail-modal-sizes');
      const labelEl = document.getElementById('detail-modal-size-label');
      if (labelEl) labelEl.textContent = this.activeSize;

      if (!container) return;
      let html = '';
      (data.sizes || []).forEach(s => {
        const isActive = (s === this.activeSize);
        html += `
          <button type="button"
                  class="size-btn ${isActive ? 'active' : ''}"
                  onclick="RaidhaniProductDetail.selectSize('${s.replace(/'/g, "\\'")}')">
            ${s}
          </button>
        `;
      });
      container.innerHTML = html;
    },

    selectSize(sizeName) {
      this.activeSize = sizeName;
      const data = getProductById(this.activeProductId);
      if (data) this.renderSizes(data);

      if (window.RaidhaniState) {
        window.RaidhaniState.selectSize(this.activeProductId, sizeName);
      }

      this.updateModalWhatsAppLink(data);
    },

    changeQty(delta) {
      this.activeQty = Math.max(1, Math.min(99, this.activeQty + delta));
      const qtyEl = document.getElementById('detail-modal-qty');
      if (qtyEl) qtyEl.textContent = this.activeQty;
    },

    addToCart() {
      const data = getProductById(this.activeProductId);
      if (!data || !window.RaidhaniCart) return;

      window.RaidhaniCart.addItem({
        productId: data.id,
        productName: data.name,
        color: this.activeColor ? this.activeColor.name : 'Default',
        size: this.activeSize,
        price: data.price_promo || data.price_normal,
        image: this.activeColor ? getColorGallery(this.activeColor)[0] : getColorGallery((data.colors || [])[0])[0],
        qty: this.activeQty
      });
    },

    buyNow() {
      const data = getProductById(this.activeProductId);
      if (!data) return;

      if (window.RaidhaniState) {
        window.RaidhaniState.selectColor(
          data.id,
          this.activeColor.name,
          this.activeColor.hex,
          getColorGallery(this.activeColor)[0]
        );
        window.RaidhaniState.selectSize(data.id, this.activeSize);
      }

      this.close();

      if (window.RaidhaniModal) {
        window.RaidhaniModal.openCheckout(data.id);
      }
    },

    updateModalWhatsAppLink(data) {
      const waBtn = document.getElementById('detail-modal-btn-wa');
      if (!waBtn || !window.RaidhaniWA || !data || !this.activeColor) return;

      const priceFormatted = formatIDR(data.price_promo || data.price_normal);
      waBtn.href = window.RaidhaniWA.getProductInquiryUrl(data.name, this.activeColor.name, this.activeSize, priceFormatted);
    }
  };

  window.RaidhaniProductDetail = RaidhaniProductDetail;
  window.RaidhaniProductUtils = { formatIDR, buildStockText, buildDiscountText, buildRatingText, getColorGallery };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => RaidhaniProductDetail.init());
  } else {
    RaidhaniProductDetail.init();
  }

})(window);
