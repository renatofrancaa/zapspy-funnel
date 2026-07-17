/**
 * Funnel production config (standalone):
 * - No Railway / ZapSpy third-party backend
 * - Mock product APIs so the funnel works offline-ish
 * - No Meta Pixel / CAPI / UTMify / Google Ads
 * - Your Centerpag checkout links
 */
(function (w) {
  'use strict';

  // Empty = no third-party product backend
  w.ZAPSPY_API_URL = '';
  w.LOCAL_FUNNEL = true;

  // Your checkout links
  w.CHECKOUT_URLS = {
    basic: 'https://go.centerpag.com/PPU38CQE960', // $37 Essentials
    complete: 'https://go.centerpag.com/PPU38CQE961' // $67 Complete
  };
  w.CHECKOUT_BASE = w.CHECKOUT_URLS.complete;

  // ---- No-op ads / pixels ----
  w.fbq = w.fbq || function () {};
  w._fbq = w._fbq || w.fbq;
  w._fbPageViewFired = true;

  w.FacebookCAPI = {
    init: function () {},
    trackViewContent: function () {},
    trackEvent: function () {},
    trackLead: function () {},
    trackPurchase: function () {},
    trackAddToCart: function () {},
    trackInitiateCheckout: function () {},
    sendToServer: function () {},
    getUserData: function () {
      return {};
    }
  };

  w.TrackingUtils = {
    captureUTMs: function () {},
    appendUTMs: function (url) {
      return url;
    },
    getUTMs: function () {
      return {};
    },
    sendWithRetry: function () {
      return Promise.resolve({
        ok: true,
        json: function () {
          return Promise.resolve({ ok: true, skipped: true });
        }
      });
    },
    send: function () {
      return w.TrackingUtils.sendWithRetry();
    }
  };

  w.FunnelTracker = {
    events: {
      EMAIL_CAPTURED: 'EMAIL_CAPTURED',
      PHONE_SUBMITTED: 'PHONE_SUBMITTED',
      TIER_SELECTED: 'TIER_SELECTED',
      CHECKOUT_CLICK: 'CHECKOUT_CLICK',
      CHECKOUT_CLICKED: 'CHECKOUT_CLICKED'
    },
    track: function (n, d) {
      try {
        if (localStorage.getItem('debug_funnel') === '1') {
          console.log('[FunnelTracker]', n, d || {});
        }
      } catch (e) {}
    }
  };

  if (typeof w.VibrationSystem === 'undefined') {
    w.VibrationSystem = {
      notification: function () {
        try {
          navigator.vibrate && navigator.vibrate(30);
        } catch (e) {}
      },
      alert: function () {
        try {
          navigator.vibrate && navigator.vibrate([40, 40, 40]);
        } catch (e) {}
      },
      success: function () {
        try {
          navigator.vibrate && navigator.vibrate(20);
        } catch (e) {}
      }
    };
  }
  if (typeof w.WhatsAppAudio === 'undefined') {
    w.WhatsAppAudio = {
      audioContext: null,
      init: function () {},
      play: function () {},
      notification: function () {}
    };
  }

  function jsonResponse(obj, status) {
    return Promise.resolve(
      new Response(JSON.stringify(obj), {
        status: status || 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );
  }

  function mockWhatsappCheck(phone) {
    var clean = String(phone || '').replace(/\D/g, '') || '000';
    var seed = 0;
    for (var i = 0; i < clean.length; i++) seed = (seed * 31 + clean.charCodeAt(i)) >>> 0;
    return {
      registered: true,
      exists: true,
      picture: null,
      profilePictureUrl: null,
      name: null,
      about: null,
      _mock: true,
      _meta: { apiOk: true, status: 200, errorKind: null, mock: true }
    };
  }

  function mockGeo() {
    return {
      success: true,
      city: 'New York',
      state: 'NY',
      region: 'NY',
      country: 'US',
      country_code: 'US',
      latitude: 40.7128,
      longitude: -74.006,
      source: 'mock'
    };
  }

  var _origFetch = w.fetch ? w.fetch.bind(w) : null;
  if (_origFetch) {
    w.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      var method = ((init && init.method) || 'GET').toUpperCase();

      // Block third-party ZapSpy / Railway product APIs
      if (/zapspy-funnel|railway\.app/i.test(url)) {
        if (/whatsapp-check/i.test(url)) {
          var m = url.match(/whatsapp-check\/([^/?#]+)/i);
          return jsonResponse(mockWhatsappCheck(m ? decodeURIComponent(m[1]) : ''));
        }
        if (/\/api\/avatar/i.test(url)) {
          return Promise.resolve(
            new Response('', { status: 404, statusText: 'No avatar mock' })
          );
        }
        if (/\/api\/(track|leads|geo)/i.test(url)) {
          if (/\/api\/geo/i.test(url)) return jsonResponse(mockGeo());
          return jsonResponse({ ok: true, skipped: true }, 204);
        }
        return jsonResponse({ ok: true, skipped: true }, 204);
      }

      // Empty API base calls: /api/... relative or bare path after empty host
      if (/\/api\/whatsapp-check\//i.test(url) || /^\/api\/whatsapp-check\//i.test(url)) {
        var m2 = url.match(/whatsapp-check\/([^/?#]+)/i);
        return jsonResponse(mockWhatsappCheck(m2 ? decodeURIComponent(m2[1]) : ''));
      }
      if (/\/api\/avatar\//i.test(url)) {
        return Promise.resolve(new Response('', { status: 404 }));
      }
      if (/\/api\/leads/i.test(url)) {
        return jsonResponse({ ok: true, skipped: 'leads_disabled' }, 204);
      }
      if (/\/api\/track/i.test(url)) {
        return jsonResponse({ ok: true, skipped: true }, 204);
      }
      if (/\/api\/geo/i.test(url)) {
        return jsonResponse(mockGeo());
      }

      // Block ads / pixels / utmify / analytics
      if (
        /facebook\.com|fbcdn|connect\.facebook\.net|utmify|clarity\.ms|googletagmanager|google-analytics|googleadservices|doubleclick|sentry\.io/i.test(
          url
        )
      ) {
        return jsonResponse({}, 204);
      }

      // Allow public geo + maps + your checkout domain
      return _origFetch(input, init);
    };
  }

  if (navigator.sendBeacon) {
    var _beacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function (url, data) {
      var u = String(url || '');
      if (/\/api\/leads|zapspy|railway|facebook|utmify|clarity|google-analytics|googletagmanager|sentry|doubleclick/i.test(u)) {
        return true;
      }
      return _beacon.apply(navigator, arguments);
    };
  }
})(window);
