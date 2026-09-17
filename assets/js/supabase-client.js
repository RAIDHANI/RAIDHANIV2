/* ============================================================
   RAIDHANI - Supabase Client & Offline Resilience Engine (PRD v2.1 §6 & §11.5)
   Seamless dual-mode: Real Supabase API <-> LocalStorage Synced Mock Store
   ============================================================ */

(function(window) {
  'use strict';

  // Konfigurasi Supabase default (dapat disuntik via window.RAIDHANI_ENV)
  const SUPABASE_URL = window.RAIDHANI_ENV?.SUPABASE_URL || '';
  const SUPABASE_ANON_KEY = window.RAIDHANI_ENV?.SUPABASE_ANON_KEY || '';

  const STORAGE_KEYS = {
    PRODUCTS: 'raidhani_products_v1',
    COUPONS: 'raidhani_coupons_v1',
    ORDERS: 'raidhani_orders_v1'
  };

  // Seed data awal jika localStorage masih kosong
  const DEFAULT_COUPONS = [
    {
      code: 'RAIDHANI100K',
      discount_type: 'fixed_amount',
      discount_value: 100000,
      quota_max: 200,
      quota_used: 114,
      valid_from: '2026-08-01T00:00:00Z',
      valid_until: '2026-12-31T23:59:59Z',
      is_active: true,
      created_at: '2026-08-01T00:00:00Z'
    },
    {
      code: 'PERDANA100K',
      discount_type: 'fixed_amount',
      discount_value: 100000,
      quota_max: 100,
      quota_used: 42,
      valid_from: '2026-08-01T00:00:00Z',
      valid_until: '2026-12-31T23:59:59Z',
      is_active: true,
      created_at: '2026-08-02T00:00:00Z'
    },
    {
      code: 'FREESHIP',
      discount_type: 'fixed_amount',
      discount_value: 25000,
      quota_max: 100,
      quota_used: 78,
      valid_from: '2026-08-01T00:00:00Z',
      valid_until: '2026-12-31T23:59:59Z',
      is_active: true,
      created_at: '2026-08-03T00:00:00Z'
    }
  ];

  const DEFAULT_ORDERS = [
    {
      order_id: 'RDH-88219',
      product_id: 'halwa-set',
      product_name: "Halwa Luxury Syar'i Set",
      color: 'Mocca Sand',
      size: 'S/M',
      qty: 1,
      unit_price: 330000,
      total_price: 230219,
      coupon_code: 'PERDANA100K',
      buyer_name: 'Siti Sarah Adawiyah',
      buyer_whatsapp: '6281289123456',
      buyer_address: 'Jl. Hang Tuah Raya No. 14',
      buyer_city_district: 'Kebayoran Baru, Jakarta Selatan',
      buyer_postal_code: '12120',
      buyer_notes: 'Mohon dicek kemasan kotak atelier wangi.',
      consent_pdp: true,
      status: 'pending',
      payment_method: 'BSI Giro',
      created_at: new Date(Date.now() - 45 * 60000).toISOString()
    },
    {
      order_id: 'RDH-88218',
      product_id: 'najla-silk',
      product_name: "Najla Silk Maharani Syar'i Set",
      color: 'Champagne Gold',
      size: 'All-Size Fit XXL',
      qty: 1,
      unit_price: 450000,
      total_price: 485000,
      coupon_code: 'FREESHIP',
      buyer_name: 'Rania Almashoor',
      buyer_whatsapp: '6281130941182',
      buyer_address: 'Apartemen Senopati Penthouse Lt. 12',
      buyer_city_district: 'Jakarta Selatan',
      buyer_postal_code: '12190',
      buyer_notes: 'Kirim dengan packaging dustbag rapi.',
      consent_pdp: true,
      status: 'lunas',
      payment_method: 'BCA Transfer',
      created_at: new Date(Date.now() - 110 * 60000).toISOString()
    },
    {
      order_id: 'RDH-88215',
      product_id: 'halwa-set',
      product_name: "Halwa Luxury Syar'i Set",
      color: 'Espresso Earth',
      size: 'L/XL',
      qty: 2,
      unit_price: 189000,
      total_price: 378000,
      coupon_code: null,
      buyer_name: 'Farah Humaira Sp.A',
      buyer_whatsapp: '6281377629011',
      buyer_address: 'Jl. Teuku Umar No. 8',
      buyer_city_district: 'Menteng, Jakarta Pusat',
      buyer_postal_code: '10350',
      buyer_notes: 'Langsung kirim YES.',
      consent_pdp: true,
      status: 'dikirim',
      payment_method: 'BCA Transfer',
      created_at: new Date(Date.now() - 240 * 60000).toISOString()
    }
  ];

  class LocalStore {
    constructor() {
      this.initData();
    }

    initData() {
      if (!localStorage.getItem(STORAGE_KEYS.COUPONS)) {
        localStorage.setItem(STORAGE_KEYS.COUPONS, JSON.stringify(DEFAULT_COUPONS));
      }
      if (!localStorage.getItem(STORAGE_KEYS.ORDERS)) {
        localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(DEFAULT_ORDERS));
      }
    }

    async getProducts() {
      const cached = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch (e) {
          console.error('Error parsing cached products', e);
        }
      }

      // Fetch fallback dari data/products.json
      try {
        const res = await fetch('data/products.json');
        if (res.ok) {
          const data = await res.json();
          localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(data));
          return data;
        }
      } catch (err) {
        console.warn('Gagal memuat data/products.json, menggunakan memory fallback', err);
      }
      return [];
    }

    saveProducts(products) {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
      window.dispatchEvent(new CustomEvent('raidhani:products-updated', { detail: products }));
    }

    getCoupons() {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.COUPONS)) || DEFAULT_COUPONS;
      } catch (e) {
        return DEFAULT_COUPONS;
      }
    }

    saveCoupons(coupons) {
      localStorage.setItem(STORAGE_KEYS.COUPONS, JSON.stringify(coupons));
      window.dispatchEvent(new CustomEvent('raidhani:coupons-updated', { detail: coupons }));
    }

    getOrders() {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.ORDERS)) || DEFAULT_ORDERS;
      } catch (e) {
        return DEFAULT_ORDERS;
      }
    }

    saveOrders(orders) {
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
      window.dispatchEvent(new CustomEvent('raidhani:orders-updated', { detail: orders }));
    }

    // Kupon aktif paling baru yang masih bisa diklaim (untuk promo banner)
    getFeaturedCoupon() {
      const now = new Date();
      const usable = this.getCoupons().filter(c => {
        return c.is_active &&
          new Date(c.valid_from) <= now &&
          now <= new Date(c.valid_until) &&
          c.quota_used < c.quota_max;
      });
      usable.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      return usable[0] || null;
    }

    // RPC: redeem_coupon (Atomik mock)
    redeemCoupon(code, originalPrice) {
      const coupons = this.getCoupons();
      const c = coupons.find(item => item.code.toUpperCase() === code.toUpperCase().trim());

      if (!c) {
        return { valid: false, final_price: originalPrice, message: 'Kode kupon tidak ditemukan.' };
      }
      if (!c.is_active) {
        return { valid: false, final_price: originalPrice, message: 'Kupon sudah tidak aktif.' };
      }
      const now = new Date();
      if (now < new Date(c.valid_from) || now > new Date(c.valid_until)) {
        return { valid: false, final_price: originalPrice, message: 'Kupon di luar masa berlaku.' };
      }
      if (c.quota_used >= c.quota_max) {
        return { valid: false, final_price: originalPrice, message: 'Kuota kupon telah habis terpakai.' };
      }

      // Potong kuota
      c.quota_used += 1;
      this.saveCoupons(coupons);

      let finalPrice = originalPrice;
      if (c.discount_type === 'fixed_price') {
        finalPrice = c.discount_value;
      } else {
        finalPrice = Math.max(0, originalPrice - c.discount_value);
      }

      return {
        valid: true,
        final_price: finalPrice,
        discount_value: c.discount_value,
        discount_type: c.discount_type,
        message: `Kupon '${c.code}' berhasil diterapkan! Potongan Rp ${(c.discount_value || 0).toLocaleString('id-ID')}`,
        code: c.code
      };
    }

    // RPC: create_order (Atomik mock)
    createOrder(orderData) {
      const orders = this.getOrders();
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const seq = String(orders.length + 1).padStart(4, '0');
      const orderId = `RDH-${dateStr}-${seq}`;

      const newOrder = {
        order_id: orderId,
        order_group_id: orderData.order_group_id || orderId,
        product_id: orderData.product_id,
        product_name: orderData.product_name,
        color: orderData.color,
        size: orderData.size,
        qty: orderData.qty || 1,
        unit_price: orderData.unit_price,
        total_price: orderData.total_price,
        coupon_code: orderData.coupon_code || null,
        buyer_name: orderData.buyer_name,
        buyer_whatsapp: orderData.buyer_whatsapp,
        buyer_address: orderData.buyer_address,
        buyer_city_district: orderData.buyer_city_district,
        buyer_postal_code: orderData.buyer_postal_code,
        buyer_notes: orderData.buyer_notes || '',
        consent_pdp: !!orderData.consent_pdp,
        status: 'pending',
        payment_method: 'Transfer Bank (BSI/BCA)',
        created_at: new Date().toISOString()
      };

      orders.unshift(newOrder);
      this.saveOrders(orders);
      return newOrder;
    }

    updateOrderStatus(orderId, newStatus) {
      const orders = this.getOrders();
      const idx = orders.findIndex(o => o.order_id === orderId);
      if (idx !== -1) {
        orders[idx].status = newStatus;
        this.saveOrders(orders);
        return orders[idx];
      }
      return null;
    }

    updateProduct(productId, updates) {
      const cached = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
      let products = cached ? JSON.parse(cached) : [];
      const idx = products.findIndex(p => p.id === productId);
      if (idx !== -1) {
        products[idx] = { ...products[idx], ...updates, updated_at: new Date().toISOString() };
        this.saveProducts(products);
        return products[idx];
      }
      return null;
    }

    createProduct(productData) {
      const cached = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
      let products = cached ? JSON.parse(cached) : [];
      const newProduct = { ...productData, updated_at: new Date().toISOString() };
      products.push(newProduct);
      this.saveProducts(products);
      return newProduct;
    }
  }

  const localStore = new LocalStore();

  // ------------------------------------------------------------
  // Inisialisasi klien Supabase ASLI (opsional). Aktif hanya jika
  // window.RAIDHANI_ENV.SUPABASE_URL/SUPABASE_ANON_KEY sudah diisi
  // (lihat assets/js/env.example.js) DAN SDK @supabase/supabase-js
  // (dimuat via CDN di index.html/admin.html) berhasil ter-load.
  // Selama salah satu belum terpenuhi, seluruh method di bawah
  // otomatis fallback ke LocalStore — tidak ada yang patah.
  // ------------------------------------------------------------
  let supabaseClient = null;
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
      console.warn('[RAIDHANI] SUPABASE_URL/ANON_KEY terisi tapi SDK @supabase/supabase-js gagal dimuat — fallback ke mode lokal.');
    }
  }

  function logSupabaseError(context, error) {
    console.error(`[Supabase] ${context} gagal, fallback ke mode lokal:`, error);
  }

  // Public facade API
  window.RaidhaniData = {
    isLiveSupabase: Boolean(supabaseClient),
    supabaseClient, // dipakai admin-auth.js untuk Supabase Auth asli

    async getProducts() {
      // RLS (products_public_read / products_admin_all) yang menentukan
      // apakah produk belum-terbit ikut terlihat atau tidak, tergantung
      // peran (anon vs admin authenticated) — tidak perlu filter di sini.
      if (supabaseClient) {
        const { data, error } = await supabaseClient.from('products').select('*');
        if (error) {
          logSupabaseError('getProducts', error);
          return localStore.getProducts();
        }
        return data;
      }
      return await localStore.getProducts();
    },

    async updateProduct(id, updates) {
      if (supabaseClient) {
        const { data, error } = await supabaseClient
          .from('products')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single();
        if (error) { logSupabaseError('updateProduct', error); throw error; }
        return data;
      }
      return localStore.updateProduct(id, updates);
    },

    async createProduct(productData) {
      if (supabaseClient) {
        const { data, error } = await supabaseClient
          .from('products')
          .insert(productData)
          .select()
          .single();
        if (error) { logSupabaseError('createProduct', error); throw error; }
        return data;
      }
      return localStore.createProduct(productData);
    },

    async redeemCoupon(code, originalPrice) {
      if (supabaseClient) {
        const { data, error } = await supabaseClient.rpc('redeem_coupon', {
          p_code: code,
          p_original_price: originalPrice
        });
        if (error) {
          logSupabaseError('redeemCoupon', error);
          return { valid: false, final_price: originalPrice, message: 'Gagal memvalidasi kupon. Silakan coba lagi.' };
        }
        const row = Array.isArray(data) ? data[0] : data;
        return { ...row, code: code.toUpperCase() };
      }
      return localStore.redeemCoupon(code, originalPrice);
    },

    async getCoupons() {
      if (supabaseClient) {
        const { data, error } = await supabaseClient.from('coupons').select('*');
        if (error) { logSupabaseError('getCoupons', error); return localStore.getCoupons(); }
        return data;
      }
      return localStore.getCoupons();
    },

    // Storefront publik (anon) TIDAK punya akses SELECT ke tabel `coupons`
    // (RLS admin-only, lihat 0010_admin_claim_and_rls_perf.sql) — jadi
    // promo banner di landing page pakai RPC SECURITY DEFINER khusus ini
    // (0012_public_featured_coupon.sql), yang hanya membocorkan kolom
    // yang memang aman ditampilkan publik (code, tipe & nilai diskon).
    async getFeaturedCoupon() {
      if (supabaseClient) {
        const { data, error } = await supabaseClient.rpc('get_featured_coupon');
        if (error) { logSupabaseError('getFeaturedCoupon', error); return localStore.getFeaturedCoupon(); }
        const row = Array.isArray(data) ? data[0] : data;
        return row || null;
      }
      return localStore.getFeaturedCoupon();
    },

    async saveCoupons(coupons) {
      if (supabaseClient) {
        const { error } = await supabaseClient.from('coupons').upsert(coupons, { onConflict: 'code' });
        if (error) { logSupabaseError('saveCoupons', error); throw error; }
        return coupons;
      }
      return localStore.saveCoupons(coupons);
    },

    async createOrder(orderData) {
      if (supabaseClient) {
        const { data, error } = await supabaseClient.rpc('create_order', { order_data: orderData });
        if (error) { logSupabaseError('createOrder', error); throw error; }
        return Array.isArray(data) ? data[0] : data;
      }
      return localStore.createOrder(orderData);
    },

    async getOrders() {
      if (supabaseClient) {
        const { data, error } = await supabaseClient
          .from('orders')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) { logSupabaseError('getOrders', error); return localStore.getOrders(); }
        return data;
      }
      return localStore.getOrders();
    },

    async updateOrderStatus(orderId, status) {
      if (supabaseClient) {
        const { data, error } = await supabaseClient
          .from('orders')
          .update({ status })
          .eq('order_id', orderId)
          .select()
          .single();
        if (error) { logSupabaseError('updateOrderStatus', error); throw error; }
        return data;
      }
      return localStore.updateOrderStatus(orderId, status);
    },

    // Konfirmasi Pembayaran Tier 1: upload foto bukti transfer.
    // Live: naik ke Supabase Storage bucket `payment-proofs`, lalu
    // tempelkan public URL-nya ke order lewat RPC attach_payment_proof
    // (bukan UPDATE langsung — orders di-lindungi RLS admin-only,
    // lihat supabase/migrations/0003_payment_proof.sql).
    // Lokal: dibuat object URL sementara (hilang saat reload) supaya
    // alur UI tetap bisa diuji end-to-end sebelum backend tersambung.
    async uploadPaymentProof(orderId, file) {
      if (supabaseClient) {
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
        const path = `${orderId}/${Date.now()}.${ext}`;

        // upsert TIDAK dipakai di sini dengan sengaja: path selalu unik
        // (mengandung Date.now()), jadi tabrakan nama file mustahil terjadi.
        // upsert:true justru membuat Supabase Storage ikut mengevaluasi
        // policy UPDATE (payment_proofs_admin_update, authenticated-only)
        // selain policy INSERT anon -> upload SELALU gagal 403 "row-level
        // security policy" untuk sesi yang bukan authenticated.
        const { error: uploadError } = await supabaseClient.storage
          .from('payment-proofs')
          .upload(path, file, { contentType: file.type || 'image/jpeg' });
        if (uploadError) { logSupabaseError('uploadPaymentProof (storage)', uploadError); throw uploadError; }

        const { data: urlData } = supabaseClient.storage.from('payment-proofs').getPublicUrl(path);
        const publicUrl = urlData.publicUrl;

        const { error: rpcError } = await supabaseClient.rpc('attach_payment_proof', {
          p_order_id: orderId,
          p_proof_url: publicUrl
        });
        if (rpcError) { logSupabaseError('uploadPaymentProof (attach)', rpcError); throw rpcError; }

        return publicUrl;
      }

      const localUrl = URL.createObjectURL(file);
      const orders = localStore.getOrders();
      const idx = orders.findIndex(o => o.order_id === orderId);
      if (idx !== -1) {
        orders[idx].payment_proof_url = localUrl;
        localStore.saveOrders(orders);
      }
      return localUrl;
    },

    // CMS Katalog: upload satu foto produk (bucket `product-images`).
    // Mengembalikan URL publik saja — admin-products.js yang menempelkan
    // URL ini ke array `colors[].gallery` lalu memanggil updateProduct().
    // Live: naik ke Supabase Storage (hanya admin terautentikasi, lihat
    // 0007_storage_product_images.sql). Lokal: object URL sementara
    // (mode demo, tidak bertahan lewat reload).
    //
    // upsert TIDAK dipakai di sini, sama seperti uploadPaymentProof:
    // path selalu unik (Date.now() + random suffix) jadi tabrakan nama
    // file mustahil terjadi, sedangkan upsert:true membuat Postgres RLS
    // ikut mengevaluasi policy UPDATE (INSERT ... ON CONFLICT DO UPDATE
    // dievaluasi terhadap policy UPDATE oleh RLS terlepas dari ada/tidaknya
    // konflik nyata) selain policy INSERT — celah yang sama yang bikin
    // upload bukti pembayaran gagal 403 sebelum diperbaiki.
    async uploadProductImage(productId, file) {
      if (supabaseClient) {
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
        const path = `${productId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

        const { error: uploadError } = await supabaseClient.storage
          .from('product-images')
          .upload(path, file, { contentType: file.type || 'image/jpeg' });
        if (uploadError) { logSupabaseError('uploadProductImage', uploadError); throw uploadError; }

        const { data: urlData } = supabaseClient.storage.from('product-images').getPublicUrl(path);
        return urlData.publicUrl;
      }

      return URL.createObjectURL(file);
    }
  };

})(window);
