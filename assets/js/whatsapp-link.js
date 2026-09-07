/* ============================================================
   RAIDHANI - WhatsApp Click-to-Chat Link Generator (PRD v2.1 §11.1 & §22)
   Distinct intents, strictly formatted wa.me links
   ============================================================ */

(function(window) {
  'use strict';

  const DEFAULT_WA_NUMBER = '6281289123456'; // Format internasional tanpa simbol '+'

  function getWaNumber() {
    return window.RAIDHANI_ENV?.ADMIN_WA_NUMBER || DEFAULT_WA_NUMBER;
  }

  const RaidhaniWA = {
    // Intent 1: Konsultasi Umum / Stylist (Hero & Footer)
    getGeneralConsultUrl() {
      const text = 'Bismillah, Assalamu\'alaikum Atelier RAIDHANI. Saya ingin konsultasi panduan ukuran, material, dan ketersediaan koleksi terbaru.';
      return `https://wa.me/${getWaNumber()}?text=${encodeURIComponent(text)}`;
    },

    // Intent 2: Tanya Produk Spesifik (Product Catalog Card)
    getProductInquiryUrl(productName, color, size, priceText) {
      const text = `Bismillah, Assalamu'alaikum Admin RAIDHANI. Saya tertarik memesan:
- Model: ${productName}
- Pilihan Warna: ${color}
- Ukuran: ${size}
- Estimasi Harga: ${priceText}

Apakah varian ini masih tersedia untuk pengiriman segera? Terima kasih.`;
      return `https://wa.me/${getWaNumber()}?text=${encodeURIComponent(text)}`;
    },

    // Intent 3: Konfirmasi Pembayaran & Bukti Transfer (Modal Tahap 2)
    getPaymentConfirmationUrl(order) {
      const formatPrice = (amount) => window.RaidhaniState ? window.RaidhaniState.formatPrice(amount) : 'Rp ' + amount;

      const productLines = (order.items && order.items.length > 1)
        ? order.items.map(it => `- ${it.product_name} — ${it.color} (Size ${it.size}) x${it.qty || 1}`).join('\n')
        : `- Produk: ${order.product_name}\n- Varian: ${order.color} (Size ${order.size})`;

      const text = `Bismillah, Assalamu'alaikum Atelier RAIDHANI. Saya telah menyelesaikan pemesanan dan ingin konfirmasi bukti transfer:
- ID Pesanan: ${order.order_id}
- Nama Pemesan: ${order.buyer_name}
${productLines}
- Total Tagihan: ${formatPrice(order.total_price)}
- Alamat Kirim: ${order.buyer_address}, ${order.buyer_city_district}

(Foto bukti transfer terlampir). Mohon diverifikasi agar resi pengiriman segera diterbitkan. Syukron.`;
      return `https://wa.me/${getWaNumber()}?text=${encodeURIComponent(text)}`;
    }
  };

  window.RaidhaniWA = RaidhaniWA;

})(window);
