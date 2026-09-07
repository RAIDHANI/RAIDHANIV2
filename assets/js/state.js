/* ============================================================
   RAIDHANI - Central Reactive State Store (PRD v2.1 §6.F)
   ============================================================ */

(function(window) {
  'use strict';

  function formatIDR(amount) {
    if (typeof amount !== 'number') amount = Number(amount) || 0;
    return 'Rp ' + amount.toLocaleString('id-ID');
  }

  function getColorCoverImage(color) {
    if (Array.isArray(color?.gallery) && color.gallery.length) return color.gallery[0];
    if (color?.image) return color.image;
    return 'media/brand/logo.png';
  }

  const RaidhaniState = {
    products: [],
    selectedOptions: {}, // { 'halwa-set': { color: 'Mocca Sand', size: 'S/M', image: '...', price: 230000 } }
    activeCheckout: null,
    activeCoupon: null,

    async init() {
      try {
        this.products = await window.RaidhaniData.getProducts();

        // Setup initial default selected options per product
        this.products.forEach(p => {
          const defaultColor = p.colors && p.colors.length > 0 ? p.colors[0] : { name: 'Default', hex: '#A66E58' };
          const defaultSize = p.sizes && p.sizes.length > 0 ? p.sizes[0] : 'Standard';

          this.selectedOptions[p.id] = {
            productId: p.id,
            productName: p.name,
            color: defaultColor.name,
            colorHex: defaultColor.hex,
            image: getColorCoverImage(defaultColor),
            size: defaultSize,
            priceNormal: p.price_normal,
            pricePromo: p.price_promo || p.price_normal,
            currentPrice: p.price_promo || p.price_normal
          };
        });

        this.renderProductCards();
        window.dispatchEvent(new CustomEvent('raidhani:state-ready', { detail: this }));
      } catch (err) {
        console.error('Failed to init RaidhaniState', err);
      }

      // Render ulang card kalau admin mengubah katalog (mode lokal, tab lain)
      window.addEventListener('raidhani:products-updated', (e) => {
        this.products = e.detail || this.products;
        this.renderProductCards();
      });
    },

    // Katalog 100% ditentukan oleh data (Supabase / localStorage) — tidak
    // ada HTML produk hardcode. Admin mengubah harga/stok/gambar lewat
    // dashboard, dan card di landing page otomatis mengikuti tanpa
    // perlu sentuh kode sama sekali.
    renderProductCards() {
      const grid = document.getElementById('product-grid');
      if (!grid) return;

      const published = this.products.filter(p => p.is_published !== false);

      if (published.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color: var(--color-text-muted); padding: 40px 0;">Katalog sedang diperbarui. Silakan kembali beberapa saat lagi.</p>';
        return;
      }

      grid.innerHTML = published.map(p => this.renderProductCard(p)).join('');
    },

    renderProductCard(p) {
      const colors = p.colors || [];
      const coverImage = colors.length ? getColorCoverImage(colors[0]) : 'media/brand/logo.png';
      const pricePromo = p.price_promo || p.price_normal;
      const hasDiscount = p.price_promo && p.price_promo < p.price_normal;
      const isSoldOut = p.stock_status === 'sold_out';
      const safeName = (p.name || '').replace(/'/g, "\\'");

      return `
        <article class="product-card${isSoldOut ? ' product-card-sold-out' : ''}" id="card-${p.id}" tabindex="0" role="button" aria-label="Lihat detail ${p.name}" onclick="RaidhaniProductDetail.open('${p.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();RaidhaniProductDetail.open('${p.id}');}">
          <div class="product-image-container">
            <img src="${coverImage}" alt="${p.name}" id="product-img-${p.id}" class="product-image">
            ${p.badge ? `<span class="badge badge-signature product-badge-corner">${p.badge}</span>` : ''}
            ${isSoldOut ? '<span class="badge badge-dark product-badge-soldout">Stok Habis</span>' : ''}
          </div>
          <div class="product-body-minimal">
            <h3 class="product-card-title">${p.name}</h3>
            <div class="product-card-price-row">
              <span class="current-price" id="display-price-${p.id}">${formatIDR(pricePromo)}</span>
              ${hasDiscount ? `<span class="original-price">${formatIDR(p.price_normal)}</span>` : ''}
            </div>
          </div>
        </article>
      `;
    },

    selectColor(productId, colorName, colorHex, imageUrl) {
      if (!this.selectedOptions[productId]) return;
      this.selectedOptions[productId].color = colorName;
      this.selectedOptions[productId].colorHex = colorHex;
      if (imageUrl) {
        this.selectedOptions[productId].image = imageUrl;
      }

      window.dispatchEvent(new CustomEvent('raidhani:selection-changed', {
        detail: { productId, type: 'color', value: colorName, item: this.selectedOptions[productId] }
      }));
    },

    selectSize(productId, sizeName) {
      if (!this.selectedOptions[productId]) return;
      this.selectedOptions[productId].size = sizeName;

      window.dispatchEvent(new CustomEvent('raidhani:selection-changed', {
        detail: { productId, type: 'size', value: sizeName, item: this.selectedOptions[productId] }
      }));
    },

    setCheckoutProduct(productId) {
      const selected = this.selectedOptions[productId];
      const product = this.products.find(p => p.id === productId);
      if (!selected || !product) return;

      let finalTotal = selected.currentPrice;
      if (this.activeCoupon && this.activeCoupon.valid) {
        if (this.activeCoupon.discount_type === 'fixed_price') {
          finalTotal = this.activeCoupon.discount_value;
        } else {
          finalTotal = Math.max(0, selected.currentPrice - (this.activeCoupon.discount_value || 100000));
        }
      }

      this.activeCheckout = {
        ...selected,
        rawProduct: product,
        qty: 1,
        finalTotal: finalTotal
      };

      window.dispatchEvent(new CustomEvent('raidhani:checkout-opened', { detail: this.activeCheckout }));
    },

    setCoupon(couponResult) {
      this.activeCoupon = couponResult;
      if (this.activeCheckout && couponResult && couponResult.valid) {
        this.activeCheckout.finalTotal = couponResult.final_price;
      }
      window.dispatchEvent(new CustomEvent('raidhani:coupon-updated', { detail: couponResult }));
    },

    setCheckoutFromCart(cartItems) {
      if (!cartItems || cartItems.length === 0) return;

      const items = cartItems.map(ci => {
        const qty = ci.qty || 1;
        return {
          productId: ci.productId,
          productName: ci.productName,
          color: ci.color,
          size: ci.size,
          price: ci.price,
          qty: qty,
          image: ci.image,
          lineTotal: ci.price * qty
        };
      });

      const subtotal = items.reduce((sum, it) => sum + it.lineTotal, 0);

      let finalTotal = subtotal;
      if (this.activeCoupon && this.activeCoupon.valid) {
        if (this.activeCoupon.discount_type === 'fixed_price') {
          finalTotal = this.activeCoupon.discount_value;
        } else {
          finalTotal = Math.max(0, subtotal - (this.activeCoupon.discount_value || 100000));
        }
      }

      this.activeCheckout = {
        isCart: true,
        items: items,
        productId: items[0].productId,
        productName: items.length > 1 ? `${items.length} Produk Terpilih` : items[0].productName,
        color: items[0].color,
        size: items[0].size,
        image: items[0].image,
        priceNormal: subtotal,
        pricePromo: subtotal,
        currentPrice: subtotal,
        subtotal: subtotal,
        finalTotal: finalTotal
      };

      window.dispatchEvent(new CustomEvent('raidhani:checkout-opened', { detail: this.activeCheckout }));
    },

    formatPrice(amount) {
      return formatIDR(amount);
    }
  };

  window.RaidhaniState = RaidhaniState;

  // Auto-init saat DOM siap
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => RaidhaniState.init());
  } else {
    RaidhaniState.init();
  }

})(window);
