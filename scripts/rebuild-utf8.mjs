/**
 * Rebuild funnel HTML from clean originals (UTF-8) + re-apply local patches.
 * Fixes mojibake caused by PowerShell Set-Content encoding corruption.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const project = path.resolve(root, '..');

const sources = {
  'phone.html': path.join(project, 'black_phone.html'),
  'account.html': path.join(project, 'black_account.html'),
  'cta.html': path.join(project, 'black_cta.html'),
  'conversas.html': path.join(project, 'proxy_results', 'conversas.html'),
  'chat.html': path.join(project, 'proxy_results', 'chat.html'),
  'dashboard.html': path.join(project, 'proxy_results', 'dashboard.html'),
  'login.html': path.join(project, 'proxy_results', 'login.html'),
};

function stripTracking(html) {
  let h = html;

  h = h.replace(/<!--\s*Meta Pixel[\s\S]*?<!--\s*End Meta Pixel Code\s*-->/gi, '');
  h = h.replace(/<!--\s*Facebook Pixel[\s\S]*?<!--\s*End Facebook Pixel Code\s*-->/gi, '');
  h = h.replace(/<script[^>]*utmify[^>]*>[\s\S]*?<\/script>/gi, '');
  h = h.replace(/<script[^>]*src=["']https:\/\/cdn\.utmify\.com\.br[^"']*["'][^>]*><\/script>/gi, '');
  h = h.replace(
    /<script>\s*\(function\(\)\s*\{\s*var m = window\.location\.search\.match\([\s\S]*?_fbp[\s\S]*?\}\)\(\);\s*<\/script>/gi,
    ''
  );
  h = h.replace(/<script>\s*!function\(f,b,e,v,n,t,s\)[\s\S]*?<\/script>/gi, '');
  h = h.replace(/<noscript>\s*<img[^>]*facebook\.com\/tr[^>]*>\s*<\/noscript>/gi, '');
  h = h.replace(/<script[^>]*converteai[^>]*><\/script>/gi, '');
  h = h.replace(/<script[^>]*src=["']https:\/\/scripts\.converteai\.net[^"']*["'][^>]*><\/script>/gi, '');
  h = h.replace(
    /<link[^>]*(converteai|connect\.facebook|www\.facebook|googletagmanager|utmify|centerpag)[^>]*>/gi,
    ''
  );
  h = h.replace(/<script[^>]*sentry[^>]*><\/script>/gi, '');
  h = h.replace(/<script[^>]*src=["'][^"']*sentry[^"']*["'][^>]*><\/script>/gi, '');

  const kill = [
    'tracking-utils.js',
    'funnel-config.js',
    'tracking.js',
    'funnel-tracking.js',
    'google-ads-loader.js',
    'fc.js',
    'funnel-tracker.js',
    'vsl-tracking.js',
    'vsl-resume.js',
    'sentry-init.js',
  ];
  for (const s of kill) {
    const re = new RegExp(
      `<script[^>]*src=["'][^"']*${s.replace(/\./g, '\\.')}[^"']*["'][^>]*>\\s*</script>`,
      'gi'
    );
    h = h.replace(re, '');
  }

  h = h.replace(
    /document\.addEventListener\('DOMContentLoaded',\s*async function\(\)\s*\{\s*if\s*\(typeof FacebookCAPI[\s\S]*?\}\);\s*<\/script>/gi,
    '</script>'
  );
  h = h.replace(
    /<script>\s*document\.addEventListener\(['"]DOMContentLoaded['"],\s*async function\(\)\s*\{\s*if\s*\(typeof FacebookCAPI[\s\S]*?\}\);\s*<\/script>/gi,
    ''
  );

  h = h.replace(/https:\/\/zapspy-funnel-production\.up\.railway\.app/g, '');
  h = h.replace(
    /window\.ZAPSPY_API_URL\s*\|\|\s*['"]https:\/\/zapspy-funnel-production\.up\.railway\.app['"]/g,
    "window.ZAPSPY_API_URL || ''"
  );
  h = h.replace(/https:\/\/go\.centerpag\.com\//g, './thanks.html?code=');
  h = h.replace(/https:\/\/go\.centerpag\.com/g, './thanks.html');
  h = h.replace(/window\.checkoutCode\s*=\s*['"][^'"]+['"]/g, "window.checkoutCode = 'LOCAL'");
  h = h.replace(
    /window\.checkoutCodeMap\s*=\s*\{[^}]+\}/g,
    "window.checkoutCodeMap = { basic: 'LOCAL_BASIC', complete: 'LOCAL_COMPLETE' }"
  );
  h = h.replace(/726299943423075/g, '000000000000000');
  h = h.replace(
    /<link rel="preconnect" href="https:\/\/(connect\.facebook\.net|www\.facebook\.com|scripts\.converteai\.net|images\.converteai\.net|cdn\.converteai\.net|cdn\.utmify\.com\.br|go\.centerpag\.com)"[^>]*>/gi,
    ''
  );
  h = h.replace(
    /<link rel="dns-prefetch" href="https:\/\/(www\.googletagmanager\.com|cdn\.utmify\.com\.br)"[^>]*>/gi,
    ''
  );
  h = h.replace(/https:\/\/www\.facebook\.com\/tr\?[^"'\s]*/g, '#');
  h = h.replace(/cta-unified\.html/g, 'cta.html');
  h = h.replace(/zappdetect\.com/gi, 'localhost');
  h = h.replace(/centerpag/gi, 'local-checkout');

  return h;
}

function rewritePaths(html) {
  let h = html;
  h = h.replace(/(href|src)=["']\.\.\/css\//g, '$1="./css/');
  h = h.replace(/(href|src)=["']\.\.\/js\//g, '$1="./js/');
  h = h.replace(/(href|src)=["']\.\.\/imagens\//g, '$1="./imagens/');
  h = h.replace(/(href|src)=["']\.\.\/\.\.\/shared\//g, '$1="./shared/');
  h = h.replace(/(href|src)=["']\/shared\//g, '$1="./shared/');
  h = h.replace(/(href|src)=["']shared\//g, '$1="./shared/');
  h = h.replace(/(href|src)=["']js\/sentry-init\.js["']/g, '$1="./js/stubs.js"');
  h = h.replace(/src=["'][^"']*fc\.js[^"']*["']/gi, 'src="./js/stubs.js"');
  h = h.replace(/src=["'][^"']*funnel-tracker\.js[^"']*["']/gi, 'src="./js/stubs.js"');
  h = h.replace(/src=["'][^"']*funnel-tracking\.js[^"']*["']/gi, 'src="./js/stubs.js"');
  h = h.replace(/src=["'][^"']*tracking-utils\.js[^"']*["']/gi, 'src="./js/stubs.js"');
  h = h.replace(/src=["'][^"']*\/tracking\.js[^"']*["']/gi, 'src="./js/stubs.js"');
  h = h.replace(/src=["'][^"']*google-ads-loader\.js[^"']*["']/gi, 'src="./js/stubs.js"');
  h = h.replace(/src=["'][^"']*funnel-config\.js[^"']*["']/gi, 'src="./js/stubs.js"');
  h = h.replace(/src=["'][^"']*vsl-tracking\.js[^"']*["']/gi, 'src="./js/stubs.js"');
  h = h.replace(/src=["'][^"']*vsl-resume\.js[^"']*["']/gi, 'src="./js/stubs.js"');
  h = h.replace(/src=["'][^"']*sentry-init\.js[^"']*["']/gi, 'src="./js/stubs.js"');

  // Local fonts instead of Google
  h = h.replace(
    /<link href="https:\/\/fonts\.googleapis\.com\/css2\?family=Inter[^"]*"[^>]*>/gi,
    '<link rel="stylesheet" href="./css/fonts.css">'
  );
  h = h.replace(/@import url\('https:\/\/fonts\.googleapis\.com[^']*'\);/gi, '');
  h = h.replace(/<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">/gi, '');
  h = h.replace(/<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com"[^>]*>/gi, '');
  h = h.replace(
    /<link[^>]*fonts\.googleapis\.com\/css2\?family=SF\+Pro[^>]*>/gi,
    '<link rel="stylesheet" href="./css/fonts.css">'
  );

  if (!h.includes('js/stubs.js')) {
    h = h.replace(/<head([^>]*)>/i, '<head$1>\n    <script src="./js/stubs.js"></script>\n');
  }
  if (!h.includes('css/fonts.css')) {
    h = h.replace(/<head([^>]*)>/i, '<head$1>\n    <link rel="stylesheet" href="./css/fonts.css">\n');
  }
  if (!h.includes('shared/css/tokens.css') && h.includes('phone.html') === false) {
    // inject tokens on all pages
  }
  if (!h.includes('shared/css/tokens.css')) {
    h = h.replace(
      /<link rel="stylesheet" href="\.\/css\/fonts\.css">/,
      '<link rel="stylesheet" href="./css/fonts.css">\n    <link rel="stylesheet" href="./shared/css/tokens.css">'
    );
  }

  h = h.replace(/<html([^>]*)>/i, '<html$1 data-clone="local-no-tracking">');
  return h;
}

function patchPhone(html) {
  let h = html;

  // Fix nested broken script if any
  h = h.replace(
    /<script>\s*<script>\/\* FacebookCAPI init removed \*\/<\/script>/gi,
    ''
  );

  // GeoLocation block → real visitor geo
  const geoBlock = `        // ========== REAL GEOLOCATION (visitor) ==========
        const GeoLocation = {
            userCity: 'Unknown',
            userCountry: 'US',
            userLat: 0,
            userLon: 0,
            init: async function() {
                try {
                    var data = null;
                    if (typeof window.resolveVisitorGeo === 'function') {
                        data = await window.resolveVisitorGeo();
                    }
                    if (!data || !data.city) {
                        try {
                            var r = await fetch('https://ipwho.is/');
                            if (r.ok) {
                                var d = await r.json();
                                if (d && d.success !== false) {
                                    data = {
                                        city: d.city,
                                        state: d.region,
                                        country_code: d.country_code,
                                        latitude: d.latitude,
                                        longitude: d.longitude,
                                        success: true
                                    };
                                }
                            }
                        } catch (e1) {}
                    }
                    if (!data) return;
                    this.userCity = data.city || '';
                    this.userCountry = data.country_code || data.country || 'US';
                    this.userLat = data.latitude || 0;
                    this.userLon = data.longitude || 0;
                    localStorage.setItem('userGeo', JSON.stringify({
                        city: this.userCity,
                        country: this.userCountry,
                        lat: this.userLat,
                        lon: this.userLon,
                        state: data.state || data.region || ''
                    }));
                    if (this.userCity) localStorage.setItem('userCity', this.userCity);
                    if (data.state || data.region) localStorage.setItem('userState', data.state || data.region || '');
                    if (this.userCountry) {
                        localStorage.setItem('userCountryCode', this.userCountry);
                        localStorage.setItem('userCountry', this.userCountry);
                    }
                    if (this.userLat) localStorage.setItem('userLat', String(this.userLat));
                    if (this.userLon) localStorage.setItem('userLon', String(this.userLon));
                } catch(e) {}
            },
            getDistance: function() {
                return (Math.random() * 15 + 2).toFixed(1);
            }
        };`;

  h = h.replace(
    /\/\/ ========== REAL GEOLOCATION ==========[\s\S]*?getDistance:\s*function\(\)\s*\{[\s\S]*?\n\s*\}\s*\n\s*\};/,
    geoBlock
  );

  // _fetchGeo
  const fetchGeo = `        let _geoData = null;
        async function _fetchGeo() {
            if (_geoData && _geoData.city) return _geoData;
            try {
                if (typeof window.resolveVisitorGeo === 'function') {
                    const d = await window.resolveVisitorGeo();
                    if (d && (d.city || d.latitude)) {
                        _geoData = {
                            success: true,
                            city: d.city || '',
                            state: d.state || d.region || '',
                            country: d.country_code || d.country || '',
                            latitude: d.latitude || 0,
                            longitude: d.longitude || 0,
                            source: d.source || 'ip',
                            device: null,
                            browser: null
                        };
                        try {
                            if (_geoData.city) localStorage.setItem('userCity', _geoData.city);
                            if (_geoData.state) localStorage.setItem('userState', _geoData.state);
                            if (_geoData.country) {
                                localStorage.setItem('userCountry', _geoData.country);
                                localStorage.setItem('userCountryCode', _geoData.country);
                            }
                            if (_geoData.latitude) localStorage.setItem('userLat', String(_geoData.latitude));
                            if (_geoData.longitude) localStorage.setItem('userLon', String(_geoData.longitude));
                        } catch(e) {}
                        return _geoData;
                    }
                }
            } catch(e) {}
            try {
                const r2 = await fetch('https://ipwho.is/');
                if (r2.ok) {
                    const d2 = await r2.json();
                    if (d2 && d2.success !== false && d2.city) {
                        _geoData = {
                            success: true,
                            city: d2.city,
                            state: d2.region || '',
                            country: d2.country_code || d2.country || '',
                            latitude: d2.latitude || 0,
                            longitude: d2.longitude || 0,
                            device: null,
                            browser: null
                        };
                        return _geoData;
                    }
                }
            } catch(e) {}
            try {
                const r3 = await fetch('https://get.geojs.io/v1/ip/geo.json');
                if (r3.ok) {
                    const d3 = await r3.json();
                    if (d3.city) {
                        _geoData = {
                            success: true,
                            city: d3.city,
                            state: d3.region || '',
                            country: d3.country_code || d3.country || '',
                            latitude: parseFloat(d3.latitude) || 0,
                            longitude: parseFloat(d3.longitude) || 0,
                            device: null,
                            browser: null
                        };
                        return _geoData;
                    }
                }
            } catch(e) {}
            return _geoData;
        }`;

  h = h.replace(/let _geoData = null;[\s\S]*?async function _fetchGeo\(\) \{[\s\S]*?\n\s*return null;\n\s*\}/, fetchGeo);

  // Map loader with real coords
  const mapLoader = `            // Load map pinned to the VISITOR's real coordinates
            (async function loadRealMap() {
                const geo = _geoData || await _fetchGeo() || {};
                const city = geo.city || localStorage.getItem('userCity') || '';
                const state = geo.state || localStorage.getItem('userState') || '';
                const country = geo.country || localStorage.getItem('userCountry') || localStorage.getItem('userCountryCode') || '';
                let lat = parseFloat(geo.latitude || localStorage.getItem('userLat') || '0');
                let lon = parseFloat(geo.longitude || localStorage.getItem('userLon') || '0');
                const mapLabel = document.getElementById('realMapLabel');
                const mapIframe = document.getElementById('realMapIframe');
                const mapCoords = document.getElementById('realMapCoords');

                if (mapLabel) {
                    mapLabel.textContent = city
                        ? (city + (state ? ', ' + state : '') + (country ? ' · ' + country : ''))
                        : 'Locating...';
                }

                if ((!isFinite(lat) || !lat || !isFinite(lon) || !lon) && city) {
                    try {
                        const searchQuery = encodeURIComponent(
                            city + (state ? ', ' + state : '') + (country ? ', ' + country : '')
                        );
                        const response = await fetch(
                            'https://nominatim.openstreetmap.org/search?q=' + searchQuery + '&format=json&limit=1'
                        );
                        const data = await response.json();
                        if (data && data[0]) {
                            lat = parseFloat(data[0].lat);
                            lon = parseFloat(data[0].lon);
                        }
                    } catch (e) {
                        console.log('Map geocoding failed:', e);
                    }
                }

                if (mapIframe && isFinite(lat) && isFinite(lon) && lat && lon) {
                    const source = geo.source || '';
                    const delta = source.indexOf('gps') === 0 ? 0.02 : 0.06;
                    const bbox = (lon - delta) + ',' + (lat - delta) + ',' + (lon + delta) + ',' + (lat + delta);
                    mapIframe.src =
                        'https://www.openstreetmap.org/export/embed.html?bbox=' +
                        bbox +
                        '&layer=mapnik&marker=' +
                        lat +
                        ',' +
                        lon;
                    if (mapCoords) {
                        if (source.indexOf('gps') === 0) {
                            mapCoords.textContent = lat.toFixed(5) + ', ' + lon.toFixed(5);
                        } else {
                            const latVar = (lat + (Math.random() - 0.5) * 0.008).toFixed(4);
                            const lonVar = (lon + (Math.random() - 0.5) * 0.008).toFixed(4);
                            mapCoords.textContent = latVar + ', ' + lonVar;
                        }
                    }
                    try {
                        localStorage.setItem('userLat', String(lat));
                        localStorage.setItem('userLon', String(lon));
                    } catch (e) {}
                }
            })();`;

  h = h.replace(
    /\/\/ Load real map with city location from geolocation[\s\S]*?\(async function loadRealMap\(\) \{[\s\S]*?\}\)\(\);/,
    mapLoader
  );

  // Spy button CSS fix after polish
  if (!h.includes('spy-btn-fix')) {
    h = h.replace(
      /<link rel="stylesheet" href="\.\/shared\/css\/funnel-polish\.css[^"]*">/,
      `<link rel="stylesheet" href="./shared/css/funnel-polish.css?v=20260419190100">
<style id="spy-btn-fix">
:root {
  --brand-primary: #00a884 !important;
  --brand-primary-strong: #008f6f !important;
  --brand-primary-soft: rgba(0, 168, 132, 0.12) !important;
  --brand-primary-ring: rgba(0, 168, 132, 0.35) !important;
  --text-on-brand: #ffffff !important;
  --bg: #f5f0eb;
  --surface: #ffffff;
  --surface-2: #f3f4f6;
  --text-1: #111827;
  --text-2: #6b7280;
  --text-3: #9ca3af;
  --font-body: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  --font-display: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}
button.spy-btn, .spy-btn {
  background: linear-gradient(135deg, #00a884 0%, #008f6f 100%) !important;
  background-color: #00a884 !important;
  color: #ffffff !important;
  -webkit-text-fill-color: #ffffff !important;
  opacity: 1 !important;
  visibility: visible !important;
  border: none !important;
  box-shadow: 0 4px 16px rgba(0, 168, 132, 0.35) !important;
}
button.spy-btn svg, .spy-btn svg {
  stroke: #ffffff !important;
  color: #ffffff !important;
}
button.confirm-btn, .confirm-btn {
  background: linear-gradient(135deg, #00a884 0%, #008f6f 100%) !important;
  background-color: #00a884 !important;
  color: #ffffff !important;
  -webkit-text-fill-color: #ffffff !important;
}
</style>`
    );
  }

  // Hardcode spy-btn inline styles if present
  h = h.replace(
    /\.spy-btn\s*\{[^}]*background:\s*linear-gradient\([^)]+var\(--brand-primary\)[^;]*;/g,
    `.spy-btn {
            width: 100%;
            padding: 18px;
            background: linear-gradient(135deg, #00a884, #008f6f) !important;`
  );

  // CTA short-circuit not needed on phone

  // Ensure ZAPSPY_API empty
  h = h.replace(
    /const ZAPSPY_API = window\.ZAPSPY_API_URL \|\| ['"][^'"]*['"]/,
    "const ZAPSPY_API = window.ZAPSPY_API_URL || ''"
  );

  return h;
}

function patchCta(html) {
  let h = html;
  if (!h.includes('LOCAL_CHECKOUT_SHORTCIRCUIT')) {
    h = h.replace(
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
  }
  if (!/window\._selectedTier\s*=\s*tier/.test(h)) {
    h = h.replace(
      /function selectTier\s*\(\s*tier\s*\)\s*\{/,
      'function selectTier(tier) {\n            window._selectedTier = tier;'
    );
  }
  return h;
}

function writeUtf8(file, content) {
  fs.writeFileSync(file, content, { encoding: 'utf8' });
}

// --- main ---
for (const [outName, srcPath] of Object.entries(sources)) {
  if (!fs.existsSync(srcPath)) {
    console.warn('SKIP', srcPath);
    continue;
  }
  let html = fs.readFileSync(srcPath, 'utf8');
  if (html.charCodeAt(0) === 0xfeff) html = html.slice(1);
  html = stripTracking(html);
  html = rewritePaths(html);
  if (outName === 'phone.html') html = patchPhone(html);
  if (outName === 'cta.html') html = patchCta(html);

  // imagem paths inside JS templates that still use ../imagens
  html = html.replace(/\.\.\/imagens\//g, './imagens/');

  writeUtf8(path.join(root, outName), html);

  // verify no mojibake
  const check = fs.readFileSync(path.join(root, outName), 'utf8');
  const moj = (check.match(/â€|ðŸ|Ã©|âœ/g) || []).length;
  const emoji = /[\u{1F300}-\u{1FAFF}]/u.test(check);
  console.log('OK', outName, 'bytes=', Buffer.byteLength(check, 'utf8'), 'mojibake=', moj, 'hasEmoji=', emoji);
}

// thanks.html clean
writeUtf8(
  path.join(root, 'thanks.html'),
  `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Checkout (local demo)</title>
  <script src="./js/stubs.js"></script>
  <link rel="stylesheet" href="./css/fonts.css">
  <link rel="stylesheet" href="./css/global.css">
  <style>
    body{font-family:'Inter',system-ui,sans-serif;background:#0f172a;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;}
    .card{background:#1e293b;border-radius:16px;padding:28px;max-width:420px;width:100%;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,.35)}
    h1{font-size:22px;margin:0 0 10px}
    p{color:#94a3b8;font-size:14px;line-height:1.5}
    code{background:#0f172a;padding:2px 8px;border-radius:6px;color:#6ee7b7}
    a{display:inline-block;margin-top:18px;background:#00a884;color:#fff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:10px}
  </style>
</head>
<body>
  <div class="card">
    <h1>Local checkout placeholder</h1>
    <p>Original payment gateway removed so nothing tracks you.<br>
    Plan: <code id="plan">—</code> · Code: <code id="code">—</code></p>
    <p>Wire your own gateway here later.</p>
    <a href="./conversas.html">Back to chats</a>
  </div>
  <script>
    var p = new URLSearchParams(location.search);
    document.getElementById('plan').textContent = p.get('plan') || 'complete';
    document.getElementById('code').textContent = p.get('code') || 'LOCAL';
  </script>
</body>
</html>
`
);

console.log('Rebuild complete (UTF-8).');
