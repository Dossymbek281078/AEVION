# Webhook Idempotency — Bureau (2026-05-08)

> Hardening pass on top of `SECURITY_AUDIT_2026-05-08_PART2.md`. Closes
> action item "Webhook idempotency dedupe (Stripe redelivery)".
>
> **Code shipped in commit [`239e6b94`](https://github.com/Dossymbek281078/AEVION/commit/239e6b94)**
> — note: the commit message ("feat(build): interview scheduling") was a
> parallel-session piggyback (third time today). The 4 files starting with
> `aevion-globus-backend/src/lib/payment/provider.ts` are the webhook
> idempotency described below; the rest of the diff (build/interviews
> backend + frontend) is unrelated work from another session.

---

## Why

Stripe and Sumsub both document **at-least-once** webhook delivery. After a
network blip or a 5xx response from us, they redeliver the same event, often
with the same payload bytes. Without dedup:

- Each redelivery overwrites `BureauVerification.paymentStatus` with the
  same value — harmless today.
- But any **side-effecting** logic added later (e.g. mint AEC reward on
  `payment_intent.succeeded`, send an email, update an external system)
  would fire N times.

We add the guard once, before any future side-effect can sneak in.

---

## Shape

### New table

```sql
CREATE TABLE "BureauWebhookEvent" (
  "eventId"   TEXT PRIMARY KEY,
  "kind"      TEXT NOT NULL,        -- 'payment' | 'kyc'
  "provider"  TEXT NOT NULL,        -- 'stripe' | 'sumsub' | 'stub' …
  "intentId"  TEXT,                 -- bureauIntentId | kyc sessionId, forensics
  "receivedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX "BureauWebhookEvent_kind_receivedAt_idx"
  ON "BureauWebhookEvent" ("kind", "receivedAt" DESC);
```

### Dedup key derivation

```ts
const id = providerEventId  // Stripe `evt_*` from constructEvent's event.id
  ?? `sha256:${sha256(rawBody)}`;  // fallback for stub providers + Sumsub
```

- **Stripe:** `event.id` (`evt_*`) is the canonical retry id. Same value on
  retry.
- **Stub providers / Sumsub** (which doesn't surface a stable id today):
  fall back to `sha256:` + SHA-256 of the exact raw bytes. Provider re-sends
  byte-identical bodies on retry.
- The `sha256:` prefix guarantees the two namespaces never collide.

### Insert + check

```ts
INSERT INTO "BureauWebhookEvent" (...) VALUES (...)
  ON CONFLICT ("eventId") DO NOTHING
  RETURNING "eventId";
// rowCount === 1 → fresh delivery, run handler
// rowCount === 0 → seen, return 200 OK { deduped: true }
```

The check happens **before** the row update / any side-effect. Provider
gets 200 either way so it stops retrying.

### Provider interface change

`PaymentProvider.parseWebhook()` now also returns `eventId?: string`. Stripe
populates it; the stub doesn't (falls back to body-hash). KYC follows the
same shape — Sumsub will populate it once its provider is fully implemented.

---

## What's NOT covered (out of scope)

- **Sumsub real signature verification** — still throws "not yet implemented".
  Doesn't matter today (`BUREAU_KYC_PROVIDER=stub` on prod), but landing real
  Sumsub flow will need its own `eventId` extraction.
- **Stale event guard** — Stripe also tells us `event.created` (unix sec).
  We could reject events older than ~5 min as a reply-attack guard. Not
  needed yet; signature itself is short-window-bound by Stripe's tolerance.
- **Cleanup job** — `BureauWebhookEvent` grows monotonically. At expected
  volumes (single-digit per cert × dozens of certs / day) it's negligible
  for years. Add a TTL index in 12 months if it ever matters.

---

## Verification

```
$ npx vitest run tests/webhookIdempotency.test.ts \
                 tests/webhookClassifier.test.ts \
                 tests/sharedSecretsHardening.test.ts \
                 tests/qsignLegacyHardening.test.ts \
                 tests/bureauSecurityHardening.test.ts
Test Files  5 passed (5)
     Tests  42 passed (42)
```

Prod: `bank-prod-smoke.js` 24/24 PASS, investor-demo audit 20/20 green.
