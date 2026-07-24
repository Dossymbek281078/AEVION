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

- [ ] **Confirm the flip landed** — `node scripts/qcoreai-quota-policy-smoke.js`
  (added 2026-07-23, modeled directly on `paywall-policy-smoke.js`). Hits the
  new public `GET /api/qcoreai/quota-policy` (no auth needed, safe to cache)
  and asserts the three gate flags + the per-tier cap table shape. Supports
  the same `--wait` polling mode:
  ```bash
  BASE=https://<preview>.up.railway.app EXPECT_TIER=1 \
    node aevion-globus-backend/scripts/qcoreai-quota-policy-smoke.js --wait
  ```
- [ ] **Read the real per-account numbers before flipping.**
  `GET /api/qcoreai/me/token-quota` (authenticated) reports
  `usedTokens`/`limitTokens` and `premiumUsedTokens`/`premiumLimitTokens` for
  the caller's own account **even while both gates are dormant**
  (`metered`/`premiumMetered` will read `false`, but the underlying numbers
  are already live). Check this for a sample of real paid accounts across
  each tier — this is the "would today's real usage 402 someone
  unexpectedly" check; unlike the policy smoke above, it needs a per-account
  token, so it's a manual spot-check, not automatable the same way.
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

- `QCOREAI_PREMIUM_QUOTA` only covers `/chat` + `/chat-stream` — extending
  it to the multi-agent orchestrator is separate work. Scoped (not yet
  implemented) 2026-07-24:
  - `services/qcoreai/orchestrator.ts`'s `streamAgent()` (~line 196) is the
    **single choke point** every strategy (sequential/parallel/debate/
    moderator/judge/etc.) funnels through — good news, only one function
    needs the check, not a dozen call sites.
  - The hard part: `streamAgent()` is an async generator with **no user/tier
    context at all** today — `OrchestratorInput` doesn't carry a userId or
    resolved tier. Adding the check means threading that through
    `OrchestratorInput` → every strategy function → `streamAgent()`, not a
    one-line addition.
  - There's already a directly-analogous precedent to mirror instead of
    inventing a new mechanism: `effectiveBudget()`/`bailBudget()` (same
    file, ~line 266) already gracefully stops a run mid-stream when a
    per-run `maxCostUsd` cap is crossed, yielding a `budget_exceeded` event
    the route handler forwards to the client. A premium-quota check should
    yield an equivalent `premium_quota_exceeded` event via the same
    generator-yield idiom, NOT try to call `res.status(402)` directly from
    inside the generator (it has no `res`).
  - Open design question that needs a real decision before implementing,
    not a code change: if agent A already produced output before agent B's
    call would exceed the quota, does the run keep A's partial output (like
    `bailBudget` does — it yields `final` with `lastContent`) or discard
    it? Recommend following `bailBudget`'s existing precedent (keep partial
    output) for consistency, but confirm before implementing.

— written 2026-07-23, smoke script added 2026-07-23, orchestrator scoped 2026-07-24
