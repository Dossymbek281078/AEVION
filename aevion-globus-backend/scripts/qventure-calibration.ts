/**
 * QVenture — rubric calibration harness
 * ─────────────────────────────────────
 * Runs the deterministic engine over companies whose commercial outcome is now
 * public, and reports how the rubric separated them.
 *
 * ⚠️ WHAT THIS DOES AND DOES NOT MEASURE
 *
 * These are NOT real pitch decks. Each description was reconstructed from public
 * information as it stood at the named round, by an author who already knew the
 * outcome. That is hindsight bias in the input, and no amount of care fully
 * removes it — so this harness CANNOT establish predictive accuracy, and any
 * "hit rate" it prints must not be quoted as one.
 *
 * What it does measure, usefully:
 *   1. Discrimination — does the rubric spread known-failed and known-succeeded
 *      companies apart at all, or does it compress everything to the middle?
 *      (Before the adverse-disclosure fix it compressed: nothing scored "pass".)
 *   2. Range — are both ends of the 0-100 scale actually reachable on realistic
 *      input, or is the usable band much narrower than advertised?
 *   3. Regression — if a rubric change collapses the gap between the two groups,
 *      that shows up here immediately.
 *
 * Rule followed when writing the descriptions: state only what was publicly
 * claimed or reported at the time of that round. No outcome language, no
 * foreshadowing, no post-mortem framing on the failures — several of them were
 * enormously well-regarded at the round described.
 *
 * Usage: npx tsx scripts/qventure-calibration.ts
 */

import { analyze, type AnalysisInput } from "../src/lib/qventure/engine";

/** outcome: "failed" = wound down / fire-sale / fraud finding. "succeeded" = durable large outcome. */
const CASES: Array<AnalysisInput & { outcome: "failed" | "succeeded" }> = [
  // ── Outcome: failed ───────────────────────────────────────────────────────
  { name: "Quibi", sector: "consumer", stage: "series-a", geography: "US", askUsd: 750_000_000, outcome: "failed",
    description: "Short-form premium video for mobile: professionally produced shows in under-10-minute chapters, built for commuting and queueing. Founded by a studio chairman and a former tech CEO, with major studio content commitments and a subscription model.",
    tractionNotes: "Pre-launch. No revenue, no users. Content slate contracted with top-tier studios and talent." },
  { name: "Juicero", sector: "consumer", stage: "series-a", geography: "US", askUsd: 120_000_000, outcome: "failed",
    description: "Connected countertop press that squeezes single-serve produce packs into cold-pressed juice, with QR-verified freshness and a subscription pack service. Hardware sells at $699 with recurring pack margin.",
    tractionNotes: "Early retail placement. Hardware gross margin negative at current volumes; packs carry the economics." },
  { name: "Zume Pizza", sector: "logistics", stage: "series-a", geography: "US", askUsd: 375_000_000, outcome: "failed",
    description: "Robot-assembled pizza cooked by onboard ovens during delivery, timed so the pie finishes baking as the van arrives. Vertically integrated kitchen robotics plus a predictive routing stack.",
    tractionNotes: "Limited regional delivery footprint. Capital intensity high; each van carries bespoke oven hardware." },
  { name: "Fast", sector: "fintech", stage: "series-a", geography: "US", askUsd: 102_000_000, outcome: "failed",
    description: "One-click checkout identity that works across any merchant, removing account creation and card entry from online purchase. Merchant-side JavaScript install, consumer-side passwordless login.",
    tractionNotes: "Merchant installs growing; transaction volume small relative to burn. Incumbent checkout options bundled free by major platforms." },
  { name: "IRL", sector: "consumer", stage: "series-a", geography: "US", askUsd: 170_000_000, outcome: "failed",
    description: "Group messaging and events app for Gen Z, organising real-world meetups around shared interests with calendar and group-chat primitives.",
    tractionNotes: "Reported roughly 20 million monthly users. Engagement and retention cohorts not independently audited." },
  { name: "Olive AI", sector: "healthtech", stage: "growth", geography: "US", askUsd: 400_000_000, outcome: "failed",
    description: "Automation layer for hospital revenue-cycle and administrative workflows, marketed as an AI workforce that handles eligibility checks, prior authorisation and claim status across health systems.",
    tractionNotes: "Deployed across hundreds of hospitals. Delivery heavily services-led; product breadth spread across many workflows." },
  { name: "Katerra", sector: "proptech", stage: "growth", geography: "US", askUsd: 865_000_000, outcome: "failed",
    description: "End-to-end technology-driven construction: owns design, factory-based component manufacturing, supply chain and general contracting to remove margin stacking from building.",
    tractionNotes: "Large contracted pipeline. Vertical integration requires factories and a full construction workforce; margins thin across every stage." },
  { name: "Convoy", sector: "logistics", stage: "growth", geography: "US", askUsd: 260_000_000, outcome: "failed",
    description: "Digital freight marketplace matching shippers with carrier capacity, automating brokerage pricing and load assignment to cut empty miles.",
    tractionNotes: "Substantial gross bookings. Brokerage take rate thin and cyclical; incumbents and other digital brokers compete on the same lanes." },
  { name: "Britishvolt", sector: "climate", stage: "series-a", geography: "UK", askUsd: 200_000_000, outcome: "failed",
    description: "Domestic gigafactory for EV battery cells, sited to serve European automakers seeking supply-chain localisation, with plans for renewable-powered cell production at scale.",
    tractionNotes: "Pre-revenue. Site secured, offtake agreements in discussion. Capital requirement in the billions before first commercial cell." },
  { name: "Arrival", sector: "climate", stage: "growth", geography: "UK", askUsd: 660_000_000, outcome: "failed",
    description: "Electric commercial vehicles built in small robotised microfactories rather than conventional assembly lines, targeting fleet buyers with lower unit capex per plant.",
    tractionNotes: "Pre-revenue with a large stated order book. Microfactory approach unproven at production volume." },
  { name: "Airlift", sector: "ecommerce", stage: "series-a", geography: "PK", askUsd: 85_000_000, outcome: "failed",
    description: "Quick-commerce delivery of groceries and essentials in under 30 minutes from dark stores in emerging-market cities, with aggressive discounting to build habit.",
    tractionNotes: "Rapid order growth across several cities. Contribution margin negative per order at current discount levels." },
  { name: "Pear Therapeutics", sector: "healthtech", stage: "growth", geography: "US", askUsd: 100_000_000, outcome: "failed",
    description: "Prescription digital therapeutics: FDA-authorised software treatments for substance use disorder and insomnia, prescribed by clinicians and intended for payer reimbursement.",
    tractionNotes: "Multiple FDA authorisations secured. Prescriptions written growing; reimbursement coverage by payers still being established case by case." },

  // ── Outcome: succeeded ────────────────────────────────────────────────────
  { name: "Stripe", sector: "fintech", stage: "seed", geography: "US", askUsd: 2_000_000, outcome: "succeeded",
    description: "Payments API that lets a developer accept card payments with a few lines of code, replacing the merchant-account and gateway setup that takes weeks. Handles compliance, fraud and payouts behind a single integration.",
    tractionNotes: "Early developer adoption strong; integration time measured in hours versus weeks for incumbents. Revenue per transaction at standard interchange-plus pricing." },
  { name: "Figma", sector: "saas", stage: "series-a", geography: "US", askUsd: 14_000_000, outcome: "succeeded",
    description: "Browser-based collaborative interface design tool where multiple designers and engineers edit the same file simultaneously, removing file handoff and version conflicts from product design.",
    tractionNotes: "Design teams adopting bottom-up; multiplayer editing drives team-wide expansion from a single seat. Retention strong within adopting teams." },
  { name: "Datadog", sector: "saas", stage: "series-a", geography: "US", askUsd: 15_000_000, outcome: "succeeded",
    description: "Unified monitoring for cloud infrastructure and applications, correlating metrics, traces and logs in one platform so operations and development teams work from the same data.",
    tractionNotes: "Usage-based revenue expanding with customer infrastructure; net revenue retention well above 100%. Land-and-expand from single-team adoption." },
  { name: "Snowflake", sector: "saas", stage: "series-a", geography: "US", askUsd: 26_000_000, outcome: "succeeded",
    description: "Cloud-native data warehouse that separates storage from compute, letting customers scale query capacity independently and pay only for what runs. Runs across major cloud providers.",
    tractionNotes: "Enterprise data teams migrating from on-premise appliances; consumption revenue grows with data volume. Strong expansion within accounts." },
  { name: "Canva", sector: "saas", stage: "seed", geography: "AU", askUsd: 3_000_000, outcome: "succeeded",
    description: "Browser-based design tool that lets non-designers produce professional graphics from templates, with a freemium model converting to subscription for teams and premium assets.",
    tractionNotes: "Fast free-tier signup growth with meaningful free-to-paid conversion. Gross margin typical of self-serve software." },
  { name: "Wiz", sector: "cybersecurity", stage: "seed", geography: "IL", askUsd: 21_000_000, outcome: "succeeded",
    description: "Agentless cloud security platform that scans an entire cloud estate from the API layer, building a graph of exposures and prioritising the few attack paths that actually reach crown-jewel assets.",
    tractionNotes: "Enterprise deals closing unusually fast for security; agentless deployment removes the rollout friction that slows incumbents. Founding team previously built and sold a cloud security company." },
  { name: "Databricks", sector: "ai_infra", stage: "series-a", geography: "US", askUsd: 33_000_000, outcome: "succeeded",
    description: "Managed platform for large-scale data processing and machine learning built by the creators of Apache Spark, unifying data engineering and model training on one substrate.",
    tractionNotes: "Enterprise adoption driven by existing open-source usage; consumption revenue scales with workload. Strong technical founding team from academia." },
  { name: "CrowdStrike", sector: "cybersecurity", stage: "series-a", geography: "US", askUsd: 26_000_000, outcome: "succeeded",
    description: "Cloud-delivered endpoint protection using a lightweight sensor that streams telemetry to a shared threat graph, so detections learned at one customer protect all others.",
    tractionNotes: "Enterprise wins against signature-based incumbents. Shared telemetry improves detection with each added customer; subscription revenue per endpoint." },
  { name: "Rippling", sector: "saas", stage: "series-a", geography: "US", askUsd: 45_000_000, outcome: "succeeded",
    description: "Unified employee system of record connecting payroll, benefits, devices and app access, so onboarding or offboarding a person propagates across every downstream system automatically.",
    tractionNotes: "Multi-product attach from day one; customers adopting several modules raise contract value and switching cost. Founder previously built a payroll company." },
  { name: "Deel", sector: "saas", stage: "seed", geography: "US", askUsd: 14_000_000, outcome: "succeeded",
    description: "Compliant hiring and payroll for international contractors and employees, handling local contracts, tax and payments across many jurisdictions through one interface.",
    tractionNotes: "Revenue growing rapidly off remote-hiring demand; per-worker recurring fee with expansion as customers hire more. Regulatory coverage per country is the operational moat." },
  { name: "Anduril", sector: "space", stage: "series-a", geography: "US", askUsd: 41_000_000, outcome: "succeeded",
    description: "Autonomous defence systems built as software-first products — sensor towers, counter-drone interceptors and a common autonomy platform — sold to defence and border agencies as products rather than cost-plus programmes.",
    tractionNotes: "Early government contracts secured. Product-based procurement model contrasts with incumbent cost-plus primes; hardware capital intensity meaningful." },
  { name: "Airbnb", sector: "marketplace", stage: "seed", geography: "US", askUsd: 600_000, outcome: "succeeded",
    description: "Marketplace for booking rooms and homes from private hosts, with payments, reviews and identity handled by the platform so strangers can transact on accommodation.",
    tractionNotes: "Bookings growing week over week off a small base; repeat booking behaviour visible. Two-sided liquidity building city by city." },
];

function pct(n: number, d: number) { return d === 0 ? "0.0" : ((n / d) * 100).toFixed(1); }
function mean(xs: number[]) { return xs.reduce((a, b) => a + b, 0) / xs.length; }
function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function run() {
  console.log("\nQVenture rubric calibration");
  console.log("⚠️  Reconstructed descriptions, written with knowledge of the outcome.");
  console.log("    This measures rubric DISCRIMINATION and RANGE — never predictive accuracy.\n");

  const rows = CASES.map((c) => {
    const r = analyze({
      name: c.name, sector: c.sector, stage: c.stage, geography: c.geography,
      askUsd: c.askUsd, description: c.description, tractionNotes: c.tractionNotes,
    });
    return { ...c, composite: r.composite, verdict: r.strategy.verdict, flags: r.redFlags.length };
  });

  const w = Math.max(...rows.map((r) => r.name.length));
  for (const group of ["failed", "succeeded"]) {
    console.log(`── Outcome: ${group} ──`);
    for (const r of rows.filter((x) => x.outcome === group).sort((a, b) => a.composite - b.composite)) {
      console.log(`  ${r.name.padEnd(w)}  ${String(r.composite).padStart(5)}  ${r.verdict.padEnd(6)}  ${r.flags} flag(s)`);
    }
    console.log("");
  }

  const failed = rows.filter((r) => r.outcome === "failed").map((r) => r.composite);
  const ok = rows.filter((r) => r.outcome === "succeeded").map((r) => r.composite);

  console.log("── Discrimination ──");
  console.log(`  failed    n=${failed.length}  mean ${mean(failed).toFixed(1)}  median ${median(failed).toFixed(1)}  range ${Math.min(...failed)}–${Math.max(...failed)}`);
  console.log(`  succeeded n=${ok.length}  mean ${mean(ok).toFixed(1)}  median ${median(ok).toFixed(1)}  range ${Math.min(...ok)}–${Math.max(...ok)}`);
  console.log(`  separation of means: ${(mean(ok) - mean(failed)).toFixed(1)} points`);
  console.log(`  overlap: ${rows.filter((r) => r.outcome === "failed" && r.composite >= Math.min(...ok)).length} failed cases score at or above the weakest success\n`);

  console.log("── Verdict distribution ──");
  for (const group of ["failed", "succeeded"]) {
    const g = rows.filter((r) => r.outcome === group);
    const c = (v: string) => g.filter((r) => r.verdict === v).length;
    console.log(`  ${group.padEnd(10)} invest ${c("invest")} (${pct(c("invest"), g.length)}%)  watch ${c("watch")} (${pct(c("watch"), g.length)}%)  pass ${c("pass")} (${pct(c("pass"), g.length)}%)`);
  }

  // Per-sector n is 2-3 here, which is noise. Split on the axis that plausibly
  // breaks the rubric instead: capital-intensive businesses, where the sector
  // priors carry most of the score, versus software, where disclosed traction
  // can actually move it. If the failure concentrates on one side, the fix is
  // the priors for those sectors — not the factor architecture.
  const CAPITAL_HEAVY = new Set(["climate", "space", "proptech", "logistics", "biotech", "agtech"]);
  console.log("── Discrimination by business type ──");
  for (const [label, pred] of [
    ["capital-intensive", (r: typeof rows[number]) => CAPITAL_HEAVY.has(r.sector as string)],
    ["software-like", (r: typeof rows[number]) => !CAPITAL_HEAVY.has(r.sector as string)],
  ] as const) {
    const g = rows.filter(pred);
    const f = g.filter((r) => r.outcome === "failed").map((r) => r.composite);
    const s = g.filter((r) => r.outcome === "succeeded").map((r) => r.composite);
    if (!f.length || !s.length) { console.log(`  ${label.padEnd(18)} n=${g.length} — too few in one arm to compare`); continue; }
    console.log(`  ${label.padEnd(18)} failed n=${f.length} mean ${mean(f).toFixed(1)} | succeeded n=${s.length} mean ${mean(s).toFixed(1)} | separation ${(mean(s) - mean(f)).toFixed(1)}`);
  }
  console.log("");

  const all = rows.map((r) => r.composite);
  console.log(`\n── Range used ──\n  ${Math.min(...all)}–${Math.max(...all)} of a nominal 0–100 scale (${(Math.max(...all) - Math.min(...all)).toFixed(1)} points of ${100} used)\n`);
}

run();
