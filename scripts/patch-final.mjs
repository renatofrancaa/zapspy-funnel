import fs from 'fs';

// --- CTA short-circuit ---
let cta = fs.readFileSync('cta.html', 'utf8');
if (!cta.includes('LOCAL_CHECKOUT_SHORTCIRCUIT')) {
  cta = cta.replace(
    /function proceedToCheckout\s*\(\s*\)\s*\{/,
    `function proceedToCheckout() {
            /* LOCAL_CHECKOUT_SHORTCIRCUIT */
            try {
              var plan = window._selectedTier || 'complete';
              var code = (window.checkoutCodeMap && window.checkoutCodeMap[plan]) || window.checkoutCode || 'LOCAL';
              window.location.href = './thanks.html?plan=' + encodeURIComponent(plan) + '&code=' + encodeURIComponent(code);
              return;
            } catch (e) { window.location.href = './thanks.html'; return; }
        function __original_proceedToCheckout_dead() {`
  );
  fs.writeFileSync('cta.html', cta);
  console.log('cta: short-circuit installed');
} else {
  console.log('cta: already short-circuited');
}

cta = fs.readFileSync('cta.html', 'utf8');
if (!/window\._selectedTier\s*=\s*tier/.test(cta)) {
  cta = cta.replace(
    /function selectTier\s*\(\s*tier\s*\)\s*\{/,
    'function selectTier(tier) {\n            window._selectedTier = tier;'
  );
  fs.writeFileSync('cta.html', cta);
  console.log('cta: selectTier patched');
}

// --- stubs.js ---
const stubs = `/**
 * Local no-op stubs — replaces original tracking/analytics SDKs.
 * Nothing phones home. Safe for offline demos.
 */
(function (w) {
  'use strict';

  w.fbq = w.fbq || function () {};
  w._fbq = w._fbq || w.fbq;
  w._fbPageViewFired = true;

  w.FacebookCAPI = {
    init: function () {},
    trackViewContent: function () {},
    trackEvent: function () {},
    trackLead: function () {},
    trackPurchase: function () {},
    trackInitiateCheckout: function () {},
    sendToServer: function () {},
    getUserData: function () { return {}; }
  };

  w.TrackingUtils = {
    captureUTMs: function () {
      try {
        var p = new URLSearchParams(w.location.search);
        var keys = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','utm_id','ref','atk'];
        var saved = {};
        keys.forEach(function (k) {
          var v = p.get(k);
          if (v) {
            saved[k] = v;
            try { localStorage.setItem('local_' + k, v); } catch (e) {}
          }
        });
        if (Object.keys(saved).length) {
          try { localStorage.setItem('local_utms', JSON.stringify(saved)); } catch (e) {}
        }
      } catch (e) {}
    },
    appendUTMs: function (url) { return url; },
    getUTMs: function () {
      try { return JSON.parse(localStorage.getItem('local_utms') || '{}'); } catch (e) { return {}; }
    },
    sendWithRetry: function () {
      return Promise.resolve({ ok: true, json: function () { return Promise.resolve({}); } });
    },
    send: function () { return Promise.resolve({ ok: true }); }
  };

  var _events = {
    EMAIL_CAPTURED: 'EMAIL_CAPTURED',
    PHONE_SUBMITTED: 'PHONE_SUBMITTED',
    TIER_SELECTED: 'TIER_SELECTED',
    CHECKOUT_CLICK: 'CHECKOUT_CLICK'
  };
  w.FunnelTracker = {
    events: _events,
    track: function (name, data) {
      try {
        if (w.localStorage.getItem('debug_funnel') === '1') {
          console.log('[FunnelTracker]', name, data || {});
        }
      } catch (e) {}
    }
  };

  if (typeof w.VibrationSystem === 'undefined') {
    w.VibrationSystem = {
      notification: function () { try { if (navigator.vibrate) navigator.vibrate(30); } catch (e) {} },
      alert: function () { try { if (navigator.vibrate) navigator.vibrate([40, 40, 40]); } catch (e) {} },
      success: function () { try { if (navigator.vibrate) navigator.vibrate(20); } catch (e) {} }
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

  w.ZAPSPY_API_URL = '';
  w.LOCAL_FUNNEL = true;
  w.CHECKOUT_BASE = './thanks.html';

  function mockWhatsapp(phone) {
    return {
      registered: true,
      picture: null,
      name: null,
      about: null,
      isBusiness: false,
      phone: phone || '',
      status: 'online'
    };
  }

  function mockGeo() {
    var city = 'New York', state = 'NY';
    try {
      city = localStorage.getItem('userCity') || city;
      state = localStorage.getItem('userState') || state;
    } catch (e) {}
    return {
      success: true,
      city: city,
      state: state,
      country: 'US',
      country_code: 'US',
      region: state,
      latitude: 40.7128,
      longitude: -74.0060
    };
  }

  function jsonResponse(obj, status) {
    return Promise.resolve(new Response(JSON.stringify(obj), {
      status: status || 200,
      headers: { 'Content-Type': 'application/json' }
    }));
  }

  var _origFetch = w.fetch ? w.fetch.bind(w) : null;
  if (_origFetch) {
    w.fetch = function (input, init) {
      var url = (typeof input === 'string') ? input : (input && input.url) || '';

      if (/\\/api\\/whatsapp-check\\//i.test(url) || /whatsapp-check\\//i.test(url)) {
        var phone = (url.match(/whatsapp-check\\/(\\d+)/) || [])[1] || '';
        return jsonResponse(mockWhatsapp(phone));
      }
      if (/\\/api\\/geo/i.test(url) || /ipapi\\.co|ipwho\\.is|api\\.country\\.is|geojs\\.io|ipify|my-ip\\.io/i.test(url)) {
        return jsonResponse(mockGeo());
      }
      if (/\\/api\\/avatar\\//i.test(url)) {
        return Promise.resolve(new Response('', { status: 204 }));
      }
      if (/\\/api\\/(track|leads)/i.test(url)) {
        return jsonResponse({ ok: true }, 204);
      }

      if (/zappdetect\\.com|zapspy-funnel|railway\\.app|facebook\\.com|fbcdn|utmify|converteai|centerpag|clarity\\.ms|googletagmanager|google-analytics|sentry\\.io|doubleclick/i.test(url)) {
        return jsonResponse({}, 204);
      }

      return _origFetch(input, init);
    };
  }

  if (navigator.sendBeacon) {
    var _beacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function (url) {
      if (/zappdetect|railway|facebook|utmify|converteai|centerpag|clarity|google|sentry|\\/api\\/track/i.test(String(url))) {
        return true;
      }
      return _beacon.apply(navigator, arguments);
    };
  }

  try { w.TrackingUtils.captureUTMs(); } catch (e) {}
})(window);
`;

// The above still has double-escaped regex because of template string writing to file.
// Write with real single backslashes for regex source:
fs.writeFileSync(
  'js/stubs.js',
  stubs
    .replace(/\\\\/g, '\\') // convert double backslash sequences for regex in generated file
);

// Wait - that would also break newlines etc. Better write the file with a normal string carefully.

const stubsCorrect = [
  "/**",
  " * Local no-op stubs — no network tracking.",
  " */",
  "(function (w) {",
  "  'use strict';",
  "  w.fbq = w.fbq || function () {};",
  "  w._fbq = w._fbq || w.fbq;",
  "  w._fbPageViewFired = true;",
  "  w.FacebookCAPI = { init:function(){}, trackViewContent:function(){}, trackEvent:function(){}, trackLead:function(){}, trackPurchase:function(){}, trackInitiateCheckout:function(){}, sendToServer:function(){}, getUserData:function(){ return {}; } };",
  "  w.TrackingUtils = {",
  "    captureUTMs: function () { try { var p = new URLSearchParams(w.location.search); var keys=['utm_source','utm_medium','utm_campaign','utm_content','utm_term','utm_id','ref','atk']; var saved={}; keys.forEach(function(k){ var v=p.get(k); if(v){ saved[k]=v; try{localStorage.setItem('local_'+k,v);}catch(e){} } }); if(Object.keys(saved).length){ try{localStorage.setItem('local_utms',JSON.stringify(saved));}catch(e){} } } catch(e){} },",
  "    appendUTMs: function (url) { return url; },",
  "    getUTMs: function () { try { return JSON.parse(localStorage.getItem('local_utms')||'{}'); } catch(e){ return {}; } },",
  "    sendWithRetry: function () { return Promise.resolve({ ok:true, json:function(){ return Promise.resolve({}); } }); },",
  "    send: function () { return Promise.resolve({ ok:true }); }",
  "  };",
  "  w.FunnelTracker = { events:{ EMAIL_CAPTURED:'EMAIL_CAPTURED', PHONE_SUBMITTED:'PHONE_SUBMITTED', TIER_SELECTED:'TIER_SELECTED', CHECKOUT_CLICK:'CHECKOUT_CLICK' }, track:function(n,d){ try{ if(localStorage.getItem('debug_funnel')==='1') console.log('[FunnelTracker]',n,d||{}); }catch(e){} } };",
  "  if (typeof w.VibrationSystem === 'undefined') { w.VibrationSystem = { notification:function(){ try{ navigator.vibrate&&navigator.vibrate(30);}catch(e){} }, alert:function(){ try{ navigator.vibrate&&navigator.vibrate([40,40,40]);}catch(e){} }, success:function(){ try{ navigator.vibrate&&navigator.vibrate(20);}catch(e){} } }; }",
  "  if (typeof w.WhatsAppAudio === 'undefined') { w.WhatsAppAudio = { audioContext:null, init:function(){}, play:function(){}, notification:function(){} }; }",
  "  w.ZAPSPY_API_URL = '';",
  "  w.LOCAL_FUNNEL = true;",
  "  w.CHECKOUT_BASE = './thanks.html';",
  "  function mockWhatsapp(phone){ return { registered:true, picture:null, name:null, about:null, isBusiness:false, phone:phone||'', status:'online' }; }",
  "  function mockGeo(){ var city='New York', state='NY'; try{ city=localStorage.getItem('userCity')||city; state=localStorage.getItem('userState')||state; }catch(e){} return { success:true, city:city, state:state, country:'US', country_code:'US', region:state, latitude:40.7128, longitude:-74.0060 }; }",
  "  function jsonResponse(obj, status){ return Promise.resolve(new Response(JSON.stringify(obj), { status:status||200, headers:{'Content-Type':'application/json'} })); }",
  "  var _origFetch = w.fetch ? w.fetch.bind(w) : null;",
  "  if (_origFetch) {",
  "    w.fetch = function (input, init) {",
  "      var url = (typeof input === 'string') ? input : (input && input.url) || '';",
  "      if (/\\/api\\/whatsapp-check\\//i.test(url) || /whatsapp-check\\//i.test(url)) {",
  "        var phone = (url.match(/whatsapp-check\\/(\\d+)/) || [])[1] || '';",
  "        return jsonResponse(mockWhatsapp(phone));",
  "      }",
  "      if (/\\/api\\/geo/i.test(url) || /ipapi\\.co|ipwho\\.is|api\\.country\\.is|geojs\\.io|ipify|my-ip\\.io/i.test(url)) {",
  "        return jsonResponse(mockGeo());",
  "      }",
  "      if (/\\/api\\/avatar\\//i.test(url)) { return Promise.resolve(new Response('', { status:204 })); }",
  "      if (/\\/api\\/(track|leads)/i.test(url)) { return jsonResponse({ ok:true }, 204); }",
  "      if (/zappdetect\\.com|zapspy-funnel|railway\\.app|facebook\\.com|fbcdn|utmify|converteai|centerpag|clarity\\.ms|googletagmanager|google-analytics|sentry\\.io|doubleclick/i.test(url)) {",
  "        return jsonResponse({}, 204);",
  "      }",
  "      return _origFetch(input, init);",
  "    };",
  "  }",
  "  if (navigator.sendBeacon) {",
  "    var _beacon = navigator.sendBeacon.bind(navigator);",
  "    navigator.sendBeacon = function (url) {",
  "      if (/zappdetect|railway|facebook|utmify|converteai|centerpag|clarity|google|sentry|\\/api\\/track/i.test(String(url))) return true;",
  "      return _beacon.apply(navigator, arguments);",
  "    };",
  "  }",
  "  try { w.TrackingUtils.captureUTMs(); } catch (e) {}",
  "})(window);",
  ""
].join('\n');

fs.writeFileSync('js/stubs.js', stubsCorrect);
console.log('stubs rewritten, bytes', stubsCorrect.length);

// Scan
console.log('\n=== FINAL SCAN ===');
for (const f of fs.readdirSync('.').filter((x) => x.endsWith('.html'))) {
  const c = fs.readFileSync(f, 'utf8');
  const bad = [];
  if (/facebook\.com|facebook\.net/i.test(c)) bad.push('fb');
  if (/utmify|converteai|centerpag|zappdetect\.com|railway\.app/i.test(c)) bad.push('remote');
  console.log(f + ':', bad.length ? bad.join(',') : 'OK');
}
console.log('shortcircuit:', fs.readFileSync('cta.html', 'utf8').includes('LOCAL_CHECKOUT_SHORTCIRCUIT'));
