# AEVION — production env checklist

> **Created** 2026-05-03 · part of `docs/AEVION_MASTER_PLAN.md` § 4 Phase 0 (P0-3).
>
> Single source of truth for every `process.env.*` referenced by the backend.
> Read top to bottom before any prod deploy; the validator script at
> `aevion-globus-backend/scripts/check-prod-env.js` enforces the
> "required to boot" tier on startup.

Legend per row:
- 🔴 **REQUIRED** — backend boots but rejects requests / silently uses an unsafe default. Set or fail in prod.
- 🟡 **CONDITIONAL** — required only if the corresponding module/feature is enabled.
- 🟢 **OPTIONAL** — sane default, override only if you need to.

---

## § 1 Quick start — minimum to boot

If you set only these, the platform comes up and the Tier 1 trust spine
(QRight + QSign v2 + Quantum Shield + Bureau + Pipeline + Planet) works.
Everything else (LLM agents, payments, OAuth, webhooks, email) is gated
by its own section below.

| Var | Why | How |
|---|---|---|
| 🔴 `DATABASE_URL` | Postgres connection. No DB → app boots but every route 500s. | `postgres://user:pass@host:5432/aevion` (Railway / Neon / Supabase) |
| 🔴 `AUTH_JWT_SECRET` | HS256 signing key for `/api/auth/*` JWTs. **Hard-fails on boot** in prod if missing / < 32 chars / starts with `dev-`. | `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| 🔴 `JWT_SECRET` | HS256 secret for short-lived per-route tokens (Bureau cert PDF signing, Pipeline, Quantum Shield). **Currently falls back to `dev-secret-change-me` silently** — that is a forge-anyone vector in prod. Set this. | same generator as above |
| 🔴 `QSIGN_HMAC_V1_SECRET` | Active HMAC-SHA256 key for QSign v2 `/api/qsign/v2/*`. Without it, dev mode uses an ephemeral key — unsuitable for prod. | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` (≥ 16 chars) |
| 🔴 `QSIGN_ED25519_V1_PRIVATE` | Active Ed25519 private key (32-byte seed, 64-char hex). Without it, signatures are unverifiable across restarts. | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| 🔴 `QSIGN_SECRET` | Legacy v1 HMAC used by `pipeline.ts`, `planetCompliance.ts`, `bureau.ts`. Required for IPCertificate canonical-hash verification. | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| 🔴 `SHARD_HMAC_SECRET` | HMAC for authenticated Shamir shards (Quantum Shield). Forging shards possible without it. | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| 🟡 `CORS_ALLOWED_ORIGINS` | Comma-separated list. Required when frontend is on a different origin than backend. | `https://aevion.app,https://www.aevion.app` |
| 🟢 `PORT` | HTTP listen port. Default 4001. | `4001` |
| 🟢 `NODE_ENV` | `production` enables strict gates above. | `production` |

---

## § 2 Per-module env

### QSign v2 (`/api/qsign/v2/*`)

| Var | Status | Notes |
|---|---|---|
| `QSIGN_HMAC_V1_SECRET` | 🔴 | see § 1 |
| `QSIGN_ED25519_V1_PRIVATE` | 🔴 | see § 1 |
| `QSIGN_ED25519_V1_PUBLIC` | 🟢 | derived from private key on boot if absent. Set only if rotating without restart. |
| `QSIGN_DILITHIUM_V` | 🟢 | post-quantum addon, defaults off |
| `QSIGN_PUBLIC_VERIFY_BASE_URL` | 🟢 | overrides the URL printed in PDF receipts. Default: derives from request host. |

### Quantum Shield (`/api/quantum-shield/*`)

| Var | Status | Notes |
|---|---|---|
| `SHARD_HMAC_SECRET` | 🔴 | see § 1 |
| `HMAC_KEY_VERSION` | 🟢 | rotation marker, default `v1` |

### QRight + Pipeline + Bureau + Planet (the trust spine)

| Var | Status | Notes |
|---|---|---|
| `QSIGN_SECRET` | 🔴 | see § 1 |
| `JWT_SECRET` | 🔴 | see § 1 |
| `QRIGHT_WEBHOOK_SECRET` | 🟡 | required if external rights body POSTs to `/api/qright/royalties/verify-webhook` |
| `PLANET_WEBHOOK_SECRET` | 🟡 | required if Planet validators POST to `/api/planet/payouts/certify-webhook` |
| `WEBHOOK_REQUIRE_HMAC` | 🟢 | when `1`, enforces HMAC signature on every inbound webhook |
| `BUREAU_KYC_PROVIDER` | 🟡 | `stub` (default) / `veriff` / etc. |
| `BUREAU_PAYMENT_PROVIDER` | 🟡 | `stub` (default) / `stripe`. Set to `stripe` for P3-4. |
| `BUREAU_VERIFIED_PRICE_CENTS` | 🟢 | default 1900 ($19) |
| `BUREAU_VERIFIED_PRICE_CURRENCY` | 🟢 | default `USD` |
| `BUREAU_VERIFIED_AEC_REWARD` | 🟢 | AEC awarded to claimant on Verified-tier upgrade. Default 0. Proposed prod value: **50** (see `docs/bank/AEC_FIAT_BOUNDARY.md` §8). |
| `BUREAU_NOTARIZED_AEC_REWARD` | 🟢 | default 0. Proposed prod value: **150**. |
| `BUREAU_FILED_KZ_AEC_REWARD` | 🟢 | default 0. Proposed prod value: **500**. |
| `BUREAU_FILED_PCT_AEC_REWARD` | 🟢 | default 0. Proposed prod value: **1000** (capped — `aev.ts` clampAmount limits per-call mint to 1000). |

### Bank + QTrade + AEV

| Var | Status | Notes |
|---|---|---|
| `BANK_DAILY_TOPUP_CAP` | 🟢 | per-user daily AEC top-up cap, default unbounded. Set in prod. |
| `BANK_DAILY_TRANSFER_CAP` | 🟢 | per-user daily AEC transfer cap, default unbounded. Set in prod. |
| `STRIPE_SECRET_KEY` | 🟡 | required for Payments Rail. `sk_live_*` in prod, `sk_test_*` in staging. |
| `STRIPE_WEBHOOK_SECRET` | 🟡 | required when Stripe POSTs to `/api/payments/webhook` |
| `RECEIPT_BASE_URL` | 🟢 | used in receipt PDFs. Default: derive from request host. |

### CyberChess

| Var | Status | Notes |
|---|---|---|
| `CYBERCHESS_WEBHOOK_SECRET` | 🟡 | required for tournament-finalize webhook signing |

### QBuild

| Var | Status | Notes |
|---|---|---|
| `BUILD_PAYMENT_WEBHOOK_SECRET` | 🟡 | required when Stripe/YooKassa POSTs to `/api/build/webhooks/payment` (otherwise dev-only localhost mode) |
| `ANTHROPIC_API_KEY` | 🟡 | gates `/api/build/ai/{consult,parse-resume,improve-text}` — without it those return 500 |

### Smeta-trainer

| Var | Status | Notes |
|---|---|---|
| `SMETA_LMS_WEBHOOK_SECRET` | 🟡 | required when LMS POSTs progress to `/api/smeta-trainer/lms/*` |

### QCoreAI multi-agent

At least one provider key required to use `/api/qcoreai/*` for real LLM
runs. Without any, the routes return a stub response.

| Var | Status | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | 🟡 | recommended primary |
| `OPENAI_API_KEY` | 🟡 | recommended secondary |
| `OPENAI_MODEL` | 🟢 | default `gpt-4o-mini` |
| `OPENAI_BASE_URL` | 🟢 | default `https://api.openai.com/v1` |
| `GEMINI_API_KEY` | 🟡 | optional provider |
| `DEEPSEEK_API_KEY` | 🟡 | optional provider |
| `GROK_API_KEY` | 🟡 | optional provider |
| `QCORE_REDIS_URL` | 🟢 | enables guidance bus across multiple backend instances. Without it, guidance is in-process only (single-instance OK). |
| `QCORE_WEBHOOK_URL` | 🟢 | env-level fallback fan-out for `run.completed` events |
| `QCORE_WEBHOOK_SECRET` | 🟡 | required when `QCORE_WEBHOOK_URL` is set |
| `QCORE_ALLOW_INTERNAL_WEBHOOKS` | 🟢 | dev-only — set to `1` to allow webhook URLs targeting localhost |
| `QCORE_MAX_COST_USD_PER_RUN` | 🟢 | hard cap, default 50 |
| `COACH_MODEL` | 🟢 | default Anthropic; only used by Bank Coach surface |

### Auth + OAuth

| Var | Status | Notes |
|---|---|---|
| `GITHUB_OAUTH_CLIENT_ID` | 🟡 | required if you enable GitHub login |
| `GITHUB_OAUTH_CLIENT_SECRET` | 🟡 | same |
| `GOOGLE_OAUTH_CLIENT_ID` | 🟡 | required if you enable Google login |
| `GOOGLE_OAUTH_CLIENT_SECRET` | 🟡 | same |
| `OAUTH_REDIRECT_BASE` | 🟡 | full backend origin (e.g. `https://api.aevion.app`). Required if either provider is configured. |
| `OAUTH_SUCCESS_REDIRECT` | 🟡 | frontend post-OAuth landing (e.g. `https://aevion.app/auth/callback`) |
| `FRONTEND_URL` | 🟡 | used by mailers + OAuth redirects. Set in prod. |
| `AUTH_JWT_EXPIRES_IN` | 🟢 | default `7d` |

### Admin allow-lists

Each module has its own admin email list. Comma-separated. Without one,
the module's admin endpoints reject every caller.

| Var | Module |
|---|---|
| `AEVION_ADMIN_EMAILS` | global / cross-module |
| `AWARDS_ADMIN_EMAILS` | Awards (`/api/awards/admin/*`) |
| `BUREAU_ADMIN_EMAILS` | Bureau (`/api/bureau/admin/*`) |
| `MODULES_ADMIN_EMAILS` | Modules registry (`/api/modules/admin/*`) |
| `PIPELINE_ADMIN_EMAILS` | Pipeline (`/api/pipeline/admin/*`) |
| `PLANET_ADMIN_EMAILS` | Planet (`/api/planet/admin/*`) |
| `QRIGHT_ADMIN_EMAILS` | QRight (`/api/qright/admin/*`) |
| `QSHIELD_ADMIN_EMAILS` | Quantum Shield (`/api/quantum-shield/admin/*`) |
| `ADMIN_TOKEN` | bearer for the internal `/api/admin/*` dashboard (separate scheme) |
| `DASHBOARD_SECRET` | internal metrics dashboard auth |

### Email (transactional)

Either SMTP or Resend. Required for OAuth verify mails, payment receipts,
royalty notifications.

| Var | Status | Notes |
|---|---|---|
| `RESEND_API_KEY` | 🟡 | recommended for prod (one var, no SMTP infra) |
| `SMTP_HOST` | 🟡 | required if not using Resend |
| `SMTP_PORT` | 🟡 | usually 587 |
| `SMTP_USER` | 🟡 | |
| `SMTP_PASS` | 🟡 | |
| `SMTP_FROM` | 🟡 | `From:` header, e.g. `noreply@aevion.app` |
| `FROM_EMAIL` | 🟡 | alias used by some modules instead of `SMTP_FROM` — set both to the same value to be safe |
| `NOTIFY_EMAIL` | 🟡 | inbox that receives admin alerts (lead notifications, abuse reports) |

### Web Push (mobile / browser notifications)

All three required to enable push. Without them, push subscribe endpoints
return 503.

| Var | Status | Notes |
|---|---|---|
| `VAPID_PRIVATE_KEY` | 🟡 | `npx web-push generate-vapid-keys` |
| `VAPID_PUBLIC_KEY` | 🟡 | from same generator |
| `VAPID_SUBJECT` | 🟡 | `mailto:ops@aevion.app` |

### Sentry + observability

| Var | Status | Notes |
|---|---|---|
| `SENTRY_DSN` | 🟡 | required to receive error reports. Without it, the `makeServiceCapture` factory + `qshield/sentry.ts` no-op silently. |
| `SENTRY_RELEASE` | 🟢 | usually `git rev-parse --short HEAD`. Set in CI. |
| `SENTRY_TRACES_SAMPLE_RATE` | 🟢 | default `0`. Set `0.1` in prod for distributed tracing. |
| `QSHIELD_RELEASE` | 🟢 | per-service release tag |
| `AEVION_RELEASE` | 🟢 | platform release tag |
| `AEVION_COMMIT_SHA` | 🟢 | usually injected by CI |
| `RAILWAY_SERVICE_NAME` | 🟢 | populated by Railway automatically |
| `METRICS_TOKEN` | 🟡 | bearer token for `/api/metrics` (Prometheus). Without it, the endpoint is open. |

### Demo / dev-only

| Var | Status | Notes |
|---|---|---|
| `ENABLE_DEMO_ENDPOINTS` | 🟢 | **NEVER** set to `1` in prod. Exposes stateless reconstruct/demo endpoints with no auth. |

### File-based stores (legacy)

These let you override where the json file store writes to (used by old
landing-page tools — newsletter, leads, partners). On Railway / any
ephemeral fs, you must point these at a persistent volume or migrate
the data to Postgres.

| Var | Default | Module |
|---|---|---|
| `AEVION_DATA_DIR` | `./.aevion-data` | base for all jsonFileStore writes |
| `AFFILIATE_FILE` | `${AEVION_DATA_DIR}/affiliate.json` | affiliate program |
| `EDU_FILE` | `${AEVION_DATA_DIR}/edu.json` | education leads |
| `EVENTS_FILE` | `${AEVION_DATA_DIR}/events.json` | event RSVPs |
| `LEADS_FILE` | `${AEVION_DATA_DIR}/leads.json` | landing-page leads |
| `NEWSLETTER_FILE` | `${AEVION_DATA_DIR}/newsletter.json` | newsletter |
| `PARTNERS_FILE` | `${AEVION_DATA_DIR}/partners.json` | partners |
| `PARTNER_DEALS_FILE` | `${AEVION_DATA_DIR}/partner-deals.json` | partner deals |
| `SUBSCRIPTIONS_FILE` | `${AEVION_DATA_DIR}/subscriptions.json` | subscriptions |

### Other

| Var | Status | Notes |
|---|---|---|
| `INTERNAL_API_BASE_URL` | 🟢 | used by frontend SSR to bypass the public proxy. Default `http://127.0.0.1:4001`. |
| `NEXT_PUBLIC_SITE_URL` / `PUBLIC_SITE_URL` | 🟡 | absolute origin used by sitemap/robots/OG metadata. Set in prod. |
| `DAILY_API_KEY` | 🟡 | required for video-call surfaces (Coach / Bank Advisor) |

---

## § 3 Pre-deploy validator

Run before every push to prod:

```bash
cd aevion-globus-backend
node scripts/check-prod-env.js
```

Returns 0 when every 🔴 variable above is set and meets length/shape
constraints. Returns non-zero with a clear list otherwise. CI integration
is opt-in via `npm run check:prod-env`.

---

## § 4 Generators (cheat sheet)

```bash
# 32-byte hex (HMAC keys, generic secrets)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 32-byte base64 (some APIs prefer this)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# 48-byte hex (for AUTH_JWT_SECRET — extra headroom)
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# Ed25519 seed (32 bytes hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Web Push VAPID keypair
npx web-push generate-vapid-keys
```

---

## § 5 Where each var is read (audit trail)

The validator script and this checklist both derive from a static grep:

```bash
cd aevion-globus-backend
grep -rh "process\.env\.[A-Z_]\+" src/ --include="*.ts" -o | sort -u
```

When that list grows, refresh this doc and the validator script.

---

End of checklist. Last edit: 2026-05-03 (initial publish).
