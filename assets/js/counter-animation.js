/* ============================================================
   RAIDHANI - Trust Metrics Counter Animation (PRD v2.1 §8 FR-4)
   IntersectionObserver + requestAnimationFrame + prefers-reduced-motion
   ============================================================ */

(function(window) {
  'use strict';

  function initCounterAnimation() {
    const metricsContainer = document.querySelector('.metrics-strip');
    if (!metricsContainer) return;

    const counters = metricsContainer.querySelectorAll('[data-target]');
    if (!counters.length) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let hasAnimated = false;

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !hasAnimated) {
          hasAnimated = true;
          obs.disconnect(); // Jalankan sekali saja per page load

          counters.forEach(counter => {
            const target = parseFloat(counter.getAttribute('data-target'));
            const suffix = counter.getAttribute('data-suffix') || '';
            const decimals = parseInt(counter.getAttribute('data-decimals') || '0', 10);

            if (prefersReducedMotion) {
              counter.textContent = target.toFixed(decimals) + suffix;
              return;
            }

            const duration = 1600; // ms
            const startTime = performance.now();

            function updateCounter(currentTime) {
              const elapsed = currentTime - startTime;
              const progress = Math.min(elapsed / duration, 1);
              // Ease-out cubic formula
              const easeOut = 1 - Math.pow(1 - progress, 3);
              const currentVal = easeOut * target;

              counter.textContent = currentVal.toFixed(decimals) + suffix;

              if (progress < 1) {
                requestAnimationFrame(updateCounter);
              } else {
                counter.textContent = target.toFixed(decimals) + suffix;
              }
            }

            requestAnimationFrame(updateCounter);
          });
        }
      });
    }, {
      threshold: 0.2
    });

    observer.observe(metricsContainer);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCounterAnimation);
  } else {
    initCounterAnimation();
  }

})(window);
