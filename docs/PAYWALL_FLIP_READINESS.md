# Paywall flip readiness

> Operator checklist for turning the platform-wide module paywall on. The gate code (`planGate.ts`) shipped dormant in PR #434; the frontend UX (`PaywallScreen`, `lib/paywall.ts`) and a probe smoke (`paywall-policy-smoke.js`) shipped in PR #438 / #441 and the followup expand-PR. **PR #439** then mounted `requireModule()` on *every* monetised module (centralised `MODULE_GATE_PREFIXES` map in `src/index.ts`) — excluding `globus` (free), `cyberchess*`, `smeta-trainer`, `qbuild/build`, `constitution*` (own gate) — and added a **global `<PaywallModal>`** + `window.fetch` interceptor so a 402 surfaces an upgrade prompt from *any* module even if its page wasn't individually wired with `<PaywallScreen>`. Until `PAYWALL_MODULES` env is set on Railway, every `requireModule()` call is a no-op.
>
> **Payout rail is live:** revenue is collected via Gumroad (the only KYC-passed Merchant of Record) and paid out via **Payoneer → KZ** (Payoneer account approved 2026-06-25). A flip now produces money that actually reaches the founder.
>
> **Recommended first flip (real OPEX first):** `PAYWALL_MODULES=qcoreai,qfusionai,multichat-engine,healthai` — the AI-compute modules where each request has marginal cost. Expand from there.

## TL;DR

```bash
# 1. confirm current state (must say "enforced: 0" on dormant)
node aevion-globus-backend/scripts/paywall-policy-smoke.js

# 2. flip one module on Railway preview
#    Railway → service → Variables → add PAYWALL_MODULES=qcoreai

# 3. confirm flip landed
EXPECT_ENFORCED=qcoreai node aevion-globus-backend/scripts/paywall-policy-smoke.js

# 4. manual UX check
#    log in as a free-tier user → open /qcoreai/playground
#    expect <PaywallScreen> instead of the playground

# 5. promote to prod
#    same env on prod Railway, run smoke again with EXPECT_ENFORCED set
```

## What's wired

| Surface | Module | Wired at | Reads policy from |
|---|---|---|---|
| Backend gate | `requireModule()` mounted on ALL monetised modules (`MODULE_GATE_PREFIXES`, PR #439) | dormant until env | `MODULES_PRICING.includedIn` |
| Backend introspection | `GET /api/me/entitlements`, `GET /api/paywall/policy` | always live | same |
| Frontend UI (per-page) | `<PaywallScreen>` + `fetchOrPaywall`/`apiFetchOrPaywall` helpers | on 7+ pages (qcoreai, qcoreai/playground, qfusionai, multichat-engine, healthai, smeta-trainer, cyberchess) | the 402 response payload |
| Frontend UI (global) | `<PaywallModal>` + `window.fetch` interceptor (PR #439) | always live, app-wide | the 402 response payload |
| Audit | `npm run audit:projects-pricing` (CI gate) | every PR | `projects.ts` ↔ `pricing.ts` |
| Daily smoke | `qbuild-seo` (verifies SEO didn't regress) | `prod-readonly-sweep` | live `aevion.app` |

## Pre-flip checklist (one-time)

- [ ] `npm run audit:projects-pricing` exit 0 — every module has a `MODULES_PRICING` row
- [ ] `node scripts/paywall-policy-smoke.js` exit 0 — endpoint up, schema stable, **enforced: 0** in prod today
- [ ] (Optional since PR #439) Confirm modules you plan to enforce have a `<PaywallScreen>`-wired page for the *best* UX. Grep: `grep -l PaywallScreen frontend/src/app/<module>/`. Modules without one still get the global `<PaywallModal>` overlay on 402 — no module is left with a silent failure.
- [ ] Confirm `/pricing` page lists the tiers the 402 response will name (`lite`/`medium`/`full`/`enterprise`). The CTA in `PaywallScreen` deep-links to `upgradeUrl` from the backend.
- [ ] Decide enforcement strategy: comma list (`qcoreai,qfusionai`), wildcard (`*`), or stepwise rollout (one module per day for a week)

## The flip (per-module)

### Railway preview (dry-run)

1. Open Railway dashboard → service → **Variables**
2. Add: `PAYWALL_MODULES=qcoreai` (lowercase, comma-separated for multiple)
3. Deploy / redeploy. Wait for green check.
4. Run from local:
   ```bash
   BASE=https://<preview>.up.railway.app \
     EXPECT_ENFORCED=qcoreai \
     node aevion-globus-backend/scripts/paywall-policy-smoke.js
   ```
   Expect: `✓ enforced set matches EXPECT_ENFORCED`
5. UX check: log in as free-tier on the preview frontend → hit `/qcoreai/playground` → expect `<PaywallScreen>` with chips `medium / full / enterprise`. CTA → `/pricing` should land you on the tier page.

### Prod (after preview is good)

Same steps against prod Railway. Add an Uptime/Sentry alert on `/api/paywall/policy` 5xx so a regression in the policy resolver pages someone.

## The unflip (kill switch)

```bash
# nuclear option — disables enforcement everywhere, regardless of PAYWALL_MODULES
PAYWALL_DISABLED=1
```

Set this env on Railway → redeploy. Confirms with:
```bash
node scripts/paywall-policy-smoke.js
# expect: enforcedCount === 0 (even with PAYWALL_MODULES set)
```

The dormant-by-default + global kill-switch combo means a bad flip is reversible in <2 min — same window as a deploy.

## Common pitfalls

- **402 returned but no UX shown** → the page is calling `fetch` directly. Switch to `fetchOrPaywall` (RSC) or `apiFetchOrPaywall` (client). The full list of wired pages is in §"What's wired".
- **Smoke says enforced but UI works** → the `requireModule()` middleware isn't mounted on that route. `src/index.ts` should have `app.use("/api/<module>", requireModule("<module>"), <router>)`.
- **Lite-tier users blocked when they shouldn't be** → check `chosenModules` is being persisted on the subscription. `planGate.isModuleEntitled` checks `plan.chosenModules.includes(moduleId)` for Lite.
- **`/me/plan` and `/me/entitlements` 402** → exempted by design (`isExemptPath`). If they're 402'ing, the middleware version isn't from PR #434+.

## Where the policy is defined

- `aevion-globus-backend/src/lib/planGate.ts` — middleware + entitlement resolver
- `aevion-globus-backend/src/data/pricing.ts` — `MODULES_PRICING[].includedIn` (single source of truth)
- `aevion-globus-backend/src/routes/entitlements.ts` — `/me/entitlements` + `/paywall/policy`

To change the policy: edit `includedIn` in `pricing.ts`, ship a PR. The CI audit job will fail if a new module shows up in `projects.ts` without a pricing row.
