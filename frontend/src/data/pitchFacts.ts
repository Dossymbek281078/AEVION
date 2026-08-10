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
 * `/api/modules/registry`. As of 2026-07-26 it holds 41 entries:
 * 36 `status:"live"` + 5 `status:"mvp"`. The public-facing product-node count
 * excludes the `globus` entry, which is the interactive map shell itself, not
 * a product node (41 registry entries − 1 map shell = 40 nodes on the map).
 *
 * These two constants are locked to projects.ts by pitchNumbers.guard.test.ts,
 * which COUNTS the file rather than comparing one hardcoded number to another.
 * An earlier version of that test asserted `MODULE_NODES === 37` against a
 * literal, so the registry could grow to 41 while the test stayed green and
 * every pitch surface quietly published a stale figure. If the count changes,
 * the test now tells you the new number instead of agreeing with the old one.
 */

// ── Ecosystem scale ────────────────────────────────────────────────────────
/**
 * Всего записей в реестре, включая `globus` — оболочку карты.
 * Именно это число /api/aevion/registry отдаёт в поле `total`, поэтому
 * счётчики, подписанные этим эндпоинтом, должны падать сюда, а не в
 * MODULE_NODES (тот на единицу меньше — он считает продуктовые узлы карты).
 */
export const REGISTRY_ENTRIES = 41;
/** Public "product nodes on the Globus map" = registry entries − the globus map shell. */
export const MODULE_NODES = 40;
/** Registry entries with status:"live". The remaining 5 are status:"mvp". */
export const LIVE_MODULES = 36;
/** Honest qualitative framing (from the #484 objectivity audit): deployed ≠ feature-complete. */
export const FEATURE_COMPLETE_LABEL = "~a dozen feature-complete";
/**
 * Модули, у которых на /pitch есть собственная карточка-разбор с пруфами.
 *
 * Это НЕ реестровое «live» (LIVE_MODULES): реестр считает задеплоенное (36),
 * а здесь — то, по чему в питче есть доказательный разбор (12). Числа разные
 * по смыслу, поэтому и имена разные. Пока смысл был один («live»), герой
 * страницы печатал «12 live MVPs of 33 planned nodes», а абзац ниже — «41
 * product nodes»: читатель одной страницы видел два разных знаменателя.
 *
 * Заперто на длину массива `launchedModules` со `stage:"live"` сторожем
 * pitchNumbers.guard.test.ts — считает файл, а не сверяет литерал с литералом.
 */
export const DEEP_DIVE_MODULES = 12;
/**
 * Узлы с обязательством отгрузить за 18 месяцев. Плановое число основателя,
 * не замер: сторож проверяет только, что оно не больше MODULE_NODES и что
 * «остальные N» в тексте рисков считаются из него, а не вписаны руками
 * (было «13 из 41, остальные 15» — 13 + 15 не сходится ни с 40, ни с 41).
 */
export const COMMITTED_NODES = 13;

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
export const UNIVERSE_SEAT_MONTHLY = "$149.99";
export const UNIVERSE_SEAT_ANNUAL_TOTAL = "~$1,500/yr"; // effective ARPU used in the growth model
export const UNIVERSE_SEAT_INTRO_NOTE = "Introductory price for the first 6–12 months — may rise as the ecosystem matures.";
// Live plan is now 5-tier: Free / Lite $19 / Medium $29 / Full $49 / Universe(pro) $149.99.
// The $149.99 "Universe" tier (id "pro") is defined in the backend pricing registry
// (aevion-globus-backend/src/data/pricing.ts); its checkout goes live once its Gumroad product exists.
export const LIVE_TOP_TIER_MONTHLY = "$49"; // highest tier with live checkout today (Full)
