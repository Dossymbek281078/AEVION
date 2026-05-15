# Bureau Security Audit — 2026-05-08

> Tier 3 hardening pass. Audited `aevion-globus-backend/src/routes/bureau.ts`
> (2505 lines, 36 endpoints) + payment/kyc provider chain.

---

## Findings

### 🔴 HIGH-1 — Stripe payment provider was a TODO stub

**Where:** `src/lib/payment/stripeProvider.ts`

**Impact:** With `BUREAU_PAYMENT_PROVIDER=stripe` (set on prod 2026-05-06):
- `POST /api/bureau/payment/intent` → 500 (`createIntent` threw)
- `POST /api/bureau/payment/webhook` → 400 (`parseWebhook` threw)
- `getIntent` polling → 500
- Net effect: **paid Bureau cert flow non-functional on prod** despite
  P3-4 marked done. Smoke 24/24 passed because it only exercises trust-graph
  plumbing, not the Stripe call.

**Fix:** Full implementation in commit. Uses Checkout Sessions + a server-
generated `bureauIntentId` UUID passed through `payment_intent_data.metadata`.
Webhook stays synchronous (no Stripe API roundtrip needed to map back to
our row). Verifies signature via `stripe.webhooks.constructEvent`.

### 🔴 HIGH-2 — Webhook signature verification used re-serialised body

**Where:** `bureau.ts` `/payment/webhook`, `/verify/webhook`

**Impact:** Both routes built `rawBody = JSON.stringify(req.body ?? {})`.
Stripe's signature is computed over the **exact** bytes Stripe sent. After
`express.json()` parses + we re-stringify, the bytes differ (key order,
escaping, whitespace). `constructEvent` would always fail.

**Fix:** Use `req.rawBody` (Buffer captured in `express.json({verify:...})`,
already wired in `src/index.ts`). Fallback to JSON.stringify only when raw
buf is absent (e.g. edge cases in tests).

### 🔴 HIGH-3 — Admin auth used wrong env var + insecure fallback

**Where:** `bureau.ts` `isBureauAdmin()`

**Impact:**
- Read `process.env.JWT_SECRET` — but the rest of the codebase uses
  `process.env.AUTH_JWT_SECRET` (see `lib/authJwt.ts`). On prod, where only
  `AUTH_JWT_SECRET` is set, `JWT_SECRET` is undefined.
- Fallback to `"dev-secret-change-me"` — a public string in OSS code.
- Behaviour: every admin endpoint `403`'d (because real-prod tokens are
  signed with `AUTH_JWT_SECRET`, verify with `dev-secret-change-me` fails).
  **No bypass risk** (fails closed) but admin routes were unusable.
- Counterfactual risk: if a future deploy ever set `JWT_SECRET=dev-secret-change-me`
  literally, anyone could forge admin tokens.

**Fix:** Use `getJwtSecret()` from `lib/authJwt.ts` — single source of truth.
Throws in production when secret is missing, weak (<32 chars), or starts
with `dev-`. Verify pinned to `algorithms: ["HS256"]` (alg-confusion mitigation).

---

## Tests added

| File | Cases | Status |
|---|---:|---|
| `tests/bureauSecurityHardening.test.ts` | 8 | passing locally |
| `tests/stripeProviderHardening.test.ts` | 4 | skipped locally (no `stripe` in dev), runs on CI |

Cases cover: env-var requirements, dev-default refusal in production,
forged-token rejection (attacker using public default), HS256 algorithm
pinning (no `none`/`RS256` confusion).

---

## Not yet covered (next pass)

- **Stripe Search API** in `getIntent` requires a Stripe Search index
  (search:read scope). Unclear if our key has it; alternative is to look
  up by `payment_intent` listing or persist `stripeCheckoutSessionId` in
  `BureauVerification`. Defer until first real paid cert exercises it.
- **Webhook idempotency:** Stripe may redeliver. Our update is idempotent
  in effect (overwrite paymentStatus), but we don't dedupe by event_id —
  metrics may double-count. Add `bureau_webhook_event_log(event_id PRIMARY KEY)`
  in a follow-up.
- **Admin route per-IP rate limit** — admin endpoints are unauthenticated-
  attempt-cheap (jwt.verify is fast). Add a per-IP limiter to slow brute force.
- **CSP/CSRF** — embed routes return JSON only (no HTML), so XSS surface is
  limited; no cookie auth so CSRF not applicable. Confirm with a passive scan.

---

## Verification on prod

After merge + Railway redeploy:

```bash
# 1. Webhook returns 400 with "missing stripe-signature" on naked POST
curl -sS -o /dev/null -w '%{http_code}\n' -X POST \
  -H 'content-type: application/json' -d '{}' \
  https://aevion-production-a70c.up.railway.app/api/bureau/payment/webhook
# expect: 400

# 2. /api/bureau/payment/intent without verificationId still 400
curl -sS -X POST -H 'content-type: application/json' -d '{}' \
  https://aevion-production-a70c.up.railway.app/api/bureau/payment/intent
# expect: {"error":"verificationId is required"}

# 3. /api/bureau/admin/audit without bearer is 403, not 500
curl -sS -o /dev/null -w '%{http_code}\n' \
  https://aevion-production-a70c.up.railway.app/api/bureau/admin/audit
# expect: 403
```

Real end-to-end: send a `4242 4242 4242 4242` test card through `/bureau/upgrade`
and confirm the webhook fires successfully on Stripe Workbench → Webhooks →
AEVION Bureau payments → recent deliveries (200 OK).
