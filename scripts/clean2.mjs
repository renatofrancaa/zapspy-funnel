import fs from 'fs';

const files = fs.readdirSync('.').filter((f) => f.endsWith('.html'));

function clean(html) {
  let h = html;

  h = h.replace(
    /<script\b[^>]*src=["'][^"']*(utmify|fbevents|facebook\.net|converteai|sentry|fc\.js|funnel-tracker|funnel-tracking|tracking-utils|tracking\.js|funnel-config|google-ads|vsl-tracking|vsl-resume|clarity)[^"']*["'][^>]*>\s*<\/script>/gi,
    '<!-- tracker script removed -->'
  );

  h = h.replace(
    /<link\b[^>]*(utmify|facebook|converteai|googletagmanager|centerpag|clarity)[^>]*>/gi,
    ''
  );

  h = h.replace(/<noscript>[\s\S]*?facebook\.com\/tr[\s\S]*?<\/noscript>/gi, '');

  h = h.replace(/<script>\s*!function\(f,b,e,v,n,t,s\)[\s\S]*?<\/script>/gi, '<!-- fbq bootstrap removed -->');
  h = h.replace(
    /<script>\s*\(function\(\)\s*\{\s*var m = window\.location\.search\.match\([\s\S]*?_fbp[\s\S]*?\}\)\(\);\s*<\/script>/gi,
    ''
  );

  h = h.replace(/<!--\s*UTMify[\s\S]*?-->/gi, '');
  h = h.replace(/<!--\s*Meta Pixel[\s\S]*?-->/gi, '');
  h = h.replace(/<!--\s*End Meta Pixel[\s\S]*?-->/gi, '');

  h = h.replace(
    /<script>\s*document\.addEventListener\(['"]DOMContentLoaded['"],\s*async function\(\)\s*\{\s*if\s*\(typeof FacebookCAPI[\s\S]*?\}\);\s*<\/script>/gi,
    ''
  );
  h = h.replace(
    /<script>\s*document\.addEventListener\(['"]DOMContentLoaded['"],\s*function\(\)\s*\{\s*if\s*\(typeof FacebookCAPI[\s\S]*?\}\);\s*<\/script>/gi,
    ''
  );

  const pairs = [
    [/https?:\/\/cdn\.utmify\.com\.br[^"'\s]*/gi, ''],
    [/https?:\/\/connect\.facebook\.net[^"'\s]*/gi, ''],
    [/https?:\/\/www\.facebook\.com\/tr\?[^"'\s]*/gi, ''],
    [/https?:\/\/scripts\.converteai\.net[^"'\s]*/gi, ''],
    [/https?:\/\/images\.converteai\.net[^"'\s]*/gi, ''],
    [/https?:\/\/cdn\.converteai\.net[^"'\s]*/gi, ''],
    [/https?:\/\/go\.centerpag\.com\/?/gi, './thanks.html?code='],
    [/https?:\/\/zapspy-funnel-production\.up\.railway\.app/gi, ''],
    [/https?:\/\/(?:go\.)?zappdetect\.com[^"'\s]*/gi, ''],
    [/726299943423075/g, '000000000000000'],
    [/window\.checkoutCode\s*=\s*['"][^'"]+['"]/g, "window.checkoutCode = 'LOCAL'"],
  ];
  for (const [re, rep] of pairs) h = h.replace(re, rep);

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

  // vturb / converteai custom elements
  h = h.replace(/<vturb-smartplayer[\s\S]*?<\/vturb-smartplayer>/gi, '<!-- video removed -->');
  h = h.replace(/class="[^"]*vturb[^"]*"/gi, 'class="video-removed"');

  // leftover absolute path comments
  h = h.replace(/<!-- tracker script removed -->\s*<!-- tracker script removed -->/g, '<!-- tracker script removed -->');

  // checkout URL construction variants
  h = h.replace(
    /(['"])https:\/\/go\.centerpag\.com\/\1\s*\+/gi,
    "'./thanks.html?code=' +"
  );
  h = h.replace(
    /let checkoutUrl = ['"][^'"]*['"]\s*\+\s*currentCheckoutCode/gi,
    "let checkoutUrl = './thanks.html?plan=' + (window._selectedTier || 'complete') + '&code=' + currentCheckoutCode"
  );
  h = h.replace(
    /checkoutUrl = ['"][^'"]*centerpag[^'"]*['"]/gi,
    "checkoutUrl = './thanks.html?plan=' + (window._selectedTier || 'complete')"
  );

  // ensure stubs once at top of head
  if (!/js\/stubs\.js/.test(h)) {
    h = h.replace(/<head([^>]*)>/i, '<head$1>\n    <script src="./js/stubs.js"></script>\n');
  }

  // remove empty src scripts
  h = h.replace(/<script[^>]*src=["']\s*["'][^>]*>\s*<\/script>/gi, '');

  // replace centerpag string remnants in JS comments/strings
  h = h.replace(/centerpag/gi, 'local-checkout');
  h = h.replace(/zappdetect/gi, 'local');
  h = h.replace(/utmify/gi, 'localutm');
  h = h.replace(/converteai/gi, 'localvideo');

  return h;
}

for (const f of files) {
  if (f === 'index.html' || f === 'thanks.html') continue;
  let html = fs.readFileSync(f, 'utf8');
  html = clean(html);
  fs.writeFileSync(f, html);
  console.log('cleaned', f, html.length);
}

console.log('\n=== SCAN ===');
for (const f of files) {
  const c = fs.readFileSync(f, 'utf8');
  const hits = [];
  const checks = [
    ['utmify', /utmify/i],
    ['fbsdk', /connect\.facebook\.net/i],
    ['pixelid', /726299943423075/],
    ['converteai', /converteai/i],
    ['centerpag', /centerpag/i],
    ['railway', /zapspy-funnel-production/i],
    ['zappdetect', /zappdetect\.com/i],
    ['fc.js', /(?<!stubs)fc\.js/],
    ['funnel-tracker.js', /funnel-tracker\.js/],
    ['tracking.js src', /src=["'][^"']*tracking/i],
  ];
  for (const [name, re] of checks) {
    if (re.test(c)) hits.push(name);
  }
  console.log(f + ':', hits.length ? hits.join(', ') : 'CLEAN');
}
