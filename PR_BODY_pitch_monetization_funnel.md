# fix(pricing): every published price now matches the code that charges it

18 files, +440/−108. Branch is level with `main` (merged 2026-08-10, two OG-image
conflicts resolved). `tsc` clean on frontend and backend; **560 tests across 52 files pass.**

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

`checkout_start` fired from exactly one place — the `/pricing` table — so
`/pricing/admin` reported a checkout-start count that silently excluded
`ModulePricingChip` (a real `checkout/session` call), `UpgradeButton`→Gumroad (9 module
pages) and devhub Studio Pro (its own LS variant, never touches `/api/pricing/checkout`).
All three now fire it with a `source` naming the origin. The two `/pricing/[tierId]` CTAs
fire `cta_click`, since they hand off to the calculator rather than starting a checkout.

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

- **Production build not run to completion here.** The app *compiles* (9.3 min,
  successful), but the generated route types fail on `frontend/src/app/[id]/page.tsx`
  (`params: Promise<T> | T`, last touched in #537) — an unrelated pre-existing file, and
  this worktree resolves a different Next patch than the pinned one. CI is the authority.
- **Whole-frontend sweep is in** (`retiredPrices.guard.test.ts`), covering the four
  retired tier prices with every legitimate exception named and reasoned — the same bet
  `scaleClaims.guard.test.ts` makes for module counts. Scope stops there deliberately:
  the frontend holds 1033 dollar literals across 300 distinct values, almost all of them
  legitimately someone else's, and an allowlist that large could not be verified.
  Explanatory text is excused only on real comment lines, so adding the word "repriced"
  to a UI string cannot smuggle a wrong price past it — verified.

## Needs a decision, not code

`/partner` and `/pitch` publish two different revenue curves for the same company —
Year 1 `$15–30M` vs `$0.5M`, a 30–60× gap — and `/partner` never cites the bottom-up
model `/pitch` calls the defensible base case. Which curve is *the* claim is
positioning, so it was left untouched.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
