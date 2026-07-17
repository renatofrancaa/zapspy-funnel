# Funnel clone (production-ready static)

Clone visual do funil multi-step (Whats Spy style), **sem tracking do original** e **sem backend Railway deles**.

## Live (Vercel)

- **Start:** https://funnel-clone.vercel.app/phone.html  
- **Home:** https://funnel-clone.vercel.app/ (rewrite → phone)  
- **Repo:** https://github.com/renatofrancaa/zapspy-funnel  
- **Dashboard:** https://vercel.com/renatofrancaa-7241s-projects/funnel-clone  

Test on **mobile** or Chrome DevTools device mode.

### Custom domain

Vercel → Project → **Settings → Domains** → add `seudominio.com` → copy the DNS records into your registrar.

## Local

```bash
cd funnel-clone
npx --yes serve -p 5173 .
```

http://localhost:5173/phone.html

## Funnel steps

| # | File | Step |
|---|------|------|
| 1–6 | `phone.html` | Capture → loading → profile → scan → terminal → fingerprint |
| 7 | `account.html` | Email / account |
| 8 | `conversas.html` | Chat list |
| 9 | `chat.html` | Single chat (locked) |
| 10 | `cta.html` | Offer $37 / $67 → Centerpag |
| 11 | `thanks.html` | Post-checkout placeholder |

## Checkout

Configured in `js/stubs.js`:

- $37 → `https://go.centerpag.com/PPU38CQE960`
- $67 → `https://go.centerpag.com/PPU38CQE961`

## Privacy / independence

- Meta Pixel / UTMify / GTM blocked
- Lead API disabled
- Product APIs mocked locally (no `zapspy-funnel` Railway)
- Geo can still use public IP APIs from the browser

## Next

Member **report dashboard** (Love Finds style) — separate step.
