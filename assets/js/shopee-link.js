/* ============================================================
   RAIDHANI - Shopee Store Link Helper
   Menautkan website ke toko Shopee RAIDHANI. Shopee tidak punya cara
   resmi untuk memindahkan keranjang/varian dari situs lain, jadi yang
   dibuka hanya halaman produk atau halaman toko; pembeli memilih ulang
   warna & ukuran di Shopee.
   Tautan produk disimpan di kolom products.shopee_url (diedit lewat admin
   CMS), tautan toko di RAIDHANI_ENV.SHOPEE_SHOP_URL sebagai cadangan.
   Kalau keduanya kosong, semua tombol Shopee disembunyikan.
   ============================================================ */

(function(window) {
  'use strict';

  // Host tujuan yang diizinkan (cocok persis). URL berasal dari input admin
  // dan dipasang ke href, jadi hanya https ke domain Shopee yang lolos.
  const ALLOWED_HOSTS = ['shopee.co.id', 's.shopee.co.id', 'shope.ee', 'shp.ee', 'id.shp.ee'];

  // Mengembalikan URL yang sudah dinormalisasi, atau null kalau tidak valid.
  function sanitize(url) {
    if (typeof url !== 'string' || !url.trim()) return null;

    let parsed;
    try {
      parsed = new URL(url.trim());
    } catch (e) {
      return null;
    }

    if (parsed.protocol !== 'https:') return null;
    if (parsed.username || parsed.password || parsed.port) return null;
    if (!ALLOWED_HOSTS.includes(parsed.hostname.toLowerCase())) return null;
    return parsed.href;
  }

  function findProduct(productOrId) {
    if (productOrId && typeof productOrId === 'object') return productOrId;
    const products = window.RaidhaniState?.products || [];
    return products.find(p => p.id === productOrId) || null;
  }

  function getShopUrl() {
    return sanitize(window.RAIDHANI_ENV?.SHOPEE_SHOP_URL);
  }

  // Menerima objek produk atau id produk.
  function getProductUrl(productOrId) {
    return sanitize(findProduct(productOrId)?.shopee_url) || getShopUrl();
  }

  // Keranjang tidak bisa dikirim ke Shopee: satu produk unik -> halaman
  // produknya, lebih dari satu -> halaman toko supaya pembeli memilih sendiri.
  function getCartUrl(items) {
    const ids = [...new Set((items || []).map(item => item.productId))];
    return ids.length === 1 ? getProductUrl(ids[0]) : getShopUrl();
  }

  // True kalau ada minimal satu tujuan Shopee yang valid (dipakai untuk
  // memutuskan apakah keterangan "khusus Pesan Langsung" pada kupon perlu tampil).
  function isConfigured() {
    if (getShopUrl()) return true;
    const products = window.RaidhaniState?.products || [];
    return products.some(p => sanitize(p.shopee_url));
  }

  function track(source, productId) {
    if (!window.RaidhaniAnalytics) return;
    const params = { source };
    if (productId) params.product_id = productId;
    window.RaidhaniAnalytics.trackEvent('shopee_click', params);
  }

  function initFooterLink() {
    const link = document.getElementById('footer-shopee-link');
    if (!link) return;

    const url = getShopUrl();
    if (!url) {
      (link.closest('li') || link).style.display = 'none';
      return;
    }
    link.href = url;
    link.addEventListener('click', () => track('footer'));
  }

  window.RaidhaniShopee = {
    sanitize,
    getShopUrl,
    getProductUrl,
    getCartUrl,
    isConfigured,
    track
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFooterLink);
  } else {
    initFooterLink();
  }

})(window);
