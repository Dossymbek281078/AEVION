# Planet Compliance deploy notes

## Environment variables

| Name | Required | Default | Purpose |
|---|---|---|---|
| `AUTH_JWT_SECRET` | yes | `dev-auth-secret` | JWT signing key. |
| `BACKEND_PROXY_TARGET` | frontend build | `http://127.0.0.1:4001` | URL the Next rewrite proxies `/api-backend/*` to. |
| `PLANET_ADMIN_EMAILS` | optional | empty | Comma-separated lowercase emails granted access to `/admin/planet` and `POST /api/planet/admin/*`. JWT `role=admin` is also honoured. |
| `QSIGN_SECRET` | yes | `dev-qsign-secret` | Used by `productSecretFor()` for compliance vote signatures. |

## Schema (Tier 2 additions)

All tables bootstrap via `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ADD COLUMN IF NOT EXISTS` on first request. **No manual migration.**

### `PlanetCertificate` columns added

- `revokeReasonCode TEXT` — closed set: `license-conflict / withdrawn / dispute / mistake / superseded / other / admin-takedown`
- `revokedBy TEXT` — `owner` or `admin`
- `embedFetches BIGINT NOT NULL DEFAULT 0` — total embed/badge hits
- `lastFetchedAt TIMESTAMPTZ`

### New tables

- **`PlanetCertFetchDaily(certificateId, day, fetches)`** — daily fetch buckets, indexed on `day`.
- **`PlanetCertFetchSource(certificateId, sourceHost, day, fetches)`** — per-Referer-host bucket. Hostname only (no path/UA/IP), lowercased, `www.` stripped, `(direct)` fallback. Drives `/admin/sources`.
- **`PlanetAuditLog(id, actor, action, targetId, payload JSONB, at)`** — append-only privileged action log.
- **`PlanetWebhook(id, ownerUserId, url, secret, createdAt, lastDeliveredAt, lastFailedAt, lastError)`** — outgoing webhook config, cap 10/owner.
- **`PlanetWebhookDelivery(id, webhookId, certificateId, eventType, requestBody, statusCode, ok, error, deliveredAt, isRetry)`** — per-attempt log.

## Public surfaces (rate-limited 240/min/IP, CORS open)

```bash
HOST=https://YOUR_HOST

# 1. embed JSON
curl -i $HOST/api/planet/certificates/<certId>/embed
# expect 200 + sanitized JSON (no privatePayload / signature internals)

# 2. SVG badge (theme=dark|light)
curl -i $HOST/api/planet/certificates/<certId>/badge.svg | head -1
# expect 200 + image/svg+xml

# 3. transparency
curl -s $HOST/api/planet/transparency | head -30
# expect totals + revokesByReasonCode + certificatesByArtifactType

# 4. per-source bump (privacy-aware)
curl -s -H "Referer: https://example.com/blog" $HOST/api/planet/certificates/<certId>/embed > /dev/null
# row added to PlanetCertFetchSource for sourceHost='example.com'
```

## Owner controls

```bash
TOKEN="<bearer-from-localStorage>"

# Owner revoke (closed-set reasonCode, excludes admin-takedown)
curl -i -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"reasonCode":"superseded","reason":"v2 issued"}' \
  $HOST/api/planet/certificates/<certId>/revoke
# expect 200 + { id, revokedAt, reasonCode, revokedBy: "owner" }
```

## Admin endpoints

```bash
# admin probe
curl -i -H "Authorization: Bearer $TOKEN" $HOST/api/planet/admin/whoami
# expect { isAdmin: true }

# list (status=all|active|revoked, q≥2 chars)
curl -s -H "Authorization: Bearer $TOKEN" "$HOST/api/planet/admin/certificates?status=active"

# CSV export (mirrors filter)
curl -i -H "Authorization: Bearer $TOKEN" "$HOST/api/planet/admin/certificates.csv?status=revoked"

# single force-revoke
curl -i -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"reasonCode":"admin-takedown","reason":"DMCA"}' \
  $HOST/api/planet/admin/certificates/<certId>/revoke

# bulk force-revoke (≤200 ids)
curl -i -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"ids":["a","b"],"reasonCode":"admin-takedown","reason":"sweep"}' \
  $HOST/api/planet/admin/certificates/revoke-bulk
# expect { revoked: [...], alreadyRevoked: [...], notFound: [...] }

# audit reader
curl -s -H "Authorization: Bearer $TOKEN" "$HOST/api/planet/admin/audit?limit=50"

# top embed sources (days=7|30|90)
curl -s -H "Authorization: Bearer $TOKEN" "$HOST/api/planet/admin/sources?days=30"
```

## Owner webhooks (HMAC-SHA256, 5s timeout)

```bash
# list
curl -s -H "Authorization: Bearer $TOKEN" $HOST/api/planet/webhooks

# add — secret returned ONCE
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"url":"https://webhook.site/<uuid>"}' \
  $HOST/api/planet/webhooks
# response: { id, url, secret: "<32-hex>" }

# trigger via revoke; webhook.site shows POST with X-AEVION-Signature: sha256=<hmac>
# body: { event: "planet.certificate.revoked", certificateId, revokedAt, reasonCode, reason, revokedBy, deliveredAt }

# delivery history
curl -s -H "Authorization: Bearer $TOKEN" "$HOST/api/planet/webhooks/<id>/deliveries?limit=50"

# edit URL (no secret rotation)
curl -i -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"url":"https://new-url.example/hook"}' \
  $HOST/api/planet/webhooks/<id>

# manual retry (re-issues original signed body)
curl -i -X POST -H "Authorization: Bearer $TOKEN" \
  $HOST/api/planet/webhooks/<id>/retry/<deliveryId>

# delete
curl -i -X DELETE -H "Authorization: Bearer $TOKEN" $HOST/api/planet/webhooks/<id>
```

## Frontend pages added

- `/planet/transparency` — public report (server component, EN/RU via Accept-Language or `?lang=`)
- `/planet/badge/[certId]` — embed configurator with live preview
- `/planet/webhooks/[id]` — delivery log + manual retry + URL edit
- `/admin/planet` — registry browser, force-revoke (single + bulk), audit log, top-source view, CSV export

## Deploy checklist

- [ ] Set `PLANET_ADMIN_EMAILS` (Railway env vars)
- [ ] First request to `/api/planet/*` after deploy creates new tables (`\dt "Planet*"` should list 8)
- [ ] Public smoke 1-3 pass
- [ ] Admin probe returns `{ isAdmin: true }` for an allowlisted user
- [ ] Webhook lifecycle (add → revoke → POST received with valid HMAC → retry idempotent)
