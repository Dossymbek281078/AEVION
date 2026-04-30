# QRight deploy notes

## Environment variables

| Name | Required | Default | Purpose |
|---|---|---|---|
| `AUTH_JWT_SECRET` | yes | `dev-auth-secret` | JWT signing key. Set to a strong random string in production. |
| `BACKEND_PROXY_TARGET` | frontend build | `http://127.0.0.1:4001` | URL the Next rewrite proxies `/api-backend/*` to. |
| `QRIGHT_ADMIN_EMAILS` | optional | empty | Comma-separated lowercase emails granted access to `/admin/qright` and `POST /api/qright/admin/*`. JWT `role=admin` is also honoured if you set roles on issued tokens. |

## Schema

All QRight tables are bootstrapped via `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ADD COLUMN IF NOT EXISTS` on the first request that hits the qright router. **No manual migration required** — first request after deploy will idempotently bring the schema forward.

### `QRightObject` columns added in Tier 2

- `revokedAt TIMESTAMPTZ`
- `revokeReason TEXT` (free-form, ≤ 500 chars)
- `revokeReasonCode TEXT` (one of: `license-conflict / withdrawn / dispute / mistake / superseded / other / admin-takedown`)
- `embedFetches BIGINT NOT NULL DEFAULT 0`
- `lastFetchedAt TIMESTAMPTZ`

### New tables

- **`QRightFetchDaily(objectId TEXT, day DATE, fetches BIGINT)`** — PK `(objectId, day)`, index on `day`. Bumped via UPSERT on every `/embed/:id` and `/badge/:id.svg` response (best-effort, fire-and-forget). Drives the 30-day sparkline on owner cards.
- **`QRightFetchSource(objectId TEXT, sourceHost TEXT, day DATE, fetches BIGINT)`** *(v1.1)* — PK `(objectId, sourceHost, day)`, index on `(objectId, day)`. Buckets fetches by `Referer` hostname (lowercased, `www.` stripped, `(direct)` fallback for missing/invalid Referer). Hostname only — no path/query/UA — so it's privacy-aware. Drives the top-source chips under owner cards and powers the future per-source admin view.
- **`QRightAuditLog(id TEXT PK, actor TEXT, action TEXT, targetId TEXT, payload JSONB, at TIMESTAMPTZ)`** *(v1.1)* — append-only audit history, indexed on `at DESC` + `action` + `targetId`. Replaces the v1.0 `console.warn` trail with a queryable, persistent log surfaced via `GET /api/qright/admin/audit`. Actions logged: `owner.revoke`, `admin.revoke`, `admin.bulk-revoke`.
- **`QRightWebhook(id TEXT PK, ownerUserId TEXT, url TEXT, secret TEXT, createdAt TIMESTAMPTZ, lastDeliveredAt TIMESTAMPTZ, lastFailedAt TIMESTAMPTZ, lastError TEXT)`** *(v1.1)* — per-owner outgoing webhook config, indexed on `ownerUserId`. Cap of 10 endpoints/owner. Delivery is fire-and-forget on every revoke path with HMAC-SHA256 signature in `X-AEVION-Signature: sha256=<hex>` and 5s `AbortController` timeout.

## Headers / iframe support

`/qright/object/:id`, `/qright/badge/:id`, `/qright/transparency` carry route-specific headers in `frontend/next.config.ts` to override the catch-all COEP `require-corp` and allow third-party iframe embedding:

- `Content-Security-Policy: frame-ancestors *`
- `X-Frame-Options: ALLOWALL`
- `Cross-Origin-Resource-Policy: cross-origin`
- `Cross-Origin-Embedder-Policy: credentialless`
- `Cross-Origin-Opener-Policy: unsafe-none`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()` (object page only)
- `Referrer-Policy: strict-origin-when-cross-origin`

If you change the catch-all `Cross-Origin-Embedder-Policy` you must keep these route-specific overrides or third-party iframes will break.

## Operational

- Public transparency: `GET /api/qright/transparency` — 5-min cache, `Access-Control-Allow-Origin: *`. Safe to render on the homepage.
- Force-revoke audit trail (v1.1): every `POST /api/qright/admin/revoke/:id` and `POST /api/qright/admin/revoke-bulk` writes a `QRightAuditLog` row in addition to the legacy `console.warn` line (`[qright] admin force-revoke …`). Read via `GET /api/qright/admin/audit` (default 100, max 500).
- Webhook delivery is fire-and-forget. Failures update `lastFailedAt` + `lastError` on the row but do not retry — owners can see status in the registry UI and re-add the endpoint if needed. Exponential retry queue is on the v1.2 backlog.
- Rate-limits: `embedRateLimit` 240/min/IP on public surfaces (`/embed/:id`, `/badge/:id.svg`, `/transparency`). `objectsRateLimit` 60/min/IP on registry reads.
- Cache: badges 5 min (`Cache-Control: public, max-age=300`), embed JSON 2 min, transparency 5 min. ETags include `revokedAt` so revoke flips badge colour even if a CDN holds the old SVG.
- Bulk operations: `POST /api/qright/admin/revoke-bulk` accepts up to 200 ids per request. Response partitions input into `revoked / alreadyRevoked / notFound` so you can spot-check the outcome.
- CSV export: `GET /api/qright/admin/objects.csv?status=&q=` mirrors the on-screen registry view with revoke fields and fetch counters. RFC 4180 escaping.

## Smoke test after deploy

### Public surfaces (no auth)

```bash
HOST=https://YOUR_HOST

# 1. embed JSON for a known object
curl -i $HOST/api/qright/embed/<known-object-id>
# expect 200 + JSON with status, certificateId, contentHashPrefix

# 2. SVG badge
curl -i $HOST/api/qright/badge/<known-object-id>.svg | head -1
# expect 200 + image/svg+xml

# 3. transparency
curl -i $HOST/api/qright/transparency | head -20
# expect 200 + JSON with totals, revokesByReasonCode, registrationsByKind

# 4. iframe embed
curl -I $HOST/qright/object/<known-object-id>?embed=1
# expect 200 + Content-Security-Policy: frame-ancestors *

# 5. per-source counter wiring (v1.1) — bump with a custom Referer
curl -s -H "Referer: https://example.com/blog/post" $HOST/api/qright/embed/<known-object-id> > /dev/null
# expect 200; row added/updated in QRightFetchSource for sourceHost='example.com'
```

### Admin endpoints (v1.1)

Requires `QRIGHT_ADMIN_EMAILS` to include the user's email **or** JWT `role=admin`. Replace `<TOKEN>` with the value of `aevion_auth_token_v1` from your browser's localStorage.

```bash
TOKEN="<paste-bearer-here>"

# 6. admin probe
curl -i -H "Authorization: Bearer $TOKEN" $HOST/api/qright/admin/whoami
# expect 200 + { admin: true }

# 7. audit log read
curl -s -H "Authorization: Bearer $TOKEN" "$HOST/api/qright/admin/audit?limit=20" | head -40
# expect 200 + { rows: [...] } ordered by at DESC

# 8. CSV export
curl -i -H "Authorization: Bearer $TOKEN" "$HOST/api/qright/admin/objects.csv?status=active" | head -5
# expect 200 + text/csv with header row

# 9. bulk force-revoke (DRY: pass non-existing ids first to verify partition)
curl -i -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"ids":["nonexistent-1","nonexistent-2"],"reasonCode":"admin-takedown","reason":"smoke"}' \
  $HOST/api/qright/admin/revoke-bulk
# expect 200 + { revoked: 0, alreadyRevoked: 0, notFound: 2 }
```

### Owner webhooks (v1.1)

```bash
# 10. list mine (secret returned redacted to 6-char prefix)
curl -s -H "Authorization: Bearer $TOKEN" $HOST/api/qright/webhooks
# expect 200 + { rows: [...] }

# 11. add (one-time secret in response — store immediately, will never be shown again)
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"url":"https://webhook.site/<your-uuid>"}' \
  $HOST/api/qright/webhooks
# expect 200 + { id, url, secret: "<32-hex-shown-ONCE>" }

# 12. trigger a delivery: revoke any of your own objects
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"reasonCode":"mistake","reason":"webhook smoke"}' \
  $HOST/api/qright/revoke/<your-object-id>
# webhook.site should show POST with X-AEVION-Signature: sha256=<hmac>
# and body { event: "qright.object.revoked", objectId, revokedAt, reasonCode, reason, revokedBy, deliveredAt }

# 13. verify HMAC (Node REPL)
# const crypto = require('crypto');
# const sig = crypto.createHmac('sha256', '<secret-from-step-11>').update(<raw-body>).digest('hex');
# console.log(sig === '<value-after-sha256=>');
# expect true
```

## v1.1 deploy checklist

- [ ] `QRIGHT_ADMIN_EMAILS` set (Railway/Vercel env vars)
- [ ] First request to `/api/qright/*` after deploy creates the four new tables (check Postgres `\dt "QRight*"`)
- [ ] Smoke 1-4 (public) pass
- [ ] Smoke 6 (admin probe) returns `{ admin: true }` for an allowlisted user
- [ ] Smoke 7 (audit log) returns `{ rows: [] }` cleanly on a fresh deploy
- [ ] Webhook delivery (smoke 11-13) lands a POST at the configured endpoint with valid HMAC
