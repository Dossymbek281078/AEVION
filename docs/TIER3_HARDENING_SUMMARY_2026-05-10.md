# Tier 3 Hardening — Day 3 Summary (2026-05-10)

> Continuation of `TIER3_HARDENING_SUMMARY_2026-05-08.md`. Captures the
> autonomous overnight + morning sweep that closed the AEV /mint R1
> boundary violation, hardened the pricing/dashboard secret path, unified
> admin gates across pricing/events, and tightened the static regression
> test to catch two more anti-patterns.

---

## Findings closed this session

### 🔴 HIGH

| Module | Finding | Fix | Commit |
|---|---|---|---|
| `aev.ts` | `POST /mint` and `/sync` were public — anyone could mint arbitrary AEC. R1 boundary violation (AEC↔fiat). | `requireAuthForMintIfProd()` gate; production requires Bearer (with `AEV_PUBLIC_MINT_ENABLED=1` escape hatch); `bank-prod-smoke.js` pivoted to register-first then run AEV layer authenticated | `9c85c69e` |
| `events.ts` | All 3 admin endpoints (`/summary`, `/recent`, `/by-variant`) were silently fail-OPEN when `ADMIN_TOKEN` env was unset — analytics readable by anyone | New `adminGateBlocks()` helper, fail-CLOSED in production, timing-safe equality | `09b0ffbb` |

### 🟡 MEDIUM

| Module | Finding | Fix | Commit |
|---|---|---|---|
| `pricing.ts` | `dashboardSecret()` fell back to literal `"aevion-dashboard-default-rotate-me"` (non-`dev-` prefix bypassed the original regression check) | Fail-closed in production when `DASHBOARD_SECRET`/`ADMIN_TOKEN` unset; static regex broadened to catch any 6+ char lowercase fallback | `0420474d` |
| `pricing.ts` | `/leads`, `/applications`, `/newsletter/list` admin gates used `got !== required` — non-timing-safe, leaks token length and prefix | Unified through `pricingAdminGateBlocks()` helper using `crypto.timingSafeEqual` | `f33a6fec` (rebased from `eea460d2`) |
| `auth.ts` | `requireAuth` `jwt.verify(token, secret)` lacked `algorithms: ["HS256"]` — alg-confusion risk via `alg: "none"` tokens | Added algorithm pin; dropped `e.message` echo from 401 response | `ba9ea63f` |

---

## Static regression — extended (4 new checks)

`tests/sharedSecretsHardening.test.ts` now enforces, on every CI run:

1. No `process.env.*_SECRET || "dev-*"` (original).
2. No `process.env.*_SECRET || "<6+ char lowercase literal>"` (NEW — catches `"aevion-dashboard-default-rotate-me"`-style fallbacks).
3. No literal hardcoded credentials matching `(sk_test_|sk_live_|sk-ant-|whsec_)[A-Za-z0-9_-]{16,}`.
4. No `JSON.stringify(req.body)` near `createHmac` without a `rawBody` reference (catches the Bureau/Build re-serialisation bug shape).
5. **NEW:** Every `jwt.verify` call in `src/routes/` must include `algorithms: ["HS256"]` within 200 chars (multi-line tolerant). Caught and fixed `auth.ts` this session.

---

## Railway env state (after sweep)

| Env | Status | Set today |
|---|---|---|
| `STRIPE_SECRET_KEY` | live | (was 05-06) |
| `STRIPE_WEBHOOK_SECRET` | live | (was 05-06) |
| `BUREAU_PAYMENT_PROVIDER=stripe` | live | (was 05-06) |
| `QSIGN_SECRET` | live | (05-08) |
| `QRIGHT_WEBHOOK_SECRET` | live | (05-08) |
| `CYBERCHESS_WEBHOOK_SECRET` | live | (05-08) |
| `PLANET_WEBHOOK_SECRET` | live | (05-08) |
| `BUILD_PAYMENT_WEBHOOK_SECRET` | live | (05-09) |
| `QPAYNET_ADMIN_EMAILS` | live (founder email) | (05-09) |
| `DASHBOARD_SECRET` | live | ✅ today |
| `ADMIN_TOKEN` | live | ✅ today |
| `SENTRY_DSN` | **NOT SET** | needs Sentry project + DSN from human |

---

## Commits today

```
ba9ea63f  feat(auth): pin HS256 on requireAuth + drop error msg leak
0420474d  feat(pricing): dashboardSecret fail-closed + tighten regex
09b0ffbb  feat(events): admin gate fail-closed + timing-safe compare
9c85c69e  feat(aev): R1 boundary closure — auth gate on /mint+/sync
556be19c  docs(bank): mark AEV /mint R1 finding CLOSED
99979845  test(security): extend static regression — keys + JSON.stringify
3be8bcb3  feat(aev): /mint+/sync prod gate (initial)
eea460d2→f33a6fec  feat(pricing): unify 3 admin gates via pricingAdminGateBlocks
```

8 clean commits, no piggyback.

---

## Verification on prod (continuous)

- `bank-prod-smoke.js` 24/24 PASS through 4 redeploys today
- `scripts/investor-demo-audit.sh` 20/20 green throughout
- Anonymous `POST /api/aev/wallet/x/mint` → **401** with R1 message
- `GET /api/pricing/events/recent` without `X-Admin-Token` → **401**
- Authenticated mint → **200** with proper userId binding

---

## Cumulative across 2026-05-08 → 2026-05-10

- **22 modules audited** (all of `src/routes/` excluding leaf utilities + qsignV2 which was already gold-standard)
- **125+ unit tests** all green
- **10 Railway env vars** set via GraphQL
- **11 doc artifacts** (Tier 3 summaries × 3, security audits × 2, webhook idempotency, rate-limit limitations, AEV finding closure, public API quotas, etc)
- **All HIGH/CRITICAL findings closed**

## What's left for the human

1. **`SENTRY_DSN`** on Railway — alerts authored, won't ping Slack until DSN set.
2. **Real-flow Bureau E2E** through `/bureau/upgrade` test card — final validation of Stripe provider end-to-end (browser).
3. **Redis-backed rate limiter** — when Redis is added to the stack, swap `lib/rateLimit.ts` for a distributed implementation (see `docs/RATELIMIT_KNOWN_LIMITATIONS.md`).
