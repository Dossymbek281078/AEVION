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

/**
 * What a disclosed growth rate applies to. A rate is meaningless without it:
 * "up 77%" next to GMV and "up 93%" next to revenue are different facts, and
 * reporting one under the other's name is a wrong number, not a missing one.
 */
export type GrowthBasis = "revenue" | "gmv" | "customers" | "unspecified";

/** Churn quoted over `period`, expressed as a monthly rate. */
export const monthlyChurnFrom = monthlyRateFrom;

export interface PlanSignals {
  revenueUsd: number | null;
  /** How revenue was stated (MRR is annualized ×12 into revenueUsd). */
  revenueBasis: "ARR" | "MRR" | "revenue" | null;
  growthPct: number | null;
  growthPeriod: "MoM" | "YoY" | "WoW" | "unspecified" | null;
  /** Which metric the growth rate describes — see GrowthBasis. */
  growthBasis: GrowthBasis;
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
  /**
   * Physical capacity already built and running, in megawatts. For a solar,
   * storage or grid company this is the business — it is what the contracted
   * revenue is earned on — and there was no field for it, so such a plan read
   * as a customer count and nothing else.
   *
   * POWER only. A first attempt at this reader took "16 GWh of installed
   * capacity" as 16,000 MW: GWh is energy and GW is power, Northvolt's own
   * fixture in this corpus states its factory in GWh, and the naive unit list
   * would have introduced a thousand-fold error while closing a miss. Energy
   * units are rejected outright rather than converted, because converting them
   * needs a duration the plan rarely states.
   *
   * Backs no factor yet, like `reservations`: whether delivered infrastructure
   * should move a score the way revenue does is a rubric decision that needs
   * calibration, not a regex. It is parsed so the reader sees it.
   */
  capacityDeployedMw: number | null;
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

  /**
   * The text path rejects impossible figures — churn above 100%, retention
   * above 500% — and the structured path did not, so 250% monthly churn or 900%
   * retention supplied as "exact" numbers were scored as facts. The precise
   * input is meant to be MORE trustworthy than a regex, not less, so it gets
   * the same bounds.
   */
  const bounded = (v: unknown, min: number, max: number): number | null =>
    typeof v === "number" && isFinite(v) && v >= min && v <= max ? v : null;

  // Growth is legitimately negative — a plan that is shrinking. The prose path
  // reads "revenue declined 20%" and the structured path dropped -20 entirely,
  // the same asymmetry that made a below-cost margin unstateable in exact form.
  const set = <K extends keyof PlanSignals>(key: K, v: number | null) => { if (v !== null) (s[key] as number | null) = v; };
  set("growthPct", bounded(f.growthPct, -100, 100_000));
  if (f.growthPct != null && f.growthPeriod) s.growthPeriod = f.growthPeriod;
  set("grossMarginPct", marginOrNull(f.grossMarginPct));
  set("cacUsd", numOrNull(f.cacUsd));
  set("ltvUsd", numOrNull(f.ltvUsd));
  set("ltvCacRatio", numOrNull(f.ltvCacRatio));
  set("paybackMonths", bounded(f.paybackMonths, 0, 240));
  const churnIn = bounded(f.churnPct, 0, 100);
  if (churnIn !== null) {
    s.churnPct = churnIn;
    s.churnPeriod = f.churnPeriod ?? "unspecified";
    s.churnMonthlyPct = monthlyChurnFrom(churnIn, s.churnPeriod);
  }
  set("retentionPct", bounded(f.retentionPct, 0, 500));
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
    growthBasis: "unspecified",
    grossMarginPct: null, cacUsd: null, ltvUsd: null, ltvCacRatio: null,
    paybackMonths: null, churnPct: null, churnPeriod: null, churnMonthlyPct: null,
    retentionPct: null, customers: null,
    bottomUpTamUsd: null, mentionsRevenueNoNumber: false, mentionsPatent: false, currency: null,
    gmvUsd: null, takeRatePct: null, contractedRevenueUsd: null, nonDilutiveUsd: null,
    pilots: null, reservations: null, capacityDeployedMw: null,
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

/**
 * Is the thing matched at `at` stated as ACHIEVED, rather than intended?
 *
 * An explicit achievement word wins outright; otherwise an intention marker
 * anywhere in the same clause disqualifies it. Clause-bounding is what lets
 * "FDA clearance granted; we expect launch in 2027" keep its clearance — the
 * intention is in the next clause and is about something else.
 *
 * Shared, because the same distinction decides a regulatory milestone and a
 * megawatt already in the ground, and writing it twice is how the two would
 * drift apart.
 */
const ACHIEVED_WORD = /\b(?:granted|received|obtained|awarded|cleared|certified|approved|issued|secured|holds?|complete[d]?|executed|signed|registered|delivered|operating|in hand)\b/i;
const INTENDED_WORD = /\b(?:expect\w*|anticipat\w*|plan(?:s|ning)?\s+to|plans\b|intend\w*|pursu\w+|seeking|applying for|applied for|application pending|targeting|aims? to|will\s+(?:be|seek|file|submit|apply|deploy|have)|may\s+(?:apply|seek|obtain|file|become|need|be granted)|in the future|to submit|to file|once|upon|plan(?:ned)? for|plan|by 20\d\d)\b/i;
function statedAsAchieved(text: string, at: number, len: number): boolean {
  const from = Math.max(text.lastIndexOf(".", at), text.lastIndexOf(";", at)) + 1;
  const ends = [text.indexOf(".", at + len), text.indexOf(";", at + len)].filter((i) => i !== -1);
  const clause = text.slice(from, ends.length ? Math.min(...ends) : text.length);
  return ACHIEVED_WORD.test(clause) || !INTENDED_WORD.test(clause);
}

/** The year a match's own clause is about, or null. Bounded to the clause so a
 *  date from a neighbouring sentence cannot date this figure. */
function clauseYearAt(text: string, at: number, len: number): number | null {
  const from = Math.max(text.lastIndexOf(".", at), text.lastIndexOf(";", at)) + 1;
  const afterDot = text.indexOf(".", at + len);
  const to = afterDot === -1 ? text.length : afterDot;
  const years = [...text.slice(from, to).matchAll(/(?:19|20)[0-9]{2}/g)].map((m) => Number(m[0]));
  return years.length ? Math.max(...years) : null;
}

/**
 * Like `firstMatch`, except that when the plan states the same metric for more
 * than one DATED period it returns the latest rather than the first typed.
 *
 * Every field used `firstMatch`, so "churn of 8% in 2019, churn of 3% in 2020"
 * scored 8% — a figure the same document supersedes two sentences later. It is
 * an accident of where the matcher stops, not a reading, and it ran through all
 * eight metric fields. Identical to `firstMatch` unless two or more matches
 * carry different years, so undated plans are untouched.
 */
function latestMatch(text: string, re: RegExp, s: PlanSignals, label: string): RegExpMatchArray | null {
  const global = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  const found = [...text.matchAll(global)].map((m) => ({ m: m as RegExpMatchArray, year: clauseYearAt(text, m.index ?? 0, m[0].length) }));
  if (!found.length) return null;
  const dated = found.filter((f) => f.year !== null);
  if (dated.length >= 2) {
    const latest = dated.reduce((a, b) => ((b.year as number) > (a.year as number) ? b : a));
    if (latest.m !== found[0].m) {
      s.parseNotes.push(`More than one period was disclosed for ${label}; the score uses the latest (${latest.year}).`);
      return latest.m;
    }
  }
  return found[0].m;
}

// Number + money-unit patterns come from the platform metric primitives, which
// carry the `(?![a-z])` guard that stops "LTV $2, monthly" reading as $2 million.
const NUM = NUMBER_PATTERN;
/**
 * Every name a plan gives the top line. Module-scoped on purpose: the revenue
 * parser and the contradiction check below must read the SAME set, and they
 * had already drifted — the check knew only "$5M ARR" and never the
 * "Revenue of $5M" form the parser has supported all along, so a plan stating
 * two different revenue figures in the ordinary phrasing raised nothing.
 */
const REV_NOUN = String.raw`arr|mrr|recurring revenues?|revenues?|net sales|sales|in[- ]force premiums?|gross written premiums?|gwp`;
/**
 * Forward-looking INTENT, not a noun. A plan that says it TARGETS $20M ARR
 * next year has not earned $20M, and the revenue parser read it as if it had —
 * an aspiration scored as achieved traction, always in the plan's favour. The
 * contradiction check below already knew this test; the parser never asked it.
 */
const FORWARD = /\b(target|targets|targeting|goal|expects?|expected|expecting|forecasts?|forecasting|projected|projection|projections|planned|planning|plans to|plan to|aims? to|intends? to|will (?:reach|hit|grow|be)|by (?:year[- ]end|the end of|20\d\d)|next year|run[- ]rate exit|ambition)\b/;

/**
 * Is the figure at `at` sitting behind forward-looking intent — in ITS OWN
 * clause? The window must stop at the previous sentence, or "we target $20M
 * next year. Revenue of $5M today." suppresses the $5M as well, which trades
 * one wrong reading for another.
 */
function forwardLooking(text: string, at: number): boolean {
  const before = text.slice(Math.max(0, at - 90), at);
  const clause = before.slice(Math.max(before.lastIndexOf("."), before.lastIndexOf(";")) + 1);
  return FORWARD.test(clause);
}
/**
 * A level stated after a direction verb: "churn fell to 3%", "retention
 * declined to 85%", "margin improved to 62%", "churn improved from 8% to 3%".
 *
 * Every metric pattern below already accepted `of / = / : / at` between the
 * metric's name and its figure. None accepted this, so seven fields out of
 * eight dropped the number outright whenever a filing said which way it had
 * moved — and filings say that constantly. The intermediate figure in
 * "from X to Y" is matched non-capturing, because the current value is Y.
 */
const DIR_VERB = String.raw`(?:fell|fallen|declin(?:ed|ing)|decreas(?:ed|ing)|dropped|improv(?:ed|ing)|rose|risen|grew|grown|increas(?:ed|ing)|expand(?:ed|ing)|lengthened|shortened|narrowed|widened|climbed|slipped)`;
/**
 * What may sit between the direction verb and "to". Filings write "decreased by
 * $14.3 million, or 13%, to $99.6 million", so the span cannot be nothing — but
 * it must not be a free run of text either. A permissive span was tried and
 * reverted: it let "gross margin declined to 20% and churn rose to 7%" carry
 * the margin's reader across the conjunction and read the churn figure.
 * Amount-shaped tokens only means a conjunction, or another metric's name, ends
 * the span by construction rather than by a length guess.
 */
const AMOUNT_BIT = String.raw`(?:(?:by|or|from|of)\s+)?[$€£₸₽¥]?\d[\d,.]*\s*(?:%|million|billion|bn|m|k)?\s*,?\s*`;
const TO_LEVEL = String.raw`(?:${DIR_VERB}\s+(?:${AMOUNT_BIT}){0,3}?(?:back\s+)?to)`;
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
  // Skip any figure sitting behind forward-looking intent: "we target $20M ARR
  // next year" is a plan, not a disclosure, and reading it as current revenue
  // hands the deck credit for money it has not made.
  const notForward = (m: RegExpMatchArray | null): RegExpMatchArray | null => {
    if (!m) return null;
    const at = m.index ?? 0;
    return forwardLooking(t, at) ? null : m;
  };
  /**
   * The year a figure's own clause is about. Bounded to the clause so a date
   * from a neighbouring sentence cannot date this figure.
   */
  const clauseYear = (at: number, len: number): number | null => {
    const from = Math.max(t.lastIndexOf(".", at), t.lastIndexOf(";", at)) + 1;
    const afterDot = t.indexOf(".", at + len);
    const to = afterDot === -1 ? t.length : afterDot;
    const years = [...t.slice(from, to).matchAll(/(?:19|20)[0-9]{2}/g)].map((m) => Number(m[0]));
    return years.length ? Math.max(...years) : null;
  };
  const statedCandidates = (pattern: string) => {
    const out: Array<{ m: RegExpMatchArray; year: number | null }> = [];
    for (const m of t.matchAll(new RegExp(pattern, "gi"))) {
      const kept = notForward(m as RegExpMatchArray);
      if (kept) out.push({ m: kept, year: clauseYear(kept.index ?? 0, kept[0].length) });
    }
    return out;
  };
  /**
   * When a plan discloses the same metric for more than one period, the LATER
   * one is the company as it stands — "in-force premium of $116M in 2019" and
   * "$133M as of Q1 2020" are both true, and scoring 2019 because it was typed
   * first is an accident of the regex, not a reading. Order of the two shapes
   * still decides when nothing dates the figures, so ordinary plans are
   * unaffected, and the choice is stated rather than made silently.
   */
  const candidates = [
    ...statedCandidates(String.raw`${CUR}${NUM}\s*${UNIT}\s*(?:in\s*)?(${REV_NOUN})`),
    ...statedCandidates(String.raw`(?:net\s*|total\s*)?(${REV_NOUN})\s*(?:of|=|:|at|were|was|${TO_LEVEL})?\s*${CUR}${NUM}\s*${UNIT}`),
  ];
  let arr: RegExpMatchArray | null = candidates[0]?.m ?? null;
  const dated = candidates.filter((c) => c.year !== null);
  if (dated.length >= 2) {
    const latest = dated.reduce((a, b) => ((b.year as number) > (a.year as number) ? b : a));
    if (latest.m !== arr) {
      arr = latest.m;
      s.parseNotes.push(`More than one period was disclosed for the top line; the score uses the latest (${latest.year}).`);
    }
  }
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
      // The abbreviation was recognised and the words were not: "monthly
      // recurring revenue of $500k" and "revenue of $500k per month" both
      // parsed as $500k of ANNUAL revenue — the same figure understated
      // twelvefold, on the phrasing an early-stage plan is most likely to use.
      // The clause around the match decides, not the captured noun alone.
      const at = arr.index ?? 0;
      const around = t.slice(Math.max(0, at - 30), at + arr[0].length + 20);
      const monthly = /\bmrr\b/i.test(kindStr)
        || /\bmonthly\s+recurring\b/i.test(around)
        || /\b(?:per|a)\s+month\b|\/\s*mo(?:nth)?\b/i.test(around);
      s.revenueUsd = monthly ? val * 12 : val;
      s.revenueBasis = monthly ? "MRR" : /arr/i.test(kindStr) ? "ARR" : "revenue";
      if (monthly && !/\bmrr\b/i.test(kindStr)) {
        s.parseNotes.push(`The top line was disclosed monthly (${fmtUsdShort(val)}); the score uses the annualized figure (${fmtUsdShort(val * 12)}).`);
      }
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
  // A filing states the size before the rate — "decreased by $14.3 million, or
  // 13%, to $99.6 million" — so the same amount-shaped span the level connector
  // uses lets that through without letting a conjunction through.
  const decline = firstMatch(t, new RegExp(String.raw`${DOWN}\s*(?:${AMOUNT_BIT}){0,2}?(?:by|at|of|to|or)?\s*(?<![0-9.])${NUM}\s*%\s*${PERIOD_WORD}?${NOT_ANOTHER_METRIC}`, "i"));

  // A growth rate is meaningless without knowing WHAT grew, and the parser did
  // not ask. Affirm's S-1 states GMV up 77% and revenue up 93% in consecutive
  // sentences; taking the first match reported 77% as the company's revenue
  // growth — one metric's number under another metric's name, which is a wrong
  // figure rather than a missing one. Every match is now classified by the
  // nearest metric noun in front of it, a revenue-attached rate wins when
  // several are disclosed, and whatever is used carries its basis so the report
  // can say "GMV growth" when that is what it is.
  const GROWTH_PATTERNS = [
    String.raw`(?:grow(?:ing|th|s|n)?|up|increas(?:ing|ed|e)|expand(?:ing|ed))\s*(?:by|at|of|to)?\s*${NUM}\s*%\s*${PERIOD_WORD}?${NOT_ANOTHER_METRIC}`,
    String.raw`${NUM}\s*%\s*${PERIOD_WORD}\s*(?:revenue\s*)?growth`,
    String.raw`${NUM}\s*%\s*(mom|yoy|wow|month[- ]over[- ]month|year[- ]over[- ]year|week[- ]over[- ]week)${NOT_ANOTHER_METRIC}`,
  ];
  const BASIS_NOUNS: Array<[GrowthBasis, RegExp]> = [
    ["revenue", /\b(?:revenues?|arr|mrr|net sales|sales)\b/g],
    ["gmv", /\b(?:gmv|gtv|gross transaction value|gross merchandise (?:value|volume)|processed volume|gross bookings|transaction volume)\b/g],
    ["customers", /\b(?:customers|users|subscribers|members|memberships|merchants|sellers)\b/g],
  ];
  /** The metric noun closest in front of `at`, within a clause-sized window. */
  const basisFor = (at: number): GrowthBasis => {
    const from = Math.max(0, at - 90);
    let best: GrowthBasis = "unspecified";
    let bestIdx = -1;
    for (const [basis, re] of BASIS_NOUNS) {
      re.lastIndex = 0;
      for (let m = re.exec(t); m; m = re.exec(t)) {
        if (m.index >= at) break;
        if (m.index >= from && m.index > bestIdx) { bestIdx = m.index; best = basis; }
      }
    }
    return best;
  };

  // A growth band read its HIGH end — "growing 20-40% year over year" scored 40
  // — which is the flattering end, against the rule every other band here
  // follows. The plan committed to 20.
  const growthRange = firstMatch(t, new RegExp(String.raw`(?:grow(?:ing|th|s|n)?|up|increas(?:ing|ed|e)|expand(?:ing|ed))\s*(?:by|at|of|between)?\s*${NUM}\s*%?\s*(?:-|–|—|to|and)\s*${NUM}\s*%\s*${PERIOD_WORD}?${NOT_ANOTHER_METRIC}`, "i"));
  if (growthRange && !decline) {
    const a = parseLocaleNumber(growthRange[1]);
    const b = parseLocaleNumber(growthRange[2]);
    if (isFinite(a) && isFinite(b) && Math.min(a, b) > 0) {
      s.growthPct = Math.min(a, b);
      s.growthBasis = "revenue";
      s.growthPeriod = growthPeriodFromWords((growthRange[3] ?? "").toLowerCase());
      s.parseNotes.push(`Growth was disclosed as a range (${Math.min(a, b)}–${Math.max(a, b)}%); the score uses the low end.`);
    }
  }

  /** The best rise the text states, with what it is attached to. */
  const risePreferred = (): { m: RegExpMatchArray; basis: GrowthBasis } | undefined => {
    const found: Array<{ m: RegExpMatchArray; basis: GrowthBasis }> = [];
    for (const pat of GROWTH_PATTERNS) {
      const re = new RegExp(pat, "gi");
      for (let m = re.exec(t); m; m = re.exec(t)) {
        found.push({ m: m as unknown as RegExpMatchArray, basis: basisFor(m.index) });
        if (m.index === re.lastIndex) re.lastIndex++;
      }
      if (found.length) break; // patterns stay ordered by confidence, as before
    }
    return found.find((f) => f.basis === "revenue") ?? found[0];
  };

  let growth: RegExpMatchArray | null = s.growthPct !== null ? null : decline;
  let growthBasis: GrowthBasis = decline ? basisFor(decline.index ?? 0) : "unspecified";
  // A decline wins by default, because a plan that mentions one is usually
  // describing itself now. But a rate belongs to a period like every other
  // figure here, and every other field already prefers the later one. When both
  // a rise and a fall are stated AND both are dated, the later date decides —
  // so "fell in 2023, grew 40% in 2024" reports the growth, and Moderna's "up
  // 90% in 2017, down 13% in the nine months to September 2018" still reports
  // the decline.
  const rise = s.growthPct === null ? risePreferred() : undefined;
  let usingDecline = growth === decline && decline !== null;
  if (decline && rise && rise.m !== decline) {
    const declineYear = clauseYearAt(t, decline.index ?? 0, decline[0].length);
    const riseYear = clauseYearAt(t, rise.m.index ?? 0, rise.m[0].length);
    if (declineYear !== null && riseYear !== null && riseYear > declineYear) {
      growth = rise.m;
      growthBasis = rise.basis;
      usingDecline = false;
      s.parseNotes.push(`Growth was disclosed for more than one period; the score uses the latest (${riseYear}).`);
    }
  }
  if (!growth && s.growthPct === null && rise) {
    growth = rise.m; growthBasis = rise.basis; usingDecline = false;
  }
  if (growth) {
    const groups = growth.slice(1).filter((g): g is string => typeof g === "string");
    const value = groups.find((g) => /^\d/.test(g));
    const g = value !== undefined ? parseLocaleNumber(value) : NaN;
    if (isFinite(g)) {
      // The sign follows the SELECTED match, not the mere presence of a decline
      // elsewhere in the text.
      s.growthPct = usingDecline ? -g : g;
      s.growthBasis = growthBasis;
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
  const gm = latestMatch(t, new RegExp(String.raw`${NOT_RANGE}${NEG}${NUM}\s*%\s*gross\s*margin`, "i"), s, "gross margin")
    || latestMatch(t, new RegExp(String.raw`gross\s*margins?\s*(?:of|=|:|at|are|is|${TO_LEVEL})?\s*${NEG}${NUM}\s*%`, "i"), s, "gross margin")
    || latestMatch(t, new RegExp(String.raw`gross\s*margins?\s*(?:of|=|:|at|are|is|${TO_LEVEL})?\s*(\()\s*${NUM}\s*\)\s*%`, "i"), s, "gross margin");
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
    : firstMatch(t, new RegExp(String.raw`ltv[:/ ]*cac\s*(?:of|=|:|at|${TO_LEVEL})?\s*${NUM}\s*(?::\s*1)?`, "i"));
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
  // Payback is stored in months, and only the word "months" was accepted — so a
  // plan stating "payback of 2 years" disclosed nothing at all. The unit is
  // captured and converted rather than assumed, because assuming months on a
  // figure written in years would turn 2 years into an excellent 2-month
  // payback: the same class of error the churn period exists to prevent.
  const pb = s.paybackMonths !== null ? null
    : latestMatch(t, new RegExp(String.raw`payback\s*(?:period)?\s*(?:of|=|:|at|is|${TO_LEVEL})?\s*${NUM}\s*[- ]?(months?|years?)`, "i"), s, "payback")
    || latestMatch(t, new RegExp(String.raw`${NUM}\s*[- ]?(months?|years?)\s*payback`, "i"), s, "payback");
  if (pb) {
    const v = parseLocaleNumber(pb[1]);
    const inYears = /year/i.test(pb[2] ?? "");
    const months = inYears ? v * 12 : v;
    if (isFinite(months) && months > 0 && months < 240) {
      s.paybackMonths = Math.round(months * 10) / 10;
      if (inYears) s.parseNotes.push(`Payback was disclosed as ${v} year${v === 1 ? "" : "s"}; scored as ${s.paybackMonths} months.`);
    }
  }

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
    : latestMatch(t, new RegExp(String.raw`(?:(monthly|quarterly|annual(?:ised|ized)?|yearly|weekly)\s+)?${NUM}\s*%\s*(monthly|quarterly|annual(?:ised|ized)?|yearly|weekly)?\s*churn(?:\s*(?:per|a|\/)\s*(month|quarter|year|week))?`, "i"), s, "churn")
    // The period may also follow the figure as a bare adverb — "churn of 24%
    // annually". Only the "per year" / "a year" / "/year" forms were accepted,
    // so the adverb was lost and the rate defaulted to MONTHLY: 24% a year, an
    // ordinary number, was scored as 24% a month and charged as a company
    // bleeding out. Exactly the confusion the churn-period machinery exists to
    // prevent, left open on the most natural phrasing of all.
    || latestMatch(t, new RegExp(String.raw`(monthly|quarterly|annual(?:ised|ized)?|yearly|weekly)?\s*churn\s*(?:rate)?\s*(?:of|=|:|at|is|${TO_LEVEL})?\s*\(?\s*${NUM}\s*%\s*(?:per\s+|a\s+|\/\s*)?\s*(month(?:ly)?|quarter(?:ly)?|year(?:ly)?|annual(?:ly|ised|ized)?|week(?:ly)?)?`, "i"), s, "churn");
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
  // A band, read at the low end: less retention is the worse reading, the same
  // rule the revenue and margin bands already follow. Without this the whole
  // disclosure was dropped, so a plan stating 110–130% scored as if it had said
  // nothing about retention at all.
  const retRange = firstMatch(t, new RegExp(String.raw`(?:${RET_NAME})\s*(?:rate)?\s*(?:of|=|:|at|is|between)?\s*${NUM}\s*%?\s*(?:-|–|—|to|and)\s*${NUM}\s*%`, "i"));
  if (retRange) {
    const a = parseLocaleNumber(retRange[1]);
    const b = parseLocaleNumber(retRange[2]);
    if (isFinite(a) && isFinite(b) && Math.min(a, b) > 0 && Math.max(a, b) <= 500) {
      s.retentionPct = Math.min(a, b);
      s.parseNotes.push(`Retention was disclosed as a range (${Math.min(a, b)}–${Math.max(a, b)}%); the score uses the low end.`);
    }
  }
  const ret = s.retentionPct !== null ? null
    : latestMatch(t, new RegExp(String.raw`${NUM}\s*%\s*(?:${RET_NAME})`, "i"), s, "retention")
    || latestMatch(t, new RegExp(String.raw`(?:${RET_NAME})\s*(?:rate)?\s*(?:of|=|:|at|is|was|${TO_LEVEL})?\s*\(?\s*${NUM}\s*%`, "i"), s, "retention");
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
  const CUST_NOUN = String.raw`customers|users|clients|subscribers|merchants|seats|members|memberships|accounts|stores|buyers|sellers|tenants|policyholders|policies in force`;
  // "12,000-15,000 customers" read 15,000 — the flattering end, against the
  // rule every other band here follows. Fewer customers is the worse reading.
  const custRange = firstMatch(t, new RegExp(String.raw`${NOT_MONEY}${NUM}\s*${UNIT}\s*(?:-|–|—|to)\s*${NUM}\s*${UNIT}\s*(?:paying\s*|active\s*)?${CUST_QUALIFIER}(?:${CUST_NOUN})`, "i"));
  if (custRange) {
    const a = parseMoney(custRange[1], custRange[2]);
    const b = parseMoney(custRange[3], custRange[4] ?? custRange[2]);
    if (a && b && Math.min(a, b) >= 1) {
      s.customers = Math.round(Math.min(a, b));
      s.parseNotes.push(`The customer count was disclosed as a range (${Math.round(Math.min(a, b)).toLocaleString("en-US")}–${Math.round(Math.max(a, b)).toLocaleString("en-US")}); the score uses the low end.`);
    }
  }
  const cust = s.customers !== null ? null
    : latestMatch(t, new RegExp(String.raw`${NOT_MONEY}${NUM}\s*${UNIT}\s*(?:paying\s*|active\s*)?${CUST_QUALIFIER}(?:${CUST_NOUN})`, "i"), s, "the customer count");
  if (cust) {
    const v = parseMoney(cust[1], cust[2]);
    if (v && v >= 1) s.customers = Math.round(v);
  }
  // The count pattern above puts the figure BEFORE the noun, so "customers fell
  // to 900" reaches it in the wrong order and was dropped. Same family as the
  // percentage fields, different sentence shape.
  if (s.customers === null) {
    const custAfterVerb = firstMatch(t, new RegExp(String.raw`(?:${CUST_NOUN})\s*${TO_LEVEL}\s*${NUM}\s*${UNIT}`, "i"));
    if (custAfterVerb) {
      const v = parseMoney(custAfterVerb[1], custAfterVerb[2]);
      if (v && v >= 1) s.customers = Math.round(v);
    }
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

  // Contradictions on the metrics that never had the check revenue has had.
  detectMetricConflict(t, s, "gross margin", String.raw`gross\s*margins?\s*(?:of|=|:|at|are|is)?\s*(\d[\d.,]*)\s*%`, (m) => parseLocaleNumber(m[1]));
  detectMetricConflict(t, s, "churn rate", String.raw`churn\s*(?:rate)?\s*(?:of|=|:|at|is)?\s*(\d[\d.,]*)\s*%`, (m) => parseLocaleNumber(m[1]));
  detectMetricConflict(t, s, "customer count", String.raw`(?<![$€£₽₸¥])(\d[\d.,]*)\s*${UNIT}\s*(?:paying\s*|active\s*)?(?:${"customers|users|subscribers|members|memberships|merchants|policyholders"})`, (m) => parseMoney(m[1], m[2]));

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
/**
 * The same check, for the metrics that never had one.
 *
 * `detectRevenueConflict` has existed for a while and guards exactly one field.
 * A plan stating "gross margin of 70%" and "gross margin of 40%", or two
 * different customer counts, scored one of them and said nothing — the reader
 * had no way to know the document disagreed with itself. Revenue was not
 * special; it was just the field someone got to.
 *
 * Figures the plan dates to different years are NOT a contradiction: the
 * latest-period rule already resolves those, and flagging them would turn every
 * ordinary year-on-year disclosure into a warning.
 */
function detectMetricConflict(
  t: string, s: PlanSignals, label: string, pattern: string,
  read: (m: RegExpMatchArray) => number | null,
): void {
  const seen = new Map<number, number | null>(); // value → year
  for (const m of t.matchAll(new RegExp(pattern, "gi"))) {
    const at = m.index ?? 0;
    if (forwardLooking(t, at)) continue;
    const v = read(m as RegExpMatchArray);
    if (v === null || !isFinite(v) || v <= 0) continue;
    const rounded = Math.round(v * 100) / 100;
    if (!seen.has(rounded)) seen.set(rounded, clauseYearAt(t, at, m[0].length));
  }
  if (seen.size < 2) return;
  const years = [...seen.values()];
  if (new Set(years.filter((y) => y !== null)).size > 1) return; // different periods, already resolved
  const vals = [...seen.keys()].sort((a, b) => a - b);
  const lo = vals[0], hi = vals[vals.length - 1];
  if (hi / lo < 1.2) return; // the same figure rounded twice is not a disagreement
  s.conflicts.push(`Plan states more than one ${label} (${vals.slice(0, 3).join(" and ")}) for the same period — reconcile before relying on either.`);
}

function detectRevenueConflict(t: string, s: PlanSignals, planCurrency: MoneyCurrency | null): void {
  if (s.revenueUsd === null) return;
  // Forward INTENT, not the noun. "in this plan:" must not silence the check —
  // the smoke run caught exactly that: a bare "plan" swallowed a real
  // contradiction because the sentence happened to use the word.
  const figureFirst = new RegExp(String.raw`${CUR}${NUM}\s*${UNIT}\s*(?:in\s*)?(${REV_NOUN})`, "gi");
  const nameFirst = new RegExp(String.raw`(?:net\s*|total\s*)?(?:${REV_NOUN})\s*(?:of|=|:|at|were|was|${TO_LEVEL})?\s*${CUR}${NUM}\s*${UNIT}`, "gi");
  const seen = new Set<number>();
  const stated: number[] = [];
  for (const m of [...t.matchAll(figureFirst), ...t.matchAll(nameFirst)]) {
    const at = m.index ?? 0;
    if (forwardLooking(t, at)) continue;
    const val = moneyUsd(t, m as RegExpMatchArray, m[1], m[2], planCurrency);
    if (!val || val <= 0) continue;
    const noun = [m[3], m[1]].find((x) => typeof x === "string" && !/^[\d.,]/.test(x)) ?? "";
    const annual = /mrr/i.test(noun) ? val * 12 : val;
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
  const GMV_NOUN = String.raw`gmv|gtv|gross merchandise (?:value|volume)|gross transaction value|processed volume|gross bookings|total payment volume|tpv|transaction volume|annualized volume`;
  // A band, before the single-figure pattern: "GMV of $100-150M" used to match
  // the single pattern on "$100" with the "M" still attached to 150, so the
  // engine recorded a GMV of one hundred dollars. A magnitude error of six
  // orders, silent, on the headline number of a marketplace plan.
  const gmvRange = firstMatch(t, new RegExp(String.raw`(?:${GMV_NOUN})\s*(?:of|=|:|at|is|between)?\s*${CUR}${NUM}\s*${UNIT}\s*(?:-|–|—|to|and)\s*${CUR}${NUM}\s*${UNIT}`, "i"));
  if (gmvRange) {
    const ends = moneyRangeEnds(t, gmvRange, s.currency);
    if (ends) {
      s.gmvUsd = ends.low;
      s.parseNotes.push(`GMV was disclosed as a range (${fmtUsdShort(ends.low)}–${fmtUsdShort(ends.high)}); the score uses the low end.`);
    }
  }
  const gmv = s.gmvUsd !== null ? null
    : latestMatch(t, new RegExp(String.raw`(?:${GMV_NOUN})\s*(?:of|=|:|at|is|reached)?\s*${CUR}${NUM}\s*${UNIT}`, "i"), s, "GMV")
    || latestMatch(t, new RegExp(String.raw`${CUR}${NUM}\s*${UNIT}\s*(?:in\s*)?(?:${GMV_NOUN})`, "i"), s, "GMV");
  if (gmv) { const v = moneyUsd(t, gmv, gmv[1], gmv[2], s.currency); if (v && v > 0) s.gmvUsd = v; }

  const TAKE_NOUN = String.raw`take[- ]rate|commission(?: rate)?|net revenue margin`;
  const takeRange = firstMatch(t, new RegExp(String.raw`(?:${TAKE_NOUN})\s*(?:of|=|:|at|is|between)?\s*${NUM}\s*%?\s*(?:-|–|—|to|and)\s*${NUM}\s*%`, "i"));
  if (takeRange) {
    const a = parseLocaleNumber(takeRange[1]);
    const b = parseLocaleNumber(takeRange[2]);
    if (isFinite(a) && isFinite(b) && Math.min(a, b) > 0 && Math.max(a, b) <= 100) {
      s.takeRatePct = Math.min(a, b);
      s.parseNotes.push(`Take rate was disclosed as a range (${Math.min(a, b)}–${Math.max(a, b)}%); the score uses the low end.`);
    }
  }
  const take = s.takeRatePct !== null ? null
    : latestMatch(t, new RegExp(String.raw`(?:${TAKE_NOUN})\s*(?:of|=|:|at|is|${TO_LEVEL})?\s*${NUM}\s*%`, "i"), s, "take rate")
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
  // Same band trap as GMV, and the same six-order consequence: "$20-60M" of
  // backlog was read as twenty dollars.
  const backlogRange = firstMatch(t, new RegExp(String.raw`${backlogRe}\s*(?:of|worth|totall?ing|=|:|at|is|between)?\s*${CUR}${NUM}\s*${UNIT}\s*(?:-|–|—|to|and)\s*${CUR}${NUM}\s*${UNIT}`, "i"));
  if (backlogRange && mentionsUnnegated(t, new RegExp(backlogRe, "i"))) {
    const ends = moneyRangeEnds(t, backlogRange, s.currency);
    if (ends) {
      s.contractedRevenueUsd = ends.low;
      s.parseNotes.push(`Contracted backlog was disclosed as a range (${fmtUsdShort(ends.low)}–${fmtUsdShort(ends.high)}); the score uses the low end.`);
    }
  }
  const backlog = s.contractedRevenueUsd !== null ? null
    : latestMatch(t, new RegExp(String.raw`${backlogRe}\s*(?:of|worth|totall?(?:ing|ed)|=|:|at|is|stands at)?\s*${CUR}${NUM}\s*${UNIT}`, "i"), s, "contracted backlog")
    || latestMatch(t, new RegExp(String.raw`${CUR}${NUM}\s*${UNIT}\s*(?:in\s*)?${backlogRe}`, "i"), s, "contracted backlog");
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

  // ── Capacity deployed — infrastructure already built and running ──
  // The unit alternation is power-only and the negative lookahead is what keeps
  // energy out: "16 GWh" must not become 16,000 MW.
  const CAP_UNIT = String.raw`(mw|gw|megawatts?|gigawatts?)(?!h|\s*h\b|-hours?|\s*hours?)`;
  const CAP_STATE = String.raw`(?:deployed|installed|operational|in operation|online|commissioned|built)`;
  const cap = firstMatch(t, new RegExp(String.raw`${CAP_STATE}[^.;]{0,28}?(?<![0-9.])${NUM}\s*${CAP_UNIT}`, "i"))
    || firstMatch(t, new RegExp(String.raw`(?<![0-9.])${NUM}\s*${CAP_UNIT}[^.;]{0,28}?${CAP_STATE}`, "i"));
  if (cap) {
    const groups = cap.slice(1).filter((g): g is string => typeof g === "string");
    const numStr = groups.find((g) => /^[0-9]/.test(g));
    const unitStr = groups.find((g) => /^[a-z]/i.test(g)) ?? "";
    const v = numStr !== undefined ? parseLocaleNumber(numStr) : NaN;
    if (isFinite(v) && v > 0 && statedAsAchieved(t, cap.index ?? 0, cap[0].length)) {
      s.capacityDeployedMw = /^g/i.test(unitStr) ? v * 1000 : v;
      if (/^g/i.test(unitStr)) {
        s.parseNotes.push(`Capacity was disclosed in gigawatts (${v} GW); it is recorded as ${s.capacityDeployedMw} MW.`);
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
    [/\bemergency use authorization\b|\beua\b(?! ?\w)/i, "FDA emergency use authorization"],
    // What a security or infrastructure company leads with. Held back when it
    // was written, because the list could not yet tell "certified" from "plans
    // to pursue certification"; released now that it can.
    [/\biso[\s-]?27001\b|\bsoc\s?2(?:\s*type\s*(?:i{1,2}|[12]))?\b|\bhitrust\b|\bfedramp\b/i, "Security certification held"],
    [/\bce mark(?:ed|ing)?\b|\bmdr certifi/i, "CE mark"],
    [/\bema approval|\bmhra approval/i, "EMA/MHRA approval"],
    [/\bphase\s*(?:iii|3)\b/i, "Phase 3 clinical"],
    [/\bphase\s*(?:ii|2)\b/i, "Phase 2 clinical"],
    [/\bphase\s*(?:i|1)\b(?!\w)/i, "Phase 1 clinical"],
    // "The program has an open IND" is how a filing says the application
    // cleared and is live. The pattern missed it while correctly ignoring the
    // two neighbouring phrasings in the same S-1 that are NOT a cleared IND:
    // "IND-enabling toxicology studies" and "included in the IND filing".
    [/\bind (?:cleared|filed|accepted)\b|\b(?:open|active)\s+ind\b|\bind\s+is\s+(?:open|active|cleared)\b/i, "IND cleared"],
    // Rocket Lab's S-1: "implemented corrective actions and received
    // authorization from the FAA to resume launches" — a real authorization the
    // pattern missed, because it expected the authority's name to come first.
    // The reverse order stays out where it should: AeroVironment's "the FAA,
    // which regulates airspace for all air vehicles" and "the FAA issued a
    // clarification of its existing policies" are regulatory context, not a
    // certificate held.
    [/\b(?:faa|easa) (?:certifi\w+|type certificate|approval|authoriz\w+)\b|\b(?:received|granted|obtained|holds?|issued)\b[^.;]{0,40}?\b(?:certification|authorization|type certificate|licence|license)\b[^.;]{0,20}?\bfrom the (?:faa|easa)\b/i, "Aviation authority certification"],
    [/\b(?:banking|e-?money|emi|money transmitter|payment institution|broker[- ]dealer|lending) licen[cs]e\b/i, "Financial licence held"],
    // A bare "IDIQ" matched any mention of the words, including AeroVironment's
    // 10-K explaining what an IDIQ contract IS ("we do not include unfunded
    // ceiling amounts for ... IDIQ contracts in unfunded backlog") — a
    // definition credited as a defence contracting status. The token now needs
    // an award verb beside it. The same 10-K also showed the opposite miss: the
    // natural passive "we were awarded a defense contract" did not match a
    // pattern fixed to the words "defense contract awarded".
    [/\bitar (?:registered|registration)\b|\b(?:awarded|won|received|secured)[^.;]{0,40}?\b(?:defen[cs]e|military|government) contract\b|\bdefen[cs]e contract awarded\b|\b(?:awarded|won|holds?|received|secured)[^.;]{0,40}?\bidiq\b|\bidiq\b[^.;]{0,30}?\b(?:award(?:ed)?|win|won)\b|\bota\b (?:award|contract)/i, "Defence contracting status"],
    // Sunrun's S-1 describes its BUSINESS with the same words a milestone uses:
    // "homeowners who buy energy from us under leases or power purchase
    // agreements are covered by production guaranties". That sentence announces
    // no agreement; it explains the product. It missed only because the plural
    // "agreements" broke the word boundary — luck, not a rule — so the entry now
    // requires the agreement to be stated as concluded.
    [/\bgrid interconnection agreement\b[^.;]{0,30}?\b(?:executed|signed|secured|in place|granted|approved)\b|\b(?:executed|signed|secured|concluded|awarded)\b[^.;]{0,30}?\b(?:grid interconnection agreement|ppa|power purchase agreements?)\b|\b(?:ppa|power purchase agreements?)\b[^.;]{0,30}?\b(?:is |are |was |were )?(?:executed|signed|secured|concluded|in place)\b/i, "Grid/PPA agreement"],
  ];
  /**
   * The comment above this list has always promised that "FDA approval expected
   * in 2027 is a plan, not a milestone". It was not true: the negation layer
   * catches "no FDA approval" and nothing about a future tense, so an applicant
   * who had obtained nothing could be credited with a clearance, a PPA, a
   * defence contracting status or a banking licence — and every entry in the
   * list inherited the hole.
   *
   * The rule, applied inside the milestone's OWN clause: an explicit
   * achievement word wins outright; otherwise an intention marker anywhere in
   * that clause disqualifies it. Clause-bounding is what lets "FDA clearance
   * granted; we expect launch in 2027" keep its clearance — the intention lives
   * in the next clause, and it is about something else.
   */
  for (const [re, label] of REG) {
    if (!mentionsUnnegated(t, re) || s.regulatoryMilestones.includes(label)) continue;
    const m = firstMatch(t, new RegExp(re.source, re.flags.replace("g", "")));
    if (m && !statedAsAchieved(t, m.index ?? 0, m[0].length)) continue;
    s.regulatoryMilestones.push(label);
  }

  // ── Technical validation ──
  const PROOF: Array<[RegExp, string]> = [
    [/\bpeer[- ]reviewed\b|\bpublished in (?:nature|science|nejm|the lancet|cell)\b/i, "Peer-reviewed result"],
    [/\bclinical(?:ly)? validat\w+|\bsensitivity\b.*\bspecificity\b|\b\d{2,3}% sensitivity\b/i, "Clinical validation data"],
    [/\bbenchmark(?:ed|s)?\b|\bstate[- ]of[- ]the[- ]art\b|\bsota\b|\boutperform\w*\b/i, "Benchmark result claimed"],
    [/\bpilot plant\b|\bproduction line\b|\bat scale in production\b|\bfactory (?:running|operational)\b|\bin commercial operation\b/i, "Plant / production line running"],
    // The single most important sentence in a clinical filing, and the reader
    // knew every phrasing around it — trial phase, peer review, sensitivity —
    // except the result itself.
    [/\bmet (?:its |the )?primary endpoint\b|\bprimary endpoint was met\b|\bachieved (?:its )?primary endpoint\b/i, "Primary endpoint met"],
    [/\bflight[- ]tested\b|\bfield[- ]tested\b|\bin operational use\b|\bdeployed (?:with|to) (?:customers|operators|units)\b/i, "Field / flight tested"],
    // A flight record is the hardest evidence a launch company has, and it is
    // stated as a count of missions flown, not as a test result.
    [/\b\d+\s+successful\s+(?:missions?|launches|flights?)\b|\bsuccessfully (?:launched|flown)\b/i, "Flight record"],
    [/\bworking prototype\b|\bfunctional prototype\b|\bdemonstrat(?:ed|or) (?:unit|system|vehicle)\b/i, "Working prototype"],
  ];
  for (const [re, label] of PROOF) {
    if (mentionsUnnegated(t, re) && !s.technicalProof.includes(label)) s.technicalProof.push(label);
  }
}
