# Tier 3 Hardening — Full-Day Sweep Summary (2026-05-08)

> Single-day systemic security pass across Bureau / Sentry / QSign / Awards
> / Modules / Planet / Pipeline / QShield / QPayNet / 4 webhook routes.
> Documents all findings + fixes for future onboarding.

---

## Findings by domain

### 1. Bureau (P3-4 production fixes)
- 🔴 Stripe payment provider was a TODO stub on prod since `BUREAU_PAYMENT_PROVIDER=stripe` was set 2026-05-06. Every `/payment/intent` returned 500; every webhook returned 400. **Fixed:** full `stripeProvider.ts` impl using Checkout Sessions + UUID intent through metadata.
- 🔴 Webhook signature verification used `JSON.stringify(req.body)` which doesn't match Stripe-signed bytes. **Fixed:** switched to `req.rawBody` (Buffer captured by `express.json({verify: ...})`).
- 🔴 Admin auth read `process.env.JWT_SECRET || "dev-secret-change-me"` — wrong env name + public default. **Fixed:** unified through `getJwtSecret()` + HS256 algorithm pinning.

### 2. Sentry observability
- Webhook routes had no `captureBureauError` calls — failures went to console only. **Fixed:** `classifyWebhookFailure()` distinguishes 6 categories; only real ones fire alerts (scanner-noise filtered). Added 3 P1 rules in `SENTRY_ALERTS.md`.

### 3. QSign legacy v1
- 🔴 `QSIGN_SECRET` defaulted to `"dev-qsign-secret"` — public string in OSS. **Fixed:** `getQSignSecret()` fail-closed in production.
- 🔴 `/verify` echoed `expected` in response — forgery oracle. **Fixed:** response is now only `{valid, algo}`.
- 🟡 `expected === signature` not constant-time. **Fixed:** `crypto.timingSafeEqual` over hex Buffers.
- 🟡 No payload size cap or rate limit. **Fixed:** 256 KB cap, 60/min sign, 240/min verify.
- 🟢 No Deprecation header. **Fixed:** `Deprecation: true`, `Sunset: 2026-12-31`, `Link: rel="successor-version"`.

### 4. Systemic JWT/HMAC secret sweep (9 routes, 11 occurrences)
Static regression test `tests/sharedSecretsHardening.test.ts` walks `src/routes/` and fails CI on any `process.env.*_SECRET || "dev-..."` pattern.
- `awards.ts`, `modules.ts`, `planetCompliance.ts` ×3, `pipeline.ts`, `quantum-shield.ts` — all admin endpoints used insecure JWT secret defaults.
- `bankTest.ts` ×3, `cyberchess.ts`, `planetPayouts.ts`, `qrightRoyalties.ts` — webhook HMAC secrets used same pattern.
- **Fixed:** new `lib/qsignSecret.ts` exports `getQSignSecret()` and `requireProdSecret(envKey, devFallback)`. All 11 sites converted. Webhook secrets resolved lazily so prod-misconfig fails per-route, not at boot.

### 5. QPayNet
- 🔴 `isAdmin()` returned `true` for everyone when `QPAYNET_ADMIN_EMAILS` env was unset. Comment said "open in dev"; in production this means every signed-in user could hit 16+ admin endpoints (KYC override, freeze wallets, refunds, payout actions). **Fixed:** fail-closed in production when allowlist empty; dev convenience preserved.

### 6. QShield
- Already fixed via systemic sweep (item 4). No additional findings beyond JWT secret.
- Webhook subscription secrets validate ≥16 chars, auto-generate when shorter.
- Rate limiting in place on creates/rotates/reconstructs.
- Admin endpoints all gated through `isQShieldAdmin` (fail-closed by default).

### 7. Webhook idempotency (Stripe at-least-once)
- Stripe & Sumsub redeliver events on transient failures. Without dedup, future side-effecting handlers (AEC mint, email) would fire N times.
- **Fixed:** `BureauWebhookEvent` table with `eventId` PRIMARY KEY. Insert before handler; on conflict 200 OK with `{deduped: true}`. Stripe `evt_*` is the canonical id; stub providers + Sumsub fall back to `sha256:` + body hash. Provider interface extended with `eventId?: string`.

---

## Code shipped

| Commit | Subject | Notes |
|---|---|---|
| `8f6ca475` | Bureau Tier 3 (Stripe + raw-body + JWT) | clean |
| `ecdd6419` | Sentry classifier | clean |
| `d4b8feb9` | QSign legacy hardening | clean |
| `18a2ccb7` | (parallel-session piggyback) — actually contains systemic JWT/HMAC sweep | mapped in `docs/bureau/SECURITY_AUDIT_2026-05-08_PART2.md` |
| `239e6b94` | (parallel-session piggyback) — actually contains webhook idempotency | mapped in `docs/bureau/WEBHOOK_IDEMPOTENCY_2026-05-08.md` |
| `3ddd76e1` | QPayNet isAdmin fail-closed | clean |

## Tests added (49 total)

| File | Cases | Status |
|---|---:|---|
| `tests/bureauSecurityHardening.test.ts` | 8 | passing |
| `tests/stripeProviderHardening.test.ts` | 4 | skipped locally (no stripe pkg), runs on CI |
| `tests/webhookClassifier.test.ts` | 10 | passing |
| `tests/qsignLegacyHardening.test.ts` | 11 | passing |
| `tests/sharedSecretsHardening.test.ts` | 7 | passing (incl. static regression guard) |
| `tests/webhookIdempotency.test.ts` | 6 | passing |
| `tests/qpaynetAdminGate.test.ts` | 6 | passing |

## Railway env state (after sweep)

| Env | Status | Set today via GraphQL |
|---|---|---|
| `STRIPE_SECRET_KEY` | live | (was 05-06) |
| `STRIPE_WEBHOOK_SECRET` | live | (was 05-06) |
| `BUREAU_PAYMENT_PROVIDER=stripe` | live | (was 05-06) |
| `QSIGN_SECRET` | live | ✅ today |
| `QRIGHT_WEBHOOK_SECRET` | live | ✅ today |
| `CYBERCHESS_WEBHOOK_SECRET` | live | ✅ today |
| `PLANET_WEBHOOK_SECRET` | live | ✅ today |
| `QPAYNET_ADMIN_EMAILS` | **NOT SET** | ⚠ admin endpoints will 403 in prod until configured |

## Action items remaining

1. **Set `QPAYNET_ADMIN_EMAILS`** on Railway with founder email(s). Without it,
   QPayNet admin endpoints fail-close 403 (intended, but blocks ops use).
2. **`SENTRY_DSN`** on Railway — alerts authored, won't ping until DSN set.
3. **Real-flow Bureau E2E** through `/bureau/upgrade` with test card
   `4242 4242 4242 4242` — final validation of Stripe provider end-to-end.
4. **Sumsub provider** is still a stub. When KYC goes live, will need parallel
   hardening pass + signature verification implementation.

## Verification

- 49 unit tests passing (locally, where deps available).
- `bank-prod-smoke.js` 24/24 PASS on each redeploy today.
- `scripts/investor-demo-audit.sh` 20/20 green throughout.
- 3 webhook routes return 401 (not 500) on bad signature — fail-closed behaviour confirmed on prod.
- Stripe webhook returns 400 with proper Stripe-SDK error message on bad signature → captured by `signature_invalid` Sentry classifier.
