/* ============================================================
   RAIDHANI v2 - Hero Carousel
   Kartu produk di hero yang bisa digeser (scroll-snap native). Modul ini
   hanya menambah: penanda slide aktif, tombol sebelumnya/berikutnya,
   penghitung, klik kartu samping untuk memusatkannya, dan tombol "Pilih"
   yang membuka modal detail dengan warna slide itu sudah terpilih.
   Slide produk dirender oleh RaidhaniState.renderProductCards() (state.js),
   yang memanggil refresh() setiap kali katalog berubah.
   ============================================================ */

(function (window) {
  'use strict';

  const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pad = (n) => String(n).padStart(2, '0');

  let track = null;
  let slides = [];
  let activeIndex = 0;
  let observer = null;

  function setActive(index) {
    activeIndex = Math.max(0, Math.min(index, slides.length - 1));
    slides.forEach((slide, i) => slide.classList.toggle('is-active', i === activeIndex));

    const total = slides.length;
    document.querySelectorAll('[data-hero-index]').forEach(el => { el.textContent = pad(activeIndex + 1); });
    document.querySelectorAll('[data-hero-total]').forEach(el => { el.textContent = pad(total); });
    document.querySelectorAll('[data-hero-progress]').forEach(el => {
      el.style.transform = `scaleX(${total ? (activeIndex + 1) / total : 0})`;
    });
    document.querySelectorAll('[data-hero-prev]').forEach(btn => { btn.disabled = activeIndex === 0; });
    document.querySelectorAll('.hero-controls [data-hero-next]').forEach(btn => { btn.disabled = activeIndex >= total - 1; });
  }

  function goTo(index) {
    const slide = slides[Math.max(0, Math.min(index, slides.length - 1))];
    if (!slide || !track) return;
    // Hitung manual (bukan scrollIntoView) supaya halaman tidak ikut
    // bergulir vertikal saat hero sebagian sudah lewat.
    const left = slide.offsetLeft - (track.clientWidth - slide.offsetWidth) / 2;
    track.scrollTo({ left, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }

  // Slide aktif = slide yang menyentuh 2% bagian tengah track. Dipakai di
  // semua browser (scrollsnapchange baru ada di Chromium).
  function observe() {
    if (observer) observer.disconnect();
    if (!('IntersectionObserver' in window)) return;
    observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) setActive(slides.indexOf(entry.target));
      });
    }, { root: track, rootMargin: '0px -49%', threshold: 0 });
    slides.forEach(slide => observer.observe(slide));
  }

  function choose(slide) {
    const productId = slide.dataset.productId;
    if (!productId || !window.RaidhaniProductDetail) return;

    // Warna slide ini dijadikan pilihan aktif sebelum modal dibuka, karena
    // RaidhaniProductDetail.open() membaca warna dari RaidhaniState.
    const product = window.RaidhaniState?.products?.find(p => p.id === productId);
    const color = product?.colors?.find(c => c.name === slide.dataset.color);
    if (color) {
      const cover = Array.isArray(color.gallery) && color.gallery.length ? color.gallery[0] : color.image;
      window.RaidhaniState.selectColor(productId, color.name, color.hex, cover);
    }
    window.RaidhaniProductDetail.open(productId);
  }

  function onClick(e) {
    if (e.target.closest('[data-hero-next]')) {
      goTo(activeIndex + 1);
      return;
    }
    const slide = e.target.closest('.hero-slide');
    if (!slide) return;
    const index = slides.indexOf(slide);

    if (index !== activeIndex) {
      // Kartu samping: pusatkan dulu, jangan langsung membuka detail
      e.preventDefault();
      goTo(index);
      return;
    }
    if (e.target.closest('[data-hero-buy]') || slide.classList.contains('hero-slide--product')) {
      choose(slide);
    }
  }

  function refresh() {
    if (!track) return;
    slides = [...track.querySelectorAll('.hero-slide')];
    track.classList.add('is-ready');
    setActive(Math.min(activeIndex, slides.length - 1));
    observe();
  }

  function init() {
    track = document.getElementById('hero-track');
    if (!track) return;

    track.addEventListener('click', onClick);
    document.querySelectorAll('.hero-controls [data-hero-prev]').forEach(btn => btn.addEventListener('click', () => goTo(activeIndex - 1)));
    document.querySelectorAll('.hero-controls [data-hero-next]').forEach(btn => btn.addEventListener('click', () => goTo(activeIndex + 1)));

    refresh();
  }

  window.RaidhaniHeroCarousel = { refresh, goTo };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(window);
