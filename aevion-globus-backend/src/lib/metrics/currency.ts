/**
 * Money currency detection and USD normalization for parsed figures.
 * ─────────────────────────────────────────────────────────────────
 * A number without its currency is the same defect class as a rate without its
 * period: "€3M ARR" was read as $3M, "₸450 млн" as $450M. Both flatter or punish
 * a company by the size of an exchange rate — and every non-US plan is affected,
 * which is most of the ones this platform sees.
 *
 * Why this table is not `data/pricing.ts` → `CURRENCY_RATES`: those are manually
 * maintained *billing display* rates for AEVION's own price list, deliberately
 * fixed so a customer's quoted price does not move with the market. These are
 * *measurement* rates for reading someone else's figures, and they carry a
 * source and a date. Keeping them apart is intentional; merging them would make
 * a pricing decision move whenever a deck-parsing rate is refreshed.
 *
 * Rates are checked in, not fetched: the engine's contract is determinism —
 * the same plan must always produce the same score. Refresh by re-running the
 * source below and updating both the table and `RATES_AS_OF` in one commit.
 */

/** Units of the currency per 1 USD. Source: open.er-api.com, fetched 2026-07-26. */
export const UNITS_PER_USD = {
  USD: 1,
  EUR: 0.878778,
  GBP: 0.750671,
  KZT: 470.246541,
  RUB: 78.236746,
  JPY: 163.809686,
  CNY: 6.786115,
  INR: 96.61443,
  CHF: 0.817769,
  CAD: 1.408302,
  AUD: 1.432468,
  SEK: 9.720717,
  AED: 3.6725,
  BRL: 5.079327,
  TRY: 47.330088,
  SGD: 1.290995,
  ILS: 3.055265,
  PLN: 3.795285,
} as const;

export type MoneyCurrency = keyof typeof UNITS_PER_USD;

export const RATES_AS_OF = "2026-07-26";
export const RATES_SOURCE = "open.er-api.com";

/**
 * Currency markers, longest-first so "C$" wins over "$" and "млрд тенге" is not
 * matched as a bare "тенге" fragment of something else. Ordered scanning matters:
 * the first entry whose pattern is present in the window wins.
 */
const MARKERS: Array<[MoneyCurrency, RegExp]> = [
  ["CAD", /\bcad(?![a-z])|c\$|\bcanadian dollars?\b/i],
  ["AUD", /\baud(?![a-z])|a\$|\baustralian dollars?\b/i],
  ["SGD", /\bsgd(?![a-z])|s\$|\bsingapore dollars?\b/i],
  ["EUR", /€|\beur(?![a-z])|\beuros?\b|\bевро\b/i],
  ["GBP", /£|\bgbp(?![a-z])|\bpounds? sterling\b|\bquid\b/i],
  ["KZT", /₸|\bkzt(?![a-z])|\btenge\b|\bтенге\b|\bтг\b/i],
  ["RUB", /₽|\brub(?![a-z])|\broubles?\b|\brubles?\b|\bрубл|\bруб\b/i],
  ["JPY", /¥|\bjpy(?![a-z])|\byen\b/i],
  ["CNY", /\bcny(?![a-z])|\brmb(?![a-z])|\byuan\b/i],
  ["INR", /₹|\binr(?![a-z])|\brupees?\b/i],
  ["CHF", /\bchf(?![a-z])|\bswiss francs?\b/i],
  ["SEK", /\bsek(?![a-z])|\bswedish krona\b/i],
  ["AED", /\baed(?![a-z])|\bdirhams?\b/i],
  ["BRL", /\bbrl(?![a-z])|r\$|\breais\b|\breal\b/i],
  ["TRY", /\btry(?![a-z])|\blira\b|₺/i],
  ["ILS", /₪|\bils(?![a-z])|\bshekels?\b/i],
  ["PLN", /\bpln(?![a-z])|\bzloty\b|\bzł/i],
  ["USD", /\$|\busd(?![a-z])|\bdollars?\b/i],
];

/**
 * Regex source for an optional currency marker sitting in front of a number,
 * so "€3M ARR" and "KZT 450 млн" match the same money patterns "$3M" does.
 */
export const CURRENCY_PREFIX_PATTERN =
  String.raw`(?:[$€£₸₽¥₹₪₺]|\b(?:usd|eur|gbp|kzt|rub|jpy|cny|rmb|inr|chf|cad|aud|sek|aed|brl|try|sgd|ils|pln)(?![a-z]))?\s*`;

/**
 * Find the currency a figure is quoted in, given a small text window around it.
 * Returns null when nothing marks it — the caller decides the default, and says
 * so, rather than this function silently asserting dollars.
 */
export function detectCurrency(window: string): MoneyCurrency | null {
  if (!window) return null;
  for (const [code, re] of MARKERS) {
    if (re.test(window)) return code;
  }
  return null;
}

/**
 * The currency of the FIRST money marker in the text, by position.
 *
 * Position, not table order: a plan that writes "€" first and "$" later is
 * quoting euros and mentioning dollars, and picking by table order would make
 * the answer depend on an implementation detail no reader can see.
 */
export function detectCurrencyFirst(text: string): MoneyCurrency | null {
  let best: { code: MoneyCurrency; at: number } | null = null;
  for (const [code, re] of MARKERS) {
    const m = new RegExp(re.source, re.flags.replace("g", "")).exec(text);
    if (!m || m.index === undefined) continue;
    if (!best || m.index < best.at) best = { code, at: m.index };
  }
  return best?.code ?? null;
}

/** Convert an amount in `code` to USD using the checked-in rate. */
export function toUsd(amount: number, code: MoneyCurrency | null): number {
  if (!isFinite(amount)) return amount;
  if (!code || code === "USD") return amount;
  const rate = UNITS_PER_USD[code];
  if (!rate || rate <= 0) return amount;
  return Math.round(amount / rate);
}

/** Human-readable note for the assumptions list when a plan was not in USD. */
export function conversionNote(code: MoneyCurrency): string {
  return `Figures were disclosed in ${code} and converted to USD at ${UNITS_PER_USD[code]} ${code}/USD (${RATES_SOURCE}, ${RATES_AS_OF}) — re-check against the rate on the date of the round.`;
}
