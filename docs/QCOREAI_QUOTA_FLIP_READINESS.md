# QCoreAI paid-tier token quota — flip readiness

> Companion to `docs/PAYWALL_FLIP_READINESS.md` (same structure, different
> gate). See `docs/PRICING_STRATEGY_2026-07.md` for why these caps exist —
> this doc is only about the mechanics of turning them on safely.

> **🟡 DORMANT.** Three independent env-gated quota checks live in
> `lib/qcoreQuota.ts`, all default OFF:
> - `QCOREAI_FREE_QUOTA=1` — 🟢 **LIVE since 2026-07-20.** Free tier's
>   100k tokens/mo promise. Unaffected by anything below.
> - `QCOREAI_TIER_QUOTA=1` — 🔴 **OFF.** Enforces every PAID tier's
>   `llmTokensPerMonth` cap (Lite 2M, Medium 10M, Full 50M, Universe 200M).
>   Added 2026-07-22 — before this, paid tiers had **no cap at all**.
> - `QCOREAI_PREMIUM_QUOTA=1` — 🔴 **OFF.** Enforces a smaller sub-cap
>   (~10% of the overall cap) on premium/frontier-model usage specifically
>   (`isPremiumModel()`, `services/qcoreai/pricing.ts`). Added 2026-07-22.
>   Only wired into `/chat` + `/chat-stream` — the multi-agent orchestrator's
>   dispatch points are NOT covered yet (known gap, see strategy doc).

## Why these are separate from the module paywall

`PAYWALL_MODULES` (the blanket gate in `planGate.ts`) permanently excludes
`qcoreai` via `UNSAFE_TO_GATE` — an all-or-nothing 402 would break the
advertised "N tokens free/included, then upgrade" promise outright. These
two quota gates are the *correct* tool for a metered promise: they let
traffic through until the caller's own allowance is spent, then 402 with the
same `upgrade_required` shape the paywall uses.

## Pre-flip checklist

- [ ] **Read the real numbers first.** `GET /api/qcoreai/me/token-quota`
  (authenticated) reports `usedTokens`/`limitTokens` and
  `premiumUsedTokens`/`premiumLimitTokens` for the caller's own account
  **even while both gates are dormant** (`metered`/`premiumMetered` will
  read `false`, but the underlying numbers are already live). Check this
  for a sample of real paid accounts across each tier before flipping —
  this is the "would today's real usage 402 someone unexpectedly" check,
  equivalent to the paywall's `paywall-policy-smoke.js --wait` step, except
  there is no dedicated smoke script for this gate yet (worth adding one,
  modeled on `paywall-policy-smoke.js`, before a prod flip).
- [ ] **Railway env access required.** This dev machine's `railway` CLI is
  unauthenticated (`railway login` needed) — verifying live Railway env
  state and querying the real production DB for aggregate usage can't be
  done from a plain dev checkout; needs someone with Railway/prod DB access.
- [ ] Confirm `QCOREAI_FREE_QUOTA` flipping first didn't already surface
  false-positive complaints (it's been live since 2026-07-20 — check
  support/Sentry for `free_token_quota_exhausted` 402s that look like
  genuine free users, not abuse).
- [ ] Decide `QCOREAI_TIER_QUOTA` and `QCOREAI_PREMIUM_QUOTA` rollout order —
  recommend `QCOREAI_TIER_QUOTA` first (coarser, safer — a heavy user has to
  blow through their WHOLE tier allowance) before `QCOREAI_PREMIUM_QUOTA`
  (finer, easier to false-positive a legitimate power user who happens to
  prefer a frontier model).

## The flip

```bash
# 1. Railway dashboard → service → Variables → add:
QCOREAI_TIER_QUOTA=1
# (repeat later, separately, for QCOREAI_PREMIUM_QUOTA=1)

# 2. Manual UX check — log in as a real paid account near/over its cap
#    (found via step 1 of the checklist above), hit qcoreai chat, expect
#    a 402 upgrade_required with reason "tier_token_quota_exhausted" (or
#    "premium_model_quota_exhausted" for the premium gate).

# 3. Spot-check GET /me/token-quota for that same account — metered/
#    premiumMetered should now read true, matching the env flip.
```

## Rollback

Unset the env var(s) on Railway — both gates fail open on any metering
error already, and unsetting the flag reverts to the pre-flip dormant
no-op instantly, same as `PAYWALL_MODULES`.

## Open follow-up

- No dedicated smoke script yet (unlike `paywall-policy-smoke.js`) — would
  need one that hits `/me/token-quota` for a known test account and asserts
  `metered`/`premiumMetered` match `EXPECT_*` env vars, mirroring the
  paywall smoke's `--wait` polling mode.
- `QCOREAI_PREMIUM_QUOTA` only covers `/chat` + `/chat-stream` — extending
  it to the multi-agent orchestrator's dispatch points is separate work,
  tracked in `docs/PRICING_STRATEGY_2026-07.md`.

— written 2026-07-23
