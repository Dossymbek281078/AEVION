/**
 * QVenture — Company-Specific Signal Extraction (deterministic)
 * ────────────────────────────────────────────────────────────
 * Parses *the specific plan's own numbers* out of the free-text description and
 * traction notes: revenue, growth, gross margin, CAC/LTV, payback, churn,
 * retention, customer count, bottom-up TAM. These feed the scoring engine so the
 * composite reflects THIS company — not just its sector average.
 *
 * Deliberately NOT LLM-backed: the engine's contract is "numbers never from an
 * LLM" (engine.ts). A regex/parse pass is fully deterministic and offline-safe,
 * so the same plan always yields the same signals → the same score. The LLM
 * council (lenses.ts) still reads the full plan for qualitative depth on top.
 *
 * Every field is nullable: absent = "not disclosed", and the engine falls back
 * to the sector prior for that factor. `fieldsFound` measures how much of the
 * score is company-specific vs sector-derived (surfaced as signal coverage).
 */

import { mentionsUnnegated } from "../textNegation";

/**
 * Period a churn figure is quoted over. Decks quote churn monthly *or* annually
 * and rarely say which explicitly — but 4% means "excellent" annually and
 * "the company is bleeding out" monthly (4%/mo ≈ 39%/yr). Reading every figure
 * as monthly punished plans that disclosed a good annual number and let bad
 * annual numbers pass as fine. So the period is parsed and the rate is
 * normalized to monthly before anything scores it.
 */
export type ChurnPeriod = "monthly" | "quarterly" | "annual" | "weekly" | "unspecified";

/** Compounding periods per month, used to normalize a churn rate to monthly. */
const PERIODS_PER_MONTH: Record<Exclude<ChurnPeriod, "unspecified">, number> = {
  weekly: 52 / 12,
  monthly: 1,
  quarterly: 1 / 3,
  annual: 1 / 12,
};

/**
 * Convert a churn rate quoted over `period` into its monthly equivalent,
 * compounding properly (20%/yr is 1.84%/mo, not 1.67%/mo).
 * An unspecified period is read as monthly — the deck convention — and the
 * engine says so in its assumptions instead of hiding the choice.
 */
export function monthlyChurnFrom(pct: number, period: ChurnPeriod | null): number {
  if (!isFinite(pct) || pct <= 0) return 0;
  if (pct >= 100) return 100;
  const p = period && period !== "unspecified" ? period : "monthly";
  const perMonth = PERIODS_PER_MONTH[p];
  if (perMonth === 1) return Math.round(pct * 100) / 100;
  const survivalPerPeriod = 1 - pct / 100;
  const monthly = 1 - Math.pow(survivalPerPeriod, perMonth);
  return Math.round(monthly * 10000) / 100;
}

export interface PlanSignals {
  revenueUsd: number | null;
  /** How revenue was stated (MRR is annualized ×12 into revenueUsd). */
  revenueBasis: "ARR" | "MRR" | "revenue" | null;
  growthPct: number | null;
  growthPeriod: "MoM" | "YoY" | "WoW" | "unspecified" | null;
  grossMarginPct: number | null;
  cacUsd: number | null;
  ltvUsd: number | null;
  ltvCacRatio: number | null;
  paybackMonths: number | null;
  /** Churn exactly as disclosed, in the period stated by `churnPeriod`. */
  churnPct: number | null;
  /** Period the churn figure is quoted over. "unspecified" is read as monthly. */
  churnPeriod: ChurnPeriod | null;
  /** Churn normalized to a monthly rate — this is what the engine scores. */
  churnMonthlyPct: number | null;
  retentionPct: number | null;
  customers: number | null;
  bottomUpTamUsd: number | null;
  /** Plan references revenue/customers but discloses no figure — a soft flag. */
  mentionsRevenueNoNumber: boolean;
  /** Plan asserts patents / proprietary IP — a small moat signal. */
  mentionsPatent: boolean;
  /** Count of concrete quantitative fields parsed (drives signal coverage). */
  fieldsFound: number;
}

/**
 * Structured financials an analyst can supply directly (bypassing the text
 * parser). Every field optional; provided values are *exact*, so they override
 * whatever the parser guessed from the description. This is the "raise input
 * depth" path — precise numbers instead of hoping the regex caught them.
 */
export interface StructuredFinancials {
  revenueUsd?: number;
  mrrUsd?: number; // annualized ×12 into revenue if arr/revenue not given
  arrUsd?: number;
  growthPct?: number;
  growthPeriod?: "MoM" | "YoY" | "WoW" | "unspecified";
  grossMarginPct?: number;
  cacUsd?: number;
  ltvUsd?: number;
  ltvCacRatio?: number;
  paybackMonths?: number;
  churnPct?: number;
  /** Period the supplied churn is quoted over (defaults to monthly). */
  churnPeriod?: ChurnPeriod;
  retentionPct?: number;
  customers?: number;
  bottomUpTamUsd?: number;
}

const numOrNull = (v: unknown): number | null =>
  typeof v === "number" && isFinite(v) && v >= 0 ? v : null;

/** Merge exact structured financials over parsed text signals (structured wins). */
export function mergeStructuredSignals(parsed: PlanSignals, f: StructuredFinancials | undefined): PlanSignals {
  if (!f) return parsed;
  const s: PlanSignals = { ...parsed };

  // Revenue: explicit revenue/arr, else annualize mrr.
  const arr = numOrNull(f.arrUsd) ?? numOrNull(f.revenueUsd);
  const mrr = numOrNull(f.mrrUsd);
  if (arr !== null) { s.revenueUsd = arr; s.revenueBasis = f.arrUsd != null ? "ARR" : "revenue"; }
  else if (mrr !== null) { s.revenueUsd = mrr * 12; s.revenueBasis = "MRR"; }

  const set = <K extends keyof PlanSignals>(key: K, v: number | null) => { if (v !== null) (s[key] as number | null) = v; };
  set("growthPct", numOrNull(f.growthPct));
  if (f.growthPct != null && f.growthPeriod) s.growthPeriod = f.growthPeriod;
  set("grossMarginPct", numOrNull(f.grossMarginPct));
  set("cacUsd", numOrNull(f.cacUsd));
  set("ltvUsd", numOrNull(f.ltvUsd));
  set("ltvCacRatio", numOrNull(f.ltvCacRatio));
  set("paybackMonths", numOrNull(f.paybackMonths));
  if (numOrNull(f.churnPct) !== null) {
    s.churnPct = f.churnPct as number;
    s.churnPeriod = f.churnPeriod ?? "unspecified";
    s.churnMonthlyPct = monthlyChurnFrom(f.churnPct as number, s.churnPeriod);
  }
  set("retentionPct", numOrNull(f.retentionPct));
  set("customers", numOrNull(f.customers) !== null ? Math.round(f.customers as number) : null);
  set("bottomUpTamUsd", numOrNull(f.bottomUpTamUsd));

  // Derive LTV/CAC if not given but CAC+LTV are.
  if (s.ltvCacRatio === null && s.cacUsd && s.ltvUsd && s.cacUsd > 0) {
    s.ltvCacRatio = Math.round((s.ltvUsd / s.cacUsd) * 10) / 10;
  }
  if (s.revenueUsd !== null) s.mentionsRevenueNoNumber = false;

  const quant: Array<number | null> = [
    s.revenueUsd, s.growthPct, s.grossMarginPct, s.cacUsd, s.ltvUsd, s.ltvCacRatio,
    s.paybackMonths, s.churnPct, s.retentionPct, s.customers, s.bottomUpTamUsd,
  ];
  s.fieldsFound = quant.filter((x) => x !== null).length;
  return s;
}

export function emptySignals(): PlanSignals {
  return {
    revenueUsd: null, revenueBasis: null, growthPct: null, growthPeriod: null,
    grossMarginPct: null, cacUsd: null, ltvUsd: null, ltvCacRatio: null,
    paybackMonths: null, churnPct: null, churnPeriod: null, churnMonthlyPct: null,
    retentionPct: null, customers: null,
    bottomUpTamUsd: null, mentionsRevenueNoNumber: false, mentionsPatent: false,
    fieldsFound: 0,
  };
}

const MULT: Record<string, number> = {
  k: 1e3, m: 1e6, b: 1e9, bn: 1e9, t: 1e12, tn: 1e12,
  thousand: 1e3, million: 1e6, billion: 1e9, trillion: 1e12,
};

/** Parse a money-ish token like "$1.2M", "500k", "2 million", "1,500,000". */
function parseMoney(numRaw: string, unitRaw?: string): number | null {
  const n = parseFloat(numRaw.replace(/,/g, ""));
  if (!isFinite(n)) return null;
  const unit = (unitRaw || "").trim().toLowerCase();
  const mult = MULT[unit] ?? 1;
  return n * mult;
}

/** Match the first capture group of a pattern, or null. */
function firstMatch(text: string, re: RegExp): RegExpMatchArray | null {
  re.lastIndex = 0;
  return re.exec(text);
}

const NUM = String.raw`(\d[\d,]*(?:\.\d+)?)`;
/**
 * Money multiplier. The `(?![a-z])` guard is load-bearing: without it the single
 * letters k/m/b/t matched the START of the next word, so "CAC $3, LTV $2, monthly
 * churn 14%" read LTV as $2 **m**illion (ratio 666,666:1 instead of 0.7) and
 * "$50 tests" would have been fifty trillion. Alternation backtracks, so
 * "million"/"billion" still match — only a bare letter glued to a word is rejected.
 */
const UNIT = String.raw`(?:(k|m|b|bn|t|tn|thousand|million|billion|trillion)(?![a-z]))?`;

export function parsePlanSignals(text: string): PlanSignals {
  const s = emptySignals();
  if (!text || !text.trim()) return s;
  const t = ` ${text.toLowerCase().replace(/\s+/g, " ")} `;

  // ── Revenue: "$2M ARR" / "$500k MRR" / "$1.2m in revenue" / "arr of $3m" ──
  const arr = firstMatch(t, new RegExp(String.raw`\$?\s*${NUM}\s*${UNIT}\s*(arr|mrr|in revenue|revenue|recurring revenue)`, "i"))
    || firstMatch(t, new RegExp(String.raw`(arr|mrr|revenue)\s*(?:of|=|:|at)?\s*\$?\s*${NUM}\s*${UNIT}`, "i"));
  if (arr) {
    // group order differs between the two alternatives; detect which matched
    const hasLeadingNum = /^\s*\$?\s*\d/.test(arr[0]);
    const numStr = hasLeadingNum ? arr[1] : arr[2];
    const unitStr = hasLeadingNum ? arr[2] : arr[3];
    const kindStr = (hasLeadingNum ? arr[3] : arr[1]) || "";
    const val = parseMoney(numStr, unitStr);
    if (val && val > 0) {
      const isMrr = /mrr/i.test(kindStr);
      s.revenueUsd = isMrr ? val * 12 : val;
      s.revenueBasis = isMrr ? "MRR" : /arr/i.test(kindStr) ? "ARR" : "revenue";
    }
  }
  // A plan that says it has no revenue is not 'revenue mentioned without a
  // figure' — that is a denial, and the adverse-disclosure path handles it.
  if (s.revenueUsd === null && mentionsUnnegated(t, /\b(revenue|paying customers|arr|mrr|monetiz)\b/i)) {
    s.mentionsRevenueNoNumber = true;
  }

  // ── Growth: "growing 20% MoM" / "30% month-over-month growth" / "up 15% MoM" ──
  // A bare "<n>% monthly" is NOT growth: "20% monthly churn" used to be read as
  // 20% MoM growth, handing a dying company +14 execution points for a metric it
  // never claimed. So a period word alone no longer qualifies — the match needs a
  // growth verb, the word "growth", or a growth-specific token (MoM/YoY/WoW).
  const PERIOD_WORD = String.raw`(mom|yoy|wow|month[- ]over[- ]month|year[- ]over[- ]year|week[- ]over[- ]week|monthly|annually|annual|yearly|per month|per year|per week)`;
  const NOT_ANOTHER_METRIC = String.raw`(?!\s*(?:churn|attrition|retention|margin|discount|fee|interest|refund|conversion))`;
  const growth = firstMatch(t, new RegExp(String.raw`(?:grow(?:ing|th|s|n)?|up|increas(?:ing|ed|e)|expand(?:ing|ed))\s*(?:by|at|of|to)?\s*${NUM}\s*%\s*${PERIOD_WORD}?${NOT_ANOTHER_METRIC}`, "i"))
    || firstMatch(t, new RegExp(String.raw`${NUM}\s*%\s*${PERIOD_WORD}\s*(?:revenue\s*)?growth`, "i"))
    || firstMatch(t, new RegExp(String.raw`${NUM}\s*%\s*(mom|yoy|wow|month[- ]over[- ]month|year[- ]over[- ]year|week[- ]over[- ]week)${NOT_ANOTHER_METRIC}`, "i"));
  if (growth) {
    const groups = growth.slice(1).filter((g): g is string => typeof g === "string");
    const value = groups.find((g) => /^\d/.test(g));
    const g = value !== undefined ? parseFloat(value.replace(/,/g, "")) : NaN;
    if (isFinite(g)) {
      s.growthPct = g;
      const p = groups.filter((x) => !/^\d/.test(x)).join(" ").toLowerCase();
      s.growthPeriod = /mom|month/.test(p) ? "MoM" : /yoy|year|annual/.test(p) ? "YoY" : /wow|week/.test(p) ? "WoW" : "unspecified";
    }
  }

  // ── Gross margin: "80% gross margin" / "gross margin of 72%" ──
  const gm = firstMatch(t, new RegExp(String.raw`${NUM}\s*%\s*gross\s*margin`, "i"))
    || firstMatch(t, new RegExp(String.raw`gross\s*margins?\s*(?:of|=|:|at|are|is)?\s*${NUM}\s*%`, "i"));
  if (gm) {
    const m = parseFloat(gm[1].replace(/,/g, ""));
    if (isFinite(m) && m > 0 && m <= 100) s.grossMarginPct = m;
  }

  // ── LTV:CAC ratio stated directly: "LTV:CAC of 4:1" / "LTV/CAC 3.5" ──
  const ratio = firstMatch(t, new RegExp(String.raw`ltv[:/ ]*cac\s*(?:of|=|:|at)?\s*${NUM}\s*(?::\s*1)?`, "i"));
  if (ratio) {
    const r = parseFloat(ratio[1].replace(/,/g, ""));
    if (isFinite(r) && r > 0 && r < 100) s.ltvCacRatio = r;
  }
  // ── CAC / LTV absolute: "CAC of $400", "LTV $3,000" ──
  // The negative lookbehind stops "LTV/CAC 4.2" from also matching here and
  // reading the ratio's 4.2 as a $4.20 CAC — which was nonsense data and
  // inflated fieldsFound / signalCoverage with a metric the plan never disclosed.
  const cac = firstMatch(t, new RegExp(String.raw`(?<!ltv[:/ ]{0,4})cac\s*(?:of|=|:|at|is)?\s*\$?\s*${NUM}\s*${UNIT}`, "i"));
  if (cac) { const v = parseMoney(cac[1], cac[2]); if (v && v > 0) s.cacUsd = v; }
  const ltv = firstMatch(t, new RegExp(String.raw`ltv\s*(?:of|=|:|at|is)?\s*\$?\s*${NUM}\s*${UNIT}`, "i"));
  if (ltv) { const v = parseMoney(ltv[1], ltv[2]); if (v && v > 0) s.ltvUsd = v; }
  if (s.ltvCacRatio === null && s.cacUsd && s.ltvUsd && s.cacUsd > 0) {
    s.ltvCacRatio = Math.round((s.ltvUsd / s.cacUsd) * 10) / 10;
  }

  // ── Payback: "payback of 8 months" / "8-month payback" ──
  const pb = firstMatch(t, new RegExp(String.raw`payback\s*(?:period)?\s*(?:of|=|:|at|is)?\s*${NUM}\s*[- ]?months?`, "i"))
    || firstMatch(t, new RegExp(String.raw`${NUM}\s*[- ]?months?\s*payback`, "i"));
  if (pb) { const v = parseFloat(pb[1].replace(/,/g, "")); if (isFinite(v) && v > 0 && v < 240) s.paybackMonths = v; }

  // ── Churn / retention / NRR ──
  // The period matters as much as the number: "4% annual churn" is excellent,
  // "4% churn" read as monthly is ~39%/yr. Capture whichever side states it.
  const churn = firstMatch(t, new RegExp(String.raw`(?:(monthly|quarterly|annual(?:ised|ized)?|yearly|weekly)\s+)?${NUM}\s*%\s*(monthly|quarterly|annual(?:ised|ized)?|yearly|weekly)?\s*churn(?:\s*(?:per|a|\/)\s*(month|quarter|year|week))?`, "i"))
    || firstMatch(t, new RegExp(String.raw`(monthly|quarterly|annual(?:ised|ized)?|yearly|weekly)?\s*churn\s*(?:rate)?\s*(?:of|=|:|at|is)?\s*${NUM}\s*%\s*(?:(?:per|a|\/)\s*(month|quarter|year|week))?`, "i"));
  if (churn) {
    const groups = churn.slice(1).filter((g): g is string => typeof g === "string");
    const value = groups.find((g) => /^\d/.test(g));
    const v = value !== undefined ? parseFloat(value.replace(/,/g, "")) : NaN;
    if (isFinite(v) && v >= 0 && v <= 100) {
      const words = groups.filter((g) => !/^\d/.test(g)).join(" ").toLowerCase();
      s.churnPct = v;
      s.churnPeriod = /annual|yearly|year/.test(words) ? "annual"
        : /quarter/.test(words) ? "quarterly"
          : /week/.test(words) ? "weekly"
            : /month/.test(words) ? "monthly"
              : "unspecified";
      s.churnMonthlyPct = monthlyChurnFrom(v, s.churnPeriod);
    }
  }
  const ret = firstMatch(t, new RegExp(String.raw`${NUM}\s*%\s*(?:net\s*)?(?:revenue\s*)?retention`, "i"))
    || firstMatch(t, new RegExp(String.raw`(?:net\s*revenue\s*retention|nrr|retention)\s*(?:of|=|:|at|is)?\s*${NUM}\s*%`, "i"));
  if (ret) { const v = parseFloat(ret[1].replace(/,/g, "")); if (isFinite(v) && v > 0 && v <= 500) s.retentionPct = v; }

  // ── Customers / users: "10,000 customers" / "1,200 paying users" ──
  const cust = firstMatch(t, new RegExp(String.raw`${NUM}\s*${UNIT}\s*(?:paying\s*)?(?:customers|users|clients|subscribers|merchants|seats)`, "i"));
  if (cust) {
    const v = parseMoney(cust[1], cust[2]);
    if (v && v >= 1) s.customers = Math.round(v);
  }

  // ── Bottom-up TAM: "TAM of $12B" / "$500M TAM" / "addressable market of $8B" ──
  const tam = firstMatch(t, new RegExp(String.raw`(?:tam|total addressable market|addressable market)\s*(?:of|=|:|is|at)?\s*\$?\s*${NUM}\s*${UNIT}`, "i"))
    || firstMatch(t, new RegExp(String.raw`\$?\s*${NUM}\s*${UNIT}\s*(?:tam|addressable market)`, "i"));
  if (tam) {
    // detect group layout
    const lead = /^\s*\$?\s*\d/.test(tam[0]) && !/^(tam|total|addressable)/i.test(tam[0].trim());
    const numStr = lead ? tam[1] : tam[1];
    const unitStr = lead ? tam[2] : tam[2];
    const v = parseMoney(numStr, unitStr);
    if (v && v > 0) s.bottomUpTamUsd = v;
  }

  // ── Patents / proprietary IP ──
  // "We have no patents and no proprietary technology" used to set this true,
  // and the engine then credited +0.1 moat realization for the patents it denied.
  s.mentionsPatent = mentionsUnnegated(t, /\b(patents?|patented|proprietary technolog(?:y|ies)|proprietary algorithms?|patent[- ]pending)\b/i);

  // ── Count concrete quantitative fields for coverage ──
  const quant: Array<number | null> = [
    s.revenueUsd, s.growthPct, s.grossMarginPct, s.cacUsd, s.ltvUsd, s.ltvCacRatio,
    s.paybackMonths, s.churnPct, s.retentionPct, s.customers, s.bottomUpTamUsd,
  ];
  s.fieldsFound = quant.filter((x) => x !== null).length;

  return s;
}
