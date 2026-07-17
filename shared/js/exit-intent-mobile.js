/**
 * ZS Exit-Intent Mobile — fires the existing #exitOverlay on mobile devices
 * where the classic mouseleave trigger doesn't exist.
 *
 * Strategy (any of these triggers reveals the overlay, only once per session):
 *   1. Tab becomes hidden (visibilitychange) AFTER the user spent ≥ 25s on page
 *      AND scrolled past 30% of the document.
 *   2. User taps browser back-button (popstate). We push a sentinel state on
 *      load so the first back press is captured for an exit interstitial.
 *   3. Aggressive upward scroll near the top of the page (rage scroll up).
 *   4. Idle timeout: 90s of zero touch/scroll interaction.
 *
 * Designed to coexist with the existing desktop mouseleave handler — both
 * use the same `exitShown` window flag so nothing fires twice.
 */
(function () {
  'use strict';
  if (window.ZSExitIntentMobile) return;
  window.ZSExitIntentMobile = true;

  function isMobile() {
    return window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  }

  function show() {
    var ov = document.getElementById('exitOverlay');
    if (!ov) return;
    if (window.exitShown) return;
    window.exitShown = true;
    ov.style.display = 'flex';
    try {
      if (typeof fbq === 'function') {
        fbq('trackCustom', 'ExitIntent', { source: 'mobile' });
      }
    } catch (e) {}
  }

  if (!isMobile()) return; // Desktop already handled by mouseleave

  var loadedAt = Date.now();
  var maxScrollPct = 0;
  var lastScrollY = window.scrollY || 0;
  var lastInteract = Date.now();

  function scrollPct() {
    var doc = document.documentElement;
    var h = doc.scrollHeight - doc.clientHeight;
    if (h <= 0) return 0;
    return Math.min(100, ((window.scrollY || doc.scrollTop) / h) * 100);
  }

  window.addEventListener('scroll', function () {
    lastInteract = Date.now();
    var pct = scrollPct();
    if (pct > maxScrollPct) maxScrollPct = pct;

    var st = window.scrollY || 0;
    // Rage scroll up: jumped > 200px upward AND landed in top 100px
    if (st < 100 && (lastScrollY - st) > 200 && maxScrollPct > 25) {
      show();
    }
    lastScrollY = st;
  }, { passive: true });

  ['touchstart', 'touchmove', 'pointerdown', 'click'].forEach(function (ev) {
    window.addEventListener(ev, function () { lastInteract = Date.now(); }, { passive: true });
  });

  // Trigger 1: tab hidden after 25s + meaningful scroll
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      var dwell = Date.now() - loadedAt;
      if (dwell >= 25000 && maxScrollPct >= 30) show();
    }
  });

  // Trigger 2: back button intent (push sentinel state, intercept popstate)
  try {
    if (typeof history !== 'undefined' && history.pushState) {
      history.pushState({ zsExitGuard: 1 }, '', window.location.href);
      window.addEventListener('popstate', function () {
        if (window.exitShown) return;
        // Re-push sentinel so the user can still navigate back after seeing modal
        try { history.pushState({ zsExitGuard: 1 }, '', window.location.href); } catch (e) {}
        show();
      });
    }
  } catch (e) {}

  // Trigger 4: idle for 90s
  setInterval(function () {
    if ((Date.now() - lastInteract) > 90000 && maxScrollPct >= 20) show();
  }, 15000);
})();
