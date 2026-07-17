import fs from 'fs';

for (const f of fs.readdirSync('.').filter((x) => x.endsWith('.html'))) {
  let h = fs.readFileSync(f, 'utf8');
  h = h.replace(/<!-- removed [^>]*-->/g, '');
  h = h.replace(/<!-- tracker script removed -->/g, '');
  h = h.replace(/<!-- fbq bootstrap removed -->/g, '');
  h = h.replace(/<!-- pixel removed -->/g, '');
  h = h.replace(/<!-- ok -->/g, '');
  h = h.replace(/<!-- video removed -->/g, '<!-- video placeholder -->');
  fs.writeFileSync(f, h);
}

console.log('=== THREAT SCAN ===');
for (const f of fs.readdirSync('.').filter((x) => x.endsWith('.html'))) {
  const c = fs.readFileSync(f, 'utf8');
  const bad = [];
  if (/facebook\.com|facebook\.net/i.test(c)) bad.push('fb-host');
  if (/utmify/i.test(c)) bad.push('utmify');
  if (/converteai/i.test(c)) bad.push('converteai');
  if (/centerpag/i.test(c)) bad.push('centerpag');
  if (/zappdetect/i.test(c)) bad.push('zappdetect');
  if (/railway\.app/i.test(c)) bad.push('railway');
  if (/src=["'][^"']*fc\.js/.test(c)) bad.push('fc-src');
  if (/fbq\('init'/.test(c)) bad.push('fbq-init');
  const ext = [...c.matchAll(/src=["'](https?:[^"']+)["']/g)].map((m) => m[1]);
  const blocked = ext.filter(
    (u) => !/fonts\.googleapis|fonts\.gstatic|cdnjs|unpkg|jsdelivr|cloudflare/.test(u)
  );
  if (blocked.length) bad.push('ext:' + blocked.slice(0, 4).join(' | '));
  console.log(f + ':', bad.length ? bad.join(', ') : 'OK');
}

// Patch CTA checkout if still broken
let cta = fs.readFileSync('cta.html', 'utf8');
if (cta.includes('proceedToCheckout') && !cta.includes('thanks.html')) {
  cta = cta.replace(
    /function proceedToCheckout\s*\([^)]*\)\s*\{/,
    `function proceedToCheckout() {
            var currentCheckoutCode = window.checkoutCode || 'LOCAL';
            var checkoutUrl = './thanks.html?plan=' + (window._selectedTier || 'complete') + '&code=' + currentCheckoutCode;
            window.location.href = checkoutUrl;
            return;
            function __dead_proceedToCheckout() {`
  );
  fs.writeFileSync('cta.html', cta);
  console.log('patched proceedToCheckout');
}

// Safer: rewrite any remaining checkout URL builders
cta = fs.readFileSync('cta.html', 'utf8');
cta = cta.replace(
  /https:\/\/go\.local-checkout\.com\/?/gi,
  './thanks.html?code='
);
// purchaseTier should set _selectedTier
if (!cta.includes('window._selectedTier')) {
  cta = cta.replace(
    /function selectTier\s*\(\s*tier\s*\)\s*\{/,
    "function selectTier(tier) {\n            window._selectedTier = tier;"
  );
  cta = cta.replace(
    /function purchaseTier\s*\(\s*tier/,
    "function purchaseTier(tier"
  );
}
// Force checkout URLs
cta = cta.replace(
  /let checkoutUrl = [^;]+;/g,
  "let checkoutUrl = './thanks.html?plan=' + (window._selectedTier || tier || 'complete') + '&code=' + (window.checkoutCode || 'LOCAL');"
);
fs.writeFileSync('cta.html', cta);

// phone.html ensure API empty
let phone = fs.readFileSync('phone.html', 'utf8');
phone = phone.replace(
  /const ZAPSPY_API = window\.ZAPSPY_API_URL \|\| ['"][^'"]*['"]/,
  "const ZAPSPY_API = window.ZAPSPY_API_URL || ''"
);
fs.writeFileSync('phone.html', phone);

console.log('done');
