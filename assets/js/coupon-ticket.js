/* ============================================================
   RAIDHANI - Coupon Ticket (voucher butik)
   Merender kupon aktif (RaidhaniState.featuredCoupon) ke semua elemen
   [data-coupon-ticket] — versi ringkas di hero dan versi penuh di
   Koleksi — dari satu template. Tidak punya logika klaim sendiri:
   klik CTA didelegasikan ke RaidhaniModal.claimFromPromo(), dan state
   "terpasang" mengikuti event raidhani:coupon-updated dari setCoupon().
   Animasi: entrance (IntersectionObserver), count-up nominal, momen
   klaim. Sisanya murni CSS (assets/css/coupon.css).
   ============================================================ */

(function (window) {
  'use strict';

  const HERO_DELAY_MS = 450;     // biar judul hero mulai muncul lebih dulu
  const COUNT_DELAY_MS = 350;    // hitung mundur mulai saat kertas hampir terbuka
  const COUNT_DURATION_MS = 1400;
  const CLAIM_FLASH_MS = 380;    // lamanya stub "tersobek" sebelum kembali

  const hosts = () => document.querySelectorAll('[data-coupon-ticket]');
  const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const formatNumber = (n) => (Number(n) || 0).toLocaleString('id-ID');

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
    ));
  }

  function template(featured, labels) {
    const code = esc(featured.code);
    const amount = formatNumber(labels.nominal);
    const spoken = `${labels.kicker} Rp ${amount}${labels.unit ? ' per pcs' : ''}. ${labels.note}`;
    const unit = labels.unit ? `<span class="coupon-ticket__unit" aria-hidden="true">${esc(labels.unit)}</span>` : '';

    // Bintang 8 sudut: motif geometris yang sama dengan .geometric-star di divider
    return `
      <div class="coupon-ticket__core">
        <div class="coupon-ticket__body">
          <svg class="coupon-ticket__ornament" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
            <rect x="19" y="19" width="62" height="62"/>
            <rect x="19" y="19" width="62" height="62" transform="rotate(45 50 50)"/>
            <circle cx="50" cy="50" r="13"/>
          </svg>
          <span class="coupon-ticket__eyebrow" data-stagger style="--i:0">
            <span class="coupon-ticket__brand">Kupon Perdana</span>
            <span class="coupon-ticket__kicker">${esc(labels.kicker)}</span>
          </span>
          <div class="coupon-ticket__value tabular-nums" data-stagger style="--i:1">
            <span class="coupon-ticket__currency" aria-hidden="true">Rp</span>
            <span class="coupon-ticket__amount" aria-hidden="true" data-amount data-target="${Number(labels.nominal) || 0}">${amount}</span>
            ${unit}
            <span class="sr-only">${esc(spoken)}</span>
          </div>
          <p class="coupon-ticket__note" data-stagger style="--i:2">${esc(labels.note)}</p>
        </div>
        <div class="coupon-ticket__stub">
          <span class="coupon-ticket__code-label" data-stagger style="--i:1">Kode Kupon</span>
          <code class="coupon-ticket__code"${String(featured.code).length > 10 ? ' data-long' : ''} data-stagger style="--i:2">${code}</code>
          <button type="button" class="coupon-ticket__cta" data-coupon-claim data-code="${code}" data-stagger style="--i:3">
            <span class="coupon-ticket__cta-idle" aria-hidden="true">
              <span class="material-symbols-outlined">content_copy</span>
              <span>Klaim Kupon</span>
            </span>
            <span class="coupon-ticket__cta-done" aria-hidden="true">
              <svg class="coupon-ticket__check" viewBox="0 0 24 24" focusable="false"><path d="M5 12.5l4.2 4.2L19 7" pathLength="1"/></svg>
              <span>Terpasang</span>
            </span>
          </button>
        </div>
      </div>
      <span class="sr-only" role="status" aria-live="polite" data-coupon-live></span>`;
  }

  // Kode kupon yang saat ini benar-benar terpasang di state checkout
  function appliedCode() {
    const c = window.RaidhaniState?.activeCoupon;
    return c && c.valid && c.code ? String(c.code).toUpperCase() : null;
  }

  // Mengembalikan true bila tiket ini sedang dalam state "terpasang"
  function syncClaimed(host) {
    const code = String(host.dataset.code || '').toUpperCase();
    const claimed = !!code && appliedCode() === code;
    host.classList.toggle('is-claimed', claimed);

    const btn = host.querySelector('[data-coupon-claim]');
    if (btn) {
      btn.setAttribute('aria-label', claimed
        ? `Kupon ${code} terpasang. Tekan untuk menyalin kode lagi`
        : `Klaim kupon ${code}`);
    }
    return claimed;
  }

  function syncAnnouncementButton() {
    const btn = document.getElementById('announcement-claim-btn');
    if (!btn) return;
    const code = String(btn.dataset.code || '').toUpperCase();
    btn.classList.toggle('is-claimed', !!code && appliedCode() === code);
  }

  // Nominal berputar dari 0. Lebar dikunci selama berjalan supaya satuan
  // ("/ pcs") tidak bergeser mengikuti lebar digit yang berubah.
  function countUp(host, delay) {
    const el = host.querySelector('[data-amount]');
    if (!el) return;
    const target = Number(el.dataset.target) || 0;
    if (prefersReducedMotion() || target <= 0) {
      el.textContent = formatNumber(target);
      return;
    }

    el.style.minWidth = `${el.getBoundingClientRect().width}px`;
    el.textContent = formatNumber(0);
    const startAt = performance.now() + delay;

    function frame(now) {
      const t = Math.min(Math.max((now - startAt) / COUNT_DURATION_MS, 0), 1);
      const eased = 1 - Math.pow(1 - t, 3); // easeOut cubic, sama dengan counter-animation.js
      el.textContent = formatNumber(Math.round(eased * target));
      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        el.style.minWidth = '';
      }
    }
    requestAnimationFrame(frame);
  }

  // Hero langsung tampil (sudah di atas lipatan); Koleksi menunggu masuk viewport
  function reveal(host) {
    const isHero = host.dataset.variant === 'hero';
    const delay = isHero ? HERO_DELAY_MS : 0;
    host.style.setProperty('--ticket-delay', `${delay}ms`);

    const start = () => {
      host.classList.add('is-inview');
      countUp(host, delay + COUNT_DELAY_MS);
    };

    if (isHero || !('IntersectionObserver' in window)) {
      start();
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        start();
      }
    }, { threshold: 0.35 });
    observer.observe(host);
  }

  function bindOnce(host) {
    if (host.dataset.bound) return;
    host.dataset.bound = '1';
    host.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-coupon-claim]');
      const code = btn && btn.dataset.code;
      if (code && window.RaidhaniModal) window.RaidhaniModal.claimFromPromo(code);
    });
  }

  function render(featured, labels) {
    if (!featured) {
      clear();
      return;
    }
    labels = labels || window.RaidhaniState?.getCouponLabels(featured);
    if (!labels) return;

    const signature = [featured.code, featured.discount_type, featured.discount_value].join('|');

    hosts().forEach((host) => {
      if (host.dataset.signature === signature) {
        syncClaimed(host);
        return;
      }

      host.dataset.signature = signature;
      host.dataset.code = featured.code;
      host.innerHTML = template(featured, labels);
      host.dataset.state = 'ready';
      bindOnce(host);
      syncClaimed(host);

      // Kupon berganti saat halaman terbuka: isi diganti, entrance tidak diulang
      if (host.classList.contains('is-inview')) {
        countUp(host, 0);
      } else {
        reveal(host);
      }
    });

    syncAnnouncementButton();
  }

  function clear() {
    hosts().forEach((host) => {
      host.dataset.state = 'empty';
      host.innerHTML = '';
      delete host.dataset.signature;
      delete host.dataset.code;
      host.classList.remove('is-inview', 'is-claimed', 'is-claiming');
    });
  }

  // setCoupon() memancarkan event ini setiap kali kupon terpasang / dilepas,
  // baik dari tiket, announcement bar, maupun kolom kupon di modal checkout.
  window.addEventListener('raidhani:coupon-updated', () => {
    hosts().forEach((host) => {
      const wasClaimed = host.classList.contains('is-claimed');
      if (!syncClaimed(host) || wasClaimed) return;

      host.classList.add('is-claiming');
      setTimeout(() => host.classList.remove('is-claiming'), CLAIM_FLASH_MS);

      const live = host.querySelector('[data-coupon-live]');
      if (live) live.textContent = `Kupon ${host.dataset.code} terpasang.`;
    });
    syncAnnouncementButton();
  });

  window.RaidhaniCouponTicket = { render, clear };

  // Data kupon bisa sudah siap sebelum modul ini dimuat
  function renderIfReady() {
    const featured = window.RaidhaniState?.featuredCoupon;
    if (featured) render(featured);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderIfReady);
  } else {
    renderIfReady();
  }

})(window);
