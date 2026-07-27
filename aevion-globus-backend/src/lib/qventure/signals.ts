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
  NUMBER_PATTERN, MONEY_UNIT_PATTERN, parseLocaleNumber, MONEY_MULTIPLIER, type RatePeriod,
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
  /**
   * Reservations and pre-orders — demand the customer can walk away from.
   *
   * Deliberately NOT merged into `pilots` or `contractedRevenueUsd`, and it
   * backs no factor: a reservation book is not a backlog, and hardware plans
   * lead with it precisely because it is the largest number they have. It is
   * parsed so the reader sees it and so the engine can say out loud that it is
   * uncommitted, rather than silently crediting it as traction.
   */
  reservations: number | null;
  /** Regulatory milestones the plan claims to have REACHED (not merely planned). */
  regulatoryMilestones: string[];
  /** Technical validation the plan claims: peer review, trial phase, benchmark, working plant. */
  technicalProof: string[];
  /** Internal contradictions in the plan's own figures — surfaced to the reader, not scored. */
  conflicts: string[];
  /** How the parser resolved an ambiguity, so the reader sees the choice and not only its result. */
  parseNotes: string[];

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

/** Same, for the one field that is legitimately negative: a below-cost margin. */
const marginOrNull = (v: unknown): number | null =>
  typeof v === "number" && isFinite(v) && v >= -100 && v <= 100 ? v : null;

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
  set("grossMarginPct", marginOrNull(f.grossMarginPct));
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
    pilots: null, reservations: null,
    regulatoryMilestones: [], technicalProof: [], conflicts: [], parseNotes: [],
    fieldsFound: 0,
  };
}

/** Compact USD label for the range notes ("$12k", "$1.5M"). */
function fmtUsdShort(n: number): string {
  return n >= 1e9 ? `$${Math.round((n / 1e9) * 10) / 10}B`
    : n >= 1e6 ? `$${Math.round((n / 1e6) * 10) / 10}M`
      : n >= 1e3 ? `$${Math.round(n / 1e3)}k`
        : `$${Math.round(n)}`;
}

/**
 * Both ends of a money range match, already converted to USD.
 * Returns null unless two figures parsed — a half-matched range must fall
 * through to the single-figure pattern rather than score half a band.
 */
function moneyRangeEnds(
  t: string, m: RegExpMatchArray, planCurrency: MoneyCurrency | null,
): { low: number; high: number } | null {
  const groups = m.slice(1).filter((g): g is string => typeof g === "string");
  const nums = groups.filter((g) => /^\d/.test(g));
  const units = groups.filter((g) => /^[a-zа-я]{1,8}$/i.test(g) && g.toLowerCase() in MONEY_MULTIPLIER);
  if (nums.length < 2) return null;
  const a = parseMoney(nums[0], units[0]);
  const b = parseMoney(nums[1], units[units.length - 1] ?? units[0]);
  if (!a || !b) return null;
  return { low: toUsd(Math.min(a, b), planCurrency), high: toUsd(Math.max(a, b), planCurrency) };
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
  // Tight window, and first-by-position inside it. A wide window scanned in
  // table order made "$1M ARR in the US and €2M ARR in the EU" convert the
  // dollar figure at the euro rate, because EUR is checked before USD.
  const tight = t.slice(Math.max(0, at - 8), at + m[0].length);
  return toUsd(raw, detectCurrencyFirst(tight) ?? planCurrency);
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

  detectRevenueRange(t, s, planCurrency);

  // ── Revenue: "$2M ARR" / "$500k MRR" / "$1.2m in revenue" / "arr of $3m" ──
  // "Net revenues of $87.9M" — the plural is how filings write it, and the
  // singular-only pattern matched "revenue" inside "revenues" and then failed on
  // the trailing "s", so the figure was dropped entirely. "Net sales" is the
  // same disclosure again under the name consumer-goods filings use.
  const REV_NOUN = String.raw`arr|mrr|recurring revenues?|revenues?|net sales|sales`;
  const arr = firstMatch(t, new RegExp(String.raw`${CUR}${NUM}\s*${UNIT}\s*(?:in\s*)?(${REV_NOUN})`, "i"))
    || firstMatch(t, new RegExp(String.raw`(?:net\s*|total\s*)?(${REV_NOUN})\s*(?:of|=|:|at|were|was)?\s*${CUR}${NUM}\s*${UNIT}`, "i"));
  if (arr) {
    // group order differs between the two alternatives; detect which matched
    const hasLeadingNum = startsWithFigure(arr[0]);
    const numStr = hasLeadingNum ? arr[1] : arr[2];
    const unitStr = hasLeadingNum ? arr[2] : arr[3];
    const kindStr = (hasLeadingNum ? arr[3] : arr[1]) || "";
    const val = moneyUsd(t, arr, numStr, unitStr, planCurrency);
    // A range already resolved this (at its low end) — the single-figure pattern
    // would otherwise overwrite it with whichever end of the range it matched.
    if (val && val > 0 && s.revenueUsd === null) {
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

  detectRevenueConflict(t, s, planCurrency);

  // ── Growth: "growing 20% MoM" / "30% month-over-month growth" / "up 15% MoM" ──
  // A bare "<n>% monthly" is NOT growth: "20% monthly churn" used to be read as
  // 20% MoM growth, handing a dying company +14 execution points for a metric it
  // never claimed. So a period word alone no longer qualifies — the match needs a
  // growth verb, the word "growth", or a growth-specific token (MoM/YoY/WoW).
  const PERIOD_WORD = String.raw`(mom|yoy|wow|month[- ]over[- ]month|year[- ]over[- ]year|week[- ]over[- ]week|monthly|annually|annual|yearly|per month|per year|per week)`;
  const NOT_ANOTHER_METRIC = String.raw`(?!\s*(?:churn|attrition|retention|margin|discount|fee|interest|refund|conversion))`;
  // A stated DECLINE was read as growth of the same size: "revenue declined 20%
  // year over year" set +20 and scored exactly like +20% growth, because the
  // bare "<n>% year-over-year" alternative below matches without looking at the
  // verb in front of it. That is not a dropped figure, it is an inverted one —
  // the worst reading available, and always in the company's favour. Checked
  // first so the decline wins the sentence.
  const DOWN = String.raw`(?:declin(?:ing|ed|e|es)|down|fell|falling|decreas(?:ing|ed|e|es)|contract(?:ing|ed)|shrank|shrunk|dropped)`;
  const decline = firstMatch(t, new RegExp(String.raw`${DOWN}\s*(?:by|at|of|to)?\s*${NUM}\s*%\s*${PERIOD_WORD}?${NOT_ANOTHER_METRIC}`, "i"));
  const growth = decline
    || firstMatch(t, new RegExp(String.raw`(?:grow(?:ing|th|s|n)?|up|increas(?:ing|ed|e)|expand(?:ing|ed))\s*(?:by|at|of|to)?\s*${NUM}\s*%\s*${PERIOD_WORD}?${NOT_ANOTHER_METRIC}`, "i"))
    || firstMatch(t, new RegExp(String.raw`${NUM}\s*%\s*${PERIOD_WORD}\s*(?:revenue\s*)?growth`, "i"))
    || firstMatch(t, new RegExp(String.raw`${NUM}\s*%\s*(mom|yoy|wow|month[- ]over[- ]month|year[- ]over[- ]year|week[- ]over[- ]week)${NOT_ANOTHER_METRIC}`, "i"));
  if (growth) {
    const groups = growth.slice(1).filter((g): g is string => typeof g === "string");
    const value = groups.find((g) => /^\d/.test(g));
    const g = value !== undefined ? parseLocaleNumber(value) : NaN;
    if (isFinite(g)) {
      s.growthPct = decline ? -g : g;
      const p = groups.filter((x) => !/^\d/.test(x)).join(" ").toLowerCase();
      s.growthPeriod = growthPeriodFromWords(p);
    }
  }

  // ── Gross margin: "80% gross margin" / "gross margin of 72%" / "70-80%" ──
  // A stated band is read at its low end, like a revenue range: the plan
  // disclosed a floor, and scoring the ceiling would credit a number it never
  // committed to. The choice is stated in the assumptions, not assumed.
  const gmRange = firstMatch(t, new RegExp(String.raw`gross\s*margins?\s*(?:of|=|:|at|are|is|between)?\s*\(?\s*${NUM}\s*%?\s*(?:-|–|—|to|and)\s*${NUM}\s*%`, "i"))
    || firstMatch(t, new RegExp(String.raw`${NUM}\s*%?\s*(?:-|–|—|to|and)\s*${NUM}\s*%\s*gross\s*margin`, "i"));
  if (gmRange) {
    const a = parseLocaleNumber(gmRange[1]);
    const b = parseLocaleNumber(gmRange[2]);
    if (isFinite(a) && isFinite(b) && Math.min(a, b) > 0 && Math.max(a, b) <= 100) {
      s.grossMarginPct = Math.min(a, b);
      s.parseNotes.push(`Gross margin was disclosed as a range (${Math.min(a, b)}–${Math.max(a, b)}%); the score uses the low end.`);
    }
  }
  // A NEGATIVE gross margin is the strongest thing a plan can disclose against
  // itself — it says every unit sold loses money. Until this read the sign, all
  // four ways of writing it ("-45%", "(45)%", "negative 45%", "minus 45%") were
  // dropped as unparseable, the factor fell back to the sector prior, and a
  // company selling below cost scored like an average one in its sector. The
  // sign is captured explicitly rather than inferred, and the range widened to
  // allow it.
  // The sign must touch the digit. An en/em dash is prose punctuation —
  // "Gross margin — 45%" is a positive margin behind a dash — so those
  // characters are deliberately NOT signs here, and a hyphen preceded by a digit
  // is a range separator ("70-80%"), not a minus. Getting this wrong would flip
  // a healthy margin negative, which is the same class of silent corruption in
  // the opposite direction.
  const NEG = String.raw`(-|−|minus\s+|negative\s+)?`;
  const NOT_RANGE = String.raw`(?<![\d.,])`;
  const gm = firstMatch(t, new RegExp(String.raw`${NOT_RANGE}${NEG}${NUM}\s*%\s*gross\s*margin`, "i"))
    || firstMatch(t, new RegExp(String.raw`gross\s*margins?\s*(?:of|=|:|at|are|is)?\s*${NEG}${NUM}\s*%`, "i"))
    || firstMatch(t, new RegExp(String.raw`gross\s*margins?\s*(?:of|=|:|at|are|is)?\s*(\()\s*${NUM}\s*\)\s*%`, "i"));
  // "Gross profit of $17.6 million, or 20% of net revenue" — a margin stated as
  // a share of revenue, which is how a filing writes it when it never uses the
  // words "gross margin".
  // The gap between "gross profit" and the percentage must be allowed to cross
  // a decimal point — "$17.6 million" sits in it — so the span is length-bounded
  // rather than punctuation-bounded, and the tail ("% of net revenue") is what
  // keeps it from reaching into an unrelated sentence.
  const gmShare = gm ? null : firstMatch(t, new RegExp(String.raw`gross\s*profit.{0,48}?${NEG}${NUM}\s*%\s*of\s*(?:net\s*|total\s*)?(?:revenues?|sales)`, "i"));
  if (gmShare && s.grossMarginPct === null) {
    const magnitude = parseLocaleNumber(gmShare[2]);
    if (isFinite(magnitude) && magnitude > 0 && magnitude <= 100) {
      s.grossMarginPct = gmShare[1] ? -magnitude : magnitude;
    }
  }
  if (gm && s.grossMarginPct === null) {
    const magnitude = parseLocaleNumber(gm[2]);
    const negative = Boolean(gm[1]);
    if (isFinite(magnitude) && magnitude > 0 && magnitude <= 100) {
      s.grossMarginPct = negative ? -magnitude : magnitude;
      if (negative) {
        s.parseNotes.push(`Gross margin was disclosed as negative (${s.grossMarginPct}%); it is scored at that sign, not as ${magnitude}%.`);
      }
    }
  }

  // ── LTV:CAC ratio stated directly: "LTV:CAC of 4:1" / "LTV/CAC 3.5" / "3-5x" ──
  // A band is read at the end that does NOT flatter the plan. For a ratio that
  // is the low end; for payback and churn below it is the HIGH end, because a
  // longer payback and a higher churn are the worse readings. "Low end" is not
  // the rule — "the conservative end" is.
  // "and" only counts after an explicit "between": without that guard,
  // "LTV:CAC of 8:1 and 6 month payback" parsed as the range 8–6 and scored the
  // deal on a ratio of 6 that belonged to the payback clause.
  const ratioRange = firstMatch(t, new RegExp(String.raw`ltv[:/ ]*cac\s*(?:of|=|:|at)?\s*${NUM}\s*(?:x|:\s*1)?\s*(?:-|–|—|to)\s*${NUM}\s*(?:x|:\s*1)?`, "i"))
    || firstMatch(t, new RegExp(String.raw`ltv[:/ ]*cac\s*(?:of|=|:|at)?\s*between\s*${NUM}\s*(?:x|:\s*1)?\s*and\s*${NUM}\s*(?:x|:\s*1)?`, "i"));
  if (ratioRange) {
    const a = parseLocaleNumber(ratioRange[1]);
    const b = parseLocaleNumber(ratioRange[2]);
    if (isFinite(a) && isFinite(b) && Math.min(a, b) > 0 && Math.max(a, b) < 100) {
      s.ltvCacRatio = Math.min(a, b);
      s.parseNotes.push(`LTV/CAC was disclosed as a range (${Math.min(a, b)}–${Math.max(a, b)}); the score uses the conservative end.`);
    }
  }
  const ratio = s.ltvCacRatio !== null ? null
    : firstMatch(t, new RegExp(String.raw`ltv[:/ ]*cac\s*(?:of|=|:|at)?\s*${NUM}\s*(?::\s*1)?`, "i"));
  if (ratio) {
    const r = parseLocaleNumber(ratio[1]);
    if (isFinite(r) && r > 0 && r < 100) s.ltvCacRatio = r;
  }
  // ── CAC / LTV absolute: "CAC of $400", "LTV $3,000" ──
  // The negative lookbehind stops "LTV/CAC 4.2" from also matching here and
  // reading the ratio's 4.2 as a $4.20 CAC — which was nonsense data and
  // inflated fieldsFound / signalCoverage with a metric the plan never disclosed.
  // Bands here run in opposite directions: a HIGHER CAC and a LOWER LTV are both
  // the worse reading, so "CAC $8-12k, LTV $40-60k" scores 12k against 40k —
  // the pessimistic corner of the box the plan drew, not its flattering one.
  const cacRange = firstMatch(t, new RegExp(String.raw`(?<!ltv[:/ ]{0,4})cac\s*(?:of|=|:|at|is)?\s*${CUR}${NUM}\s*${UNIT}\s*(?:-|–|—|to)\s*${CUR}${NUM}\s*${UNIT}`, "i"));
  if (cacRange) {
    const ends = moneyRangeEnds(t, cacRange, planCurrency);
    if (ends) { s.cacUsd = ends.high; s.parseNotes.push(`CAC was disclosed as a range (${fmtUsdShort(ends.low)}–${fmtUsdShort(ends.high)}); the score uses the higher, conservative end.`); }
  }
  const cac = s.cacUsd !== null ? null
    : firstMatch(t, new RegExp(String.raw`(?<!ltv[:/ ]{0,4})cac\s*(?:of|=|:|at|is)?\s*${CUR}${NUM}\s*${UNIT}`, "i"));
  if (cac) { const v = moneyUsd(t, cac, cac[1], cac[2], planCurrency); if (v && v > 0) s.cacUsd = v; }

  const ltvRange = firstMatch(t, new RegExp(String.raw`ltv\s*(?:of|=|:|at|is)?\s*${CUR}${NUM}\s*${UNIT}\s*(?:-|–|—|to)\s*${CUR}${NUM}\s*${UNIT}`, "i"));
  if (ltvRange) {
    const ends = moneyRangeEnds(t, ltvRange, planCurrency);
    if (ends) { s.ltvUsd = ends.low; s.parseNotes.push(`LTV was disclosed as a range (${fmtUsdShort(ends.low)}–${fmtUsdShort(ends.high)}); the score uses the lower, conservative end.`); }
  }
  const ltv = s.ltvUsd !== null ? null
    : firstMatch(t, new RegExp(String.raw`ltv\s*(?:of|=|:|at|is)?\s*${CUR}${NUM}\s*${UNIT}`, "i"));
  if (ltv) { const v = moneyUsd(t, ltv, ltv[1], ltv[2], planCurrency); if (v && v > 0) s.ltvUsd = v; }
  if (s.ltvCacRatio === null && s.cacUsd && s.ltvUsd && s.cacUsd > 0) {
    s.ltvCacRatio = Math.round((s.ltvUsd / s.cacUsd) * 10) / 10;
  }

  // ── Payback: "payback of 8 months" / "8-month payback" ──
  // A payback band takes the LONGER end — the conservative reading of a range is
  // the one that is worse for the plan, and "9-12 months" promises 12.
  const pbRange = firstMatch(t, new RegExp(String.raw`payback\s*(?:period)?\s*(?:of|=|:|at|is|between)?\s*${NUM}\s*(?:-|–|—|to|and)\s*${NUM}\s*[- ]?months?`, "i"))
    || firstMatch(t, new RegExp(String.raw`${NUM}\s*(?:-|–|—|to|and)\s*${NUM}\s*[- ]?months?\s*payback`, "i"));
  if (pbRange) {
    const a = parseLocaleNumber(pbRange[1]);
    const b = parseLocaleNumber(pbRange[2]);
    if (isFinite(a) && isFinite(b) && Math.min(a, b) > 0 && Math.max(a, b) < 240) {
      s.paybackMonths = Math.max(a, b);
      s.parseNotes.push(`Payback was disclosed as a range (${Math.min(a, b)}–${Math.max(a, b)} months); the score uses the longer, conservative end.`);
    }
  }
  const pb = s.paybackMonths !== null ? null
    : firstMatch(t, new RegExp(String.raw`payback\s*(?:period)?\s*(?:of|=|:|at|is)?\s*${NUM}\s*[- ]?months?`, "i"))
    || firstMatch(t, new RegExp(String.raw`${NUM}\s*[- ]?months?\s*payback`, "i"));
  if (pb) { const v = parseLocaleNumber(pb[1]); if (isFinite(v) && v > 0 && v < 240) s.paybackMonths = v; }

  // ── Churn / retention / NRR ──
  // The period matters as much as the number: "4% annual churn" is excellent,
  // "4% churn" read as monthly is ~39%/yr. Capture whichever side states it.
  // A churn band takes the HIGHER end for the same reason payback takes the
  // longer one: "2-3% monthly churn" promises 3%, and reading 2% would score a
  // company on the best month it ever had.
  const churnRange = firstMatch(t, new RegExp(String.raw`${NUM}\s*%?\s*(?:-|–|—|to|and)\s*${NUM}\s*%\s*(monthly|quarterly|annual(?:ised|ized)?|yearly|weekly)?\s*churn`, "i"))
    || firstMatch(t, new RegExp(String.raw`(monthly|quarterly|annual(?:ised|ized)?|yearly|weekly)?\s*churn\s*(?:of|=|:|at|is|between)?\s*${NUM}\s*%?\s*(?:-|–|—|to|and)\s*${NUM}\s*%`, "i"));
  if (churnRange) {
    const groups = churnRange.slice(1).filter((g): g is string => typeof g === "string");
    const nums = groups.filter((g) => /^\d/.test(g)).map(parseLocaleNumber);
    const words = groups.filter((g) => !/^\d/.test(g)).join(" ");
    if (nums.length >= 2 && nums.every((n) => isFinite(n)) && Math.max(...nums) <= 100) {
      s.churnPct = Math.max(...nums);
      // "Churn of 2-3% monthly" puts the period after the phrase, so also read
      // the words just past the match before falling back to "unspecified".
      const at = (churnRange.index ?? 0) + churnRange[0].length;
      s.churnPeriod = ratePeriodFromWords(words) !== "unspecified"
        ? ratePeriodFromWords(words)
        : ratePeriodFromWords(t.slice(at, at + 18));
      s.churnMonthlyPct = monthlyChurnFrom(s.churnPct, s.churnPeriod);
      s.parseNotes.push(`Churn was disclosed as a range (${Math.min(...nums)}–${Math.max(...nums)}%); the score uses the higher, conservative end.`);
    }
  }
  const churn = s.churnPct !== null ? null
    : firstMatch(t, new RegExp(String.raw`(?:(monthly|quarterly|annual(?:ised|ized)?|yearly|weekly)\s+)?${NUM}\s*%\s*(monthly|quarterly|annual(?:ised|ized)?|yearly|weekly)?\s*churn(?:\s*(?:per|a|\/)\s*(month|quarter|year|week))?`, "i"))
    || firstMatch(t, new RegExp(String.raw`(monthly|quarterly|annual(?:ised|ized)?|yearly|weekly)?\s*churn\s*(?:rate)?\s*(?:of|=|:|at|is)?\s*\(?\s*${NUM}\s*%\s*(?:(?:per|a|\/)\s*(month|quarter|year|week))?`, "i"));
  if (churn) {
    const groups = churn.slice(1).filter((g): g is string => typeof g === "string");
    const value = groups.find((g) => /^\d/.test(g));
    const v = value !== undefined ? parseLocaleNumber(value) : NaN;
    if (isFinite(v) && v >= 0 && v <= 100) {
      const words = groups.filter((g) => !/^\d/.test(g)).join(" ").toLowerCase();
      s.churnPct = v;
      s.churnPeriod = ratePeriodFromWords(words);
      s.churnMonthlyPct = monthlyChurnFrom(v, s.churnPeriod);
    }
  }
  // Filings do not agree on a name for this number. "Net revenue retention",
  // "net dollar expansion rate", "dollar-based net retention rate" and "NDR" are
  // the same disclosure, and the word "rate" sits between the name and the
  // figure often enough that omitting it dropped the standard S-1 phrasing.
  const RET_NAME = String.raw`(?:dollar[- ]based\s*)?(?:net\s*)?(?:revenue\s*|dollar\s*)?(?:retention|expansion)|nrr|ndr`;
  const ret = firstMatch(t, new RegExp(String.raw`${NUM}\s*%\s*(?:${RET_NAME})`, "i"))
    || firstMatch(t, new RegExp(String.raw`(?:${RET_NAME})\s*(?:rate)?\s*(?:of|=|:|at|is|was)?\s*\(?\s*${NUM}\s*%`, "i"));
  if (ret) { const v = parseLocaleNumber(ret[1]); if (isFinite(v) && v > 0 && v <= 500) s.retentionPct = v; }

  // ── Customers / users: "10,000 customers" / "1,200 paying users" ──
  // Not every business calls them customers: a workspace operator discloses
  // memberships, a marketplace sellers, a platform accounts or stores. Reading
  // only the SaaS nouns made those filings look like plans with no customer
  // disclosure at all.
  // Filings qualify the noun: "511,202 Connected Fitness Subscribers", "1,200
  // paying enterprise customers". Up to three qualifying words are allowed
  // between the count and the noun — but not a preposition, which means the
  // count belongs to a different clause ("$144.1M on marketing to acquire
  // customers" must not read as 144 million customers), and not a figure that
  // carries a currency symbol.
  const NOT_MONEY = String.raw`(?<![$€£₽₸¥])`;
  const CUST_QUALIFIER = String.raw`(?:(?!on\s|of\s|in\s|to\s|for\s|from\s|with\s|at\s|by\s|per\s)[a-z]+\s+){0,3}`;
  const CUST_NOUN = String.raw`customers|users|clients|subscribers|merchants|seats|members|memberships|accounts|stores|sellers|tenants`;
  const cust = firstMatch(t, new RegExp(String.raw`${NOT_MONEY}${NUM}\s*${UNIT}\s*(?:paying\s*|active\s*)?${CUST_QUALIFIER}(?:${CUST_NOUN})`, "i"));
  if (cust) {
    const v = parseMoney(cust[1], cust[2]);
    if (v && v >= 1) s.customers = Math.round(v);
  }

  // ── Bottom-up TAM: "TAM of $12B" / "$500M TAM" / "addressable market of $8B" ──
  // A TAM band ("$5-10B") reads at the low end too. Here it matters more than
  // elsewhere: the market factor is log-scaled and an inflated TAM is one of the
  // engine's red flags, so quietly taking the ceiling would flatter the plan on
  // the one number founders are most tempted to stretch.
  const tamRange = firstMatch(t, new RegExp(String.raw`(?:tam|total addressable market|addressable market)\s*(?:of|=|:|is|at|between)?\s*${CUR}${NUM}\s*${UNIT}\s*(?:-|–|—|to|and)\s*${CUR}${NUM}\s*${UNIT}`, "i"))
    // Numbers first, keyword after ("€2B to €4B TAM") — without this the
    // single-figure pattern matched the SECOND figure and took the ceiling.
    || firstMatch(t, new RegExp(String.raw`(?:between\s*)?${CUR}${NUM}\s*${UNIT}\s*(?:-|–|—|to|and)\s*${CUR}${NUM}\s*${UNIT}\s*(?:tam|addressable market)`, "i"));
  if (tamRange) {
    const groups = tamRange.slice(1).filter((g): g is string => typeof g === "string");
    const nums = groups.filter((g) => /^\d/.test(g));
    const units = groups.filter((g) => /^[a-zа-я]{1,8}$/i.test(g) && g.toLowerCase() in MONEY_MULTIPLIER);
    if (nums.length >= 2) {
      const a = parseMoney(nums[0], units[0]);
      const b = parseMoney(nums[1], units[units.length - 1] ?? units[0]);
      if (a && b) {
        const low = toUsd(Math.min(a, b), planCurrency);
        const high = toUsd(Math.max(a, b), planCurrency);
        s.bottomUpTamUsd = low;
        const fmt = (n: number) => (n >= 1e9 ? `$${Math.round((n / 1e9) * 10) / 10}B` : `$${Math.round(n / 1e6)}M`);
        s.parseNotes.push(`Bottom-up TAM was disclosed as a range (${fmt(low)}–${fmt(high)}); the score uses the low end.`);
      }
    }
  }
  const tam = s.bottomUpTamUsd !== null ? null
    : firstMatch(t, new RegExp(String.raw`(?:tam|total addressable market|addressable market)\s*(?:of|=|:|is|at)?\s*${CUR}${NUM}\s*${UNIT}`, "i"))
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
 * Two different revenue figures stated as present fact.
 *
 * The parser takes the first match, so a deck claiming "$2M ARR" on one page and
 * "$5M ARR" on another was scored on $2M with nothing said about the other
 * number. Which figure is right is not the tool's call — that the plan
 * contradicts itself is a diligence finding on its own, and it is surfaced as
 * text rather than scored, because the honest response is "reconcile these",
 * not a silent deduction.
 *
 * Forward-looking figures are not contradictions: "$2M today, targeting $5M by
 * year end" is a plan, so a figure introduced by a projection word is skipped.
 */
function detectRevenueRange(t: string, s: PlanSignals, planCurrency: MoneyCurrency | null): void {
  if (s.revenueUsd !== null) return;
  const KIND = String.raw`(arr|mrr|recurring revenue|in revenue|revenue)`;
  const SPAN = String.raw`${CUR}${NUM}\s*${UNIT}\s*(?:-|–|—|to|and)\s*${CUR}${NUM}\s*${UNIT}`;
  const m = firstMatch(t, new RegExp(String.raw`${KIND}\s*(?:of|is|at|:|between)?\s*${SPAN}`, "i"))
    || firstMatch(t, new RegExp(String.raw`(?:between\s*)?${SPAN}\s*(?:in\s*)?${KIND}`, "i"));
  if (!m) return;
  const groups = m.slice(1).filter((g): g is string => typeof g === "string");
  const nums = groups.filter((g) => /^\d/.test(g));
  if (nums.length < 2) return;
  const units = groups.filter((g) => /^[a-zа-я]{1,8}$/i.test(g) && g.toLowerCase() in MONEY_MULTIPLIER);
  const a = parseMoney(nums[0], units[0]);
  const b = parseMoney(nums[1], units[units.length - 1] ?? units[0]);
  if (!a || !b) return;
  const low = toUsd(Math.min(a, b), planCurrency);
  const high = toUsd(Math.max(a, b), planCurrency);
  const isMrr = /mrr/i.test(m[0]);
  s.revenueUsd = isMrr ? low * 12 : low;
  s.revenueBasis = isMrr ? "MRR" : /arr/i.test(m[0]) ? "ARR" : "revenue";
  s.mentionsRevenueNoNumber = false;
  const fmt = (n: number) => (n >= 1e6 ? `$${Math.round((n / 1e6) * 10) / 10}M` : `$${Math.round(n / 1e3)}k`);
  s.parseNotes.push(`Revenue was disclosed as a range (${fmt(low)}–${fmt(high)}); the score uses the low end.`);
}

/**
 * Two different revenue figures stated as present fact — see below. This one
 * handles the honest cousin of that problem: a plan that gives a range rather
 * than a point. It used to be dropped in silence, because the revenue pattern
 * wants one figure, so a founder who was open about uncertainty scored as if
 * nothing had been disclosed at all. Read at the low end (the diligence
 * convention) with the choice stated in the assumptions.
 */
function detectRevenueConflict(t: string, s: PlanSignals, planCurrency: MoneyCurrency | null): void {
  if (s.revenueUsd === null) return;
  // Forward INTENT, not the noun. "in this plan:" must not silence the check —
  // the smoke run caught exactly that: a bare "plan" swallowed a real
  // contradiction because the sentence happened to use the word.
  const FORWARD = /\b(target|targets|targeting|goal|expects?|expected|expecting|forecasts?|forecasting|projected|projection|projections|planned|planning|plans to|plan to|aims? to|intends? to|will (?:reach|hit|grow|be)|by (?:year[- ]end|the end of|20\d\d)|next year|run[- ]rate exit|ambition)\b/;
  const re = new RegExp(String.raw`${CUR}${NUM}\s*${UNIT}\s*(arr|mrr|in revenue|revenue|recurring revenue)`, "gi");
  const seen = new Set<number>();
  const stated: number[] = [];
  for (const m of t.matchAll(re)) {
    const at = m.index ?? 0;
    if (FORWARD.test(t.slice(Math.max(0, at - 60), at))) continue;
    const val = moneyUsd(t, m as RegExpMatchArray, m[1], m[2], planCurrency);
    if (!val || val <= 0) continue;
    const annual = /mrr/i.test(m[3] || "") ? val * 12 : val;
    const key = Math.round(annual);
    if (seen.has(key)) continue;
    seen.add(key);
    stated.push(annual);
  }
  if (stated.length < 2) return;
  const lo = Math.min(...stated), hi = Math.max(...stated);
  // Rounding of the same figure ("$2M" and "$2.0M") is not a contradiction.
  if (hi / lo < 1.2) return;
  const fmt = (n: number) => (n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${Math.round(n / 1e3)}k`);
  s.conflicts.push(`Plan states more than one current revenue figure (${stated.slice(0, 3).map(fmt).join(" and ")}) — scored on ${fmt(s.revenueUsd)}; reconcile before relying on either.`);
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
  // "Gross transaction value" (and GTV) is what a delivery or travel
  // marketplace calls the same number outside US filings — Deliveroo's
  // prospectus leads with it, and the engine read it as no marketplace
  // disclosure at all.
  const GMV_NOUN = String.raw`gmv|gtv|gross merchandise (?:value|volume)|gross transaction value|gross bookings|total payment volume|tpv|transaction volume|annualized volume`;
  const gmv = firstMatch(t, new RegExp(String.raw`(?:${GMV_NOUN})\s*(?:of|=|:|at|is|reached)?\s*${CUR}${NUM}\s*${UNIT}`, "i"))
    || firstMatch(t, new RegExp(String.raw`${CUR}${NUM}\s*${UNIT}\s*(?:in\s*)?(?:${GMV_NOUN})`, "i"));
  if (gmv) { const v = moneyUsd(t, gmv, gmv[1], gmv[2], s.currency); if (v && v > 0) s.gmvUsd = v; }

  const take = firstMatch(t, new RegExp(String.raw`(?:take[- ]rate|commission(?: rate)?|net revenue margin)\s*(?:of|=|:|at|is)?\s*${NUM}\s*%`, "i"))
    || firstMatch(t, new RegExp(String.raw`${NUM}\s*%\s*(?:take[- ]rate|commission)`, "i"));
  if (take) { const v = parseLocaleNumber(take[1]); if (isFinite(v) && v > 0 && v <= 100) s.takeRatePct = v; }

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
    const v = parseLocaleNumber(pilots[1]);
    if (isFinite(v) && v >= 1 && v < 100000) s.pilots = Math.round(v);
  }
  // Units actually delivered are the hardware equivalent of a deployment count,
  // and the exact fact that separates a shipping hardware company from one with
  // a reservation book. Only counted when the sentence says they reached a
  // customer, so a production-capacity figure is not read as demand.
  if (s.pilots === null) {
    const delivered = firstMatch(t, new RegExp(String.raw`${NUM}\s+(?:[A-Za-z]+\s+){0,2}(?:sold|delivered|shipped)\s+to\s+(?:customers|clients|operators)`, "i"))
      || firstMatch(t, new RegExp(String.raw`${NUM}\s*(?:units|vehicles|systems|devices)\s+(?:sold|delivered|shipped)`, "i"));
    if (delivered) {
      const v = parseLocaleNumber(delivered[1]);
      if (isFinite(v) && v >= 1 && v < 100000) {
        s.pilots = Math.round(v);
        s.parseNotes.push(`${s.pilots} units disclosed as delivered to customers are counted as deployments.`);
      }
    }
  }

  // ── Reservations / pre-orders — read, but kept apart from committed demand ──
  const resv = firstMatch(t, new RegExp(String.raw`${NUM}\s*${UNIT}\s*(?:reservations?|pre[- ]?orders?|orders? reserved|non[- ]binding orders?)`, "i"))
    || firstMatch(t, new RegExp(String.raw`(?:reservations?|pre[- ]?orders?)\s*(?:for|of|totalling|totaling)?\s*(?:approximately\s*)?${NUM}\s*${UNIT}`, "i"));
  if (resv) {
    const v = parseMoney(resv[1], resv[2]);
    if (v && v >= 1 && v < 1e9) s.reservations = Math.round(v);
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
