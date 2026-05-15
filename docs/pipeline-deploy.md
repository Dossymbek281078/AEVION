# Pipeline Tier 2 deploy notes

## Environment variables

| Name | Required | Default | Purpose |
|---|---|---|---|
| `PIPELINE_ADMIN_EMAILS` | optional | empty | Comma-separated lowercase emails granted access to `/api/pipeline/admin/*`. JWT `role=admin` is also honoured. |

## Schema (no manual migration)

One new table (`CREATE TABLE IF NOT EXISTS`):

- **`PipelineAuditLog(id, action, certId, objectId, actor, payload JSONB, at)`** — append-only admin trail. Indexed on `at DESC` and `(action, at DESC)`.

No changes to existing tables (`IPCertificate`, `QRightObject`, etc.).

> Note: per-cert embed/badge for the public surface lives at `/api/bureau/cert/:certId/{embed,badge.svg}` (Bureau Tier 2 owns it). Pipeline Tier 2 owns the lifecycle and aggregate views.

## Public surface

```bash
HOST=https://YOUR_HOST

# Public counts only (no PII): totals.{certificates,active,revoked}, byKind, topCountries
curl -s $HOST/api/pipeline/transparency | jq
```

## Admin endpoints (Bearer + PIPELINE_ADMIN_EMAILS allowlist)

```bash
TOKEN="<bearer-from-localStorage>"

# Probe
curl -i -H "Authorization: Bearer $TOKEN" $HOST/api/pipeline/admin/whoami

# List certs (?status, ?kind, ?q, ?limit≤200)
curl -s -H "Authorization: Bearer $TOKEN" "$HOST/api/pipeline/admin/certificates?status=active&limit=20"

# Force-revoke a cert (reason required)
curl -i -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"reason":"Legal takedown notice (ticket #9001)"}' \
  $HOST/api/pipeline/admin/certificate/CERT_ID/revoke

# Audit reader
curl -s -H "Authorization: Bearer $TOKEN" "$HOST/api/pipeline/admin/audit?limit=50"
```

## Backwards compatibility

Original Pipeline endpoints (`/protect`, `/reconstruct`, `/verify/:certId`, `/certificates`, `/certificate/:certId/pdf`, `/health`, `/ots/*`, `/hmac-versions`, `/shield/:shieldId/witness`, `/certificate/:certId/bundle.json`) are unchanged. Tier 2 layer is purely additive.

## Deploy checklist

1. Set `PIPELINE_ADMIN_EMAILS` in Railway (lowercase, comma-sep).
2. Deploy — schema bootstraps on first request.
3. Smoke (anon): `GET /api/pipeline/transparency` → counts.
4. Smoke (admin Bearer): `whoami` → `isAdmin: true`. List → recent certs. Force-revoke a test cert → `ok: true` + audit row appears.
