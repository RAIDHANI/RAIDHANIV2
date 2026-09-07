/* ============================================================
   RAIDHANI - Analytics & Conversion Tracking Module (PRD v2.1 §10.6)
   Custom event logger for Google Analytics 4 & Meta Pixel
   ============================================================ */

(function(window) {
  'use strict';

  const RaidhaniAnalytics = {
    trackEvent(eventName, params = {}) {
      const payload = {
        event_name: eventName,
        timestamp: new Date().toISOString(),
        ...params
      };

      // 1. Google Analytics 4 (gtag)
      if (typeof window.gtag === 'function') {
        window.gtag('event', eventName, params);
      }

      // 2. Meta Pixel (fbq)
      if (typeof window.fbq === 'function') {
        if (eventName === 'checkout_submit') {
          window.fbq('track', 'Purchase', { currency: 'IDR', value: params.total_price || 0 });
        } else if (eventName === 'checkout_modal_open') {
          window.fbq('track', 'InitiateCheckout');
        } else {
          window.fbq('trackCustom', eventName, params);
        }
      }

      // 3. Console logger untuk inspeksi development
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || !window.gtag) {
        console.info(`[RAIDHANI Analytics] ${eventName}:`, payload);
      }
    }
  };

  window.RaidhaniAnalytics = RaidhaniAnalytics;

})(window);
