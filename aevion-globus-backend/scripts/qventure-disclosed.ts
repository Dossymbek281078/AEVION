/**
 * QVenture — disclosed-figures harness
 * ────────────────────────────────────
 * The two existing harnesses share one blind spot, and the rubric doc states it
 * plainly: the calibration corpus holds real companies whose fixtures state
 * almost no figures, and the hard-cases corpus holds real figures on companies
 * that do not exist. So rubric v5 — bands, pessimistic-corner reads, range
 * handling, the ten classes of silent number corruption — has been exercised
 * only on numbers this repository invented for itself. A rubric change that is
 * validated by its author's own fixtures has not been validated.
 *
 * This harness closes that gap. Every case below is a real company at a named
 * round, and every figure in its text is one the company itself put in a public
 * document — an S-1/F-1, a 10-Q, or reporting of the round. `sources` on each
 * case lists where each figure came from. Nothing here is typed in from memory
 * and nothing is rounded "to make the point".
 *
 * ⚠️ WHAT THIS MEASURES — AND WHAT IT STILL CANNOT
 *
 * It measures two things the other harnesses cannot:
 *
 *   1. PARSE COVERAGE ON REAL PROSE. Filing language is not fixture language.
 *      "delivered less than 1% of its 16 GWh capacity", "gross margin of
 *      negative 45%", "net dollar expansion rate of 140%" — the parser was
 *      written against sentences the same author wrote. `expect` on each case
 *      names the figures the text states, and the harness reports which ones the
 *      engine actually recovered. A miss here is a real defect: it means the
 *      engine scores a real filing as "no evidence disclosed".
 *
 *   2. SEPARATION ON REAL NUMBERS. Whether real disclosure moves the score at
 *      all, and in which direction.
 *
 * It still cannot establish predictive accuracy, for the same reason as the
 * calibration harness: the cases were selected in 2026, knowing the outcomes.
 * Selection bias survives even when every figure is sourced. What removes the
 * *input* bias — and this is the difference from the calibration corpus — is
 * that the wording is constrained to disclosed figures, so the author cannot
 * shade a description toward the outcome without stating a number that is not
 * in the source.
 *
 * Rule followed when writing each case: only figures the company disclosed at
 * or before the named round, including the adverse ones it disclosed about
 * itself. No outcome language, no post-mortem framing, no figure that surfaced
 * later. Several of these failures were extremely well-regarded at the round
 * described, and two of the successes disclosed enormous losses.
 *
 * Usage: npx tsx scripts/qventure-disclosed.ts
 */

import { analyze, type AnalysisInput } from "../src/lib/qventure/engine";
import { parsePlanSignals, type PlanSignals } from "../src/lib/qventure/signals";

/** A figure the case text states, and how to read what the engine made of it. */
export interface Expectation {
  label: string;
  /** Pull the parsed value the engine should have produced for this figure. */
  read: (s: PlanSignals) => number | boolean | null;
  /** What the source document states. */
  expected: number | boolean;
  /** Relative tolerance for money/percent figures (default 2%). */
  tol?: number;
}

export interface DisclosedCase {
  input: AnalysisInput;
  outcome: "failed" | "succeeded";
  /** The filing or round the figures are taken from. */
  round: string;
  /** Where every figure in the text can be checked. */
  sources: string[];
  /** Figures the text states — the engine is expected to recover each one. */
  expect: Expectation[];
  /**
   * Set when the company disclosed no usable figures at the round. Such a case
   * is a control, not a parse test: it checks that a large ask with nothing
   * behind it does not score like a disclosed one.
   */
  disclosureFree?: boolean;
}

const num = (v: number, tol?: number) => ({ expected: v, tol });

export const CASES: DisclosedCase[] = [
  // ── Outcome: failed ───────────────────────────────────────────────────────
  {
    outcome: "failed",
    round: "Form S-1, August 2019",
    sources: [
      "https://www.sec.gov/Archives/edgar/data/1533523/000119312519220499/d781982ds1.htm",
      "https://news.crunchbase.com/public/wework-files-its-s-1-we-dive-into-the-numbers-and-pose-some-questions/",
      "https://www.cnbc.com/2019/08/14/wework-releases-s-1-filing-for-ipo.html",
    ],
    input: {
      name: "WeWork (The We Company)",
      sector: "proptech",
      stage: "growth",
      geography: "US",
      askUsd: 3_000_000_000,
      description:
        "Workspace-as-a-service: the company takes long-term leases on buildings, fits them out, and sells short-term memberships to individuals and enterprises. Enterprise members accounted for 40% of memberships in the second quarter of 2019.",
      tractionNotes:
        "Revenue of $1.54B in the first half of 2019, up 102% year over year from $763.8M in the first half of 2018. Operating loss of $729.7M in the second quarter of 2019. Total liabilities of $24.6B as of 30 June 2019. Approximately 527,000 memberships.",
    },
    expect: [
      { label: "revenue $1.54B (H1 2019)", read: (s) => s.revenueUsd, ...num(1_540_000_000) },
      { label: "growth 102% YoY", read: (s) => s.growthPct, ...num(102) },
      { label: "growth period is YoY", read: (s) => s.growthPeriod === "YoY", expected: true },
      { label: "customers 527,000 memberships", read: (s) => s.customers, ...num(527_000) },
    ],
  },
  {
    outcome: "failed",
    round: "Form S-1, December 2009 (offering later withdrawn)",
    sources: [
      "https://www.sec.gov/Archives/edgar/data/0001443115/000119312509255919/ds1.htm",
      "https://www.forbes.com/sites/timworstall/2011/09/17/solyndra-yes-it-was-possible-to-see-this-failure-coming/",
      "https://www.greentechmedia.com/articles/read/solydra-gets-warning-from-auditor-and-admits-its-solar-is-costly",
    ],
    input: {
      name: "Solyndra",
      sector: "climate",
      stage: "growth",
      geography: "US",
      askUsd: 300_000_000,
      description:
        "Cylindrical thin-film solar panels for flat commercial rooftops, manufactured in a company-owned fabrication plant. The design is intended to cut installation labour and mounting hardware on low-slope roofs.",
      tractionNotes:
        "Revenue of $100M in 2009. Sales backlog of $1.8B under signed multi-year agreements. Over the first nine months of 2009 the average selling price was $3.42 per watt against a manufacturing cost of $6.29 per watt, a gross margin of -45%.",
    },
    expect: [
      { label: "revenue $100M", read: (s) => s.revenueUsd, ...num(100_000_000) },
      { label: "backlog $1.8B read as contracted revenue", read: (s) => s.contractedRevenueUsd, ...num(1_800_000_000) },
      { label: "gross margin -45% (negative)", read: (s) => s.grossMarginPct, ...num(-45) },
    ],
  },
  {
    outcome: "failed",
    round: "Form 10-Q for the quarter ended 30 June 2020",
    sources: [
      "https://www.sec.gov/Archives/edgar/data/1731289/000173128920000012/nkla-20200630.htm",
      "https://www.truckinginfo.com/news/anheuser-busch-orders-800-nikola-hydrogen-electric-trucks",
    ],
    input: {
      name: "Nikola",
      sector: "climate",
      stage: "growth",
      geography: "US",
      askUsd: 700_000_000,
      description:
        "Hydrogen fuel-cell and battery-electric heavy trucks sold with the fuelling infrastructure, on a bundled lease covering the truck, hydrogen and maintenance. The company states its reservations are an indication of potential demand rather than a product backlog, and that customers may cancel at any time.",
      tractionNotes:
        "Approximately 14,000 reservations for fuel-cell trucks as of 30 June 2020, of which up to 800 are subject to a binding commitment with one customer. No truck revenue recognised. Commercial production of the fuel-cell truck planned for the second half of 2023.",
    },
    expect: [
      { label: "14,000 reservations read as reservations, not as backlog", read: (s) => s.reservations, ...num(14_000) },
      { label: "reservations are NOT counted as contracted revenue", read: (s) => s.contractedRevenueUsd, expected: 0 },
      { label: "reservations are NOT counted as deployments", read: (s) => s.pilots, expected: 0 },
      { label: "no revenue figure to find", read: (s) => s.revenueUsd, expected: 0 },
    ],
  },
  {
    outcome: "failed",
    round: "Series C, June 2021 ($170M raised)",
    sources: [
      "https://sec.gov/newsroom/press-releases/2024-92",
      "https://www.sec.gov/enforcement-litigation/litigation-releases/lr-26066",
    ],
    input: {
      name: "IRL",
      sector: "consumer",
      stage: "growth",
      geography: "US",
      askUsd: 170_000_000,
      description:
        "Group messaging and event-planning app organising real-world meetups for a young audience, with calendar and group-chat primitives. The company states that 75% of its user base is Gen Z.",
      tractionNotes:
        "20,000,000 users claimed. No revenue disclosed. User growth is supported by paid download-incentive advertising.",
    },
    // The round disclosed a user count and nothing else — no revenue figure and
    // no revenue reference to flag. That is the whole test: a single large,
    // unaudited vanity number is all the engine has to work with here.
    expect: [
      { label: "20,000,000 users read as customers", read: (s) => s.customers, ...num(20_000_000) },
    ],
  },
  {
    outcome: "failed",
    round: "Order book as stated late 2023, before the 2024 filing",
    sources: [
      "https://sifted.eu/articles/northvolt-trouble-cancelled",
      "https://techcrunch.com/2021/03/15/swedish-battery-manufacturer-northvolt-receives-a-14-billion-order-from-vw",
      "https://www.bruegel.org/analysis/northvolts-struggles-cautionary-tale-eu-clean-industrial-deal",
    ],
    input: {
      name: "Northvolt",
      sector: "climate",
      stage: "growth",
      geography: "EU",
      askUsd: 1_200_000_000,
      description:
        "European lithium-ion cell manufacturer building gigafactories to supply automotive customers under long-term offtake agreements, with an in-house recycling loop for cathode material.",
      tractionNotes:
        "Contracted order book of $50B, including a single $14B cell order to be delivered over ten years. In 2023 the Skellefteå plant delivered under 1% of its 16 GWh installed capacity.",
    },
    expect: [
      { label: "order book $50B read as contracted revenue", read: (s) => s.contractedRevenueUsd, ...num(50_000_000_000) },
    ],
  },
  {
    outcome: "failed",
    disclosureFree: true,
    round: "Series B, January 2021 ($102M led by Stripe)",
    sources: [
      "https://techcrunch.com/2021/01/26/fast-raises-102m-as-the-online-checkout-wars-continue-to-attract-huge-investment",
      "https://www.npr.org/2022/04/05/1091077398/checkout-startup-fast-is-shutting-down-after-burning-through-investors-money",
    ],
    input: {
      name: "Fast",
      sector: "fintech",
      stage: "growth",
      geography: "US",
      askUsd: 102_000_000,
      description:
        "One-click checkout identity that works across merchants, removing account creation and card entry from an online purchase. Merchant-side JavaScript install, consumer-side passwordless login.",
      tractionNotes:
        "No revenue, customer count, growth rate or unit economics disclosed at the round.",
    },
    expect: [],
  },

  // ── Outcome: succeeded ────────────────────────────────────────────────────
  {
    outcome: "succeeded",
    round: "Form S-1, August 2019",
    sources: [
      "https://www.sec.gov/Archives/edgar/data/1561550/000119312519227783/d745413ds1.htm",
      "https://news.crunchbase.com/venture/datadog-files-to-go-public-with-quick-revenue-growth-slim-losses-and-history-of-profitability/",
      "https://www.meritechcapital.com/blog/datadog-ipo-s-1-breakdown",
    ],
    input: {
      name: "Datadog",
      sector: "saas",
      stage: "growth",
      geography: "US",
      askUsd: 648_000_000,
      description:
        "Monitoring and observability platform unifying infrastructure metrics, application performance traces and logs in one product, sold bottom-up to engineering teams and expanding across an account by product.",
      tractionNotes:
        "Revenue of $198.1M in 2018, up 97% year over year from $100.8M in 2017. Gross margin 77%. Net revenue retention 146%.",
    },
    expect: [
      { label: "revenue $198.1M", read: (s) => s.revenueUsd, ...num(198_100_000) },
      { label: "growth 97% YoY", read: (s) => s.growthPct, ...num(97) },
      { label: "gross margin 77%", read: (s) => s.grossMarginPct, ...num(77) },
      { label: "net revenue retention 146%", read: (s) => s.retentionPct, ...num(146) },
    ],
  },
  {
    outcome: "succeeded",
    round: "Form S-1, March 2019",
    sources: [
      "https://medium.com/@alexfclayton/zoom-ipo-s-1-breakdown-119249acadd3",
      "https://news.crunchbase.com/?p=17798",
    ],
    input: {
      name: "Zoom Video Communications",
      sector: "saas",
      stage: "growth",
      geography: "US",
      askUsd: 356_000_000,
      description:
        "Cloud video conferencing built on a purpose-built distributed architecture, sold self-serve and expanded into the enterprise, with free meetings as the acquisition channel.",
      tractionNotes:
        "Revenue of $330.5M in the fiscal year ended 31 January 2019, up 118% year over year. Gross margin 81.5%. Net dollar expansion rate 140%. 50,800 customers with more than 10 employees. Net income of $7.6M.",
    },
    expect: [
      { label: "revenue $330.5M", read: (s) => s.revenueUsd, ...num(330_500_000) },
      { label: "growth 118% YoY", read: (s) => s.growthPct, ...num(118) },
      { label: "gross margin 81.5%", read: (s) => s.grossMarginPct, ...num(81.5) },
      { label: "expansion 140% read as retention", read: (s) => s.retentionPct, ...num(140) },
      { label: "50,800 customers", read: (s) => s.customers, ...num(50_800) },
    ],
  },
  {
    outcome: "succeeded",
    round: "Form S-1, August 2020",
    sources: [
      "https://www.sec.gov/Archives/edgar/data/1640147/000162828020013010/snowflakes-1.htm",
      "https://blog.publiccomps.com/snowflake-s1-ipo-teardown/",
    ],
    input: {
      name: "Snowflake",
      sector: "saas",
      stage: "growth",
      geography: "US",
      askUsd: 3_400_000_000,
      description:
        "Cloud data platform separating storage from compute so that warehousing, data engineering and data sharing run on consumption-priced clusters across multiple public clouds.",
      tractionNotes:
        "Revenue of $264.7M in the fiscal year ended 31 January 2020, up 174% year over year from $96.7M. Net revenue retention 158%. Net loss of $348.5M.",
    },
    expect: [
      { label: "revenue $264.7M", read: (s) => s.revenueUsd, ...num(264_700_000) },
      { label: "growth 174% YoY", read: (s) => s.growthPct, ...num(174) },
      { label: "net revenue retention 158%", read: (s) => s.retentionPct, ...num(158) },
    ],
  },
  {
    outcome: "succeeded",
    round: "Form F-1, April 2015",
    sources: [
      "https://www.sec.gov/Archives/edgar/data/1594805/000119312515129273/d863202df1.htm",
    ],
    input: {
      name: "Shopify",
      sector: "ecommerce",
      stage: "growth",
      geography: "CA",
      askUsd: 131_000_000,
      description:
        "Hosted commerce platform letting a merchant run storefront, payments, shipping and reporting from one subscription, with an app ecosystem and payment processing layered on top of the subscription.",
      tractionNotes:
        "Revenue of $105.0M in 2014, up 109% year over year. GMV of $3.8B in 2014. 162,261 merchants on the platform as of 31 March 2015.",
    },
    expect: [
      { label: "revenue $105.0M", read: (s) => s.revenueUsd, ...num(105_000_000) },
      { label: "growth 109% YoY", read: (s) => s.growthPct, ...num(109) },
      { label: "GMV $3.8B", read: (s) => s.gmvUsd, ...num(3_800_000_000) },
      { label: "162,261 merchants read as customers", read: (s) => s.customers, ...num(162_261) },
    ],
  },
  {
    outcome: "succeeded",
    round: "Form S-1, January 2010",
    sources: [
      "https://www.sec.gov/Archives/edgar/data/1318605/000119312510017054/ds1.htm",
      "https://www.sec.gov/Archives/edgar/data/1318605/000119312510149105/d424b4.htm",
    ],
    input: {
      name: "Tesla Motors",
      sector: "climate",
      stage: "growth",
      geography: "US",
      askUsd: 226_000_000,
      description:
        "Electric vehicles designed and assembled in-house, sold directly through company-owned stores, with the battery pack and powertrain also supplied to other manufacturers.",
      tractionNotes:
        "Revenue of $111.9M in 2009. Net loss of $55.7M in 2009. 937 Roadsters sold to customers in 18 countries as of 31 December 2009.",
    },
    expect: [
      { label: "revenue $111.9M", read: (s) => s.revenueUsd, ...num(111_900_000) },
      { label: "937 units delivered read as deployments", read: (s) => s.pilots, ...num(937) },
    ],
  },
];

// ── Reporting ───────────────────────────────────────────────────────────────

const money = (v: number) =>
  Math.abs(v) >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : Math.abs(v) >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${v.toLocaleString()}`;

const show = (v: number | boolean | null) =>
  v === null ? "null" : typeof v === "boolean" ? String(v) : Math.abs(v) >= 1e6 ? money(v) : String(v);

function matches(actual: number | boolean | null, e: Expectation): boolean {
  if (typeof e.expected === "boolean") return actual === e.expected;
  if (e.expected === 0) return actual === null || actual === 0; // "nothing to find"
  if (typeof actual !== "number") return false;
  const tol = e.tol ?? 0.02;
  return Math.abs(actual - e.expected) <= Math.abs(e.expected) * tol;
}

function main() {
  const rows: Array<{
    name: string; outcome: string; composite: number; verdict: string;
    coverage: number; found: number; parsed: string; flags: number;
  }> = [];
  const misses: string[] = [];

  for (const c of CASES) {
    const signals = parsePlanSignals(`${c.input.description} ${c.input.tractionNotes ?? ""}`);
    const r = analyze(c.input);

    let hit = 0;
    for (const e of c.expect) {
      const actual = e.read(signals);
      if (matches(actual, e)) hit++;
      else misses.push(`${c.input.name} — ${e.label}: engine read ${show(actual)}, source states ${show(e.expected)}`);
    }

    rows.push({
      name: c.input.name,
      outcome: c.outcome,
      composite: r.composite,
      verdict: r.strategy.verdict,
      coverage: r.signalCoverage,
      found: signals.fieldsFound,
      parsed: c.expect.length ? `${hit}/${c.expect.length}` : "— (control)",
      flags: r.redFlags.length,
    });
  }

  console.log("\nQVenture — disclosed-figures corpus (rubric v" + analyze(CASES[0].input).rubricVersion + ")");
  console.log("Every figure below is one the company disclosed at the named round.\n");
  console.log(
    "Company".padEnd(26) + "Outcome".padEnd(11) + "Score".padEnd(8) +
    "Verdict".padEnd(10) + "Coverage".padEnd(10) + "Fields".padEnd(8) + "Parsed".padEnd(12) + "Flags",
  );
  console.log("-".repeat(96));
  for (const r of rows) {
    console.log(
      r.name.padEnd(26) + r.outcome.padEnd(11) + r.composite.toFixed(1).padEnd(8) +
      r.verdict.padEnd(10) + (r.coverage * 100).toFixed(0).padEnd(9) + "%" +
      String(r.found).padEnd(8) + r.parsed.padEnd(12) + String(r.flags),
    );
  }

  const failed = rows.filter((r) => r.outcome === "failed");
  const succeeded = rows.filter((r) => r.outcome === "succeeded");
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const mf = mean(failed.map((r) => r.composite));
  const ms = mean(succeeded.map((r) => r.composite));

  const totalExpect = CASES.reduce((a, c) => a + c.expect.length, 0);
  const totalHit = totalExpect - misses.length;

  console.log("\n── Parse coverage on real filing prose ──");
  console.log(`Figures stated by the sources: ${totalExpect}   recovered by the engine: ${totalHit} (${((totalHit / totalExpect) * 100).toFixed(0)}%)`);
  if (misses.length) {
    console.log("\nNot recovered — each of these is a real filing figure the engine did not read:");
    for (const m of misses) console.log(`  ✗ ${m}`);
  } else {
    console.log("Every stated figure was recovered.");
  }

  console.log("\n── Separation on disclosed numbers ──");
  console.log(`mean(succeeded) ${ms.toFixed(1)}   mean(failed) ${mf.toFixed(1)}   gap ${(ms - mf).toFixed(1)} pts`);
  const worstSuccess = Math.min(...succeeded.map((r) => r.composite));
  const overlap = failed.filter((r) => r.composite >= worstSuccess);
  console.log(`Failures scoring at or above the weakest success (${worstSuccess.toFixed(1)}): ${overlap.length}/${failed.length}` +
    (overlap.length ? ` — ${overlap.map((r) => `${r.name} ${r.composite.toFixed(1)}`).join(", ")}` : ""));

  console.log(
    "\nThis is discrimination on disclosed evidence, not outcome prediction: the cases\n" +
    "were selected in 2026 knowing how each ended.\n",
  );
}

if (require.main === module) main();
