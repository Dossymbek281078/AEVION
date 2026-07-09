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
/** The single defensible revenue figure. Company is pre-revenue ($0) today. */
export const BOTTOM_UP_BEACHHEAD_ARR = "≈$0.8M";
export const BOTTOM_UP_REGIONAL_ARR = "≈$9.4M";
export const IS_PRE_REVENUE = true;

// ── Universe Seat (one seat = the whole ecosystem) ───────────────────────────
/**
 * PROPOSED premium "Universe Seat" price for a branded launch. This is a
 * repositioning of today's LIVE published All-Access price ($49/mo — still what
 * the pricing pages and Gumroad charge). $79 is a go-forward pricing DECISION,
 * not the live price; the live checkout is intentionally NOT changed here.
 * Justification anchor = sum-of-parts: a working creator's AI stack (Claude +
 * Midjourney + ElevenLabs + Higgsfield ≈ $100+/mo) vs one AEVION seat.
 */
export const UNIVERSE_SEAT_MONTHLY = "$79";
export const UNIVERSE_SEAT_ANNUAL_PER_MO = "$63"; // annual −20%
export const UNIVERSE_SEAT_ANNUAL_TOTAL = "$756"; // effective ARPU used in the growth model
export const LIVE_ALL_ACCESS_MONTHLY = "$49"; // what the live product charges today
