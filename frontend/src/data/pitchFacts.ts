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
export const REGISTRY_ENTRIES = 43;
/** Public "product nodes on the Globus map" = registry entries − the globus map shell. */
export const MODULE_NODES = 42;
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
/**
 * The single defensible revenue figure. Company is pre-revenue ($0) today.
 *
 * Recomputed 2026-09-16 off the TERM LADDER (founder's decision 2026-09-15): a
 * paid tier is now a TERM of access to the whole planet, paid up front, and the
 * subscription flagship is modelled at the 12-month term — $200/mo, $2,400 for
 * the term. The subscriber assumptions did NOT move: still 1,000 beachhead and
 * 10,000 regional. Only the price input changed, so the arithmetic is
 * 1,000 × $2,400 = $2.4M and 10,000 × $2,400 = $24M (was 1,000 × $490 = $490K
 * and 10,000 × $490 = $4.9M under the retired monthly plan).
 *
 * Totals therefore move ≈$0.85M → ≈$2.76M beachhead and ≈$9.65M → ≈$28.75M
 * regional; the QBuild ($235K / $2.35M) and QCoreAI ($120K / $2.4M) rows are
 * untouched, because neither is priced off the planet ladder.
 *
 * The direction matters more than the number: the model follows the published
 * price both ways — it went DOWN on 2026-08-18 and UP now. A revenue figure
 * that only ever moves one way is a figure nobody should believe.
 *
 * Locked to the registry by pitchNumbers.guard.test.ts, which recomputes the
 * flagship ARR from the backend term ladder and re-adds the three rows, instead
 * of comparing one hardcoded number to another.
 */
export const BOTTOM_UP_BEACHHEAD_ARR = "≈$2.76M";
export const BOTTOM_UP_REGIONAL_ARR = "≈$28.75M";
export const IS_PRE_REVENUE = true;

// ── Term ladder (a paid tier IS a term of access to the whole planet) ───────
/**
 * ЛЕСТНИЦА СРОКОВ — слово основателя 15.09.2026, заменяет помесячный план.
 *
 * Тариф называет СРОК доступа ко ВСЕЙ планете, оплата за срок вперёд: Lite
 * 1 месяц, Medium 3, Pro 6, Full 9, Max 12. Цена месяца дешевеет с длиной
 * срока: $400 / $350 / $300 / $250 / $200. Платёж за срок = цена месяца ×
 * месяцы, то есть $400 / $1050 / $1800 / $2250 / $2400.
 *
 * Источник чисел — реестр бэкенда (data/pricing.ts: TERM_MONTHS, TERM_FACTOR,
 * PLANET_BASE_MONTHLY), копия для страниц — lib/termPricing.ts. Строки ниже
 * существуют только для инвесторских поверхностей и ЗАПЕРТЫ на реестр сторожем
 * pitchNumbers.guard.test.ts: он считает их из лестницы, а не сверяет литерал
 * с литералом.
 *
 * ⚠️ ДВА РАЗНЫХ ЧИСЛА, которые легко принять за одно, — поэтому у них разные
 * имена, и прежнего единственного ENTRY_PAID_TIER_MONTHLY больше нет:
 *
 *   ВХОД в лестницу      — самый КОРОТКИЙ срок: $400 за один месяц. Наименьший
 *                          платёж, какой можно сделать, и при этом наибольшая
 *                          цена месяца.
 *   «от $X/мес» на сайте — наименьшая ЦЕНА МЕСЯЦА, а она на самом ДЛИННОМ
 *                          сроке: $200 (fromPricePerMonth в lib/termPricing).
 *
 * Одно имя на два смысла напечатало бы либо «вход $200» (платежа такого нет),
 * либо «от $400/мес» (месяц бывает дешевле). Оба варианта — ложь на витрине.
 *
 * Годовой оплаты и формулы «×10» (плати за 10 месяцев, получи 12) больше НЕТ:
 * платёж за срок берётся из реестра, а не считается скидкой к году.
 */
/** Месяц на самом коротком сроке (Lite, 1 месяц) — вход в лестницу. */
export const ENTRY_TERM_MONTHLY = "$400";
/**
 * Верхняя ступень лестницы — Max, 12 месяцев, $200/мес.
 *
 * Оговорка «у Universe нет варианта Lemon Squeezy, поэтому верхняя ПОКУПАЕМАЯ
 * ступень — Full» СНЯТА 16.09.2026: варианты LS заведены у всех пяти сроков,
 * то есть верхняя ступень лестницы и есть верхняя ступень с живой кассой.
 * Держать оговорку дальше значило бы занижать то, что уже можно купить.
 */
export const LIVE_TOP_TIER_MONTHLY = "$200";
/** Платёж за весь 12-месячный срок вперёд — он же ARPU места за год. */
export const LIVE_TOP_TIER_TERM_TOTAL = "$2,400";
/** Честная оговорка рядом с ценой: срок фиксирует цену месяца на весь свой период. */
export const TERM_LADDER_INTRO_NOTE =
  "Introductory pricing — the term you pay for locks your monthly rate for its whole length; " +
  "later terms may be priced higher as the ecosystem matures.";
