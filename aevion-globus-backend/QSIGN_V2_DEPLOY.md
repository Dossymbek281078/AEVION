# QSign v2 — Production Deployment Runbook

Companion to `QSIGN_V2.md`. This file is the single source of truth for shipping
QSign v2 to a Railway / Fly / Render-class environment and keeping it healthy.

---

## 1. First-deploy checklist

| Step | Command / action | Verifies |
|------|------------------|----------|
| 1.1 | Set env vars (table in §2) | `/health` ok |
| 1.2 | `npx prisma db push` (or rely on `ensureQSignV2Tables`) | Tables exist |
| 1.3 | Restart backend | Boot logs clean |
| 1.4 | `curl $BASE/api/qsign/v2/health` | `status="ok"`, DB latency < 200ms, both kids resolved |
| 1.5 | `BASE=$BASE NO_REVOKE=1 npm run smoke:qsign-v2` | All 16 steps PASS |
| 1.6 | `curl $BASE/api/qsign/v2/openapi.json | jq .info.version` | `"2.0.0"` |
| 1.7 | Probe `/qsign/verify/<id>` SSR page | Status banner + QR render |

If any step fails, stop and fix before opening to public traffic.

---

## 2. Required environment variables

| Var | Required | Format | Notes |
|-----|----------|--------|-------|
| `DATABASE_URL` | yes | `postgresql://…` | Tables auto-bootstrapped on first hit |
| `AUTH_JWT_SECRET` | yes | random ≥32 chars | Shared with the rest of AEVION auth |
| `QSIGN_HMAC_V1_SECRET` | yes (prod) | hex/string ≥16 chars | Default HMAC key |
| `QSIGN_ED25519_V1_PRIVATE` | yes (prod) | 64-hex (32-byte seed) | Default Ed25519 key |
| `QSIGN_ED25519_V1_PUBLIC` | optional | 64-hex | Auto-derived from private if absent |
| `QSIGN_PUBLIC_VERIFY_BASE_URL` | optional | `https://example.com` | Used by QR code in `/:id/pdf` |
| `NODE_ENV` | yes | `production` | Without this, missing key envs fall back to ephemeral with warning |

Generate fresh secrets:

```bash
# 32-byte hex secret (HMAC and Ed25519 seed)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 3. Health probe contract

`GET /api/qsign/v2/health` returns 200 with this shape on green:

```json
{
  "service": "qsign-v2",
  "status": "ok",
  "algoVersion": "qsign-v2.0",
  "canonicalization": "RFC 8785 (JCS)",
  "uptimeSec": 1234,
  "db": { "ok": true, "latencyMs": 8, "error": null },
  "activeKeys": { "hmac": "qsign-hmac-v1", "ed25519": "qsign-ed25519-v1" },
  "counts": {
    "signatures": 1423,
    "revoked": 22,
    "keys": 4,
    "activeWebhooks": 3,
    "deliveryAttempts": 1812
  },
  "memory": { "rssMb": 87.4, "heapUsedMb": 24.1, "heapTotalMb": 32.0 }
}
```

503 on degradation (DB down, ensureTables fail, key resolution fail). Monitor
on `db.ok === true`, `activeKeys.hmac !== null`, `activeKeys.ed25519 !== null`,
and alert if `db.latencyMs > 500`.

---

## 4. Webhooks operations

### 4.1 Receiver template (Express)

```js
app.post("/qsign-webhook", express.json({ verify: (req, _res, buf) => { req.rawBody = buf } }),
  (req, res) => {
    const expected = require("crypto")
      .createHmac("sha256", process.env.QSIGN_WEBHOOK_SECRET)
      .update(req.rawBody)
      .digest("hex");
    const got = req.headers["x-qsign-signature"];
    if (!got || !require("crypto").timingSafeEqual(
      Buffer.from(expected, "hex"), Buffer.from(got, "hex"))) {
      return res.status(401).end();
    }
    // process req.body.{event,timestamp,data}
    res.status(200).end();
  });
```

### 4.2 Retry semantics

- 3 attempts max with backoff: 0s → 5s → 30s.
- Retried on 5xx, network errors, 5s timeout.
- 4xx is permanent failure — no retry.
- Every attempt persists a row in `QSignWebhookDelivery` with `attempt`,
  `httpStatus`, `error`, `durationMs`, `succeeded`.

### 4.3 Triage

```bash
# Recent failures for one webhook
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/qsign/v2/webhooks/<id>/deliveries?limit=50" | jq

# Disable a webhook by deletion
curl -X DELETE -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/qsign/v2/webhooks/<id>"
```

The Studio webhooks card (`/qsign`) shows last status + last error inline.

---

## 5. Key rotation runbook

Quarterly is the recommended cadence; emergency rotations follow the same flow.

```bash
# 5.1 — generate new HMAC secret and persist it as an env var first
NEW_HMAC=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
# (Railway) railway variables set QSIGN_HMAC_QSIGN_HMAC_V2_SECRET=$NEW_HMAC
#           railway up --detach

# 5.2 — rotate via API (admin token required)
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"algo":"HMAC-SHA256","notes":"quarterly rotation 2026-Q3"}' \
  "$BASE/api/qsign/v2/keys/rotate" | jq

# 5.3 — verify; the previous active is now retired
curl -s "$BASE/api/qsign/v2/keys" | jq '.keys[] | select(.algo=="HMAC-SHA256")'
```

Retired keys remain valid for verifying historical signatures **forever** — never
delete them.

---

## 6. Disaster recovery

| Failure mode | Mitigation |
|--------------|------------|
| DB down | `/health` returns 503; sign + verify error 500 with `requestId`. Restore DB → backend self-heals on next request. |
| HMAC env lost | Sign fails (`active_secret_missing`). Rotate HMAC keys with new envs (§5). Historical signatures verifiable only if old secret recovered from backups. |
| Ed25519 private lost | Same as HMAC — rotate. **Public** can be reconstructed from any one historical signature row + canonical, so verification still works. |
| Table corruption | Restore from snapshot. `ensureQSignV2Tables` is idempotent — restart will not duplicate data. |
| Webhook receiver permanently down | Either delete the webhook (cascades deliveries) or wait — only `lastFiredAt`/`lastError` columns get updated, no unbounded growth. |

---

## 7. Smoke test against production

```bash
cd aevion-globus-backend
BASE=https://aevion-production-a70c.up.railway.app \
  EMAIL=qsign-prod-smoke-$(date +%s)@aevion.test \
  NO_REVOKE=1 \
  npm run smoke:qsign-v2
```

`NO_REVOKE=1` skips the revoke + post-revoke steps (steps 12-14) so smoke runs
are non-destructive against prod data. Drop the flag in staging to assert the
full revocation flow.

---

## 8. SLO targets (recommended)

| Metric | Target |
|--------|--------|
| `/health` p99 latency | < 200ms |
| `/sign` p99 latency | < 500ms (incl. DB write) |
| `/verify` (stateless) p99 latency | < 100ms |
| `/audit` p99 latency | < 800ms |
| Sign success rate | ≥ 99.9% |
| Webhook delivery success (3 attempts) | ≥ 99% |

Page the team on:
- `/health` 503 sustained > 1 minute
- `/sign` p99 > 2s for 5 minutes
- Webhook delivery success drops below 95% over a 1-hour window
- `db.latencyMs` > 1000ms on /health

---

## 9. Observability hooks

Every error response carries a `requestId` field plus the `X-Request-Id`
response header (echoed from inbound when present, otherwise minted). Include
it in user-facing error messages so support can correlate with logs.

Server logs prefix every error with `[qsign v2] [req=<id>]`. To diagnose a
user-reported failure:

```bash
# Railway log search
railway logs --tail 1000 | grep "req=<id>"
```

---

## 10. Rollback plan

QSign v2 is mounted at `/api/qsign/v2` and is independent of the legacy v1
(`/api/qsign/*`), `pipeline.ts`, and `planetCompliance.ts`. To roll back the
polish layer:

```bash
git revert <range>     # or
git checkout main      # if polish layer never merged
git push origin main
# Railway redeploys automatically
```

The DB schema is **forward-compatible**: rolling back code while leaving the
new tables/columns in place is safe (older code ignores `signatureDilithium`,
`QSignWebhookDelivery`, etc.).
