# Security Policy

> AEVION runs production payment + identity + AI infrastructure. We take
> security findings seriously and respond quickly. This document is the
> contract for researchers and integrators.

---

## Reporting a vulnerability

**Email:** `security@aevion.app` *(MX configured; replies within 48h)*

**PGP key:** *(to be added once key infrastructure ships)*

**What to include:**
1. Affected endpoint / module / commit SHA.
2. Steps to reproduce — minimal `curl` command preferred.
3. Impact assessment (data accessed, accounts compromised, money moved).
4. Whether the issue is public, partially public, or coordinated.

**What to expect:**
- 48h initial response.
- 7-day triage with severity classification (HIGH / MEDIUM / LOW).
- Public disclosure timeline negotiated with reporter; default 90 days
  from triage or until fix is deployed, whichever comes first.

**Bug bounty:** not formally established yet. Material findings get
acknowledgement on the project changelog and (negotiable) Stripe-paid
recognition. Critical findings fast-tracked.

---

## In scope

The following surfaces are in scope for security research:

- `https://aevion.app/*` — Vercel-hosted frontend.
- `https://aevion-production-a70c.up.railway.app/api/*` — Railway backend.
- `https://aevion.app/api-backend/*` — proxied backend endpoint.
- All public API endpoints documented at
  `https://aevion.app/api-backend/api/quotas` (the canonical machine-readable
  catalog).
- Webhook signature verification on `/api/bureau/payment/webhook`,
  `/api/qpaynet/deposit/webhook`, `/api/build/webhooks/payment`,
  `/api/qright/royalties/verify-webhook`, `/api/cyberchess/tournament-finalized`,
  `/api/planet/payouts/certify-webhook`.
- Authentication and authorisation on `/api/auth/*`, admin endpoints
  (`/admin/*` paths across modules).
- AEC↔fiat boundary enforcement (`docs/bank/AEC_FIAT_BOUNDARY.md` rules
  R1–R4).

## Out of scope

- DoS via volumetric flood (we trust Cloudflare / Vercel / Railway edge
  filtering for L3/L4; in-app rate limits documented in
  `docs/RATELIMIT_KNOWN_LIMITATIONS.md`).
- Social engineering of staff or users.
- Physical security of any party's hardware.
- Reports relying on outdated browsers, untrusted root CAs, or extensions.
- Self-XSS that requires a victim to paste attacker-supplied JavaScript
  into their own console.
- Reports about missing security headers without a concrete exploit
  scenario; we accept hardening suggestions but won't credit them as
  vulnerabilities.

---

## Security baseline (production-deployed posture)

The following controls are in place as of 2026-05-10. Anything diverging
from this list is a regression and a finding worth reporting.

### Authentication

- JWT secret resolution centralised in `lib/authJwt.ts#getJwtSecret()`.
  Production refuses any default/short/`dev-` prefixed value at boot.
- All `jwt.verify` calls in `src/routes/` pin `algorithms: ["HS256"]`
  to defeat alg-confusion (`alg: "none"`) forgery. Statically enforced
  in CI by `tests/sharedSecretsHardening.test.ts`.
- Bearer-token storage server-side keyed by `tokenVersion` claim — a
  `/api/auth/sign-out-everywhere` increment invalidates every issued
  token globally.

### Webhook signature verification

- All inbound webhook handlers compute HMAC over `req.rawBody` (the
  literal bytes received), never over `JSON.stringify(req.body)`. The
  re-serialisation anti-pattern is statically blocked in CI.
- Stripe webhooks use `stripe.webhooks.constructEvent` with the live
  `STRIPE_WEBHOOK_SECRET` env. Replay protection via signature timestamp
  + Bureau-side event-id dedup table (`BureauWebhookEvent`).
- HMAC token comparisons use `crypto.timingSafeEqual` after length-equal
  pre-check.
- Webhook secret env vars (`QSIGN_SECRET`, `QRIGHT_WEBHOOK_SECRET`,
  `CYBERCHESS_WEBHOOK_SECRET`, `PLANET_WEBHOOK_SECRET`,
  `BUILD_PAYMENT_WEBHOOK_SECRET`, `STRIPE_WEBHOOK_SECRET`,
  `QPAYNET_STRIPE_WEBHOOK_SECRET`, `DASHBOARD_SECRET`, `ADMIN_TOKEN`)
  refuse `dev-`/short fallbacks in production.

### Authorisation

- All admin endpoints fail-CLOSED in production when their respective
  allowlist env (`BUREAU_ADMIN_EMAILS`, `AWARDS_ADMIN_EMAILS`,
  `QSHIELD_ADMIN_EMAILS`, `MODULES_ADMIN_EMAILS`,
  `QRIGHT_ADMIN_EMAILS`, `QPAYNET_ADMIN_EMAILS`, `ADMIN_TOKEN`) is unset.
  Dev/test stays open for convenience.
- AEC↔fiat boundary R1: `POST /api/aev/wallet/:device/mint` and `/sync`
  require Bearer in production. Server-side authority via
  `internalMintForDevice()` is the only legitimate non-user mint path.
- QShield reconstruction requires owner-or-admin; admin allowlist gated
  through the unified `getJwtSecret()`.

### Input handling

- All public POST endpoints validate input shape and length:
  - QRight: title ≤ 300, description ≤ 10 000, kind ∈ enum.
  - HealthAI `/check-llm`: ≤ 20 symptoms × 200 chars, notes ≤ 2000 chars,
    rate limit 10/min/IP.
  - QCoreAI `/chat`: 30/min/IP, temperature clamped to [0, 2], provider
    error categories sanitised before wire response.
- Free-tier identity gradient: authenticated requests overwrite
  client-supplied `ownerName`/`ownerEmail` from the JWT subject —
  authenticated users cannot claim someone else's display name.

### Cryptography

- ML-DSA-65 (NIST FIPS 204) for IP-bureau certificate signing.
- AES-256-GCM authenticated encryption for at-rest secrets in
  QPayNet (`lib/qpaynetCrypto.ts`).
- Shamir 2-of-3 + Ed25519 in Quantum Shield (per-shield, per-key).
- HMAC-SHA256 for all outbound webhook signatures.

### Static security regression

`tests/sharedSecretsHardening.test.ts` blocks the following in CI:

1. `process.env.*_SECRET || "dev-*"` (or any 6+ char lowercase fallback).
2. Hardcoded credential prefixes (`sk_test_*`, `sk_live_*`, `sk-ant-*`,
   `whsec_*`) followed by 16+ alphanumeric chars.
3. `JSON.stringify(req.body)` HMAC verification anti-pattern in routes
   that lack a `rawBody` reference.
4. `jwt.verify(...)` calls without `algorithms: ["HS256"]` within 200
   chars (multi-line tolerant).

### Observability

- Sentry integration scaffolded in every route module via
  `makeServiceCapture()`. Webhook signature failures classified by
  category (signature_invalid / no_signature_header / metadata_missing /
  config_missing / unhandled_event / unknown) — only real errors fire
  alerts; scanner noise is filtered out.
- Daily smoke (`scripts/bank-prod-smoke.js`) runs against prod via
  GitHub Actions — 24-step E2E catches regressions in payment, AEC
  mint authority, Trust Graph plumbing, and Bureau dashboard shape.

---

## Known limitations

- **Rate limiter is per-process.** Railway runs multiple replicas; the
  in-memory `lib/rateLimit.ts` divides effective limits across them.
  Documented in `docs/RATELIMIT_KNOWN_LIMITATIONS.md`. Will move to
  Redis-backed when Redis enters the stack.
- **Sentry active** (`sentry: true` in `/api/health/deep`). All P1 alert
  rules from `docs/SENTRY_ALERTS.md` are now live.

---

## Security audit history

Comprehensive Tier 3 hardening across 22 backend modules, 2026-05-08 to
2026-05-10:

- `docs/TIER3_HARDENING_SUMMARY_2026-05-08.md` — Day 1 (Bureau, Sentry,
  QSign legacy, systemic JWT/HMAC sweep, QPayNet `isAdmin`).
- `docs/TIER3_HARDENING_SUMMARY_2026-05-10.md` — Day 3 (AEV /mint R1
  closure, events/pricing admin gates, auth.ts HS256 pin).
- `docs/bureau/SECURITY_AUDIT_2026-05-08.md` and `_PART2.md` — Bureau and
  systemic findings detail.
- `docs/bureau/WEBHOOK_IDEMPOTENCY_2026-05-08.md` — Stripe redelivery
  dedup design.
- `docs/bank/AEV_PUBLIC_MINT_FINDING_2026-05-09.md` — R1 boundary
  violation, found and closed.

---

*Last updated: 2026-05-10*
