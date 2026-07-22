# AEVION Pricing Strategy — 2026-07-22 repricing

> Companion to the billing-consolidation cleanup (PR #779) and this repricing
> change. Source of truth for the *numbers* is always `aevion-globus-backend/src/data/pricing.ts`
> — this doc records the *reasoning*, so a future session doesn't have to
> reverse-engineer why a price is what it is.

## Why we repriced

The platform-wide bundle tiers were priced well below what the bundled value
justifies. AEVION gives access to 30+ products (IP registry, e-signatures,
fintech stack, AI orchestration, CyberChess, HealthAI, and more) under one
subscription — that bundle should never be cheaper than a single-purpose
competitor's own top plan, because we're giving strictly more.

At the same time, several individual AEVION products compete head-to-head
with a specific, well-known single-purpose rival (CyberChess vs chess.com,
QCoreAI-as-standalone-AI-chat vs Claude Pro/ChatGPT Plus). Those products are
early in building traction against entrenched competitors, so they get the
**opposite** treatment: priced *below* their direct rival, as a deliberate
penetration play, funded by the bundle's higher margin.

## Two opposite pricing rules, by design

1. **Platform bundle tiers (Medium / Full / Universe) — price ABOVE the
   nearest single-purpose competitor's top plan.**
   Reference points gathered 2026-07 (see `project_billing_consolidation_2026-07`
   memory for the full list): Claude Pro $20, Claude Max 5x $100, Claude Max
   20x $200; ChatGPT Plus $20, ChatGPT Pro $100–$200. Universe/"pro" — the
   flagship, literally "all of AEVION" — moved **$149.99 → $249.99/mo**,
   clearing the ~$200 ceiling of the priciest single-product plans on the
   market. Full (all 30+ products, single seat) moved **$49 → $89/mo** —
   above Claude Pro/ChatGPT Plus individually, appropriate for an all-access
   bundle. Medium (10-app curated bundle) moved **$29 → $39/mo**. Lite (any
   ONE product of your choice) moved **$19 → $24/mo**.

2. **Named individual products with a direct competitor — price ~50% BELOW
   that competitor's comparable plan**, as an intro/penetration strategy
   while the product is still building traction. Revisit once each product
   has real market share; this is explicitly a "for now" (temporary) stance,
   not a permanent one.
   - **CyberChess** (`cyberchess` addonMonthly): $19 → **$9.99/mo**, roughly
     half of chess.com Diamond (~$20/mo monthly billing), comfortably below
     chess.com Gold (~$12/mo) too.
   - **QCoreAI as a standalone AI subscription** (`qcoreai` addonMonthly,
     i.e. bought à la carte on top of a lower tier rather than as part of a
     bundle): $29 → **$9.99/mo**, roughly half of Claude Pro / ChatGPT Plus
     ($20/mo).
   - Other individual module add-ons (multichat-engine, healthai, qright,
     qsign, aevion-ip-bureau, qtradeoffline, qpaynet-embedded, etc.) were
     **left unchanged** — no verified, comparable single-purpose competitor
     price was available for them at the time of this pass. Don't reprice
     them off a guessed comparison; benchmark first.
   - The `ai-suite` bundle (`qcoreai` + `multichat-engine` + `kids-ai-content`)
     was recomputed from $49 → $33/mo to preserve a genuine ~13% discount
     over buying the (now cheaper) components separately — it would have
     become a markup otherwise.

Both rules point the same direction commercially: cheap entry per-product to
win users away from point solutions, expensive/premium bundle to monetize
the users who want everything AEVION offers.

## The real constraint this repricing exposed: QCoreAI token COGS

Before raising Universe's price, we audited whether its "200,000,000 tokens
/ month" promise (and Full's 50M, Medium's 10M, Lite's 2M) was backed by
anything. It was not: `llmTokensPerMonth` in `data/pricing.ts` was a pure
display number. QCoreAI's paid-tier gate (`lib/qcoreQuota.ts`) enforced
*only* the Free tier's 100k/mo cap — any paid tier could, in principle, spend
unlimited tokens against the most expensive model in the real multi-provider
fleet (`services/qcoreai/pricing.ts` has real list prices: e.g. ~$25–$50 per
1M output tokens on the priciest models). At those rates, a single heavy
Universe user running even a fraction of the advertised 200M-token cap on a
premium model could cost AEVION many multiples of the $249.99 subscription.

Fixed alongside this repricing (same PR as the entitlement-mapping fix):
`qcoreQuota.ts` now has a second, independently dormant gate
(`QCOREAI_TIER_QUOTA=1`) that enforces every paid tier's real cap using the
existing per-user monthly token ledger. **It ships dormant** — flipping it on
is a separate, deliberate decision (mirrors the `PAYWALL_MODULES` /
`QCOREAI_FREE_QUOTA` pattern) that should happen only after checking real
usage patterns don't false-positive genuine heavy users who were previously
unconstrained in practice.

**Open follow-up, not yet built:** even with the monthly *token count* capped,
nothing yet distinguishes "200M tokens on the free-fleet/local models (near-
$0 COGS)" from "200M tokens on the frontier paid models (real $ per request)".
A subscriber could still exhaust a huge fraction of the subscription price on
premium-model calls well before hitting the raw token ceiling. The economically
correct next step is a **separate, smaller sub-cap on premium/frontier-model
usage** within each tier's overall token budget (similar to how Claude/ChatGPT
plans separate "generous cheaper-model access" from "limited frontier-model
access"). Not implemented in this pass — flagged here so it isn't lost.

## What this doc does NOT cover

- Modules without a verified competitor benchmark — don't invent one.
- CyberChess/QCoreAI's discount is *temporary framing*, not a permanent
  policy — revisit pricing once traction data exists.
- Enterprise stays "contact sales" / custom — no change.

## Update 2026-07-22 (same day) — premium-model sub-cap shipped, other modules checked

**Premium/frontier-model token sub-cap — implemented.** The "open follow-up"
above (a subscriber spending their whole token allowance on the priciest
model before hitting the raw count) is now built, not just flagged:
- `services/qcoreai/pricing.ts`: `isPremiumModel()` / `getPremiumModelNames()`
  — any model priced ≥$5/1M output tokens (threshold-based, so a newly added
  expensive model is covered automatically, no second list to maintain).
- `data/pricing.ts`: new `TierLimits.premiumTokensPerMonth` — ~10% of each
  tier's overall cap (Lite 200k, Medium 1M, Full 5M, Universe 20M; Free is
  `null` since its tiny 100k overall cap already bounds worst-case exposure;
  Enterprise `null`/unlimited).
- `QCoreTokenLedger` gained `premiumTokensIn`/`premiumTokensOut` columns
  (additive `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, no migration
  framework needed — this table was already raw-SQL, not Prisma-managed).
- New gate `enforcePremiumModelQuota()` in `lib/qcoreQuota.ts`, behind its
  own dormant flag `QCOREAI_PREMIUM_QUOTA=1` (independent from
  `QCOREAI_TIER_QUOTA`) — wired into `routes/qcoreai.ts`'s two single-shot
  `/chat` + `/chat-stream` endpoints, called after the model is resolved and
  before dispatch (unlike the other two gates, which run at request start,
  this one needs to know which model first).
- **Known gap, not yet covered:** the multi-agent orchestrator's per-call
  dispatch points (the `/run` pipeline, batch runs, etc.) don't call this
  gate yet — only the two direct chat endpoints do. A heavy orchestrator run
  could still spend unboundedly on premium models today. Extending coverage
  there is the next piece of this specific work, not done in this pass.
- **Pre-flip visibility**: `GET /api/qcoreai/me/token-quota` (authenticated,
  already existed for the free-tier gate) now also reports the caller's
  status against both the overall paid-tier cap and the premium sub-cap —
  `usedTokens`/`limitTokens`/`remainingTokens` and
  `premiumUsedTokens`/`premiumLimitTokens`/`premiumRemainingTokens` — even
  while both gates stay dormant (`metered`/`premiumMetered` reflect the real
  env-flag state). This is the way to check real accounts' current standing
  before flipping either flag on Railway, without needing direct production
  database access from a dev machine.

**Other modules checked for a repricing benchmark — none applied.** Looked
for a clean single-purpose competitor for QSign and QRight/IP Bureau (the
same "50% below a named rival" logic used for CyberChess/QCoreAI):
- QSign vs. DocuSign (~$10–15/mo Personal, $25–45/mo Standard) / Dropbox Sign
  (~$15/mo Essentials, $25/mo Standard): a real subscription market exists,
  but QSign is a narrow HMAC/canonical-JSON signing primitive, not a full
  contract-lifecycle product (no templates, audit-trail UI, SMS delivery).
  Repricing off this comparison risked an apples-to-oranges "50% cheaper
  than DocuSign" claim the product doesn't actually earn feature-for-feature
  — left unchanged pending a clearer scope match.
- QRight/IP Bureau vs. digital-copyright/authorship-timestamp services: no
  clean subscription competitor found. US Copyright Office registration is a
  one-time $45–125 government fee (not a subscription); third-party
  timestamp services (Copyright01, Authorship Registry, Surety) are mostly
  free or have no published subscription pricing to benchmark against.
  Left unchanged — no comparison to responsibly act on.
- Other modules (multichat-engine, healthai, aevion-ip-bureau,
  qtradeoffline, qpaynet-embedded, etc.) — not researched this pass; still
  open for a future pass if a genuine competitor benchmark turns up.
