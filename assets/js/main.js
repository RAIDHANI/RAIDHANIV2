/* ============================================================
   RAIDHANI - Main Application Entrypoint (PRD v2.1 §8 FR-1 & FR-2)
   Announcement bar, sticky header, mobile drawer with inert, anchor scrolling
   ============================================================ */

(function(window) {
  'use strict';

  function initApp() {
    // 1. Top Announcement Bar (FR-1: sessionStorage based dismiss)
    const announcementBar = document.getElementById('announcement-bar');
    const announcementClose = document.getElementById('announcement-close-btn');

    if (announcementBar && announcementClose) {
      if (sessionStorage.getItem('raidhani_announcement_dismissed') === 'true') {
        announcementBar.style.display = 'none';
      } else {
        announcementClose.addEventListener('click', () => {
          announcementBar.style.display = 'none';
          sessionStorage.setItem('raidhani_announcement_dismissed', 'true');
        });
      }
    }

    // 2. Sticky Header via IntersectionObserver (FR-2)
    const header = document.querySelector('.site-header');
    const heroSentinel = document.getElementById('hero-sentinel');

    if (header && heroSentinel) {
      const headerObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          // Ketika sentinel hero keluar viewport atas, header menjadi sticky solid
          if (!entry.isIntersecting && entry.boundingClientRect.top < 0) {
            header.classList.add('is-stuck');
          } else {
            header.classList.remove('is-stuck');
          }
        });
      }, {
        threshold: 0
      });

      headerObserver.observe(heroSentinel);
    }

    // 3. Mobile Hamburger Menu & Drawer with inert (FR-2)
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileDrawer = document.getElementById('mobile-drawer');
    const mobileOverlay = document.getElementById('mobile-drawer-overlay');
    const mobileDrawerClose = document.getElementById('mobile-drawer-close');
    const mainElement = document.querySelector('main');
    const footerElement = document.querySelector('footer');

    function openMobileDrawer() {
      if (!mobileDrawer || !mobileOverlay) return;
      mobileDrawer.classList.add('active');
      mobileOverlay.classList.add('active');
      document.body.style.overflow = 'hidden';

      // Atribut inert untuk aksesibilitas (PRD §17.B)
      if (mainElement) mainElement.setAttribute('inert', '');
      if (footerElement) footerElement.setAttribute('inert', '');
    }

    function closeMobileDrawer() {
      if (!mobileDrawer || !mobileOverlay) return;
      mobileDrawer.classList.remove('active');
      mobileOverlay.classList.remove('active');
      document.body.style.overflow = '';

      if (mainElement) mainElement.removeAttribute('inert');
      if (footerElement) footerElement.removeAttribute('inert');
    }

    if (mobileMenuBtn) {
      mobileMenuBtn.addEventListener('click', openMobileDrawer);
    }
    if (mobileDrawerClose) {
      mobileDrawerClose.addEventListener('click', closeMobileDrawer);
    }
    if (mobileOverlay) {
      mobileOverlay.addEventListener('click', closeMobileDrawer);
    }

    // Tutup drawer saat menekan Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && mobileDrawer && mobileDrawer.classList.contains('active')) {
        closeMobileDrawer();
      }
    });

    // Tutup drawer saat link internal di-klik
    document.querySelectorAll('.mobile-nav-link').forEach(link => {
      link.addEventListener('click', closeMobileDrawer);
    });

    // 4. Smooth Anchor Scrolling & Event Tracking
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function(e) {
        const targetId = this.getAttribute('href');
        if (targetId === '#') return;

        const targetEl = document.querySelector(targetId);
        if (targetEl) {
          e.preventDefault();
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

    // 5. Tracking Clicks
    document.querySelectorAll('[data-track]').forEach(el => {
      el.addEventListener('click', function() {
        const eventName = this.getAttribute('data-track');
        if (window.RaidhaniAnalytics) {
          window.RaidhaniAnalytics.trackEvent(eventName);
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

})(window);
