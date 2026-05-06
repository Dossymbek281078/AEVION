# QPayNet — operations runbook

> Created 2026-05-04. Companion to top-level `docs/RUNBOOK.md` (which covers
> backups, RTO/RPO, secrets). This file is QPayNet-specific: env vars,
> incident playbooks, smoke commands, key rotation, and SLOs.

## § 1 SLO targets

| SLI | Target | Burn alarm |
|---|---|---|
| `/api/qpaynet/stats` p99 latency | ≤ 200ms | > 500ms 5min |
| `/transfer` success rate | ≥ 99.5% / 5min | < 99% in any 5min |
| `/transfer` p99 latency | ≤ 800ms | > 2s 5min |
| Stripe webhook success | 100% (any failure → page) | any 4xx/5xx |
| Background webhook fan-out | ≤ 1% permanent failure rate | > 5% permanent |
| Idempotency table size | ≤ 100k rows | growth > 10k/h |

Latency budget reasoning: `/transfer` does 1 KYC read + 1 SELECT FOR UPDATE on
2 wallets + 2 inserts → ~5 round-trips. With p99 RTT to Railway PG ~30ms,
800ms gives ~25× headroom for one slow query.

## § 2 Required environment variables (production)

| Variable | Required | Default | Notes |
|---|---|---|---|
| `DATABASE_URL` | yes | — | Postgres |
| `AUTH_JWT_SECRET` | yes | — | shared with auth |
| `STRIPE_SECRET_KEY` | recommended | — | without it `/deposit/checkout` falls back to stub |
| `QPAYNET_STRIPE_WEBHOOK_SECRET` | yes if Stripe enabled | — | `whsec_…` from Stripe dashboard → webhooks |
| `FRONTEND_URL` | yes | `http://localhost:3000` | used for Stripe success/cancel redirects |
| `QPAYNET_DAILY_DEPOSIT_CAP` | no | `500000` | KZT per wallet per 24h |
| `QPAYNET_MAX_TRANSFER` | no | `100000` | KZT per single transfer |
| `QPAYNET_KYC_THRESHOLD` | no | `1000000` | KZT/month outgoing before KYC required |
| `QPAYNET_KYC_AUTO_VERIFY` | no | `0` | `1` in dev/staging skips manual review |
| `QPAYNET_ADMIN_EMAILS` | recommended | — | comma-list with payouts/kyc admin powers |
| `SMTP_HOST/PORT/USER/PASS/FROM` | no | — | without it email notifs are silently skipped |
| `SENTRY_DSN` | recommended | — | error capture (no-op without it) |
| `QPAYNET_ENCRYPTION_KEY` | recommended | — | hex-32 or passphrase; encrypts webhook `notify_secret` at rest. Without it, secrets store as plaintext (back-compat). |
| `QPAYNET_AUDIT_REDACT` | recommended | `0` | `1` = HMAC-hash IPs and emails in audit log (GDPR). |
| `QPAYNET_PII_SALT` | recommended | — | HMAC key for audit redaction. 32+ chars. Without it, falls back to unsalted SHA-256. |
| `QPAYNET_RATE_TIERS` | no | — | Per-email money rate-limit overrides: `email1:300,email2:600` |
| `PG_POOL_MAX` | no | `20` | Postgres pool size |
| `PG_POOL_IDLE_MS` | no | `30000` | idle connection eviction |
| `PG_POOL_CONN_MS` | no | `5000` | acquire timeout |
| `PG_STATEMENT_TIMEOUT_MS` | no | `10000` | per-query kill switch |

Env-vars checklist before declaring prod-ready:

```
[ ] DATABASE_URL points at production Postgres
[ ] STRIPE_SECRET_KEY is sk_live_… (NOT sk_test_…)
[ ] QPAYNET_STRIPE_WEBHOOK_SECRET matches the prod webhook endpoint
[ ] FRONTEND_URL is the public domain (https, no trailing slash)
[ ] QPAYNET_KYC_AUTO_VERIFY is unset or 0 in production
[ ] QPAYNET_ADMIN_EMAILS contains real on-call emails
[ ] SENTRY_DSN is set
```

## § 3 Smoke procedures

### 3.1 Cold-start smoke (5 min)

```bash
# from aevion-globus-backend/
node scripts/qpaynet-smoke.js
```

Expects 28 sections green, exits non-zero on any failure. Run after every
deploy that touches `src/routes/qpaynet.ts` or `src/lib/dbPool.ts`.

### 3.2 Health probe (continuous)

```bash
curl -fsS https://aevion-production-a70c.up.railway.app/api/aevion/health \
  | jq '.modules.qpaynet'
```

Should return `"healthy"`. Anything else → see § 4.

### 3.3 End-to-end Stripe deposit (manual, 5 min)

1. Sign in to qpaynet dashboard → wallet
2. Click Deposit → Stripe → use test card `4242 4242 4242 4242`
3. Verify wallet balance crediting within 10s
4. Verify Stripe webhook 200 in Stripe dashboard → Webhooks → Logs
5. Verify audit row: `SELECT * FROM qpaynet_audit_log WHERE action='stripe_deposit_credited' ORDER BY created_at DESC LIMIT 1`

If step 3 fails but step 4 shows 200 → check `qpaynet_deposit_checkouts.status`.
If still `pending`, the webhook reached us but the credit transaction failed →
look at Sentry / `[qpaynet stripe webhook]` logs.

## § 4 Incident playbooks

### 4.1 `/transfer` returning 500 spike

1. Check Sentry → recent qpaynet/transfer events.
2. Most likely cause: PG pool exhaustion. Check `getPoolStats()` via
   `/api/aevion/health` or DB: `SELECT count(*) FROM pg_stat_activity WHERE application_name='aevion-backend'`.
3. If `total >= max - 2` and `waiting > 0` → bump `PG_POOL_MAX` (Railway env)
   and restart. Default 20 is conservative; 50 is safe up to ~3k req/min.
4. If query is slow (statement_timeout firing) → look at Postgres slow log,
   add an index, do not raise `PG_STATEMENT_TIMEOUT_MS` (timeout protects pool).

### 4.2 Stripe webhook signature failures

1. Check Sentry → `qpaynet/stripe-webhook phase=verifySignature`.
2. Common causes:
   - **Wrong `QPAYNET_STRIPE_WEBHOOK_SECRET`**: rotate via Stripe dashboard → webhooks → reveal secret → update Railway env → restart.
   - **Body mutated by middleware**: check `src/index.ts` `express.json({ verify: ... })` is still capturing `rawBody`. If a new middleware added before our route consumes the stream, sig fails. Smoke test: run `node scripts/qpaynet-smoke.js` section 19 (stripe webhook).
3. **DO NOT** disable signature verification as a workaround — that's a
   "Стрипу разрешено в любой момент пополнить любой кошелёк" backdoor.

### 4.3 Rate-limit 429s spiking from one user

1. Identify culprit: `SELECT owner_id, COUNT(*) FROM qpaynet_audit_log WHERE created_at > NOW() - INTERVAL '5 min' GROUP BY 1 ORDER BY 2 DESC LIMIT 5`.
2. If legitimate (merchant integration), bump their tier — currently 30 money
   ops/min is hardcoded. Add `keyGenerator` exception for their owner_id, or
   move to per-tier limits.
3. If abuse, no action needed: limiter handles it. Optionally suspend wallet:
   `UPDATE qpaynet_wallets SET status='suspended' WHERE owner_id=$1`.

### 4.4 Idempotency table runaway growth

GC runs hourly and trims rows older than 24h. If table > 100k rows:

```sql
DELETE FROM qpaynet_idempotency WHERE created_at < NOW() - INTERVAL '24 hours';
```

Then check why GC stopped: look for `[qpaynet idempotency] table init skipped`
in logs. Likely the worker thread crashed at boot — restart fixes it.

### 4.5 Webhook fan-out backed up

Two queues handle webhook delivery — both with 5-attempt exp-backoff
(30s, 2m, 10m, 30m, 2h) before dead-lettering:

1. **Per-request webhooks** (`qpaynet_payment_requests.notify_*`) — for
   one-off `notifyUrl` passed at request creation.
2. **Merchant subscriptions** (`qpaynet_webhook_deliveries`) — for
   per-owner subscriptions registered via `/webhook-subs`. Each event
   creates one row per subscription.

Both queues are drained by the same retry tick (every 30s, 20 rows/queue/tick).

**Triage**

```bash
# Aggregate health probe
curl -s $API/api/qpaynet/health | jq '.stuckWebhookDeliveries'
# > 50 stuck = aggregate /health flips to degraded

# List stuck merchant deliveries
curl -s $API/api/qpaynet/admin/webhook-deliveries?status=stuck \
  -H "Authorization: Bearer $ADMIN_JWT" | jq

# Force-retry a single delivery (resets attempts to 0):
curl -X POST $API/api/qpaynet/admin/webhook-deliveries/<id>/retry \
  -H "Authorization: Bearer $ADMIN_JWT"
```

**Re-drive per-request webhooks (no admin endpoint, do it via SQL):**

```sql
UPDATE qpaynet_payment_requests
SET notify_attempts = 0, notify_next_retry_at = NOW(), notify_last_error = NULL
WHERE id = $1 AND status = 'paid';
```

If all are failing → recipient endpoint is down. Contact merchant. Do not
silently keep retrying past 5 attempts (we'll waste budget on dead URLs).

### 4.6 Suspected fraud / chargeback

1. Freeze wallet via API (preferred — audit-logged + user notified):

   ```bash
   curl -X POST $API/api/qpaynet/admin/wallets/<wallet-id>/freeze \
     -H "Authorization: Bearer $ADMIN_JWT" \
     -H "Content-Type: application/json" \
     -d '{"reason":"chargeback investigation case #..."}'
   ```

   SQL fallback if API is down: `UPDATE qpaynet_wallets SET status='frozen' WHERE id=$1`.
2. Pull audit trail: `SELECT * FROM qpaynet_audit_log WHERE owner_id=$1 ORDER BY created_at DESC LIMIT 100`.
3. Pull tx history: `SELECT * FROM qpaynet_transactions WHERE wallet_id=$1 OR owner_id=$2 ORDER BY created_at DESC`.
4. If chargeback originates from Stripe deposit:
   - Refund via Stripe dashboard.
   - Reverse our credit through the refund API:

     ```bash
     curl -X POST $API/api/qpaynet/admin/refund \
       -H "Authorization: Bearer $ADMIN_JWT" \
       -H "Content-Type: application/json" \
       -d '{"txId":"<original-deposit-tx-id>","reason":"stripe chargeback case #..."}'
     ```

   - Do NOT manually `UPDATE qpaynet_wallets SET balance = ...` — that breaks
     reconcile (no offsetting ledger row). Always use `/admin/refund`.
5. After resolution, unfreeze:
   `POST /admin/wallets/:id/unfreeze` with `{"reason":"resolved case #..."}`.

## § 5 Key rotation

### 5.1 Stripe webhook secret

1. Stripe dashboard → webhooks → roll secret → copy new value.
2. Stripe gives a 24h grace period where both old and new secrets verify.
3. Update Railway `QPAYNET_STRIPE_WEBHOOK_SECRET` → restart.
4. Verify next webhook arrives green in `qpaynet_audit_log`.

### 5.2 Merchant API key (`qpn_live_…`)

We hash on insert; raw key is shown once. Rotation:

1. Frontend → `POST /api/qpaynet/merchant/keys` → new key (returned once).
2. `DELETE /api/qpaynet/merchant/keys/:oldId` after the merchant updates.
3. Audit: both events land in `qpaynet_audit_log`.

### 5.3 KYC admin email allowlist

Update `QPAYNET_ADMIN_EMAILS` env (comma-list) on Railway → restart. No code change.

## § 6 Backup & restore

See top-level `docs/RUNBOOK.md § 2` for the master backup procedure. QPayNet-specific:

```bash
# Backup ONLY qpaynet tables (small, fast):
node scripts/qpaynet-backup.mjs > qpaynet-$(date -u +%Y%m%dT%H%M%SZ).sql

# Restore (DESTRUCTIVE - drops + recreates qpaynet_* tables):
DATABASE_URL=postgres://... \
  psql --single-transaction -f qpaynet-2026-05-04T140000Z.sql
```

After restore, verify integrity:

```sql
-- Sum of all balances should equal sum of (deposits - withdrawals - fees collected)
SELECT
  (SELECT COALESCE(SUM(balance),0) FROM qpaynet_wallets) AS total_balance,
  (SELECT COALESCE(SUM(amount),0) FROM qpaynet_transactions WHERE type='deposit')
  - (SELECT COALESCE(SUM(amount + COALESCE(fee,0)),0) FROM qpaynet_transactions WHERE type='withdraw')
  - (SELECT COALESCE(SUM(fee),0) FROM qpaynet_transactions WHERE type='transfer_out')
  - (SELECT COALESCE(SUM(fee),0) FROM qpaynet_transactions WHERE type='merchant_charge')
  AS expected_balance;
```

These must match. If they don't — STOP. Either the backup is corrupt or
there's a bug in fee accounting. Do not let users transact until reconciled.

## § 7 Monitoring queries (cheat-sheet)

```sql
-- Live transactions in last hour by type
SELECT type, COUNT(*), SUM(amount)/100 AS sum_kzt
FROM qpaynet_transactions
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY type ORDER BY 2 DESC;

-- Top 10 most active wallets (today)
SELECT wallet_id, COUNT(*) AS ops, SUM(amount)/100 AS volume_kzt
FROM qpaynet_transactions
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY 1 ORDER BY 2 DESC LIMIT 10;

-- Stuck Stripe checkouts (older than 1h, still pending)
SELECT id, wallet_id, amount/100 AS kzt, created_at
FROM qpaynet_deposit_checkouts
WHERE status = 'pending' AND created_at < NOW() - INTERVAL '1 hour'
ORDER BY created_at;

-- Webhook subs failing
SELECT id, url, notify_attempts, notify_last_error
FROM qpaynet_payment_requests
WHERE notify_attempts > 0 AND status = 'paid'
ORDER BY notify_attempts DESC LIMIT 20;
```

## § 8 Open production-readiness items (as of 2026-05-04)

| Item | Status | Owner |
|---|---|---|
| Atomic transfers (FOR UPDATE) | done | — |
| Idempotency-Key support | done | — |
| Audit log | done | — |
| Rate limiting | done | — |
| Stripe webhook signature | done (rawBody fix) | — |
| Sentry wiring | done | — |
| Pool tuning | done | — |
| Boundary validation | done — deposit/withdraw/transfer/merchant-charge/kyc/requests/payouts/checkout/webhook-subs covered | — |
| At-rest encryption for `notify_secret` | done — app-layer AES-256-GCM, no extension required | — |
| Postgres backup automation | partial — `scripts/qpaynet-backup.mjs` exists; cron not wired | — |
| Reconciliation endpoint | done — `GET /api/qpaynet/admin/reconcile` + `scripts/qpaynet-reconcile.mjs` | — |
| Reconciliation cron + paging | open — wire 15min cron → `scripts/qpaynet-reconcile.mjs` exit-code → ALERT_URL | — |
| Refunds API | done — `POST /admin/refund` (idempotent via Idempotency-Key + ref_tx_id, audit-logged, accounted in reconcile) | — |
| Refund history | done — `GET /admin/refunds` (cursor-paginated) | — |
| Soft-freeze API | done — `/admin/wallets/:id/{freeze,unfreeze}` (status='frozen' rejected by all money paths) | — |
| Merchant webhook delivery durability | done — `qpaynet_webhook_deliveries` queue + retry tick; `/admin/webhook-deliveries` for ops | — |
| At-rest encryption: lazy migration | done — needsEncryption() check at read sites encrypts plaintext rows in-place when env-key is enabled | — |
| /health degrade signal | done — pool waiting > 0 OR stuck deliveries > 50 → status=degraded | — |
| OpenAPI spec for partners | done — `GET /api/qpaynet/openapi.json` (3.1; admin endpoints intentionally hidden; CORS for third-party explorers) | — |
| Stripe event.id dedup | done — `qpaynet_stripe_events` table; INSERT ON CONFLICT before any side effect; 30d GC | — |
| Wallet close API | done — `POST /wallets/:id/close` (zero balance + no pending payouts; terminal) | — |
| Wallet metadata field | done — `metadata` jsonb on POST/PATCH `/wallets`; max 4KB; partner-supplied | — |
| Webhook event-id for partner dedup | done — `X-Aevion-Event-Id` stable across all retries (uses delivery row id or pr.id) | — |
| Stable error code registry | done — `x-error-codes` extension in OpenAPI groups codes by category | — |
| Audit log PII redaction | done — `QPAYNET_AUDIT_REDACT=1` + `QPAYNET_PII_SALT`; HMAC-hashes IPs/emails | — |
| Per-tier money limits | done — `QPAYNET_RATE_TIERS=email:limit,...` overrides without code change | — |
| ALERT_URL paging integration | open — Slack/PagerDuty webhook for reconcile drift / Sentry critical | — |

Anything in "open" is documented but not yet code. When you finish one, move
the row up and update the date.
