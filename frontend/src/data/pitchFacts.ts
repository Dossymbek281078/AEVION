/**
 * pitchFacts — single source of truth for the numbers that appear across
 * investor-facing surfaces (home, /pitch, /partner, /investor, OG images,
 * print pages, SEO meta).
 *
 * WHY THIS FILE EXISTS
 * The same figure used to be hardcoded as a string literal in ~10 different
 * files with slightly different wording ("$2B+", "$2.0B+", "29 modules",
 * "Seed $5M"). A cleanup in one file never caught the variants elsewhere, so a
 * stale copy always resurfaced on another surface (SEO meta, OG images, print
 * pages are the classic laggards). Import these constants instead of typing a
 * number, and the figure changes in exactly one place. The guard test
 * (src/app/__tests__/pitchNumbers.guard.test.ts) fails the build if a retired
 * number reappears as a literal on a pitch surface.
 *
 * GROUND TRUTH FOR THE COUNTS
 * The canonical module registry is the backend file
 * `aevion-globus-backend/src/data/projects.ts`, served at
 * `/api/modules/registry`. As of this file's last audit it holds 38 entries:
 * 35 `status:"live"` + 3 `status:"mvp"`. The public-facing "37 product nodes"
 * excludes the `globus` entry, which is the interactive map shell itself, not
 * a product node (38 registry entries − 1 map shell = 37 nodes on the map).
 * If you add/remove a module in projects.ts, update MODULE_NODES / LIVE_MODULES
 * here and the guard-test expectations that lock them.
 */

// ── Ecosystem scale ────────────────────────────────────────────────────────
/** Public "product nodes on the Globus map" = 38 registry entries − the globus map shell. */
export const MODULE_NODES = 37;
/** Registry entries with status:"live". The remaining 3 are status:"mvp". */
export const LIVE_MODULES = 35;
/** Honest qualitative framing (from the #484 objectivity audit): deployed ≠ feature-complete. */
export const FEATURE_COMPLETE_LABEL = "~a dozen feature-complete";

// ── Market ─────────────────────────────────────────────────────────────────
/** Top-down category context (IP licensing + creator economy + digital payments). */
export const TAM = "$340B";

// ── Deal (canonical: promo/02_DEAL_TERMS.md — partnership, not a buyout) ─────
export const ADVANCE = "$10M";
export const ADVANCE_KIND = "returnable advance";
export const REVENUE_SPLIT = "51/49";

// ── Revenue model (bottom-up, three flagships — see `unitEconomics`) ─────────
/**
 * The single defensible revenue figure. Company is pre-revenue ($0) today.
 *
 * Recomputed 2026-08-10 off the repriced ladder: the "Ecosystem All-Access"
 * flagship is the live Full tier, which moved $49 → $89/mo ($890/yr annual),
 * so the same unchanged subscriber assumptions (1,000 beachhead / 10,000
 * regional) now carry more ARR. Was ≈$0.8M / ≈$9.4M on the $49 price. Seat
 * counts and conversion assumptions were NOT touched — only the price input.
 */
export const BOTTOM_UP_BEACHHEAD_ARR = "≈$1.2M";
export const BOTTOM_UP_REGIONAL_ARR = "≈$13.7M";
export const IS_PRE_REVENUE = true;

// ── Universe Seat (one seat = the whole ecosystem) ───────────────────────────
/**
 * The "Universe Seat" = the `pro` tier in the backend pricing registry
 * (aevion-globus-backend/src/data/pricing.ts). Repriced 2026-07-22 from
 * $149.99 → $249.99/mo (docs/PRICING_STRATEGY_2026-07.md): the flagship must
 * sit above a single premium AI subscription, because one seat carries the
 * whole platform rather than one product.
 *
 * Justification anchor = sum-of-parts: a working creator's AI stack (Claude
 * Max $200 + Midjourney + ElevenLabs + Higgsfield) clears $200–400/mo across
 * four logins; AEVION is one seat.
 *
 * ANNUAL = ×10 (pay for 10 months, get 12) — the `annualTotal()` formula in the
 * backend registry. $249.99 × 10 ≈ $2,500/yr, which is the seat ARPU the growth
 * model in pitchModel.ts runs on.
 */
export const UNIVERSE_SEAT_MONTHLY = "$249.99";
export const UNIVERSE_SEAT_ANNUAL_TOTAL = "~$2,500/yr"; // effective ARPU used in the growth model
export const UNIVERSE_SEAT_INTRO_NOTE = "Introductory price for the first 6–12 months — may rise as the ecosystem matures.";
// Live plan is 6-tier: Free / Lite $24 / Medium $39 / Full $89 / Universe(pro) $249.99 / Enterprise.
// Universe has no Lemon Squeezy variant yet (see data/lemonSqueezyVariants.ts — a "pro" checkout
// falls through to Gumroad/stub), so the highest tier with a real subscription checkout is Full.
export const LIVE_TOP_TIER_MONTHLY = "$89"; // highest tier with live LS checkout today (Full)
/** Entry paid tier — the "from $X/mo" figure on public pricing surfaces and OG cards. */
export const ENTRY_PAID_TIER_MONTHLY = "$24";
