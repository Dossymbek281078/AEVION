/**
 * Platform metric primitives — periods and money units.
 * ─────────────────────────────────────────────────────
 * These live outside any one module because both rules here were learned the
 * expensive way inside QVenture, and the next module that reads a number out of
 * free text will hit them again:
 *
 *  1. A rate without its period is not a number. "4% churn" is excellent
 *     annually and fatal monthly (4%/mo ≈ 39%/yr). Normalize before comparing.
 *  2. A money unit must be a unit, not the next word's first letter. An
 *     unguarded `(k|m|b|t)?` turned "LTV $2, monthly churn 14%" into LTV
 *     $2 *m*illion and would read "$50 tests" as fifty trillion.
 *
 * Deliberately dependency-free and deterministic: same input, same output.
 */

export type RatePeriod = "weekly" | "monthly" | "quarterly" | "annual" | "unspecified";
export type GrowthPeriod = "MoM" | "YoY" | "WoW" | "unspecified";

export const RATE_PERIODS: readonly RatePeriod[] = ["weekly", "monthly", "quarterly", "annual", "unspecified"];
export const GROWTH_PERIODS: readonly GrowthPeriod[] = ["MoM", "YoY", "WoW", "unspecified"];

/** Compounding periods per month, used to normalize a rate to monthly. */
const PERIODS_PER_MONTH: Record<Exclude<RatePeriod, "unspecified">, number> = {
  weekly: 52 / 12,
  monthly: 1,
  quarterly: 1 / 3,
  annual: 1 / 12,
};

/**
 * Convert an attrition rate quoted over `period` into its monthly equivalent,
 * compounding properly — 20%/yr is 1.84%/mo, not 1.67%/mo.
 *
 * An unspecified period is read as monthly, because that is what decks mean by
 * default. Callers must say so wherever the number is shown: an assumption the
 * reader cannot see is indistinguishable from a measurement.
 */
export function monthlyRateFrom(pct: number, period: RatePeriod | null | undefined): number {
  if (!isFinite(pct) || pct <= 0) return 0;
  if (pct >= 100) return 100;
  const p = period && period !== "unspecified" ? period : "monthly";
  const perMonth = PERIODS_PER_MONTH[p];
  if (perMonth === 1) return Math.round(pct * 100) / 100;
  const monthly = 1 - Math.pow(1 - pct / 100, perMonth);
  return Math.round(monthly * 10000) / 100;
}

/** Narrow an untrusted value (API body, LLM reply) to a rate period, or null. */
export function asRatePeriod(v: unknown): RatePeriod | null {
  return typeof v === "string" && (RATE_PERIODS as readonly string[]).includes(v) ? (v as RatePeriod) : null;
}

/** Narrow an untrusted value to a growth period, or null. */
export function asGrowthPeriod(v: unknown): GrowthPeriod | null {
  return typeof v === "string" && (GROWTH_PERIODS as readonly string[]).includes(v) ? (v as GrowthPeriod) : null;
}

/** Map any period wording found in text ("per year", "annualised", "MoM") to a rate period. */
export function ratePeriodFromWords(words: string): RatePeriod {
  const w = words.toLowerCase();
  if (/annual|yearly|\byear\b|\byoy\b|p\.?a\.?\b/.test(w)) return "annual";
  if (/quarter/.test(w)) return "quarterly";
  if (/week|\bwow\b/.test(w)) return "weekly";
  if (/month|\bmom\b/.test(w)) return "monthly";
  return "unspecified";
}

/** Map period wording to a growth period. */
export function growthPeriodFromWords(words: string): GrowthPeriod {
  const w = words.toLowerCase();
  if (/mom|month/.test(w)) return "MoM";
  if (/yoy|year|annual/.test(w)) return "YoY";
  if (/wow|week/.test(w)) return "WoW";
  return "unspecified";
}

export const MONEY_MULTIPLIER: Record<string, number> = {
  k: 1e3, m: 1e6, b: 1e9, bn: 1e9, t: 1e12, tn: 1e12,
  thousand: 1e3, million: 1e6, billion: 1e9, trillion: 1e12,
};

/** Regex source for a number, capturing one group. */
export const NUMBER_PATTERN = String.raw`(\d[\d,]*(?:\.\d+)?)`;

/**
 * Regex source for an optional money unit, capturing one group.
 *
 * The `(?![a-z])` guard is load-bearing — see rule 2 in the file header. Regex
 * alternation backtracks, so "million"/"billion" still match; only a bare letter
 * glued to the following word is rejected.
 */
export const MONEY_UNIT_PATTERN = String.raw`(?:(k|m|b|bn|t|tn|thousand|million|billion|trillion)(?![a-z]))?`;

/** Parse a money-ish token like "$1.2M", "500k", "2 million", "1,500,000". */
export function parseMoney(numRaw: string, unitRaw?: string): number | null {
  const n = parseFloat(String(numRaw).replace(/,/g, ""));
  if (!isFinite(n)) return null;
  const unit = (unitRaw || "").trim().toLowerCase();
  return n * (MONEY_MULTIPLIER[unit] ?? 1);
}
