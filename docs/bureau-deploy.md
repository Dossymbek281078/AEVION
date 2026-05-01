# Bureau Tier 2 + Tier 3 deploy notes

## Environment variables

| Name | Required | Default | Purpose |
|---|---|---|---|
| `BUREAU_ADMIN_EMAILS` | optional | empty | Comma-separated lowercase emails granted access to `/admin/bureau` and `/api/bureau/admin/*`. JWT `role=admin` is also honoured. |

## Schema (no manual migration)

Two new tables (`CREATE TABLE IF NOT EXISTS`):

- **`BureauCertFetchSource(certId, sourceHost, day, fetches)`** — per-Referer hostname embed/badge counters (no PII).
- **`BureauAuditLog(id, action, certId, verificationId, actor, payload JSONB, at)`** — append-only admin trail. Indexed on `at DESC` and `(action, at DESC)`.

No changes to existing tables (`IPCertificate`, `BureauVerification`, `BureauOrganization`, etc.).

## Public surfaces (rate-limited 240/min/IP, CORS open)

```bash
HOST=https://YOUR_HOST

# Per-cert embed JSON (sanitized, ETag, increments fetches)
curl -i $HOST/api/bureau/cert/CERT_ID/embed

# Per-cert SVG badge — anonymous / ✓ Verified / ⚖ Notarized / revoked
curl -i "$HOST/api/bureau/cert/CERT_ID/badge.svg?theme=dark" | head -1

# Public transparency aggregate
curl -s $HOST/api/bureau/transparency | jq
```

## Admin endpoints (Bearer + BUREAU_ADMIN_EMAILS allowlist)

```bash
TOKEN="<bearer-from-localStorage>"

# Probe
curl -i -H "Authorization: Bearer $TOKEN" $HOST/api/bureau/admin/whoami

# List verifications (?status=pending|approved|declined, ?limit≤200)
curl -s -H "Authorization: Bearer $TOKEN" "$HOST/api/bureau/admin/verifications?status=pending"

# Force-verify a cert (bypass KYC + payment, reason required)
curl -i -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"verifiedName":"Alice Doe","reason":"Manual review approved (ticket #1234)"}' \
  $HOST/api/bureau/admin/cert/CERT_ID/force-verify

# Revoke verification (drops back to anonymous, reason required)
curl -i -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"reason":"Identity dispute (ticket #5678)"}' \
  $HOST/api/bureau/admin/cert/CERT_ID/revoke-verification

# Audit reader
curl -s -H "Authorization: Bearer $TOKEN" "$HOST/api/bureau/admin/audit?limit=50"
```

## Frontend pages

- **`/bureau/badge/[certId]`** — embed configurator. Live SVG preview, dark/light theme toggle, copy-able snippets (Markdown for README, HTML `<a><img></a>`, direct URL, JS fetch).
- **`/bureau/cert/[certId]`** *(Tier 3)* — public cert page (SSR). OG meta points at `/api/bureau/cert/:id/og.svg`, Twitter `summary_large_image`, JSON-LD `BreadcrumbList`, RSS `<link rel="alternate">` for the per-cert verification feed. Renders verification chip, kind, badge SVG preview, embed JSON link, RSS link. Anonymous certs show an "Upgrade to Verified" CTA.
- **`/admin/bureau`** — admin panel. Force-verify form (certId / name / reason), revoke form (certId / reason), **bulk action panel** (paste up to 100 IDs, pick `force-verify` or `revoke-verification`, single transaction, one audit row per cert), verification list with status filter, audit log with action chips.

## Tier 3 amplifier surfaces (rate-limited 240/min/IP, CORS open)

```bash
HOST=https://YOUR_HOST

# Per-cert OG social-share card (1200x630 SVG, level-coloured accent bar)
curl -i $HOST/api/bureau/cert/CERT_ID/og.svg | head -1

# Index OG card (totals by verification level)
curl -i $HOST/api/bureau/og.svg | head -1

# Per-cert RSS — verification status changes from BureauAuditLog
curl -s "$HOST/api/bureau/cert/CERT_ID/changelog.rss?limit=50" | head -20

# Sitemap — /bureau, /bureau/transparency, every public cert page
curl -s $HOST/api/bureau/sitemap.xml | head -20

# Bulk admin (Bearer + BUREAU_ADMIN_EMAILS, max 100 items, single transaction)
curl -i -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"items":[{"certId":"abc","action":"force-verify","reason":"batch import","verifiedName":"Alice"},{"certId":"def","action":"revoke-verification","reason":"identity dispute"}]}' \
  $HOST/api/bureau/admin/bulk
```

## Backwards compatibility

The original Bureau endpoints (`/verify/start`, `/verify/status/:id`, `/upgrade/:certId`, `/dashboard`, `/notaries/*`, `/org/*`) keep their contracts unchanged. Tier 2 layer is additive — new tables, new routes only.

## Deploy checklist

1. Set `BUREAU_ADMIN_EMAILS=alice@aevion.com,bob@aevion.com` in Railway (lowercase).
2. Deploy — schema bootstraps on first request.
3. Smoke (anon):
   - `GET /api/bureau/transparency` → counts.
   - `GET /api/bureau/cert/<some-cert-id>/embed` → `404 not_found` if no such cert, otherwise sanitized JSON.
   - `GET /api/bureau/cert/<some-cert-id>/badge.svg` → SVG (200 with badge or `not found` body).
4. Smoke (admin Bearer):
   - `GET /api/bureau/admin/whoami` → `{ isAdmin: true, email }`.
   - `POST /api/bureau/admin/cert/<id>/force-verify` → cert flips to `verified`; audit row appears.
   - `POST /api/bureau/admin/cert/<id>/revoke-verification` → flips back to `anonymous`; audit row appears.
5. Frontend smoke:
   - Visit `/bureau/badge/<certId>` — preview renders, snippets copy.
   - Visit `/admin/bureau` — gated by allowlist; force/revoke flows work; **bulk action panel** applies to N certs and emits N audit rows; audit log fills.
6. Tier 3 smoke:
   - `GET /api/bureau/cert/<id>/og.svg` → 1200×630 SVG, accent colour matches verification level (red=revoked, green=verified, purple=notarized).
   - `GET /api/bureau/og.svg` → index card with `verified / notarized / anonymous` counters.
   - `GET /api/bureau/cert/<id>/changelog.rss` → RSS 2.0 with audit events for that cert.
   - `GET /api/bureau/sitemap.xml` → `/bureau`, `/bureau/transparency`, `/bureau/cert/<id>` for every non-revoked verified or notarized cert.
   - Visit `/bureau/cert/<id>` — SSR page with verification chip + badge preview + JSON-LD breadcrumbs (verify in Page Source). OG image visible in social-card debuggers (Facebook Sharing Debugger, etc.).
   - `PATCH /api/bureau/admin/bulk` with 2–3 cert IDs → response says `{ok:true, applied:N, total:N}`; admin audit shows N new rows tagged `bulk: true` in payload.
