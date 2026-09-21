/* ============================================================
   RAIDHANI - Admin CMS Produk
   Katalog 100% dapat diubah dari dashboard: nama, tagline,
   deskripsi, harga, stok, ukuran, varian warna, dan foto per
   warna (upload langsung) — tanpa perlu sentuh kode sama sekali.
   ============================================================ */

(function(window) {
  'use strict';

  let products = [];
  let editingDraft = null; // working copy produk yang sedang diedit
  let isNewProduct = false;

  function slugify(text) {
    return (text || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'produk-baru';
  }

  function formatIDR(amount) {
    return 'Rp ' + (amount || 0).toLocaleString('id-ID');
  }

  const RaidhaniAdminProducts = {
    async init() {
      products = await window.RaidhaniData.getProducts();
      this.renderProductList();

      const form = document.getElementById('cms-product-form');
      if (form) {
        form.addEventListener('submit', this.handleSaveProduct.bind(this));
      }

      const sizeInput = document.getElementById('edit-size-input');
      if (sizeInput) {
        sizeInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            this.addSize();
          }
        });
      }
    },

    renderProductList() {
      const container = document.getElementById('cms-product-list');
      if (!container) return;

      const sidebarBadge = document.getElementById('sidebar-sku-badge');
      if (sidebarBadge) sidebarBadge.textContent = `${products.length} SKU`;

      container.innerHTML = '';
      products.forEach(p => {
        const card = document.createElement('div');
        card.className = 'cms-product-card';

        const colors = p.colors || [];
        const firstImg = colors[0]?.gallery?.[0] || colors[0]?.image || 'media/brand/logo.png';
        const normalPriceFormatted = formatIDR(p.price_normal);
        const promoPriceFormatted = p.price_promo ? formatIDR(p.price_promo) : '-';

        let stockBadgeHtml = '';
        if (p.stock_status === 'limited') {
          stockBadgeHtml = `<span class="badge" style="background:#FEF3C7;color:#92400E;">Sisa ${p.stock_count || 0} pcs (Kritis)</span>`;
        } else if (p.stock_status === 'sold_out') {
          stockBadgeHtml = '<span class="badge" style="background:#FFE4E6;color:#9F1239;">Sold Out</span>';
        } else {
          stockBadgeHtml = '<span class="badge badge-sage">In Stock</span>';
        }

        if (p.is_published === false) {
          stockBadgeHtml += ' <span class="badge" style="background:#E5E7EB;color:#374151;">Draft</span>';
        }

        card.innerHTML = `
          <div class="flex items-center gap-3">
            <img src="${firstImg}" style="width:56px;height:64px;object-fit:cover;border-radius:10px;background:#F2ECE4;flex-shrink:0;" alt="${p.name}">
            <div style="flex:1;">
              <div class="flex items-center gap-2" style="margin-bottom:4px;">
                <h4 class="font-semibold text-espresso-deep" style="font-size:14px;margin:0;">${p.name}</h4>
                ${stockBadgeHtml}
              </div>
              <p class="text-espresso-muted" style="font-size:11.5px;margin:0 0 4px;">${p.sku || p.id} &bull; ${colors.length} Warna &bull; ${(p.sizes || []).length} Ukuran</p>
              <div class="flex items-center gap-3" style="font-size:12px;">
                <span class="text-espresso-deep">Harga Normal: <strong>${normalPriceFormatted}</strong></span>
                <span class="text-terracotta-rich">Promo: <strong>${promoPriceFormatted}</strong></span>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2" style="justify-content:flex-end;">
            <button class="btn btn-secondary btn-sm" onclick="RaidhaniAdminProducts.openEditModal('${p.id}')">
              <span class="material-symbols-outlined" style="font-size: 15px;">edit</span>
              <span>Edit Produk</span>
            </button>
          </div>
        `;

        container.appendChild(card);
      });
    },

    openEditModal(productId) {
      const p = products.find(item => item.id === productId);
      if (!p) return;

      isNewProduct = false;
      editingDraft = JSON.parse(JSON.stringify(p));
      editingDraft.colors = editingDraft.colors || [];
      editingDraft.sizes = editingDraft.sizes || [];
      // Normalisasi field lama (image tunggal) -> gallery array
      editingDraft.colors.forEach(c => {
        if (!Array.isArray(c.gallery)) {
          c.gallery = c.image ? [c.image] : [];
        }
      });

      this.populateForm();

      const modal = document.getElementById('cms-edit-modal');
      if (modal && typeof modal.showModal === 'function') {
        modal.showModal();
      }
    },

    openCreateModal() {
      isNewProduct = true;
      editingDraft = {
        id: '',
        sku: '',
        name: '',
        tagline: '',
        description: '',
        badge: '',
        shopee_url: '',
        price_normal: 0,
        price_promo: null,
        currency: 'IDR',
        stock_status: 'in_stock',
        stock_count: 10,
        is_published: false,
        rating: 5,
        review_count: 0,
        sizes: ['All Size'],
        colors: [{ name: 'Warna Utama', hex: '#A66E58', gallery: [] }]
      };

      this.populateForm();

      const modal = document.getElementById('cms-edit-modal');
      if (modal && typeof modal.showModal === 'function') {
        modal.showModal();
      }
    },

    populateForm() {
      const p = editingDraft;
      document.getElementById('edit-product-id').value = p.id;
      document.getElementById('edit-product-name').textContent = isNewProduct ? 'Tambah Koleksi Baru' : `Edit: ${p.name}`;
      document.getElementById('edit-name').value = p.name || '';
      document.getElementById('edit-tagline').value = p.tagline || '';
      document.getElementById('edit-description').value = p.description || '';
      document.getElementById('edit-badge').value = p.badge || '';
      document.getElementById('edit-shopee-url').value = p.shopee_url || '';
      document.getElementById('edit-price-normal').value = p.price_normal || '';
      document.getElementById('edit-price-promo').value = p.price_promo || '';
      document.getElementById('edit-stock-count').value = p.stock_count ?? 10;
      document.getElementById('edit-stock-status').value = p.stock_status || 'in_stock';
      document.getElementById('edit-is-published').checked = p.is_published !== false;

      this.renderSizes();
      this.renderColors();
    },

    renderSizes() {
      const container = document.getElementById('edit-sizes-list');
      if (!container) return;
      container.innerHTML = (editingDraft.sizes || []).map((s, i) => `
        <span class="cms-size-chip">
          ${s}
          <button type="button" onclick="RaidhaniAdminProducts.removeSize(${i})" aria-label="Hapus ukuran ${s}">&times;</button>
        </span>
      `).join('');
    },

    addSize() {
      const input = document.getElementById('edit-size-input');
      const val = input.value.trim();
      if (!val) return;
      editingDraft.sizes = editingDraft.sizes || [];
      if (editingDraft.sizes.includes(val)) { input.value = ''; return; }
      editingDraft.sizes.push(val);
      input.value = '';
      this.renderSizes();
    },

    removeSize(index) {
      editingDraft.sizes.splice(index, 1);
      this.renderSizes();
    },

    renderColors() {
      const container = document.getElementById('edit-colors-list');
      if (!container) return;

      container.innerHTML = (editingDraft.colors || []).map((c, ci) => `
        <div class="cms-color-row">
          <div class="cms-color-row-head">
            <input type="color" class="cms-color-swatch-input" value="${c.hex || '#A66E58'}" onchange="RaidhaniAdminProducts.updateColorField(${ci}, 'hex', this.value)">
            <input type="text" class="form-input cms-color-name-input" placeholder="Nama warna" value="${(c.name || '').replace(/"/g, '&quot;')}" onchange="RaidhaniAdminProducts.updateColorField(${ci}, 'name', this.value)">
            <button type="button" class="cms-color-remove-btn" title="Hapus varian warna ini" onclick="RaidhaniAdminProducts.removeColor(${ci})">
              <span class="material-symbols-outlined" style="font-size: 16px;">delete</span>
            </button>
          </div>
          <div class="cms-gallery-strip">
            ${(c.gallery || []).map((src, gi) => `
              <div class="cms-gallery-thumb">
                <img src="${src}" alt="Foto ${gi + 1}">
                <button type="button" title="Hapus foto ini" onclick="RaidhaniAdminProducts.removeGalleryImage(${ci}, ${gi})">&times;</button>
              </div>
            `).join('')}
            <button type="button" class="cms-gallery-add-btn" title="Upload foto" onclick="RaidhaniAdminProducts.triggerGalleryUpload(${ci})">
              <span class="material-symbols-outlined" style="font-size: 20px;">add_a_photo</span>
            </button>
            <input type="file" id="gallery-file-input-${ci}" accept="image/*" multiple style="display:none;" onchange="RaidhaniAdminProducts.handleGalleryUpload(${ci}, this)">
          </div>
        </div>
      `).join('');
    },

    updateColorField(colorIndex, field, value) {
      if (!editingDraft.colors[colorIndex]) return;
      editingDraft.colors[colorIndex][field] = value;
    },

    addColor() {
      editingDraft.colors = editingDraft.colors || [];
      editingDraft.colors.push({ name: 'Varian Baru', hex: '#A66E58', gallery: [] });
      this.renderColors();
    },

    removeColor(index) {
      editingDraft.colors.splice(index, 1);
      this.renderColors();
    },

    removeGalleryImage(colorIndex, imgIndex) {
      editingDraft.colors[colorIndex].gallery.splice(imgIndex, 1);
      this.renderColors();
    },

    // Buka file picker secara eksplisit lewat .click() — tidak mengandalkan
    // perilaku implisit "klik <label> membuka <input type=file> tersembunyi
    // di dalamnya", yang di sebagian browser/webview embedded bisa gagal
    // tanpa error apapun (klik terlihat normal tapi dialog OS tidak terbuka).
    triggerGalleryUpload(colorIndex) {
      const input = document.getElementById(`gallery-file-input-${colorIndex}`);
      if (input) input.click();
    },

    async handleGalleryUpload(colorIndex, inputEl) {
      const files = Array.from(inputEl.files || []);
      if (!files.length) return;

      const productId = editingDraft.id || slugify(editingDraft.name);

      if (window.showToast) window.showToast(`Mengupload ${files.length} foto...`, 'cloud_upload');

      let successCount = 0;
      let lastError = null;

      for (const file of files) {
        try {
          const url = await window.RaidhaniData.uploadProductImage(productId, file);
          editingDraft.colors[colorIndex].gallery = editingDraft.colors[colorIndex].gallery || [];
          editingDraft.colors[colorIndex].gallery.push(url);
          successCount++;
        } catch (err) {
          console.error('[RAIDHANI] Upload foto produk gagal:', err);
          lastError = err;
        }
      }

      inputEl.value = '';
      this.renderColors();

      if (window.showToast) {
        if (successCount === files.length) {
          window.showToast('Foto berhasil diupload.', 'check_circle');
        } else if (successCount > 0) {
          window.showToast(`${successCount}/${files.length} foto berhasil diupload, sisanya gagal.`, 'error');
        } else {
          const reason = lastError?.message ? `: ${lastError.message}` : '.';
          window.showToast(`Upload foto gagal${reason}`, 'error');
        }
      }
    },

    async handleSaveProduct(e) {
      e.preventDefault();

      const name = document.getElementById('edit-name').value.trim();
      const normal = parseInt(document.getElementById('edit-price-normal').value, 10);
      const promo = document.getElementById('edit-price-promo').value ? parseInt(document.getElementById('edit-price-promo').value, 10) : null;
      const count = parseInt(document.getElementById('edit-stock-count').value, 10);
      const status = document.getElementById('edit-stock-status').value;
      const isPublished = document.getElementById('edit-is-published').checked;

      if (!name) {
        alert('Nama produk wajib diisi.');
        return;
      }
      if (promo && promo > normal) {
        alert('Harga promo tidak boleh lebih besar dari harga normal.');
        return;
      }
      if (!editingDraft.colors || editingDraft.colors.length === 0) {
        alert('Minimal harus ada 1 varian warna.');
        return;
      }
      if (!editingDraft.sizes || editingDraft.sizes.length === 0) {
        alert('Minimal harus ada 1 pilihan ukuran.');
        return;
      }

      // Link Shopee dipasang ke href di landing page, jadi hanya https ke
      // domain Shopee yang boleh tersimpan (aturan yang sama dengan storefront).
      const rawShopeeUrl = document.getElementById('edit-shopee-url').value.trim();
      const shopeeUrl = rawShopeeUrl ? window.RaidhaniShopee.sanitize(rawShopeeUrl) : null;
      if (rawShopeeUrl && !shopeeUrl) {
        alert('Link Shopee tidak valid. Pakai alamat https dari shopee.co.id (mis. https://shopee.co.id/product/...) atau link pendek shope.ee / shp.ee.');
        return;
      }

      const updates = {
        name,
        tagline: document.getElementById('edit-tagline').value.trim(),
        description: document.getElementById('edit-description').value.trim(),
        badge: document.getElementById('edit-badge').value.trim(),
        price_normal: normal,
        price_promo: promo,
        stock_count: count,
        stock_status: status,
        is_published: isPublished,
        sizes: editingDraft.sizes,
        colors: editingDraft.colors
      };

      // Kolom shopee_url baru ada setelah migrasi 0015 dijalankan. Dikirim
      // hanya bila berubah, supaya edit harga/stok tidak ikut gagal kalau
      // migrasi belum sempat dijalankan.
      if (shopeeUrl !== (editingDraft.shopee_url || null)) {
        updates.shopee_url = shopeeUrl;
      }

      try {
        if (isNewProduct) {
          const newId = slugify(name);
          await window.RaidhaniData.createProduct({
            id: newId,
            sku: newId.toUpperCase(),
            currency: 'IDR',
            rating: 5,
            review_count: 0,
            ...updates
          });
        } else {
          await window.RaidhaniData.updateProduct(editingDraft.id, updates);
        }
      } catch (err) {
        console.error('[RAIDHANI] Simpan produk gagal:', err);
        const reason = err?.message ? `: ${err.message}` : '.';
        if (window.showToast) window.showToast(`Gagal menyimpan produk${reason}`, 'error');
        return;
      }

      products = await window.RaidhaniData.getProducts();
      this.renderProductList();

      const modal = document.getElementById('cms-edit-modal');
      if (modal) modal.close();

      if (window.showToast) {
        window.showToast(`Produk "${name}" berhasil disimpan. Perubahan langsung tampil di landing page.`);
      }
    }
  };

  window.RaidhaniAdminProducts = RaidhaniAdminProducts;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => RaidhaniAdminProducts.init());
  } else {
    RaidhaniAdminProducts.init();
  }

})(window);
