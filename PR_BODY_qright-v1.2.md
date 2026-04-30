## Summary

QRight v1.2: closes the entire post-merge backlog from v1.1. SRI-like integrity gate on the embed surface (replaces the originally-planned iframe `integrity` attr that the spec doesn't natively support), admin per-source abuse view, full server-side i18n RU/EN, webhook delivery log + manual retry + URL edit, and vitest coverage for the pure helpers. Plus a refreshed deploy doc.

Result: every operational gap reported in the v1.1 retrospective is closed; QRight is feature-complete for the GA push.

## SRI-like hash gate (`?expected-hash=<sha256>`)

- **`GET /api/qright/embed/:id?expected-hash=<hex>`** — JSON response gains `expectedHash` (echoed lowercase) and `hashStatus` (`match` / `mismatch` / `unspecified`). Top-level `status` (`registered` / `revoked`) is unchanged so existing consumers don't break.
- **`GET /api/qright/badge/:id.svg?expected-hash=<hex>`** — when the pin doesn't match (and the object is not revoked), badge flips to `HASH MISMATCH · YYYY-MM-DD` with an orange right-segment (`#ea580c`). Revoked still wins (red).
- ETag includes `hashStatus` so a CDN won't cache a "match" variant and serve it to a caller passing a different (or no) pin.
- Validation: 64 hex chars (case-insensitive). Both `expected-hash` and `expectedHash` accepted.
- `/qright/badge/[id]` configurator gains a "Pin contentHash (SRI-like)" checkbox that appends the param to all generated snippets, with inline help.
- Constant-time compare via `crypto.timingSafeEqual` defends against the (very unlikely) timing oracle.

## Admin per-source view

- **`GET /api/qright/admin/sources?days=30&limit=50`** — aggregates `QRightFetchSource` across **all** objects an admin can see. Returns each host with `totalFetches` and `uniqueObjects` so operators can spot a single host scraping many works (abuse) versus one host hitting one work hard (legitimate embed).
- `/admin/qright` gains a "Top embed sources" panel between the bulk bar and audit log, with `7d / 30d / 90d` toggle and Refresh button. Reuses the same hostname-only privacy bucket — no path/UA/IP.

## Server-side i18n (EN/RU) for public surfaces

- New `frontend/src/lib/qrightServerI18n.ts`: `pickLang(searchParams, headers)` reads `?lang=en|ru` override then falls back to `Accept-Language` (primary subtag `ru` wins). `tString(page, lang, key, vars)` is a tiny mustache-lite lookup against EN/RU tables for `transparency` and `object` pages.
- `/qright/transparency` and `/qright/object/[id]` now route every visible string + `revokeReasonLabel(code, lang)` through the table. Number formatting follows the matching locale.
- Fixes the v1.1 limitation: server pages were EN-only because they couldn't import the `"use client"` `useI18n` context.

## Webhook UI v2 — edit URL, delivery log, manual retry

### Backend
- **`QRightWebhookDelivery(webhookId, objectId, eventType, requestBody, statusCode, ok, error, deliveredAt, isRetry)`** — per-attempt log indexed on `(webhookId, deliveredAt DESC)`. Stores raw signed body so retries re-issue identically (idempotency-friendly).
- `attemptWebhookDelivery()` — single-place HMAC sign + POST + persist log + bump `last*` counters. `triggerRevokeWebhooks()` now wraps it instead of duplicating fetch/headers/error handling.
- **`PATCH /webhooks/:id`** — edit URL without rotating secret.
- **`GET /webhooks/:id/deliveries?limit=50`** — owner-scoped delivery history (max 200/page).
- **`POST /webhooks/:id/retry/:deliveryId`** — re-issue original body. All three endpoints 404-mask "not yours" identically to "not found" so ids can't be probed.

### Frontend
- New page **`/qright/webhooks/[id]`** — endpoint info card with inline URL edit, last 100 deliveries with OK/FAIL chip, status code, RETRY badge, expandable JSON body, per-row Retry button on failed attempts.
- `/qright` Mine view: each webhook row gets a "Log & retry →" link next to Delete.

## Vitest unit coverage

Extracted `readExpectedHash`, `timingSafeHexEq`, `refererHost` from `qright.ts` into `src/lib/qrightHelpers.ts` (no behaviour change, just moved) so they can be exercised in isolation. The route file imports them.

`tests/qrightHelpers.test.ts` adds **24 cases**:
- `readExpectedHash`: missing key, non-string, both spellings, normalize, trim, length validation, array-pick, precedence
- `timingSafeHexEq`: identical, different, length mismatch, doesn't throw on garbage, case-insensitive (Node hex parses both)
- `refererHost`: missing/empty/malformed, www-strip (leading only), lowercase, ignores port/path/query/fragment, array-pick, alt spelling, 253-char cap

Full backend suite: **153/153 PASS**.

## Schema additions

- `QRightWebhookDelivery` (new) — see above.

All other v1.1 tables unchanged. Bootstrap is `CREATE TABLE IF NOT EXISTS` on first request — no manual migration.

## Deploy notes

`docs/qright-deploy.md` refreshed:
- Documents all new tables (FetchSource / AuditLog / Webhook / **WebhookDelivery**) with column-level annotations.
- Smoke-test recipes added: hash-gate match/mismatch (`5a-5c`), admin endpoints (`6-9`), webhook lifecycle including HMAC verify (`10-13`).
- v1.1 deploy checklist (env + smoke pass criteria).

## Build

`npm run verify` (backend tsc + next build) green after every commit. New routes: `/qright/webhooks/[id]`. New endpoints: `PATCH /webhooks/:id`, `GET /webhooks/:id/deliveries`, `POST /webhooks/:id/retry/:deliveryId`, `GET /admin/sources`. Embed JSON now exposes `expectedHash` + `hashStatus`.

## Test plan

- [ ] `GET /api/qright/embed/<id>?expected-hash=<hash>` returns `hashStatus: "match"` when correct, `"mismatch"` when wrong
- [ ] `GET /api/qright/badge/<id>.svg?expected-hash=<wrong>` returns SVG with `HASH MISMATCH` text
- [ ] `/qright/badge/[id]` configurator: tick "Pin contentHash" → all snippets gain the query param
- [ ] `/admin/qright` Top embed sources panel renders, toggle 7d/30d/90d works, host with `(direct)` shown grey, real hosts in teal
- [ ] `/qright/transparency?lang=ru` renders Russian labels (incl. revoke reasons)
- [ ] `/qright/object/<id>?lang=ru` renders Russian labels
- [ ] Browser with `Accept-Language: ru-RU` defaults to RU on both pages without `?lang=` override
- [ ] `/qright` Mine view: webhook row → "Log & retry →" → `/qright/webhooks/[id]` page loads with delivery history
- [ ] Click "Edit URL" → input + Save → URL updated without secret rotation (verify by re-checking secret prefix)
- [ ] Trigger a failed delivery (e.g. point webhook at `https://httpbin.org/status/500`), revoke an object → row appears in log with `FAIL 500` chip → click Retry → re-issued with same body, signature still valid
- [ ] `npm test --prefix aevion-globus-backend` passes 153/153

## Commits (6)

| SHA | What |
|-----|------|
| `1ee6848` | docs(qright): refresh deploy notes for v1.1 — new tables + admin/webhook smoke recipes |
| `c333414` | feat(qright): SRI-like expected-hash gate on embed/badge + UI pin toggle |
| `2f37969` | feat(qright): admin per-source view — top embed hosts across all objects |
| `595f14c` | feat(qright): server-side i18n EN/RU for /transparency and /object/[id] |
| `cd9229f` | test(qright): vitest coverage for pure helpers — 24 cases |
| `66488a6` | feat(qright): webhook UI v2 — edit URL, delivery log, manual retry |

🤖 Generated with [Claude Code](https://claude.com/claude-code)
