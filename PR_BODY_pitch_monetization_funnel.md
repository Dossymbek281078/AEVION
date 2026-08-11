# fix(pricing): every published number now matches the code behind it

Branch is level with `main` (merged 2026-08-10, two OG-image conflicts resolved).
**569 frontend tests across 55 files and 1424 backend tests pass**; `tsc --noEmit` is clean
on both — on the frontend *with generated route types present*, which is what the build's
type phase actually checks. Every guard added here was verified to go **red on a reverted
value** before landing.

ℹ️ **On the backend suite's occasional redness — measured, and it is contention, not a
bug.** `tests/devhub-integrations.test.ts` loses a different set of its 238 tests under
load. On a quiet machine the full suite runs **1424 passed / 8 skipped / 0 failed, three
times in a row — and three more times with a candidate fix reverted**, so the fix was not
what made it green. Under load, individual files take 19–37s against a 10s `testTimeout`
and other files fail too (`qtradeInternalCredit`, `tier3OgRoutes`). If CI reddens here,
look at runner contention first, not at logic.

## Why

The 2026-07-22 repricing (Lite 19→24, Medium 29→39, Full 49→89, Universe
149.99→249.99) landed in `aevion-globus-backend/src/data/pricing.ts` — the file
`routes/checkout.ts` computes every real charge from — **and nowhere else**. For three
weeks a visitor read `$19/mo` in the tier FAQ and the checkout billed `$24`. Nothing
crashed, no test went red, and `main` still shipped the old ladder as of this branch.

Auditing outward from that one gap turned up four more numbers that matched no source
of truth at all.

## What changed

**Tier prices, everywhere they are retyped**
- i18n (en/ru/kk): tier FAQs, annual figures (`$240/$390/$890`, was `$190/$290/$490`),
  home comparison row, startups case, affiliate commission example, DocuSign migration line.
- OG share cards — the classic laggard, since nobody re-opens an image:
  `/pricing` (from `$24`), `/pricing/[tierId]` (**plus the missing `pro` entry** —
  `/pricing/pro` used to share a card reading "Medium $29"), `/pricing/compare`
  (still advertised a FREE / PRO $19 / BUSINESS $99 plan that no longer exists).
- `pitchFacts`: Universe `$249.99`, seat ARPU `~$2,500/yr`, top live-checkout tier `$89`,
  new `ENTRY_PAID_TIER_MONTHLY`.
- `pitchModel`: seat headline, on-ramp ladder, token-margin line, and every derived ARR
  recomputed off the real prices. **Seat counts and conversion assumptions were not
  touched** — only the price input moved, and the copy says so.
- `/pitch`, `/pitch/print` and the pitch OG card now import these figures instead of
  retyping them.

**Per-product prices that matched nothing**
- `UpgradeButton` advertised "AEVION All-Access — **$59/мес**" next to a live Gumroad
  checkout on 9 module pages. `$59` was never a tier price in any era. Now imports the
  constant. Its `tierId` also defaulted to `pro` while the banner sells Full — fixed
  (Gumroad's tier param is attribution-only, so this changes reporting, not billing).
- `/investor` claimed a QBuild Starter `$49` / Pro `$249` ladder that does not exist
  (real `BuildPlan` seed: Free, Pro 4 990 ₽, Agency 14 990 ₽), Free with 3 vacancies
  (real: 1), and a **1.5% hire fee**. Real fee is `hireFeeBps/10000` = **12%**, falling to
  4% at Platinum — the page understated the platform's own take rate by 8×.
- `/investor` priced Bureau Verified at `$9`; the live charge is `$19`
  (`getVerifiedTierPriceCents`). Notarized has a request flow but no price in code and
  Gold/Platinum exist nowhere — labelled planned instead of shown as sellable.
- `provisioning.ts` mapped `pro: "Lite"` under a "legacy aliases" comment. `pro` is the
  live Universe tier, so a customer who had just paid $249.99 got a welcome email
  headlined "Добро пожаловать в AEVION Lite". Last copy of the assumption that once
  gated a Universe customer at Lite access (fixed in `planGate` on 2026-07-22).

**Funnel instrumentation**

`checkout_start` fired from exactly one place — the `/pricing` table. Writing a guard to
keep the first three fixes in place immediately found six more silent entry points, so
`/pricing/admin` had been reporting a count that excluded **most of the store**:

| Surface | What it sells |
|---|---|
| `ModulePricingChip` | Lite + a chosen module, real `checkout/session` call |
| `UpgradeButton` → Gumroad | All-Access, on 9 module pages |
| `/apps` | 7 module checkouts + the Planet offer |
| `/shop`, `/go` | the whole product catalogue |
| `/longevity`, `/qrenew`, `/qmelanin` | the paid PDFs |
| `/devhub`, `/studio` | Studio Pro |
| `/constitution` banner | Constitution Pro |

`/shop` and `/go` are server components, so rather than four copies of a tracked anchor
there is now one shared `<BuyLink>` wrapper; it sends via `sendBeacon`, which survives the
redirect to the processor, and carries the `?c=` acquisition channel into the event so a
purchase can be tied back to the traffic that produced it. The two `/pricing/[tierId]`
CTAs fire `cta_click`, since they hand off to the calculator rather than starting a
checkout.

`checkoutFunnel.guard.test.ts` keeps it that way: any file that reaches a checkout must
emit a funnel event, exceptions are named with reasons, and a second test fails when an
exception stops matching anything. It accepts either funnel and accepts delegation to
`<BuyLink>` — demanding a `track()` call in a file that handed the job to a component
would force duplicate tracking.

**Worth knowing:** Constitution keeps its own funnel by design, so its sales do **not**
appear in `/pricing/admin`. That dashboard is not the whole revenue picture. Unifying the
two is a product decision, not a technical one.

**Guard**

`pitchNumbers.guard.test.ts` now parses `TIERS` out of the backend registry and fails
when a derived surface drifts — tier constants, both OG price cards, the All-Access
banner (which must contain no price literal at all), the Bureau price and the QBuild
hire-fee range. Each new assertion was verified to go **red on a reverted value** before
landing; green on the already-fixed state proves nothing.

## Checked and deliberately left alone

Consistent with their own source of truth: QPayNet 0.1% transfer fee (`FEE_PCT`),
Constitution Free/Pro $9/Team $49 (`constitutionCheckout.ts`), module add-on chips (read
`/api/pricing` at runtime), per-tier token allowances (2M/10M/50M/200M) and support SLAs
(24h/8h/6h/1h) across all three locales.

## Known limits

- **Build blocker found and fixed — 13 route files, none of them this branch's.**
  `npm run build` failed in its type phase on generated route types. `tsc --noEmit` stayed
  clean the whole time, because those types live in `.next/types` and do not exist until a
  build creates them — which is why no test, typecheck or guard ever saw this.

  Two shapes, and the second one is why the first sweep was not enough:
  - eight routes declared `params: Promise<T> | T` — a union Next 16 rejects;
  - five more declared `params: { id: string }` outright, three of them taking
    `searchParams` synchronously too. A grep written for the union misses these.

  **The method matters more than the fix.** `next build` reports ONE such error per run at
  ~15 minutes a run: 13 files is over three hours of waiting. `next typegen` writes the same
  `.next/types` in seconds without building, and `tsc --noEmit` then checks sources *and*
  generated types together — every remaining error in one pass. That is how the second
  shape was found and cleared, and it is the check to run before claiming a frontend
  change builds.

  Files: `/[id]` (page + OG), cyberchess spectator and tournaments, `/devhub/[id]` and
  `/devhub/[id]/deploy`, four smeta-trainer routes, and the OG images for
  `/qsign/verify/[id]`, `bank/gift/[id]`, `bank/r/[code]`, `bank/share/[handle]`,
  `qpaynet/r/[token]`. Each carried a runtime branch for the pre-Next-15 sync shape that
  Next 16 can never reach — in two cases hidden from the compiler by an `as any`. Dead
  branches dropped rather than cast around; `await`-ing a Promise does exactly what the old
  `await Promise.resolve(...)` / `typeof .then === "function"` dance did.

  The two cyberchess files belong to another session's zone and were touched only because
  they carry the identical defect and block the same build — a type signature and an
  unreachable branch, no game logic.

  Worth knowing when typechecking: delete `.next` first, or a stale build directory reports
  generated-type errors as if they were source errors.
- **Whole-frontend sweep is in** (`retiredPrices.guard.test.ts`), covering the four
  retired tier prices with every legitimate exception named and reasoned — the same bet
  `scaleClaims.guard.test.ts` makes for module counts. Scope stops there deliberately:
  the frontend holds 1033 dollar literals across 300 distinct values, almost all of them
  legitimately someone else's, and an allowlist that large could not be verified.
  Explanatory text is excused only on real comment lines, so adding the word "repriced"
  to a UI string cannot smuggle a wrong price past it — verified.

## The same audit, applied outward

Once the tier ladder was pinned, the same question — *what code backs this number?* —
was put to every other numeric claim. AEVION turns out to have **four** money sources of
truth, and a surface belongs to exactly one: `data/pricing.ts` (tier checkout),
`lib/products.ts` (Gumroad/LS products, verified against the live dashboards on
2026-07-26), `routes/apiQuotas.ts` (the API ladder, served machine-readable at
`/api/quotas`), and per-product backends (Bureau cents, Constitution, QBuild's RUB plans).

- **API `Scale` tier** — `/developers/fintech/rate-limits` and `/fintech/compare` printed
  `$199/mo` while the registry a developer can curl says `$249`. Fixed; all three
  surfaces pinned by `apiTierPrices.guard.test.ts`.
- **Public module counter** — `data/trust.ts` served `27` at `/api/pricing/trust` while
  `projects.ts` holds 41 entries, and credited it to "Business", a tier with no object in
  `TIERS`. Both are derivable from code, so both were fixed (40 = entries − the globus map
  shell; Business → Full, the mapping `provisioning.ts` already uses).
- **Guard blind spot** — `scaleClaims.guard` and `retiredPrices.guard` stop at
  `frontend/src`, which is exactly why the backend counter survived. Closed from the
  backend side in `trustClaims.guard.test.ts`, which reads the registry rather than
  comparing one constant to another — a constant-vs-constant assertion is green forever,
  and that is how `27` outlived the registry's growth.

## Findings left for a decision, deliberately unfixed

Each is documented at the site, so the next reader does not mistake it for settled.

- **Two tier limits nothing enforces.** Of the seven `TierLimits` fields, five are read by
  code; `qrightObjectsPerMonth` and `qsignOpsPerDay` are advertised on the pricing page and
  read by nothing. The divergence runs in the customer's favour, and switching enforcement
  on means deciding whom to start refusing.
- **Three SLA ladders for one promise.** `apiQuotas.ts` (Build 99.0 · Scale 99.5 ·
  Enterprise 99.9), `trust.ts` (99.5 · 99.95), and the `/pricing` glossary ("99.9% on
  everything"). The glossary contradicts the registry a developer can curl. An SLA is a
  commercial commitment; picking one to make the files agree would be inventing it.
- **Traction counters with no source.** "12 000+ ideas", "3 200+ artifacts", "30+
  countries" in `trust.ts`, for a pre-revenue company.
- **Retired price inside customer quotes.** A testimonial and a case study still say
  `$19/мес`. Allowlisted with a reason rather than corrected — rewriting a price inside a
  quote attributed to a named person is falsifying a testimonial.
- **Planet.** The one paid offer whose price ($250/$200) lives in a page component and
  whose checkout links are raw Lemon Squeezy UUIDs, bypassing both the catalogue and the
  backend's reference system. Nothing in the codebase can verify what it bills.
- **qmelanin and qrenew are sold twice.** `MODULES_PRICING` lists them as monthly add-ons
  ($15 / $19); `lib/products.ts` sells the same brands as one-off Gumroad PDFs ($19 EN /
  $9 RU). Adding qrenew on `/pricing` charges $19 **every month**; buying from `/qrenew`
  charges $19 **once**, and neither page distinguishes them. The existing
  `audit:projects-pricing` CI step has been printing these two as an informational line
  ("in MODULES_PRICING but NOT in projects.ts") on every run — it was not noise, and it
  had not been checked. Picking one shape means deleting the other.

## Also verified, no defect

The promo-discount cap (`MAX_PROMO_DISCOUNT_RATIO`) is applied in **both** `buildQuote`
and `checkout.ts`, so the calculator cannot promise a discount larger than the charge
applies. Annual pricing agrees too: `checkout.ts` charges `tier.priceAnnualTotal` (×10),
the figure the pricing pages display. Studio Pro is consistent at $149 across `/devhub`,
`/studio`, `lib/products.ts` and `revenue.ts` — both pages now read the catalogue for
the price *and* the checkout URL instead of keeping their own copies.

## Needs a decision, not code

`/partner` and `/pitch` publish two different revenue curves for the same company —
Year 1 `$15–30M` vs `$0.5M`, a 30–60× gap — and `/partner` never cites the bottom-up
model `/pitch` calls the defensible base case. Which curve is *the* claim is
positioning, so it was left untouched.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
