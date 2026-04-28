## Summary

Tier 2 of QRight: closes the public-trust loop end-to-end and lands operational tooling. Users register a work → get an embeddable badge for any third-party site → revoke it later → AEVION admins can audit and force-takedown for disputes.

Result: registration → badge → cryptographic verification → revocation are now first-class, all surfaces stay consistent, and every action is observable.

## Public surface

- **`GET /api/qright/embed/:id`** — sanitized JSON (no PII), CORS `*`, ETag/304. Includes `certificateId` (LEFT JOIN with `IPCertificate`), so embeds can deep-link to `/verify/:certId`.
- **`GET /api/qright/badge/:id.svg`** — shields.io-style SVG, `?theme=dark|light`. Flips red on revoke.
- **`/qright/object/[id]`** — server-rendered public page with dynamic OG metadata + 1200×630 OG image.
- **`/qright/object/[id]?embed=1`** — compact iframe-friendly variant (~360×140) for third-party drops.
- **`/qright/badge/[id]`** — embed configurator (live preview, `<img>` / `<iframe>` / fetch JS snippets).
- **`/qright/transparency`** — public aggregate report (totals + revokes by reason + by content type).

## Owner controls

- **`POST /api/qright/revoke/:id`** — owner-only, Bearer required. Closed-set `reasonCode` validation: `license-conflict / withdrawn / dispute / mistake / superseded / other / admin-takedown`.
- **`GET /api/qright/objects/:id/stats?days=30`** — owner-only fetch counter + 30-day per-day series.
- **Revoke modal** in `/qright` registry (Mine scope) — select reason code + optional free-text. Cards visibly flip red.
- **30-day sparkline** next to embed-fetches counter on Mine-scope cards.

## Admin tooling

- **`/admin/qright`** — auth-gated registry browser with status/q filters + force-revoke modal. Sparkline per row.
- **`POST /api/qright/admin/revoke/:id`** — force-revoke regardless of ownership; logged via `console.warn`.
- **`GET /api/qright/admin/objects`** — list-all with status/q/limit filters (max 500).
- **`GET /api/qright/admin/whoami`** — admin-role probe.
- Admin gate: JWT `role=admin` **or** ENV `QRIGHT_ADMIN_EMAILS` allowlist (csv).

## Browse / Tier 2 hardening

- **`GET /api/qright/objects/search?q=&kind=&limit=`** — ILIKE on title (registered above `/objects/:id` to avoid Express shadowing). Capped at 50.
- **`GET /api/qright/objects.csv`** — RFC4180 CSV export.
- **`GET /api/qright/objects/:id`** — ETag/304.
- Search input + All/Mine scope toggle + per-card live SVG badge in the `/qright` registry.

## Headers / CSP

`/qright/object/:id`, `/qright/badge/:id`, `/qright/transparency` get `frame-ancestors *` + `X-Frame-Options ALLOWALL` + COEP `credentialless` + COOP `unsafe-none` + Referrer-Policy `strict-origin-when-cross-origin`. Public page also gets a tight `Permissions-Policy`. Catch-all `require-corp` would otherwise prevent third-party iframe embedding — these route-specific overrides scope the loosening to public surfaces only.

## Schema additions

`QRightObject` gains: `revokedAt`, `revokeReason`, `revokeReasonCode`, `embedFetches`, `lastFetchedAt`. New `QRightFetchDaily(objectId, day, fetches)` table for time-series counters (UPSERT, indexed on `day`). All via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS` — safe to deploy with no manual migration.

## ENV (production deploy)

- `QRIGHT_ADMIN_EMAILS` — comma-separated allowlist for `/admin/qright` access. Empty = JWT-role-only.

## Build

`npm run verify` (root) green: backend `tsc` + `next build`. New routes registered: `/qright/object/[id]`, `/qright/object/[id]/opengraph-image`, `/qright/badge/[id]`, `/qright/transparency`, `/admin/qright`.

## Test plan

- [ ] Register a work via `/qright`, click "Embed Badge" CTA, copy `<img>` snippet → renders on a third-party HTML page
- [ ] Open `/qright/object/<id>` → page renders with metadata; OG preview validates in Twitter Card Validator
- [ ] `/qright/object/<id>?embed=1` rendered as `<iframe>` — compact card visible, click opens full page in new tab
- [ ] Sign in, switch to Mine, click Revoke → modal opens; pick reason code; submit → badge on third-party site flips red within ~5 min cache window
- [ ] Set `QRIGHT_ADMIN_EMAILS` to your account; `/admin/qright` shows all rows; force-revoke flips embed and registry view
- [ ] `/qright/transparency` renders aggregates without errors
- [ ] Search for ≥2 chars in registry → list filters via `/objects/search`; clear → returns to full list
- [ ] Sparkline renders in Mine cards once 24h has passed and at least one fetch happened

## Commits (17)

| SHA | What |
|-----|------|
| `c0efcc7` | Public embed JSON + SVG badge endpoints |
| `d3f4650` | `/qright/badge/[id]` configurator |
| `3509f86` | Live badge in registry + Embed Badge CTA |
| `3d3a308` | Owner revoke + search + revoked state |
| `a7e66b5` | `/qright/object/[id]` public page |
| `2edf089` | Iframe CSP/X-Frame-Options on public surfaces |
| `578b4f4` | Registry UI — search + scope toggle + revoke button |
| `243a2f6` | Dynamic OG image for `/qright/object/[id]` |
| `729e9ff` | docs: PR body draft |
| `ec8ca9e` | Verify-loop closed: embed exposes `certificateId` |
| `67e3ada` | `?embed=1` compact iframe mode |
| `f4531dd` | Revoke reason codes (closed set + free-text) |
| `7af1398` | Owner-only embed fetch counter |
| `36d75bc` | Admin `/admin/qright` — audit + force-revoke |
| `7049525` | COEP credentialless + Permissions-Policy on iframe routes |
| `56d9704` | Public transparency report |
| `8dc8ac3` | Time-series counter (daily buckets) + sparklines |

🤖 Generated with [Claude Code](https://claude.com/claude-code)
