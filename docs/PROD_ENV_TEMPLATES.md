# Production env templates — `aevion.app` go-live

Copy-paste these into Vercel and Railway dashboards. Pre-filled with the
canonical `aevion.app` domain. Only the secret values (marked `<…>`) need
your input.

---

## Vercel (Production scope)

Settings → Environment Variables → "Production" → Add for each row.

```
NEXT_PUBLIC_SITE_URL=https://aevion.app
BACKEND_PROXY_TARGET=https://aevion-production-a70c.up.railway.app
NEXT_PUBLIC_APP_VERSION=v1.0.0
NEXT_PUBLIC_SENTRY_DSN=<optional — paste Sentry DSN or leave blank>
SENTRY_DSN=<same as above>
SENTRY_ENV=production
NEXT_PUBLIC_SENTRY_ENV=production
NEXT_PUBLIC_AEV_BACKEND_URL=https://aevion-production-a70c.up.railway.app
```

After saving: Deployments → latest production → ⋯ → **Redeploy** so the
build picks up the new envs.

---

## Railway (API service → Variables)

Required (production money handling):

```
DATABASE_URL=<auto-set by Railway Postgres add-on>
AUTH_JWT_SECRET=<32-byte random — already set, don't change>
AUTH_JWT_EXPIRES_IN=7d
PUBLIC_BACKEND_URL=https://aevion-production-a70c.up.railway.app
FRONTEND_URL=https://aevion.app

# QPayNet admin/ops (CRITICAL — without these you can't access admin)
QPAYNET_ADMIN_EMAILS=<your_email>,<ops_email>
QPAYNET_ALERT_URL=<Slack or Discord webhook URL — drift + dead-letter alerts>

# Encryption (CRITICAL — generate ONCE, never change once data exists)
QPAYNET_ENCRYPTION_KEY=<base64 32 bytes — gen: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))">
QPAYNET_AUDIT_REDACT=1
QPAYNET_PII_SALT=<base64 32 bytes — different from encryption key>

# QPayNet operational tunables (defaults are sane)
QPAYNET_SSE_MAX_PER_EMAIL=5
QPAYNET_DAILY_DEPOSIT_CAP=2000000
QPAYNET_KYC_THRESHOLD=1000000
QPAYNET_MAX_TRANSFER=100000

# Stripe (live payments)
STRIPE_SECRET_KEY=sk_live_<your_live_secret>
STRIPE_WEBHOOK_SECRET=whsec_<your_live_webhook_secret>
STRIPE_PUBLISHABLE_KEY=pk_live_<your_live_publishable>

# SMTP (transactional email — payment receipts, KYC notifications)
SMTP_HOST=<e.g. smtp.sendgrid.net>
SMTP_PORT=587
SMTP_USER=<smtp username>
SMTP_PASSWORD=<smtp password>
SMTP_FROM=AEVION QPayNet <noreply@aevion.app>

# Sentry server-side (optional but recommended)
SENTRY_DSN=<paste backend DSN or leave blank to disable>
```

Allowlists per module (set whichever modules you operate):

```
PLANET_ADMIN_EMAILS=<comma list, lowercase>
BUREAU_ADMIN_EMAILS=<comma list>
AWARDS_ADMIN_EMAILS=<comma list>
MODULES_ADMIN_EMAILS=<comma list>
PIPELINE_ADMIN_EMAILS=<comma list>
QSHIELD_ADMIN_EMAILS=<comma list>
QRIGHT_ADMIN_EMAILS=<comma list>
KYC_ADMIN_EMAILS=<same as QPAYNET_ADMIN_EMAILS usually>
```

DB pool tuning (defaults usually fine):

```
PG_POOL_MAX=20
PG_POOL_IDLE_MS=30000
PG_POOL_CONN_MS=5000
PG_STATEMENT_TIMEOUT_MS=10000
```

Per-tier rate limit overrides for enterprise integrators (optional):

```
QPAYNET_RATE_TIERS=partner@bigco.com:300,merchant@kz.kz:600
```

---

## Stripe webhook setup

Once `STRIPE_WEBHOOK_SECRET` is set on Railway and the API is redeployed:

1. Stripe Dashboard → Developers → Webhooks → **Add endpoint**
2. URL: `https://aevion-production-a70c.up.railway.app/api/qpaynet/stripe-webhook`
3. Events to send: `checkout.session.completed`, `payment_intent.succeeded`,
   `payment_intent.payment_failed`, `charge.refunded`
4. Copy the signing secret (`whsec_…`) → paste into Railway env as
   `STRIPE_WEBHOOK_SECRET` → redeploy
5. Click **Send test webhook** in Stripe → verify in Railway logs you see
   `[stripe-webhook] event verified` (signature check passed)

---

## Railway cron jobs

Railway → API service → Settings → **Cron jobs** (or create a sidecar):

```
*/15 * * * *    node scripts/qpaynet-reconcile.mjs    # money-supply drift check
0 4 * * *       node scripts/qpaynet-idempotency-gc.mjs    # nightly GC
0 3 * * 0       node scripts/qpaynet-backup.mjs    # weekly Postgres backup
```

The reconcile cron is **load-bearing for safety**. Without it, drift goes
unnoticed until an admin opens the dashboard.

---

## Quick verification (after env saves + redeploy)

```bash
# Public health
curl -sS https://aevion-production-a70c.up.railway.app/health | jq

# OpenAPI spec (canonical contact = aevion.app)
curl -sS https://aevion-production-a70c.up.railway.app/api/qpaynet/openapi.json \
  | jq '.info.contact'

# Stats (anonymous, no balance leak)
curl -sS https://aevion-production-a70c.up.railway.app/api/qpaynet/stats | jq

# Frontend canonical URL in sitemap
curl -sS https://aevion.app/sitemap.xml | head -20

# Admin gate (anon should see auth prompt, no secrets)
curl -sS https://aevion.app/qpaynet/admin | grep -i "войдите"
```

Then with `ADMIN_JWT` from your browser localStorage:

```bash
cd aevion-globus-backend
ADMIN_JWT=eyJhbGc... \
BASE=https://aevion-production-a70c.up.railway.app \
node scripts/qpaynet-smoke.js
```

Expected: `44 passed, 0 failed`.

---

## Rollback hooks

- Vercel: prior deployments are kept; **Promote to Production** any green one
- Railway env: every save is versioned; revert via "History"
- Stripe webhook: pause/disable from Stripe dashboard if abuse detected
- Cron jobs: edit schedule to `# */15 * * * *` to disable without removing
