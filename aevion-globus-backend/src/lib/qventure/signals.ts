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
import {
  monthlyRateFrom, ratePeriodFromWords, growthPeriodFromWords, parseMoney,
  NUMBER_PATTERN, MONEY_UNIT_PATTERN, type RatePeriod,
} from "../metrics/periods";
import {
  CURRENCY_PREFIX_PATTERN, detectCurrency, detectCurrencyFirst, toUsd, type MoneyCurrency,
} from "../metrics/currency";

/**
 * Period a churn figure is quoted over — the platform rate period. Decks quote
 * churn monthly *or* annually and rarely say which, but 4% means "excellent"
 * annually and "the company is bleeding out" monthly (4%/mo ≈ 39%/yr).
 */
export type ChurnPeriod = RatePeriod;

/** Churn quoted over `period`, expressed as a monthly rate. */
export const monthlyChurnFrom = monthlyRateFrom;

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
  /**
   * Currency the plan quotes money in, when it marks one. Every *Usd field above
   * is already converted; this records what it was converted FROM so the report
   * can disclose the rate instead of presenting a converted figure as native.
   */
  currency: MoneyCurrency | null;

  // ── Evidence that is not SaaS-shaped ────────────────────────────────────────
  // A marketplace, a defence-hardware programme, a therapeutic and a power plant
  // do not have ARR, MoM and LTV/CAC — they have GMV and take rate, contracted
  // backlog and design wins, a trial phase and a regulatory clearance, an offtake
  // agreement. Reading only SaaS metrics made every one of those companies look
  // like a plan with no evidence, so five of eight factors stayed sector
  // constants and the whole score compressed to the middle.
  /** Gross merchandise value / gross bookings / total payment volume. */
  gmvUsd: number | null;
  /** Marketplace take rate or commission, %. */
  takeRatePct: number | null;
  /** Signed-but-not-yet-recognised revenue: backlog, order book, offtake, bookings. */
  contractedRevenueUsd: number | null;
  /** Grants, prizes and awarded government programmes — capital a hard-to-fool funder committed. */
  nonDilutiveUsd: number | null;
  /** Count of pilots / LOIs / design wins / deployments disclosed. */
  pilots: number | null;
  /** Regulatory milestones the plan claims to have REACHED (not merely planned). */
  regulatoryMilestones: string[];
  /** Technical validation the plan claims: peer review, trial phase, benchmark, working plant. */
  technicalProof: string[];

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

  s.fieldsFound = countFields(s);
  return s;
}

/** Every quantitative field that counts toward disclosure coverage. */
function countFields(s: PlanSignals): number {
  const quant: Array<number | null> = [
    s.revenueUsd, s.growthPct, s.grossMarginPct, s.cacUsd, s.ltvUsd, s.ltvCacRatio,
    s.paybackMonths, s.churnPct, s.retentionPct, s.customers, s.bottomUpTamUsd,
    s.gmvUsd, s.takeRatePct, s.contractedRevenueUsd, s.nonDilutiveUsd, s.pilots,
  ];
  return quant.filter((x) => x !== null).length
    + (s.regulatoryMilestones.length ? 1 : 0)
    + (s.technicalProof.length ? 1 : 0);
}

export function emptySignals(): PlanSignals {
  return {
    revenueUsd: null, revenueBasis: null, growthPct: null, growthPeriod: null,
    grossMarginPct: null, cacUsd: null, ltvUsd: null, ltvCacRatio: null,
    paybackMonths: null, churnPct: null, churnPeriod: null, churnMonthlyPct: null,
    retentionPct: null, customers: null,
    bottomUpTamUsd: null, mentionsRevenueNoNumber: false, mentionsPatent: false, currency: null,
    gmvUsd: null, takeRatePct: null, contractedRevenueUsd: null, nonDilutiveUsd: null,
    pilots: null, regulatoryMilestones: [], technicalProof: [],
    fieldsFound: 0,
  };
}

/** Match the first capture group of a pattern, or null. */
function firstMatch(text: string, re: RegExp): RegExpMatchArray | null {
  re.lastIndex = 0;
  return re.exec(text);
}

// Number + money-unit patterns come from the platform metric primitives, which
// carry the `(?![a-z])` guard that stops "LTV $2, monthly" reading as $2 million.
const NUM = NUMBER_PATTERN;
const UNIT = MONEY_UNIT_PATTERN;
// Money can be marked with any currency, not just "$" — "€3M ARR" and
// "₸450 млн GMV" have to reach the same patterns before they can be converted.
const CUR = CURRENCY_PREFIX_PATTERN;

/** Does this match start with the figure (possibly currency-marked) rather than a keyword? */
function startsWithFigure(matched: string): boolean {
  return new RegExp(String.raw`^\s*${CURRENCY_PREFIX_PATTERN}\d`, "i").test(matched);
}

/**
 * Money from a match, normalized to USD.
 *
 * The currency is taken from the text immediately around the figure when it is
 * marked there, otherwise from the plan-level currency (the first currency the
 * plan names). An unmarked plan is read as USD — stated in the assumptions, not
 * assumed silently.
 */
function moneyUsd(
  t: string, m: RegExpMatchArray, numStr: string, unitStr: string | undefined, planCurrency: MoneyCurrency | null,
): number | null {
  const raw = parseMoney(numStr, unitStr);
  if (raw === null || !isFinite(raw)) return null;
  const at = m.index ?? 0;
  const near = t.slice(Math.max(0, at - 14), at + m[0].length + 16);
  return toUsd(raw, detectCurrency(near) ?? planCurrency);
}

export function parsePlanSignals(text: string): PlanSignals {
  const s = emptySignals();
  if (!text || !text.trim()) return s;
  const t = ` ${text.toLowerCase().replace(/\s+/g, " ")} `;

  // The currency the plan quotes in, established once from the first marker it
  // uses. Figures marked with a different currency still win locally; an
  // unmarked plan is read as USD and the engine discloses that assumption.
  const planCurrency = detectCurrencyFirst(t);
  s.currency = planCurrency;

  // ── Revenue: "$2M ARR" / "$500k MRR" / "$1.2m in revenue" / "arr of $3m" ──
  const arr = firstMatch(t, new RegExp(String.raw`${CUR}${NUM}\s*${UNIT}\s*(arr|mrr|in revenue|revenue|recurring revenue)`, "i"))
    || firstMatch(t, new RegExp(String.raw`(arr|mrr|revenue)\s*(?:of|=|:|at)?\s*${CUR}${NUM}\s*${UNIT}`, "i"));
  if (arr) {
    // group order differs between the two alternatives; detect which matched
    const hasLeadingNum = startsWithFigure(arr[0]);
    const numStr = hasLeadingNum ? arr[1] : arr[2];
    const unitStr = hasLeadingNum ? arr[2] : arr[3];
    const kindStr = (hasLeadingNum ? arr[3] : arr[1]) || "";
    const val = moneyUsd(t, arr, numStr, unitStr, planCurrency);
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
      s.growthPeriod = growthPeriodFromWords(p);
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
  const cac = firstMatch(t, new RegExp(String.raw`(?<!ltv[:/ ]{0,4})cac\s*(?:of|=|:|at|is)?\s*${CUR}${NUM}\s*${UNIT}`, "i"));
  if (cac) { const v = moneyUsd(t, cac, cac[1], cac[2], planCurrency); if (v && v > 0) s.cacUsd = v; }
  const ltv = firstMatch(t, new RegExp(String.raw`ltv\s*(?:of|=|:|at|is)?\s*${CUR}${NUM}\s*${UNIT}`, "i"));
  if (ltv) { const v = moneyUsd(t, ltv, ltv[1], ltv[2], planCurrency); if (v && v > 0) s.ltvUsd = v; }
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
      s.churnPeriod = ratePeriodFromWords(words);
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
  const tam = firstMatch(t, new RegExp(String.raw`(?:tam|total addressable market|addressable market)\s*(?:of|=|:|is|at)?\s*${CUR}${NUM}\s*${UNIT}`, "i"))
    || firstMatch(t, new RegExp(String.raw`${CUR}${NUM}\s*${UNIT}\s*(?:tam|addressable market)`, "i"));
  if (tam) {
    // detect group layout
    const lead = startsWithFigure(tam[0]) && !/^(tam|total|addressable)/i.test(tam[0].trim());
    const numStr = lead ? tam[1] : tam[1];
    const unitStr = lead ? tam[2] : tam[2];
    const v = moneyUsd(t, tam, numStr, unitStr, planCurrency);
    if (v && v > 0) s.bottomUpTamUsd = v;
  }

  // ── Patents / proprietary IP ──
  // "We have no patents and no proprietary technology" used to set this true,
  // and the engine then credited +0.1 moat realization for the patents it denied.
  s.mentionsPatent = mentionsUnnegated(t, /\b(patents?|patented|proprietary technolog(?:y|ies)|proprietary algorithms?|patent[- ]pending)\b/i);

  parseNonSaasEvidence(t, s);

  s.fieldsFound = countFields(s);

  return s;
}

/**
 * Evidence produced by business models that are not subscription software.
 *
 * Mutates `s` in place; `t` must already be lowercased and whitespace-collapsed.
 * Every claim goes through the negation layer, so "no regulatory approvals yet"
 * and "we have no backlog" cannot be read as achievements — the same mistake the
 * qualitative traction heuristic used to make.
 */
function parseNonSaasEvidence(t: string, s: PlanSignals): void {
  // ── Marketplace: GMV / gross bookings / TPV, and the take rate on it ──
  const gmv = firstMatch(t, new RegExp(String.raw`(?:gmv|gross merchandise (?:value|volume)|gross bookings|total payment volume|tpv|transaction volume|annualized volume)\s*(?:of|=|:|at|is|reached)?\s*${CUR}${NUM}\s*${UNIT}`, "i"))
    || firstMatch(t, new RegExp(String.raw`${CUR}${NUM}\s*${UNIT}\s*(?:in\s*)?(?:gmv|gross merchandise (?:value|volume)|gross bookings|tpv|transaction volume)`, "i"));
  if (gmv) { const v = moneyUsd(t, gmv, gmv[1], gmv[2], s.currency); if (v && v > 0) s.gmvUsd = v; }

  const take = firstMatch(t, new RegExp(String.raw`(?:take[- ]rate|commission(?: rate)?|net revenue margin)\s*(?:of|=|:|at|is)?\s*${NUM}\s*%`, "i"))
    || firstMatch(t, new RegExp(String.raw`${NUM}\s*%\s*(?:take[- ]rate|commission)`, "i"));
  if (take) { const v = parseFloat(take[1].replace(/,/g, "")); if (isFinite(v) && v > 0 && v <= 100) s.takeRatePct = v; }

  // Revenue the plan never stated directly but implied: GMV × take rate.
  if (s.revenueUsd === null && s.gmvUsd !== null && s.takeRatePct !== null) {
    s.revenueUsd = Math.round(s.gmvUsd * (s.takeRatePct / 100));
    s.revenueBasis = "revenue";
    s.mentionsRevenueNoNumber = false;
  }

  // ── Contracted but unrecognised revenue: backlog, order book, offtake ──
  // This is how defence, infrastructure, hardware and project-financed
  // businesses show demand. It is weaker than realised revenue and the engine
  // credits it as such — but reading it as "no traction" was plainly wrong.
  const backlogRe = String.raw`(?:backlog|order book|contracted revenue|committed revenue|signed contracts?|contract value|offtake(?: agreements?)?|framework agreements?|bookings|purchase orders?)`;
  const backlog = firstMatch(t, new RegExp(String.raw`${backlogRe}\s*(?:of|worth|totall?ing|=|:|at|is|stands at)?\s*${CUR}${NUM}\s*${UNIT}`, "i"))
    || firstMatch(t, new RegExp(String.raw`${CUR}${NUM}\s*${UNIT}\s*(?:in\s*)?${backlogRe}`, "i"));
  if (backlog && mentionsUnnegated(t, new RegExp(backlogRe, "i"))) {
    const v = moneyUsd(t, backlog, backlog[1], backlog[2], s.currency);
    if (v && v > 0) s.contractedRevenueUsd = v;
  }

  // ── Non-dilutive capital: grants, prizes, awarded public programmes ──
  const grantRe = String.raw`(?:non[- ]dilutive(?: funding| capital)?|grants?(?: funding)?|sbir|sttr|darpa|horizon europe|innovate uk|arpa-?e|prize)`;
  const grant = firstMatch(t, new RegExp(String.raw`${grantRe}\s*(?:of|worth|totall?ing|=|:|at|award(?:ed)?)?\s*${CUR}${NUM}\s*${UNIT}`, "i"))
    || firstMatch(t, new RegExp(String.raw`${CUR}${NUM}\s*${UNIT}\s*(?:in\s*)?${grantRe}`, "i"));
  if (grant && mentionsUnnegated(t, new RegExp(grantRe, "i"))) {
    const v = moneyUsd(t, grant, grant[1], grant[2], s.currency);
    if (v && v > 0) s.nonDilutiveUsd = v;
  }

  // ── Pilots, LOIs, design wins, deployments ──
  const pilots = firstMatch(t, new RegExp(String.raw`${NUM}\s*(?:paid\s*|active\s*|commercial\s*)?(?:pilots?|lois?|letters of intent|design wins?|deployments?|installations?|production sites?|customer trials?)`, "i"));
  if (pilots) {
    const v = parseFloat(pilots[1].replace(/,/g, ""));
    if (isFinite(v) && v >= 1 && v < 100000) s.pilots = Math.round(v);
  }

  // ── Regulatory milestones actually REACHED ──
  // "FDA approval expected in 2027" is a plan, not a milestone; the negation
  // layer plus the explicit past-tense wording keep those out.
  const REG: Array<[RegExp, string]> = [
    [/\b510\(k\)\s*(?:clearance|cleared)|fda\s*(?:clearance|cleared|approval|approved)|de novo (?:grant|authorization)|pma approval/i, "FDA clearance/approval"],
    [/\bbreakthrough (?:device|therapy) designation\b/i, "FDA breakthrough designation"],
    [/\bce mark(?:ed|ing)?\b|\bmdr certifi/i, "CE mark"],
    [/\bema approval|\bmhra approval/i, "EMA/MHRA approval"],
    [/\bphase\s*(?:iii|3)\b/i, "Phase 3 clinical"],
    [/\bphase\s*(?:ii|2)\b/i, "Phase 2 clinical"],
    [/\bphase\s*(?:i|1)\b(?!\w)/i, "Phase 1 clinical"],
    [/\bind (?:cleared|filed|accepted)\b/i, "IND cleared"],
    [/\b(?:faa|easa) (?:certifi\w+|type certificate|approval)\b/i, "Aviation authority certification"],
    [/\b(?:banking|e-?money|emi|money transmitter|payment institution|broker[- ]dealer|lending) licen[cs]e\b/i, "Financial licence held"],
    [/\bitar (?:registered|registration)|\bdefense contract awarded|\bidiq\b|\bota\b (?:award|contract)/i, "Defence contracting status"],
    [/\bgrid interconnection agreement|\bppa\b|\bpower purchase agreement\b/i, "Grid/PPA agreement"],
  ];
  for (const [re, label] of REG) {
    if (mentionsUnnegated(t, re) && !s.regulatoryMilestones.includes(label)) s.regulatoryMilestones.push(label);
  }

  // ── Technical validation ──
  const PROOF: Array<[RegExp, string]> = [
    [/\bpeer[- ]reviewed\b|\bpublished in (?:nature|science|nejm|the lancet|cell)\b/i, "Peer-reviewed result"],
    [/\bclinical(?:ly)? validat\w+|\bsensitivity\b.*\bspecificity\b|\b\d{2,3}% sensitivity\b/i, "Clinical validation data"],
    [/\bbenchmark(?:ed|s)?\b|\bstate[- ]of[- ]the[- ]art\b|\bsota\b|\boutperform\w*\b/i, "Benchmark result claimed"],
    [/\bpilot plant\b|\bproduction line\b|\bat scale in production\b|\bfactory (?:running|operational)\b/i, "Plant / production line running"],
    [/\bflight[- ]tested\b|\bfield[- ]tested\b|\bin operational use\b|\bdeployed (?:with|to) (?:customers|operators|units)\b/i, "Field / flight tested"],
    [/\bworking prototype\b|\bfunctional prototype\b|\bdemonstrat(?:ed|or) (?:unit|system|vehicle)\b/i, "Working prototype"],
  ];
  for (const [re, label] of PROOF) {
    if (mentionsUnnegated(t, re) && !s.technicalProof.includes(label)) s.technicalProof.push(label);
  }
}
