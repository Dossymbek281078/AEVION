## Summary

Tier 2 of QRight, v1.1: closes the public-trust loop end-to-end and lands the operational tooling around it. Users register a work → embed a badge on any third-party site → revoke later → AEVION admins can audit, bulk-takedown, and CSV-export → owners get push notifications via signed webhooks → everything is visible in a public transparency report and a persistent audit log.

Result: registration → badge → cryptographic verification → revocation → notification are all first-class, every action is observable, and admin/owner surfaces ship with the tooling required for a real production run.

## Public surface

- **`GET /api/qright/embed/:id`** — sanitized JSON (no PII), CORS `*`, ETag/304. Includes `certificateId` (LEFT JOIN with `IPCertificate`), so embeds can deep-link to `/verify/:certId`.
- **`GET /api/qright/badge/:id.svg`** — shields.io-style SVG, `?theme=dark|light`. Flips red on revoke.
- **`/qright/object/[id]`** — server-rendered public page with dynamic OG metadata + 1200×630 OG image.
- **`/qright/object/[id]?embed=1`** — compact iframe-friendly variant (~360×140) for third-party drops.
- **`/qright/badge/[id]`** — embed configurator (live preview, `<img>` / `<iframe>` / fetch JS snippets).
- **`/qright/transparency`** — public aggregate report (totals + revokes by reason + by content type).
- **Live transparency tile** on `/qright` landing — pulls counts from `/api/qright/transparency` and links to the full report. Hidden when total = 0.

## Owner controls

- **`POST /api/qright/revoke/:id`** — owner-only, Bearer required. Closed-set `reasonCode` validation: `license-conflict / withdrawn / dispute / mistake / superseded / other / admin-takedown`.
- **`GET /api/qright/objects/:id/stats?days=30`** — owner-only fetch counter + 30-day per-day series + `topSources.hosts` (top 20 referrer hostnames).
- **Revoke modal** in `/qright` registry (Mine scope) — select reason code + optional free-text. Cards visibly flip red. Reason labels are i18n EN/RU and react to the global LangSwitch.
- **30-day sparkline** + **top-5 source chips** under each Mine-scope row. `(direct)` bucket greyed out, real hosts in teal.
- **Outgoing webhooks** panel (Mine scope): up to 10 endpoints per owner, HMAC-SHA256 signed deliveries. One-time secret modal on add.

## Owner webhooks

- **`GET /api/qright/webhooks`** — list mine. Secret redacted to a 6-char prefix on read.
- **`POST /api/qright/webhooks {url}`** — validates absolute http/https URL ≤ 500 chars, caps at 10 per owner, generates a 32-hex secret returned **once** in the response.
- **`DELETE /api/qright/webhooks/:id`** — owner-scoped; 404 hides "not yours" identically to "not found" so IDs can't be probed.
- **Delivery** — fans out on owner.revoke / admin.revoke / admin.bulk-revoke. Headers: `X-AEVION-Event: qright.object.revoked`, `X-AEVION-Signature: sha256=<hmac>`. Body: `{event, objectId, revokedAt, reasonCode, reason, revokedBy, deliveredAt}`. 5s `AbortController` timeout. `lastDeliveredAt` / `lastFailedAt` / `lastError` updated per delivery.

## Admin tooling

- **`/admin/qright`** — auth-gated registry browser with status/q filters + force-revoke modal + sparkline per row + Audit log section.
- **`POST /api/qright/admin/revoke/:id`** — single force-revoke regardless of ownership. Logged to `QRightAuditLog` + `console.warn` (tail-grep fallback) + fans out webhooks for that object's owner.
- **`POST /api/qright/admin/revoke-bulk {ids[], reasonCode, reason}`** — up to 200 ids/request. Snapshots existing rows and partitions input into `revoked / alreadyRevoked / notFound`, then issues a single `UPDATE … WHERE id = ANY($1) AND revokedAt IS NULL`. Audit row carries the full input and partition.
- **`GET /api/qright/admin/objects.csv?status=&q=`** — admin-only CSV export mirroring the on-screen view, with revoke fields and fetch counters. RFC 4180 escaping.
- **`GET /api/qright/admin/audit?limit=&action=&targetId=`** — paginated audit reader, default 100 / max 500, ordered by `at DESC`.
- **`GET /api/qright/admin/objects`** — list-all with status/q/limit filters (max 500).
- **`GET /api/qright/admin/whoami`** — admin-role probe.
- Admin gate: JWT `role=admin` **or** ENV `QRIGHT_ADMIN_EMAILS` allowlist (csv).
- **Per-row checkboxes + sticky bulk bar** in `/admin/qright` for bulk force-revoke. **Export CSV** button next to Reload (auth-aware blob download honoring current filters). **Audit log** section under the registry with action chip, actor, click-through to target, expandable JSON payload.

## Browse / Tier 2 hardening

- **`GET /api/qright/objects/search?q=&kind=&limit=`** — ILIKE on title (registered above `/objects/:id` to avoid Express shadowing). Capped at 50.
- **`GET /api/qright/objects.csv`** — public RFC 4180 CSV export.
- **`GET /api/qright/objects/:id`** — ETag/304 + rate limit.
- Search input + All/Mine scope toggle + per-card live SVG badge in the `/qright` registry.

## Headers / CSP

`/qright/object/:id`, `/qright/badge/:id`, `/qright/transparency` get `frame-ancestors *` + `X-Frame-Options ALLOWALL` + COEP `credentialless` + COOP `unsafe-none` + Referrer-Policy `strict-origin-when-cross-origin`. Public page also gets a tight `Permissions-Policy`. Catch-all `require-corp` would otherwise prevent third-party iframe embedding — these route-specific overrides scope the loosening to public surfaces only.

## Schema additions

`QRightObject` gains: `revokedAt`, `revokeReason`, `revokeReasonCode`, `embedFetches`, `lastFetchedAt`.

New tables (all `CREATE TABLE IF NOT EXISTS` — safe to deploy with no manual migration):
- **`QRightFetchDaily(objectId, day, fetches)`** — daily fetch buckets, indexed on `day`.
- **`QRightFetchSource(objectId, sourceHost, day, fetches)`** — per-Referer-host fetch buckets, indexed on `(objectId, day)`. Hostname only (no path/query/UA), lowercased and stripped of `www.`, `(direct)` fallback for missing/invalid Referer.
- **`QRightAuditLog(id, actor, action, targetId, payload JSONB, at)`** — append-only audit history, indexed on `at DESC` + `action` + `targetId`.
- **`QRightWebhook(id, ownerUserId, url, secret, createdAt, lastDeliveredAt, lastFailedAt, lastError)`** — per-owner outgoing webhook config, indexed on `ownerUserId`.

## i18n

- Single source of truth: **`frontend/src/lib/qrightRevokeReasons.ts`** (EN + RU labels + `OWNER_REVOKE_REASON_CODES` + `ADMIN_REVOKE_REASON_CODES` + `revokeReasonLabel(code, lang)` helper).
- Wired into `/qright` (registry + revoke modal) and `/admin/qright` (registry + force-revoke modal + bulk modal) — both react to the LangSwitch.
- Server pages (`/qright/transparency`, `/qright/object/[id]`) default to EN until `Accept-Language` threading lands in v1.2.

## ENV (production deploy)

- `QRIGHT_ADMIN_EMAILS` — comma-separated allowlist for `/admin/qright` access. Empty = JWT-role-only.

## Build

`npm run verify` (root) green after every commit: backend `tsc` + `next build`. New routes registered: `/qright/object/[id]`, `/qright/object/[id]/opengraph-image`, `/qright/badge/[id]`, `/qright/transparency`, `/admin/qright`.

## Test plan

- [ ] Register a work via `/qright`, click "Embed Badge" CTA, copy `<img>` snippet → renders on a third-party HTML page
- [ ] Open `/qright/object/<id>` → page renders with metadata; OG preview validates in Twitter Card Validator
- [ ] `/qright/object/<id>?embed=1` rendered as `<iframe>` — compact card visible, click opens full page in new tab
- [ ] Sign in, switch to Mine, click Revoke → modal opens; reason labels show RU when LangSwitch=RU; submit → badge on third-party site flips red within ~5 min cache window
- [ ] Set `QRIGHT_ADMIN_EMAILS` to your account; `/admin/qright` shows all rows; force-revoke flips embed and registry view
- [ ] In `/admin/qright`, select 3+ active rows via checkboxes → "Force-revoke N" modal → submit → toast shows per-bucket summary, audit log section gains a `admin.bulk-revoke` row with full payload
- [ ] In `/admin/qright`, click Export CSV → file downloads with current filter applied; rows include revoke fields + fetch counters
- [ ] In `/admin/qright`, expand an audit row's `payload` `<details>` → JSON renders inline
- [ ] `/qright/transparency` renders aggregates without errors; the homepage tile on `/qright` shows live counts and links to the full report
- [ ] On a Mine-scope card after at least one third-party badge fetch, top-source chips appear under the sparkline (real hostname or `(direct)`)
- [ ] Add a webhook in `/qright` Mine view → one-time secret modal appears; copy secret; revoke any of your objects → POST hits the URL with valid HMAC sig in `X-AEVION-Signature`
- [ ] Delete a webhook → row vanishes; subsequent revokes skip it
- [ ] Search for ≥2 chars in registry → list filters via `/objects/search`; clear → returns to full list
- [ ] Sparkline renders in Mine cards once 24h has passed and at least one fetch happened

## Commits (24)

### Tier 2 core (10)

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

### Production polish (4)

| SHA | What |
|-----|------|
| `67e3ada` | `?embed=1` compact iframe mode |
| `f4531dd` | Revoke reason codes (closed set + free-text) |
| `7af1398` | Owner-only embed fetch counter |
| `36d75bc` | Admin `/admin/qright` — audit + force-revoke |

### Enterprise polish (4)

| SHA | What |
|-----|------|
| `7049525` | COEP credentialless + Permissions-Policy on iframe routes |
| `56d9704` | Public transparency report |
| `8dc8ac3` | Time-series counter (daily buckets) + sparklines |
| `0f618b5` | docs: refresh PR body to 17 commits + deploy notes |

### v1.1 — operational tooling (6)

| SHA | What |
|-----|------|
| `afdb797` | Admin bulk force-revoke (≤200/req) + admin CSV export + sticky bulk bar |
| `1da4396` | Live transparency tile on `/qright` |
| `b94f1ae` | Per-source fetch counter (privacy-aware Referer hostname bucket) + topSources |
| `f299a9a` | Persistent audit log (`QRightAuditLog`) + admin reader UI |
| `4e9054b` | i18n revoke labels (EN + RU) + single source of truth |
| `f4b2491` | Owner-configured revoke webhooks (HMAC-SHA256 signed) |

🤖 Generated with [Claude Code](https://claude.com/claude-code)
