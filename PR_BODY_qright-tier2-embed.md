## Summary

Tier 2 of QRight: closes the public-trust loop. Users register a work → get a verifiable badge they can paste anywhere → third parties (and the AEVION public page) can re-check status live, with revocation flowing through to embeds.

## What's in this branch

### Public surface
- **`GET /api/qright/embed/:id`** — sanitized JSON (no PII), CORS `*`, ETag/304. Designed for third-party fetch.
- **`GET /api/qright/badge/:id.svg`** — shields.io-style SVG badge, `?theme=dark|light`, ETag/304. Drop-in `<img>` tag.
- **`/qright/object/[id]`** — server-rendered public page with dynamic OG metadata + 1200×630 OG image. Iframe-friendly (CSP `frame-ancestors *`, X-Frame-Options ALLOWALL, COEP cross-origin overrides on this path).
- **`/qright/badge/[id]`** — embed configurator: live preview, dark/light toggle, copy snippets (img / iframe / fetch JS).

### Owner controls
- **`POST /api/qright/revoke/:id`** — owner-only (Bearer required). Adds `revokedAt` + `revokeReason` columns.
- **Revoke UI** in registry list (visible on Mine scope) — prompt for reason, refresh on success.
- **Status visible everywhere**: badge flips red, embed JSON returns `status:"revoked"`, public page shows red banner with reason, registry card tints red.

### Browse / Tier 2 API hardening
- **`GET /api/qright/objects/search?q=&kind=&limit=`** — ILIKE on title, optional kind filter, capped at 50. Declared above `/objects/:id` so Express doesn't shadow.
- **`GET /api/qright/objects.csv`** — RFC4180 CSV export (already shipped earlier on this branch).
- **`GET /api/qright/objects/:id`** — ETag/304 (already shipped).
- **`/qright` registry list** — search input + All/Mine scope toggle + live SVG badge per row + Public page / Embed code / Revoke links per card.

## Build

`npm run verify` (root) green: backend `tsc` + `next build` (`/qright/object/[id]`, `/qright/badge/[id]`, OG route all registered).

## Test plan

- [ ] Register a work via `/qright`, hit "Embed Badge" CTA, copy `<img>` snippet, paste into a third-party HTML page → badge renders
- [ ] Open `/qright/object/<id>` → page renders with metadata, OG preview works (validate via Twitter Card Validator)
- [ ] Sign in, switch registry to Mine, click Revoke → badge on third-party site flips red within ~5 min cache window (or sooner with hard reload)
- [ ] Revoked object: public page shows red banner + reason; embed JSON returns `status:"revoked"`
- [ ] Search for ≥2 chars → list filters via `/objects/search`; clear → returns to full list

## Commits

| SHA | What |
|-----|------|
| `c0efcc7` | Public embed JSON + SVG badge endpoints |
| `d3f4650` | `/qright/badge/[id]` configurator |
| `3509f86` | Live badge in registry + Embed Badge CTA on success |
| `3d3a308` | Revoke + search backend + revoked-state in embed/badge |
| `a7e66b5` | `/qright/object/[id]` public shareable page |
| `2edf089` | Iframe CSP/X-Frame-Options on public surfaces |
| `578b4f4` | Registry UI — search + scope toggle + revoke button |
| `243a2f6` | Dynamic OG image for `/qright/object/[id]` |

🤖 Generated with [Claude Code](https://claude.com/claude-code)
