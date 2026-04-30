## Summary

Tier 2 of Planet Compliance, mirroring the QRight pattern that already shipped (PRs #18 + #22). Closes the public-trust loop on Planet certificates: third-party embed JSON + SVG badge, public transparency report, owner revoke with closed-set reason codes, full admin tooling (CSV export + bulk force-revoke + audit log + top embed sources), and owner-configured outgoing webhooks (HMAC-signed with delivery log + manual retry + URL edit).

Result: Planet certificates can now be embedded on third-party sites, revoked through a normal user surface (not a database operation), and audited / managed by an admin allowlist. Operators get the same vocabulary and shape as QRight, so existing muscle-memory transfers.

## Public surfaces

- **`GET /api/planet/certificates/:certId/embed`** — sanitized JSON. Drops `privatePayload` / `signature` internals; surfaces only what's safe for an embed. CORS open, ETag/304, 240/min/IP rate limit. LEFT JOINs artifact + submission so the embed has a human-meaningful title and `verifyUrl` deep-link.
- **`GET /api/planet/certificates/:certId/badge.svg`** — shields.io-style two-segment badge. `?theme=dark|light`. Flips red on revoke.
- **`GET /api/planet/transparency`** — `{ totals: { certificates, active, revoked, firstIssuedAt, lastIssuedAt }, revokesByReasonCode, certificatesByArtifactType }`. 5-min cached, CORS `*`.
- **`/planet/transparency`** — server-rendered public report with EN/RU support (reuses `qrightServerI18n.pickLang` — `?lang=` override + `Accept-Language` fallback).
- **`/planet/badge/[certId]`** — embed configurator with live SVG preview, theme toggle, copy-able snippets (HTML `<img>` / direct URL / JS fetch).

## Owner controls

- **`POST /api/planet/certificates/:certId/revoke`** — owner-only Bearer. Closed-set `reasonCode`: `license-conflict / withdrawn / dispute / mistake / superseded / other`. `admin-takedown` is reserved for admins (returns 403 if owner tries it). Audit-logged + webhooks fan out.
- **`/planet/webhooks/[id]`** — endpoint info card with inline URL edit, last 100 deliveries with OK/FAIL chip + status code + RETRY badge, per-row Retry button on failed attempts, expandable JSON request body.

## Admin tooling

- Admin gate: `PLANET_ADMIN_EMAILS` ENV (csv allowlist) **or** JWT `role=admin`.
- **`GET /admin/whoami`** — role probe.
- **`GET /admin/certificates?status=&q=&limit=`** — registry with status filter + ILIKE search on `submissionTitle` or `id`.
- **`GET /admin/certificates.csv`** — RFC 4180 export mirroring on-screen filter.
- **`POST /admin/certificates/:certId/revoke`** — single force-revoke. Audit + console.warn + webhook fanout to the cert's owner.
- **`POST /admin/certificates/revoke-bulk`** — up to 200 ids. Snapshot-then-update strategy returns partition: `revoked / alreadyRevoked / notFound`.
- **`GET /admin/audit?limit=&action=&targetId=`** — 500 max/page.
- **`GET /admin/sources?days=30&limit=50`** — top embed source hosts across all certs (abuse detection: which third-party hosts are scraping the most certificates and how many distinct ones).
- **`/admin/planet`** — wraps all of the above: per-row checkboxes + sticky bulk bar, force-revoke modals (single + bulk), audit log section, sources panel with `7d / 30d / 90d` toggle, CSV download button.

## Owner webhooks

- **`PlanetWebhook(id, ownerUserId, url, secret, createdAt, lastDeliveredAt, lastFailedAt, lastError)`** — cap 10/owner. Secret returned **once** on POST.
- **`PlanetWebhookDelivery(...)`** — per-attempt log indexed on `(webhookId, deliveredAt DESC)`. Stores raw signed `requestBody` so retries re-issue identically.
- HMAC-SHA256 signed: `X-AEVION-Signature: sha256=<hex>`, `X-AEVION-Event: planet.certificate.revoked`. 5s `AbortController` timeout. Body: `{ event, certificateId, revokedAt, reasonCode, reason, revokedBy: "owner"|"admin", deliveredAt }`.
- CRUD: `GET /webhooks`, `POST /webhooks`, `DELETE /webhooks/:id`, **`PATCH /webhooks/:id`** (edit URL without secret rotation), `GET /webhooks/:id/deliveries`, **`POST /webhooks/:id/retry/:deliveryId`**.

## Schema additions

Bootstrap is `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE ADD COLUMN IF NOT EXISTS` on first request — **no manual migration**.

`PlanetCertificate` columns:
- `revokeReasonCode TEXT` (closed set as above)
- `revokedBy TEXT` (`owner` / `admin`)
- `embedFetches BIGINT NOT NULL DEFAULT 0`
- `lastFetchedAt TIMESTAMPTZ`

New tables (5):
- **`PlanetCertFetchDaily(certificateId, day, fetches)`** — daily fetch buckets, indexed on `day`.
- **`PlanetCertFetchSource(certificateId, sourceHost, day, fetches)`** — privacy-aware per-Referer-host bucket. Hostname only — reuses `qrightHelpers.refererHost` so the privacy semantics (no path/UA/IP, lowercase, `www.` strip, `(direct)` fallback) are identical across modules.
- **`PlanetAuditLog`** — append-only, indexed on `at DESC` + `action` + `targetId`.
- **`PlanetWebhook`** — owner config.
- **`PlanetWebhookDelivery`** — per-attempt log.

## ENV

| Name | Required | Default |
|---|---|---|
| `PLANET_ADMIN_EMAILS` | optional | empty (JWT `role=admin` still works) |

## Build

`npm run verify` (backend tsc + next build) green. Vitest 153/153 PASS unchanged. New backend routes: 13 (3 public + 1 owner + 7 admin + 6 webhook). New frontend routes: 4 (`/planet/transparency`, `/planet/badge/[certId]`, `/planet/webhooks/[id]`, `/admin/planet`).

## Test plan

- [ ] `GET /api/planet/transparency` returns `totals + revokesByReasonCode + certificatesByArtifactType`
- [ ] `GET /api/planet/certificates/<certId>/embed` returns sanitized JSON with `verifyUrl`
- [ ] `GET /api/planet/certificates/<certId>/badge.svg` returns SVG; `?theme=light` produces light variant
- [ ] Owner revoke: `POST /api/planet/certificates/<certId>/revoke` with `reasonCode=mistake` → certificate flips, badge turns red within ~5 min cache
- [ ] Owner cannot use `admin-takedown` reasonCode (403)
- [ ] `/planet/transparency?lang=ru` renders Russian labels
- [ ] Set `PLANET_ADMIN_EMAILS=<your-email>`; `/admin/planet` shows full registry
- [ ] Force-revoke single via modal → audit log gains `admin.revoke` row
- [ ] Select 3+ rows → bulk modal → submit → toast shows `N revoked, M already, K not found`
- [ ] Export CSV → file downloads with current filter applied
- [ ] Top embed sources panel: toggle 7d/30d/90d, hosts ranked by `totalFetches`
- [ ] Add a webhook in `/planet` (when integrated) or via curl → one-time secret visible
- [ ] Revoke a cert → POST hits webhook URL with valid `X-AEVION-Signature: sha256=<hmac>`
- [ ] `/planet/webhooks/<id>` shows delivery row → click Retry on a failed delivery → re-issued with same body
- [ ] Edit URL via `/planet/webhooks/<id>` → secret prefix unchanged

## Commits (2)

| SHA | What |
|-----|------|
| `5360ee7` | feat(planet): Tier 2 backend — embed/badge/transparency + revoke + admin + webhooks |
| (frontend HEAD) | feat(planet): Tier 2 frontend — transparency / admin / badge / webhook pages + docs |

🤖 Generated with [Claude Code](https://claude.com/claude-code)
