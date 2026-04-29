# QRight deploy notes

## Environment variables

| Name | Required | Default | Purpose |
|---|---|---|---|
| `AUTH_JWT_SECRET` | yes | `dev-auth-secret` | JWT signing key. Set to a strong random string in production. |
| `BACKEND_PROXY_TARGET` | frontend build | `http://127.0.0.1:4001` | URL the Next rewrite proxies `/api-backend/*` to. |
| `QRIGHT_ADMIN_EMAILS` | optional | empty | Comma-separated lowercase emails granted access to `/admin/qright` and `POST /api/qright/admin/*`. JWT `role=admin` is also honoured if you set roles on issued tokens. |

## Schema

`QRightObject` and `QRightFetchDaily` are bootstrapped via `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ADD COLUMN IF NOT EXISTS` on the first request that hits the qright router. **No manual migration required** — first request after deploy will idempotently bring the schema forward.

Columns added in Tier 2:

- `revokedAt TIMESTAMPTZ`
- `revokeReason TEXT` (free-form, ≤ 500 chars)
- `revokeReasonCode TEXT` (one of: `license-conflict / withdrawn / dispute / mistake / superseded / other / admin-takedown`)
- `embedFetches BIGINT NOT NULL DEFAULT 0`
- `lastFetchedAt TIMESTAMPTZ`

New table: `QRightFetchDaily(objectId TEXT, day DATE, fetches BIGINT)` PK `(objectId, day)` + index on `day`. Bumped via UPSERT on every `/embed/:id` and `/badge/:id.svg` response (best-effort, fire-and-forget — the response never blocks on the bump).

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
- Force-revoke: every `POST /api/qright/admin/revoke/:id` writes a `console.warn` line tagged `[qright] admin force-revoke id=… by=…@… code=…`. Pipe stdout to your log aggregator for an audit trail.
- Rate-limits: `embedRateLimit` 240/min/IP on public surfaces (`/embed/:id`, `/badge/:id.svg`, `/transparency`). `objectsRateLimit` 60/min/IP on registry reads.
- Cache: badges 5 min (`Cache-Control: public, max-age=300`), embed JSON 2 min, transparency 5 min. ETags include `revokedAt` so revoke flips badge colour even if a CDN holds the old SVG.

## Smoke test after deploy

```bash
# 1. embed JSON for a known object
curl -i https://YOUR_HOST/api/qright/embed/<known-object-id>
# expect 200 + JSON with status, certificateId, contentHashPrefix

# 2. SVG badge
curl -i https://YOUR_HOST/api/qright/badge/<known-object-id>.svg | head -1
# expect 200 + image/svg+xml

# 3. transparency
curl -i https://YOUR_HOST/api/qright/transparency | head -20
# expect 200 + JSON with totals, revokesByReasonCode, registrationsByKind

# 4. iframe embed
curl -I https://YOUR_HOST/qright/object/<known-object-id>?embed=1
# expect 200 + Content-Security-Policy: frame-ancestors *
```
