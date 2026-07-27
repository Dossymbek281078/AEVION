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
import { toUsd } from "../src/lib/metrics/currency";

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
  /**
   * "open" is not a hedge — it is the honest label for a company that is still
   * trading and whose story is not over. Forcing Rivian or Peloton into
   * failed/succeeded to pad the separation statistic would be picking the
   * outcome that suits the number. Open cases count toward parse coverage,
   * which needs no outcome, and are excluded from the separation figure.
   */
  outcome: "failed" | "succeeded" | "open";
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

  {
    outcome: "failed",
    round: "Form S-1, June 2017",
    sources: [
      "https://www.sec.gov/Archives/edgar/data/0001701114/000104746917003765/a2232259zs-1.htm",
      "https://thecounter.org/blue-aprons-revenue-could-top-1-billion-this-year-but-will-it-ever-make-a-profit/",
    ],
    input: {
      name: "Blue Apron",
      sector: "ecommerce",
      stage: "growth",
      geography: "US",
      askUsd: 300_000_000,
      description:
        "Meal-kit subscription: pre-portioned ingredients and recipes shipped weekly from company-operated fulfilment centres, with the menu and supply chain planned in-house.",
      tractionNotes:
        "Net revenue of $795.4M in 2016. Net loss of $54.9M in 2016. Marketing spend of $144.1M in 2016. Over 1,000,000 customers.",
    },
    expect: [
      { label: "revenue $795.4M", read: (s) => s.revenueUsd, ...num(795_400_000) },
      { label: "1,000,000 customers", read: (s) => s.customers, ...num(1_000_000) },
    ],
  },

  // ── Outcome: open — parse tests only, excluded from separation ─────────────
  {
    outcome: "open",
    round: "Form S-1, October 2021",
    sources: [
      "https://www.sec.gov/Archives/edgar/data/1874178/000119312521289903/d157488ds1.htm",
      "https://insideevs.com/news/537919/rivian-ipo-financial-losses-preorder/",
      "https://www.ttnews.com/articles/rivian-details-1-billion-loss-amazon-deal-ipo-filing",
    ],
    input: {
      name: "Rivian",
      sector: "climate",
      stage: "growth",
      geography: "US",
      askUsd: 8_000_000_000,
      description:
        "Electric pickup, SUV and commercial delivery van built on a shared skateboard platform, sold direct to consumers and to a single fleet customer under a long-term supply agreement.",
      tractionNotes:
        "Approximately 48,390 preorders in the United States and Canada as of 30 September 2021, each held with a $1,000 refundable deposit. Amazon has ordered 100,000 delivery vans through 2030. Net loss of $994M in the first six months of 2021.",
    },
    // The direct counterpart to Nikola: a real reservation book at a real
    // company that went on to ship. The engine must read the book the same way
    // in both cases — as demand, not as backlog.
    expect: [
      { label: "48,390 preorders read as reservations", read: (s) => s.reservations, ...num(48_390) },
      { label: "preorders are not contracted revenue", read: (s) => s.contractedRevenueUsd, expected: 0 },
      { label: "the $1,000 deposit is not read as revenue", read: (s) => s.revenueUsd, expected: 0 },
    ],
  },
  {
    outcome: "open",
    round: "IPO prospectus, London Stock Exchange, March 2021",
    sources: [
      "https://dealroom.co/uploaded/2021/04/Deliveroo-IPO-10-March-2021.pdf",
      "https://www.ig.com/en/news-and-trade-ideas/deliveroo-ipo-preview--losses-narrow-as-company-aims-to-raise-p1-210316",
    ],
    input: {
      name: "Deliveroo",
      sector: "marketplace",
      stage: "growth",
      geography: "UK",
      askUsd: 1_400_000_000,
      description:
        "Three-sided food delivery marketplace connecting restaurants, riders and consumers, with an editorial-free logistics network and company-operated delivery-only kitchens.",
      tractionNotes:
        "Gross transaction value of £4.1bn in 2020, up 64.3% from £2.5bn in 2019. Underlying loss of £223.7M in 2020, narrowed from £317.3M in 2019.",
    },
    // The only non-USD filing in the corpus. v5 claims money is read in the
    // currency it was quoted in and converted at a checked-in rate; that claim
    // had never been tested against a real filing that quotes pounds. The
    // expectation is computed with the same conversion the engine uses, so a
    // routine FX-table refresh cannot turn this red without a real defect.
    expect: [
      { label: "the plan is recognised as quoted in GBP", read: (s) => s.currency === "GBP", expected: true },
      { label: "GTV £4.1bn read and converted to USD", read: (s) => s.gmvUsd, ...num(toUsd(4_100_000_000, "GBP")) },
      { label: "growth 64.3% YoY", read: (s) => s.growthPct, ...num(64.3) },
      { label: "the rate is labelled as volume growth, not revenue growth", read: (s) => s.growthBasis === "gmv", expected: true },
    ],
  },
  {
    outcome: "open",
    round: "Form S-1, August 2019",
    sources: [
      "https://www.sec.gov/Archives/edgar/data/1639825/000119312519230923/d738839ds1.htm",
      "https://www.forbes.com/sites/bizcarson/2019/08/27/peloton-bike-ipo-filing/",
    ],
    input: {
      name: "Peloton",
      sector: "consumer",
      stage: "growth",
      geography: "US",
      askUsd: 1_200_000_000,
      description:
        "Connected fitness: company-designed stationary bikes and treadmills sold with a recurring subscription to live and on-demand classes, with content produced in an owned studio.",
      tractionNotes:
        "Revenue of $915M in the fiscal year ended 30 June 2019. 511,202 Connected Fitness Subscribers as of 30 June 2019. Net loss of $195.6M.",
    },
    expect: [
      { label: "revenue $915M", read: (s) => s.revenueUsd, ...num(915_000_000) },
      { label: "511,202 subscribers", read: (s) => s.customers, ...num(511_202) },
    ],
  },
  {
    outcome: "open",
    round: "Form S-1, April 2019",
    sources: [
      "https://stockdividendscreener.com/packaged-foods/beyond-meat-bynd-sales-revenue/",
      "https://www.globenewswire.com/news-release/2020/02/27/1992251/0/en/Beyond-Meat-Reports-Fourth-Quarter-and-Full-Year-2019-Financial-Results.html",
    ],
    input: {
      name: "Beyond Meat",
      sector: "agtech",
      stage: "growth",
      geography: "US",
      askUsd: 240_000_000,
      description:
        "Plant-based meat substitutes manufactured to sit in the meat case rather than the vegetarian aisle, sold through grocery retail and foodservice partners.",
      tractionNotes:
        "Net revenues of $87.9M in 2018. Gross profit of $17.6M, or 20% of net revenue.",
    },
    // "Gross profit of $X, or N% of net revenue" is how filings state a margin
    // when they do not use the words "gross margin".
    expect: [
      { label: "revenue $87.9M", read: (s) => s.revenueUsd, ...num(87_900_000) },
      { label: "gross margin 20% stated as a share of revenue", read: (s) => s.grossMarginPct, ...num(20) },
    ],
  },

  {
    outcome: "open",
    round: "Form S-1, November 2020",
    sources: [
      "https://www.sec.gov/Archives/edgar/data/1820953/000110465920126927/tm2026663-4_s1.htm",
      "https://www.meritechcapital.com/blog/affirm-ipo-s-1-breakdown",
      "https://www.pymnts.com/buy-now-pay-later/2020/affirm-ipo-filing-shows-narrowing-losses-surging-gmv/",
    ],
    input: {
      name: "Affirm",
      sector: "fintech",
      stage: "growth",
      geography: "US",
      askUsd: 1_200_000_000,
      description:
        "Point-of-sale instalment lending integrated into a merchant's checkout, underwriting each transaction individually and funding the loans through bank partners and securitisation.",
      tractionNotes:
        "GMV of $4.6B in the fiscal year ended 30 June 2020, up 77% year over year. Revenue of $509.5M, up 93% year over year. Net loss of $112.6M. One merchant accounted for 28% of revenue.",
    },
    expect: [
      { label: "GMV $4.6B", read: (s) => s.gmvUsd, ...num(4_600_000_000) },
      { label: "revenue $509.5M", read: (s) => s.revenueUsd, ...num(509_500_000) },
      { label: "growth 93% YoY", read: (s) => s.growthPct, ...num(93) },
    ],
  },
  {
    outcome: "open",
    round: "Form S-1, June 2011",
    sources: [
      "https://www.sec.gov/Archives/edgar/data/0001490281/000104746911005613/a2203913zs-1.htm",
      "https://money.cnn.com/2011/08/10/technology/groupon_accounting/index.htm",
    ],
    input: {
      name: "Groupon",
      sector: "marketplace",
      stage: "growth",
      geography: "US",
      askUsd: 750_000_000,
      description:
        "Daily-deal marketplace selling discounted local vouchers to an email subscriber list, with a direct sales force signing merchants city by city.",
      tractionNotes:
        "Revenue of $1.5B in the first half of 2011, up from $131.5M in the first half of 2010. 115.7 million subscribers as of 30 June 2011, up from 10.4 million a year earlier.",
    },
    expect: [
      { label: "revenue $1.5B", read: (s) => s.revenueUsd, ...num(1_500_000_000) },
      { label: "115.7 million subscribers", read: (s) => s.customers, ...num(115_700_000) },
    ],
  },

  {
    outcome: "open",
    round: "Form S-1, June 2020",
    sources: [
      "https://www.sec.gov/Archives/edgar/data/1691421/000104746920003846/a2241899zs-1a.htm",
      "https://medium.com/thomvest-ventures/unpacking-lemonades-s-1-filing-7510d7826eae",
      "https://iansbnr.com/the-definitive-break-down-of-the-lemonade-s1/",
    ],
    input: {
      name: "Lemonade",
      sector: "fintech",
      stage: "growth",
      geography: "US",
      askUsd: 300_000_000,
      description:
        "Renters and homeowners insurance sold entirely through an app, underwriting and claims handled by the company's own models with reinsurance carrying most of the risk.",
      tractionNotes:
        "In-force premium of $116M in 2019, up from $47M in 2018 and $9M in 2017. In-force premium of $133M as of 31 March 2020. 730,000 policyholders as of 31 March 2020.",
    },
    // An insurer's headline number is not revenue and its customers are not
    // called customers. Neither vocabulary existed in the parser.
    expect: [
      // The filing states two in-force premium figures — $116M for 2019 and
      // $133M as of Q1 2020. Both are true; the later one is the company as it
      // stands, and scoring 2019 because it was typed first was an accident of
      // the regex rather than a reading.
      { label: "in-force premium read at the LATEST disclosed period", read: (s) => s.revenueUsd, ...num(133_000_000) },
      { label: "730,000 policyholders read as customers", read: (s) => s.customers, ...num(730_000) },
    ],
  },

  {
    outcome: "open",
    round: "Form S-1, September 2021",
    sources: [
      "https://www.sec.gov/Archives/edgar/data/1819994/000119312521282501/d212874ds1.htm",
    ],
    input: {
      name: "Rocket Lab",
      sector: "space",
      stage: "growth",
      geography: "US",
      askUsd: 750_000_000,
      description:
        "Small-satellite launch provider operating its own vehicle and launch complex, selling launch services and satellite components to government and commercial customers.",
      tractionNotes:
        "As of 30 June 2021, backlog totaled $141.4 million. Electron has delivered 105 satellites to orbit for government and commercial customers across 18 successful missions through July 2021.",
    },
    // The non-SaaS evidence readers — contracted backlog, missions flown — have
    // only ever met fixtures this repository wrote for itself. This is the first
    // real filing to state them: a launch company whose entire case is a signed
    // order book and a flight record, with no ARR, no churn and no margin.
    expect: [
      { label: "backlog $141.4M read as contracted revenue", read: (s) => s.contractedRevenueUsd, ...num(141_400_000) },
      { label: "18 successful missions count as technical proof", read: (s) => s.technicalProof.length > 0, expected: true },
    ],
  },

  {
    outcome: "open",
    round: "Form S-1, June 2015",
    sources: [
      "https://www.sec.gov/Archives/edgar/data/1469367/000119312515234545/d880891ds1.htm",
    ],
    input: {
      name: "Sunrun",
      sector: "climate",
      stage: "growth",
      geography: "US",
      askUsd: 250_000_000,
      description:
        "Residential solar sold as a service: the company owns the system on the customer's roof and sells them the power it produces under a long-term contract, rather than selling the hardware.",
      tractionNotes:
        "We have deployed an aggregate of 430 megawatts as of March 31, 2015, serving approximately 79,000 customers. Systems are sold under a 20-year initial term.",
    },
    // The shape that forced a new signal rather than a wider regex: for a solar,
    // storage or grid company the installed base IS the business, and the engine
    // read such a plan as a customer count and nothing else.
    expect: [
      { label: "430 MW deployed read as capacity", read: (s) => s.capacityDeployedMw, ...num(430) },
      { label: "79,000 customers", read: (s) => s.customers, ...num(79_000) },
    ],
  },

  // ── Outcome: succeeded ────────────────────────────────────────────────────
  {
    outcome: "succeeded",
    round: "Form F-1, June 2016 (NYSE / Tokyo dual listing)",
    sources: [
      "https://www.sec.gov/Archives/edgar/data/1611820/000119312516618753/d728446df1.htm",
    ],
    input: {
      name: "LINE",
      sector: "consumer",
      stage: "growth",
      geography: "JP",
      askUsd: 1_300_000_000,
      description:
        "Mobile messaging platform monetised through stickers, advertising and games rather than subscriptions, with its largest markets in Japan, Taiwan, Thailand and Indonesia.",
      tractionNotes:
        "Revenues of ¥120,406 million in 2015, up from ¥86,366 million in 2014. 218 million monthly active users globally in March 2016.",
    },
    // The third currency and the first Asian filing: yen figures written with
    // the ¥ symbol and "million" as the unit word. The conversion is computed
    // with the engine's own rate, as with the pound and the euro.
    expect: [
      { label: "the plan is recognised as quoted in JPY", read: (s) => s.currency === "JPY", expected: true },
      { label: "revenue ¥120,406M read and converted", read: (s) => s.revenueUsd, ...num(toUsd(120_406_000_000, "JPY")) },
      { label: "218 million monthly active users read as customers", read: (s) => s.customers, ...num(218_000_000) },
    ],
  },
  {
    outcome: "succeeded",
    round: "Form S-1, November 2018",
    sources: [
      "https://www.sec.gov/Archives/edgar/data/1682852/000119312518323562/d577473ds1.htm",
    ],
    input: {
      name: "Moderna",
      sector: "biotech",
      stage: "growth",
      geography: "US",
      askUsd: 600_000_000,
      description:
        "Messenger RNA platform: one delivery and manufacturing approach applied across vaccines, therapeutics and oncology, funded by pharmaceutical collaborations and government grants rather than by selling a product.",
      tractionNotes:
        "Total revenue of $205.8M in 2017, up 90% from $108.4M in 2016. Total revenue decreased by $14.3 million, or 13%, to $99.6 million for the nine months ended 30 September 2018. A pipeline of 21 development candidates. Activity observed in Phase 1 trials for six out of seven clinical programs.",
    },
    // The shape the corpus lacked: a science company with no product revenue,
    // whose evidence is a pipeline and a trial phase, and whose most recent
    // disclosed period is a DECLINE against a prior year of 90% growth. The
    // MD&A phrasing that states it — "decreased by $14.3 million, or 13%, to
    // $99.6 million" — is what forced the connector between a direction verb
    // and its figure to be constrained by shape rather than by length.
    expect: [
      { label: "the latest period wins over the flattering prior year", read: (s) => s.revenueUsd, ...num(99_600_000) },
      { label: "the most recent move is read as a decline", read: (s) => s.growthPct, ...num(-13) },
      { label: "the Phase 1 programme counts as a milestone reached", read: (s) => s.regulatoryMilestones.length > 0, expected: true },
    ],
  },
  {
    outcome: "succeeded",
    round: "Form F-1, November 2021",
    sources: [
      "https://www.sec.gov/Archives/edgar/data/1691493/000119312521314359/d213207df1.htm",
      "https://techcrunch.com/2021/11/01/nubanks-ipo-filing-gives-us-a-peek-into-neobank-economics/",
      "https://pitchbook.com/news/articles/nubank-brazil-s1-ipo-breakdown",
    ],
    input: {
      name: "Nubank",
      sector: "fintech",
      stage: "growth",
      geography: "BR",
      askUsd: 2_600_000_000,
      description:
        "Digital bank operating without branches across Brazil, Mexico and Colombia, acquiring customers through a fee-free credit card and cross-selling deposits, lending and investments on the same account.",
      tractionNotes:
        "Revenue of $1.06B in the nine months ended 30 September 2021, up 98% year over year from $534M. 48.1 million active customers as of 30 September 2021. Monthly average revenue per active customer of approximately $4.",
    },
    // A bank's disclosure shape: a customer base an order of magnitude larger
    // than any SaaS case in the corpus, and a period that is neither a fiscal
    // year nor a quarter.
    expect: [
      { label: "revenue $1.06B (nine months)", read: (s) => s.revenueUsd, ...num(1_060_000_000) },
      { label: "growth 98% YoY attributed to revenue", read: (s) => s.growthPct, ...num(98) },
      { label: "48.1 million active customers", read: (s) => s.customers, ...num(48_100_000) },
    ],
  },
  {
    outcome: "succeeded",
    round: "Form F-1 / 424(b)(4), September 2014",
    sources: [
      "https://www.sec.gov/Archives/edgar/data/1577552/000119312514347620/d709111d424b4.htm",
    ],
    input: {
      name: "Alibaba Group",
      sector: "marketplace",
      stage: "growth",
      geography: "CN",
      askUsd: 21_800_000_000,
      description:
        "Online marketplaces connecting Chinese consumers, merchants and wholesalers, monetised through advertising and commission rather than by taking inventory.",
      tractionNotes:
        "Revenue of RMB52,504 million in the fiscal year ended 31 March 2014, up 52.1% from RMB34,517 million. GMV of RMB1,833 billion across the China retail marketplaces in the twelve months ended 30 June 2014, from 279 million active buyers and 8.5 million active sellers.",
    },
    // The third non-USD filing and the first in yuan. As with Deliveroo and
    // Adyen the conversion is computed with the engine's own rate, so the
    // corpus does not redden when the FX table is refreshed.
    expect: [
      { label: "the plan is recognised as quoted in CNY", read: (s) => s.currency === "CNY", expected: true },
      { label: "revenue RMB52,504M read and converted", read: (s) => s.revenueUsd, ...num(toUsd(52_504_000_000, "CNY")) },
      { label: "growth 52.1% YoY, attributed to revenue", read: (s) => s.growthPct, ...num(52.1) },
      { label: "GMV RMB1,833bn read and converted", read: (s) => s.gmvUsd, ...num(toUsd(1_833_000_000_000, "CNY")) },
      { label: "279 million active buyers read as customers", read: (s) => s.customers, ...num(279_000_000) },
    ],
  },
  {
    outcome: "succeeded",
    round: "IPO prospectus, Euronext Amsterdam, June 2018",
    sources: [
      "https://www.adyen.com/press-and-media/prospectus-price-range-release",
      "https://www.adyen.com/press-and-media/adyen-announces-intention-to-launch-an-offering-and-listing-of-its-shares-on-euronext-amsterdam",
    ],
    input: {
      name: "Adyen",
      sector: "fintech",
      stage: "growth",
      geography: "NL",
      askUsd: 1_000_000_000,
      description:
        "Single-platform payment processing for large merchants, with acquiring, gateway and risk on one stack rather than stitched from separate providers.",
      tractionNotes:
        "Net revenue of €218M in 2017, up 38% year over year. Processed volume of €108bn in 2017, up from €66bn in 2016.",
    },
    // The second non-USD filing, and the first in euros. Same reason as
    // Deliveroo: the conversion is computed with the engine's own rate so an FX
    // refresh cannot redden the corpus without a real defect.
    expect: [
      { label: "the plan is recognised as quoted in EUR", read: (s) => s.currency === "EUR", expected: true },
      { label: "net revenue €218M read and converted", read: (s) => s.revenueUsd, ...num(toUsd(218_000_000, "EUR")) },
      { label: "growth 38% YoY", read: (s) => s.growthPct, ...num(38) },
      { label: "processed volume €108bn read as GMV", read: (s) => s.gmvUsd, ...num(toUsd(108_000_000_000, "EUR")) },
    ],
  },
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
  // ── First two cases whose figures were never quoted in dollars ────────────
  // Every other case in this corpus comes from a filing that states money in
  // USD, or converts to it. These two do not: an Indian issuer reports in
  // rupee crore and a Kazakh one in tenge. Between them they surfaced four
  // defects — the crore scale word, the date-as-metric read, "revenue from
  // operations", and a segment name sitting between a metric and its figure —
  // none of which any invented fixture had reason to contain.
  {
    outcome: "open",
    round: "Form 6-K, quarter ended 30 June 2026",
    sources: [
      "https://www.sec.gov/Archives/edgar/data/1067491/000106749126000034/exv99w03.htm",
      "https://www.sec.gov/Archives/edgar/data/1067491/000106749126000034/exv99w02.htm",
    ],
    input: {
      name: "Infosys",
      sector: "saas",
      stage: "growth",
      geography: "IN",
      askUsd: 500_000_000,
      description:
        "IT services and consulting delivered from India to enterprise clients worldwide, billed on time-and-materials and fixed-price contracts.",
      tractionNotes:
        "Revenue from operations was ₹48,211 crore for the quarter. Operating margin at 21.1%. Reported revenues at $5,082 million, growth of 2.8% YoY. TCV of large deal wins was $3.6 billion.",
    },
    expect: [
      // The engine reads the dollar figure the same release also states, which
      // is the correct choice: it is the later, unconverted number. The crore
      // figure is checked on its own below, where nothing competes with it.
      { label: "revenue $5,082M", read: (s) => s.revenueUsd, ...num(5_082_000_000) },
      // Operating margin is not gross margin, and reading one as the other would
      // credit a cost structure the filing never states. Boolean, not a figure,
      // so it is not counted as a disclosed number the engine failed to find.
      { label: "operating margin 21.1% is not mistaken for gross margin", read: (s) => s.grossMarginPct === null, expected: true },
      { label: "growth 2.8% YoY", read: (s) => s.growthPct, ...num(2.8) },
      { label: "growth period is YoY", read: (s) => s.growthPeriod === "YoY", expected: true },
      { label: "backlog $3.6bn of large-deal TCV", read: (s) => s.contractedRevenueUsd, ...num(3_600_000_000) },
    ],
  },
  {
    outcome: "open",
    round: "Form 6-K, quarter ended 30 June 2026 (rupee release)",
    sources: ["https://www.sec.gov/Archives/edgar/data/1067491/000106749126000034/exv99w03.htm"],
    input: {
      name: "Infosys (rupee release)",
      sector: "saas",
      stage: "growth",
      geography: "IN",
      askUsd: 500_000_000,
      description:
        "The same quarter as filed with the Indian stock exchanges, stating every figure in rupee crore rather than dollars.",
      tractionNotes:
        "Revenue from operations was ₹48,211 crore for the quarter.",
    },
    expect: [
      {
        label: "revenue ₹48,211 crore read and converted",
        read: (s) => s.revenueUsd,
        ...num(toUsd(482_110_000_000, "INR"), 0.02),
      },
    ],
  },
  {
    outcome: "open",
    round: "Form 20-F, year ended 31 December 2025",
    sources: ["https://www.sec.gov/Archives/edgar/data/1985487/000198548726000008/kspi-20251231.htm"],
    input: {
      name: "Kaspi.kz",
      sector: "marketplace",
      stage: "growth",
      geography: "KZ",
      askUsd: 1_000_000_000,
      description:
        "A super app combining a marketplace, a payments network and a consumer finance business, used by most of the adult population of Kazakhstan and expanding into Türkiye.",
      tractionNotes:
        "GMV of our Marketplace segment including Türkiye was ₸9,053 billion, which is an increase of 52%. Kaspi.kz Super App had 10.7 million Average MAU. Kaspi Pay Super App had approximately 764,000 Active Merchants.",
    },
    expect: [
      {
        label: "GMV ₸9,053bn read and converted",
        read: (s) => s.gmvUsd,
        ...num(toUsd(9_053_000_000_000, "KZT"), 0.02),
      },
      { label: "growth 52%", read: (s) => s.growthPct, ...num(52) },
      { label: "10.7 million Average MAU read as the customer count", read: (s) => s.customers, ...num(10_700_000) },
      // The year in "year ended 31 December 2025" must not become a figure.
      { label: "no metric equals the year", read: (s) => s.revenueUsd === 2025 || s.customers === 2025 || s.gmvUsd === 2025, expected: false },
    ],
  },

  {
    outcome: "open",
    round: "Form 20-F, year ended 31 December 2025",
    sources: ["https://www.sec.gov/Archives/edgar/data/1850235/000110465926053195/heps-20251231x20f.htm"],
    input: {
      name: "Hepsiburada (D-MARKET)",
      sector: "marketplace",
      stage: "growth",
      geography: "TR",
      askUsd: 300_000_000,
      description:
        "A Turkish e-commerce platform running a first-party direct sales business alongside a third-party marketplace, with its own delivery and payments services.",
      tractionNotes:
        "Our revenues increased by 13.4% to TRY 84.7 billion in the year ended December 31, 2025, from TRY 74.7 billion in the year ended December 31, 2024, and our GMV increased by 4.3% to TRY 257.5 billion. We served approximately 11.8 million Active Customers. In 2025, we incurred a net loss of TRY 5,699.2 million compared to a net loss of TRY 2,100.7 million and net income of TRY 142.8 million for the years ended December 31, 2024 and 2023, respectively.",
    },
    expect: [
      {
        label: "revenue TRY 84.7bn read and converted",
        read: (s) => s.revenueUsd,
        ...num(toUsd(84_700_000_000, "TRY"), 0.02),
      },
      {
        label: "GMV TRY 257.5bn read from the \"increased by X% to Y\" form",
        read: (s) => s.gmvUsd,
        ...num(toUsd(257_500_000_000, "TRY"), 0.02),
      },
      { label: "growth 13.4% is attributed to revenue, not GMV", read: (s) => s.growthPct, ...num(13.4) },
      { label: "growth basis names the top line", read: (s) => s.growthBasis === "revenue", expected: true },
      { label: "11.8 million Active Customers", read: (s) => s.customers, ...num(11_800_000) },
      // Two currencies-worth of figures and four years in one sentence: nothing
      // may come back as 2024 or 2025.
      { label: "no metric equals a year in the sentence", read: (s) => [s.revenueUsd, s.gmvUsd, s.customers].some((v) => v === 2024 || v === 2025), expected: false },
    ],
  },

  {
    outcome: "open",
    round: "Form 20-F, year ended 31 December 2025",
    sources: ["https://www.sec.gov/Archives/edgar/data/1046179/000162828026025362/tsm-20251231.htm"],
    input: {
      name: "TSMC",
      sector: "hardware",
      stage: "growth",
      geography: "TW",
      askUsd: 2_000_000_000,
      description:
        "Contract manufacture of integrated circuits for fabless chip designers, on leading-edge process nodes built in the R.O.C. and increasingly overseas.",
      tractionNotes:
        "Net revenue was NT$3,809,054 million in 2025, a 31.6% increase over 2024. In 2025, our gross margin increased to 59.9% of net revenue from 56.1% in 2024.",
    },
    expect: [
      {
        label: "net revenue NT$3,809,054M read and converted",
        read: (s) => s.revenueUsd,
        ...num(toUsd(3_809_054_000_000, "TWD"), 0.02),
      },
      { label: "gross margin 59.9%", read: (s) => s.grossMarginPct, ...num(59.9) },
      // The filing writes growth as a NOUN — "a 31.6% increase over 2024" — and
      // every growth pattern was built from a verb. Closed the same session it
      // was recorded; this assertion was written asserting the miss, and went
      // red the moment the miss was fixed, which is what it was for.
      { label: "growth 31.6% stated as a noun", read: (s) => s.growthPct, ...num(31.6) },
      { label: "the growth is attributed to revenue", read: (s) => s.growthBasis === "revenue", expected: true },
      // The margin rose 3.8 points from 56.1% to 59.9%. Neither number is a
      // growth rate, and both used to be read as one.
      { label: "the margin is not also counted as growth", read: (s) => s.growthPct === 59.9 || s.growthPct === 56.1, expected: false },
      { label: "the prior-year margin does not win over the current one", read: (s) => s.grossMarginPct === 56.1, expected: false },
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
