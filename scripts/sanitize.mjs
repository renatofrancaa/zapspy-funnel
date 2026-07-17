/**
 * Sanitize original black funnel HTML:
 * - strip Meta Pixel / UTMify / Converteai / GTM / Sentry / their CAPI
 * - rewrite asset paths to local funnel-clone tree
 * - block original backends / checkout → local stubs
 * - inject stubs.js first
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

const STUBS_TAG = `<script src="./js/stubs.js"></script>`;

function stripTracking(html) {
  let h = html;

  // Remove full Meta Pixel blocks
  h = h.replace(/<!--\s*Meta Pixel[\s\S]*?<!--\s*End Meta Pixel Code\s*-->/gi, '<!-- pixel removed -->');
  h = h.replace(/<!--\s*Facebook Pixel[\s\S]*?<!--\s*End Facebook Pixel Code\s*-->/gi, '<!-- pixel removed -->');

  // UTMify
  h = h.replace(/<script[^>]*utmify[^>]*>[\s\S]*?<\/script>/gi, '');
  h = h.replace(/<script[^>]*src=["']https:\/\/cdn\.utmify\.com\.br[^"']*["'][^>]*><\/script>/gi, '');

  // fbclid capture poller
  h = h.replace(/<!--\s*Capture fbclid[\s\S]*?<\/script>/gi, '');
  h = h.replace(/\(function\(\)\s*\{\s*var m = window\.location\.search\.match\(\/\[\?&\]fbclid[\s\S]*?\}\)\(\);\s*<\/script>/gi, '');

  // Inline fbq bootstrap if still present
  h = h.replace(/<!function\(f,b,e,v,n,t,s\)[\s\S]*?fbq\('init'[\s\S]*?<\/script>/gi, '');
  h = h.replace(/!function\(f,b,e,v,n,t,s\)[\s\S]*?fbq\('init'[\s\S]*?<\/script>/gi, '');
  h = h.replace(/<noscript>\s*<img[^>]*facebook\.com\/tr[^>]*>\s*<\/noscript>/gi, '');

  // Converteai / VSL players
  h = h.replace(/<script[^>]*converteai[^>]*><\/script>/gi, '');
  h = h.replace(/<script[^>]*src=["']https:\/\/scripts\.converteai\.net[^"']*["'][^>]*><\/script>/gi, '');
  h = h.replace(/<link[^>]*(converteai|connect\.facebook|www\.facebook|googletagmanager|utmify|centerpag)[^>]*>/gi, '');

  // Sentry
  h = h.replace(/<script[^>]*sentry[^>]*><\/script>/gi, '');
  h = h.replace(/<script[^>]*src=["'][^"']*sentry[^"']*["'][^>]*><\/script>/gi, '');

  // Their tracking scripts (keep layout JS)
  const killScripts = [
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
  for (const s of killScripts) {
    const re = new RegExp(`<script[^>]*src=["'][^"']*${s.replace('.', '\\.')}[^"']*["'][^>]*>\\s*</script>`, 'gi');
    h = h.replace(re, `<!-- removed ${s} -->`);
  }

  // Facebook CAPI init blocks that call FacebookCAPI
  h = h.replace(/document\.addEventListener\('DOMContentLoaded',\s*async function\(\)\s*\{\s*if\s*\(typeof FacebookCAPI[\s\S]*?\}\);\s*<\/script>/gi, '<script>/* FacebookCAPI init removed */</script>');

  // ipapi geo in inline GeoLocation → use mock only
  h = h.replace(
    /const response = await fetch\('https:\/\/ipapi\.co\/json\/'\);/g,
    `const response = await fetch('/local-geo'); /* blocked external geo */`
  );
  // Actually local fetch mock handles ipapi via stubs; restore safer:
  h = h.replace(
    /const response = await fetch\('\/local-geo'\); \/\* blocked external geo \*\//g,
    `const response = await fetch('https://ipapi.co/json/');`
  );

  // Backend API URL
  h = h.replace(
    /https:\/\/zapspy-funnel-production\.up\.railway\.app/g,
    ''
  );
  h = h.replace(
    /window\.ZAPSPY_API_URL\s*\|\|\s*['"]https:\/\/zapspy-funnel-production\.up\.railway\.app['"]/g,
    "window.ZAPSPY_API_URL || ''"
  );

  // Checkout gateway
  h = h.replace(/https:\/\/go\.centerpag\.com\//g, './thanks.html?code=');
  h = h.replace(/https:\/\/go\.centerpag\.com/g, './thanks.html');
  h = h.replace(/window\.checkoutCode\s*=\s*['"][^'"]+['"]/g, "window.checkoutCode = 'LOCAL'");
  h = h.replace(
    /window\.checkoutCodeMap\s*=\s*\{[^}]+\}/g,
    "window.checkoutCodeMap = { basic: 'LOCAL_BASIC', complete: 'LOCAL_COMPLETE' }"
  );
  // proceedToCheckout URL builder
  h = h.replace(
    /let checkoutUrl = 'https:\/\/go\.centerpag\.com\/' \+ currentCheckoutCode;/g,
    "let checkoutUrl = './thanks.html?plan=' + (window._selectedTier || 'complete') + '&code=' + currentCheckoutCode;"
  );
  h = h.replace(
    /checkoutUrl = 'https:\/\/go\.centerpag\.com\/' \+ currentCheckoutCode;/g,
    "checkoutUrl = './thanks.html?plan=' + (window._selectedTier || 'complete') + '&code=' + currentCheckoutCode;"
  );

  // Pixel ID leftovers
  h = h.replace(/726299943423075/g, '000000000000000');

  // Clarity
  h = h.replace(/<script[^>]*>[\s\S]*?clarity\.ms[\s\S]*?<\/script>/gi, '');

  // preconnect noise
  h = h.replace(/<link rel="preconnect" href="https:\/\/(connect\.facebook\.net|www\.facebook\.com|scripts\.converteai\.net|images\.converteai\.net|cdn\.converteai\.net|cdn\.utmify\.com\.br|go\.centerpag\.com)"[^>]*>/gi, '');
  h = h.replace(/<link rel="dns-prefetch" href="https:\/\/(www\.googletagmanager\.com|cdn\.utmify\.com\.br)"[^>]*>/gi, '');

  return h;
}

function rewritePaths(html, file) {
  let h = html;

  // From original light/ folder: ../css ../js ../imagens ../../shared
  // Our clone is flat: phone.html next to css/ js/ imagens/ shared/
  h = h.replace(/(href|src)=["']\.\.\/css\//g, '$1="./css/');
  h = h.replace(/(href|src)=["']\.\.\/js\//g, '$1="./js/');
  h = h.replace(/(href|src)=["']\.\.\/imagens\//g, '$1="./imagens/');
  h = h.replace(/(href|src)=["']\.\.\/\.\.\/shared\//g, '$1="./shared/');
  h = h.replace(/(href|src)=["']\/shared\//g, '$1="./shared/');
  h = h.replace(/(href|src)=["']shared\//g, '$1="./shared/');
  h = h.replace(/(href|src)=["']js\/sentry-init\.js["']/g, '$1="./js/stubs.js"');

  // Cross-page links keep same filenames
  h = h.replace(/cta-unified\.html/g, 'cta.html');
  h = h.replace(/account\.html/g, 'account.html');
  h = h.replace(/conversas\.html/g, 'conversas.html');
  h = h.replace(/chat\.html/g, 'chat.html');
  h = h.replace(/phone\.html/g, 'phone.html');
  h = h.replace(/dashboard\.html/g, 'dashboard.html');
  h = h.replace(/login\.html/g, 'login.html');

  // Inject stubs as first script in <head>
  if (!h.includes('js/stubs.js')) {
    if (h.includes('<head>')) {
      h = h.replace('<head>', `<head>\n    ${STUBS_TAG}\n`);
    } else if (h.includes('<head ')) {
      h = h.replace(/<head[^>]*>/, (m) => `${m}\n    ${STUBS_TAG}\n`);
    }
  }

  // Brand-neutral optional title prefix comment
  h = h.replace(
    /<html([^>]*)>/i,
    '<html$1 data-clone="local-no-tracking">'
  );

  return h;
}

function patchCheckoutJs(html) {
  // Generic: any remaining centerpag
  return html
    .replace(/go\.centerpag\.com/gi, 'localhost')
    .replace(/zappdetect\.com/gi, 'localhost')
    .replace(/zapspy-funnel-production\.up\.railway\.app/gi, 'localhost');
}

function ensureThanksPage() {
  const p = path.join(root, 'thanks.html');
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Checkout (local demo)</title>
  <script src="./js/stubs.js"></script>
  <link rel="stylesheet" href="./css/global.css">
  <style>
    body{font-family:Inter,system-ui,sans-serif;background:#0f172a;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;}
    .card{background:#1e293b;border-radius:16px;padding:28px;max-width:420px;width:100%;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,.35)}
    h1{font-size:22px;margin:0 0 10px}
    p{color:#94a3b8;font-size:14px;line-height:1.5}
    code{background:#0f172a;padding:2px 8px;border-radius:6px;color:#6ee7b7}
    a{display:inline-block;margin-top:18px;background:#22c55e;color:#fff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:10px}
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
</html>`;
  fs.writeFileSync(p, html, 'utf8');
}

function ensureIndex() {
  const p = path.join(root, 'index.html');
  fs.writeFileSync(
    p,
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="0;url=phone.html">
  <title>Funnel</title>
  <script>location.replace('phone.html'+location.search);</script>
</head>
<body><a href="phone.html">Open funnel</a></body>
</html>`,
    'utf8'
  );
}

function ensureAudioVibrationFallback() {
  const p = path.join(root, 'js', 'audio-vibration.js');
  if (fs.existsSync(p) && fs.statSync(p).size > 100) return;
  fs.writeFileSync(
    p,
    `window.WhatsAppAudio={audioContext:null,init:function(){try{var AC=window.AudioContext||window.webkitAudioContext;if(AC)this.audioContext=new AC()}catch(e){}},play:function(){},notification:function(){}};
window.VibrationSystem={notification:function(){try{navigator.vibrate&&navigator.vibrate(30)}catch(e){}},alert:function(){try{navigator.vibrate&&navigator.vibrate([40,40,40])}catch(e){}},success:function(){try{navigator.vibrate&&navigator.vibrate(20)}catch(e){}}};`,
    'utf8'
  );
}

function ensureDossierFallback() {
  const p = path.join(root, 'shared', 'js', 'dossier.js');
  if (fs.existsSync(p) && fs.statSync(p).size > 50) return;
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(
    p,
    `window.Dossier=window.Dossier||{get:function(){return{deletedMessages:47,deletedMedia:23,suspicious:8,contacts:34,messages:247}},stats:function(){return this.get()}};`,
    'utf8'
  );
}

function ensureGeoFallback() {
  const p = path.join(root, 'shared', 'js', 'geo.js');
  if (fs.existsSync(p) && fs.statSync(p).size > 50) return;
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, `/* local geo stub — no network */\nwindow.__localGeo=true;\n`, 'utf8');
}

function main() {
  ensureAudioVibrationFallback();
  ensureDossierFallback();
  ensureGeoFallback();
  ensureThanksPage();
  ensureIndex();

  for (const [outName, srcPath] of Object.entries(sources)) {
    if (!fs.existsSync(srcPath)) {
      console.warn('SKIP missing source:', srcPath);
      continue;
    }
    let html = fs.readFileSync(srcPath, 'utf8');
    // Drop UTF-8 BOM if any
    if (html.charCodeAt(0) === 0xfeff) html = html.slice(1);
    html = stripTracking(html);
    html = rewritePaths(html, outName);
    html = patchCheckoutJs(html);

    // Extra: remove remaining fbq('track' network side — keep calls, stubs no-op them
    // Remove image beacons
    html = html.replace(/https:\/\/www\.facebook\.com\/tr\?[^"'\s]*/g, '#');

    const out = path.join(root, outName);
    fs.writeFileSync(out, html, 'utf8');
    console.log('OK', outName, Buffer.byteLength(html), 'bytes');
  }

  // README
  fs.writeFileSync(
    path.join(root, 'README.md'),
    `# Funnel clone (local, no tracking)

Cloned UI/structure from the competitor multi-step LP, with **all tracking removed**.

## Open

Serve the folder (file:// may block some APIs):

\`\`\`bash
npx serve .
# or: python -m http.server 8080
\`\`\`

Then open: http://localhost:3000/phone.html

## Pages

| File | Step |
|------|------|
| phone.html | Steps 1–6 (capture → loading → profile → BF → terminal → fingerprint) |
| account.html | Create free account |
| conversas.html | WhatsApp chat list (paywall) |
| chat.html | Single chat + unlock CTA |
| cta.html | Pricing (Essentials / Complete) |
| thanks.html | Local checkout placeholder |
| dashboard.html / login.html | Aux pages |

## What was removed

- Meta Pixel / CAPI / fbclid capture
- UTMify, GTM, Converteai players
- Sentry, Clarity
- Calls to zappdetect / railway track APIs
- go.centerpag.com checkout (→ thanks.html)
- Their visitor/funnel trackers

## Local stubs

\`js/stubs.js\` provides no-op \`fbq\`, \`FacebookCAPI\`, \`TrackingUtils\`, \`FunnelTracker\` and blocks outbound fetch/beacon to tracker hosts. WhatsApp-check is mocked as always registered.

## Wire your own checkout

Edit \`cta.html\` / search for \`thanks.html?plan=\` and point to your gateway.
`,
    'utf8'
  );

  console.log('Done →', root);
}

main();
