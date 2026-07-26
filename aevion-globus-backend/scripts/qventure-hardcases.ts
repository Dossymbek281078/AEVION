/**
 * QVenture — complex business models harness
 * ──────────────────────────────────────────
 * The calibration harness (qventure-calibration.ts) uses reconstructed
 * descriptions that state almost no figures, because that is what was publicly
 * claimed at those rounds. It therefore cannot tell us anything about the
 * question that actually gates a launch: *when a hard business model does
 * disclose its own evidence, does the engine read it?*
 *
 * A defence programme discloses contract awards and field tests. A therapeutic
 * discloses a trial phase and an endpoint. An energy project discloses offtake,
 * capacity and a grid interconnection. A marketplace discloses GMV and a take
 * rate. None of them have ARR, MoM growth or LTV/CAC — and until rubric v5 the
 * engine scored all of that as "no evidence disclosed".
 *
 * Structure: matched STRONG/WEAK pairs inside the same sector and stage. The
 * pair holds sector priors constant, so any gap between the two comes from the
 * plan's own disclosure — which is exactly the capability under test. A pair
 * that fails to separate is a real finding, not a tuning nuisance.
 *
 * Usage: npx tsx scripts/qventure-hardcases.ts
 */

import { analyze, type AnalysisInput } from "../src/lib/qventure/engine";
import { parsePlanSignals } from "../src/lib/qventure/signals";

interface Pair {
  model: string;
  /** What evidence the engine must pick up for this model to be scored at all. */
  mustParse: (s: ReturnType<typeof parsePlanSignals>) => boolean;
  mustParseLabel: string;
  strong: AnalysisInput;
  weak: AnalysisInput;
}

const base = (over: Partial<AnalysisInput>): AnalysisInput => ({
  name: "case", description: "", sector: "other", stage: "series-a", geography: "US", ...over,
});

const PAIRS: Pair[] = [
  {
    model: "Defence hardware programme",
    mustParseLabel: "contracted backlog or defence contracting status",
    mustParse: (s) => s.contractedRevenueUsd !== null || s.regulatoryMilestones.length > 0,
    strong: base({
      name: "Sentinel Autonomy", sector: "space", stage: "series-a", askUsd: 45_000_000,
      description: "Autonomous perimeter surveillance towers with onboard sensor fusion, sold as a product to border and base-security agencies rather than as a cost-plus programme. ITAR registered. Systems are field-tested and in operational use at eleven sites.",
      tractionNotes: "Backlog of $62M across signed contracts with two federal agencies. 11 deployments live. $8M non-dilutive from an OTA award. Unit gross margin 41%.",
    }),
    weak: base({
      name: "Aegis Concepts", sector: "space", stage: "series-a", askUsd: 45_000_000,
      description: "Autonomous perimeter surveillance towers with onboard sensor fusion, intended for border and base-security agencies. The team plans to pursue ITAR registration and expects a first field trial next year.",
      tractionNotes: "No contracts signed yet. No deployments. Prototype not yet field-tested.",
    }),
  },
  {
    model: "Therapeutics",
    mustParseLabel: "clinical phase or regulatory milestone",
    mustParse: (s) => s.regulatoryMilestones.length > 0 || s.technicalProof.length > 0,
    strong: base({
      name: "Helix Bio", sector: "biotech", stage: "series-a", askUsd: 60_000_000,
      description: "Small-molecule inhibitor for treatment-resistant hypertension. Phase 2 readout met its primary endpoint; results are peer-reviewed and published. Composition-of-matter patent granted.",
      tractionNotes: "Phase 2 complete, IND cleared for the follow-on indication. $12M non-dilutive from a national research programme. Two granted patents.",
    }),
    weak: base({
      name: "Corvus Therapeutics", sector: "biotech", stage: "series-a", askUsd: 60_000_000,
      description: "Small-molecule inhibitor for treatment-resistant hypertension. The mechanism is promising in animal models and the team intends to file an IND once formulation work completes.",
      tractionNotes: "No clinical data. No IND. No publications yet.",
    }),
  },
  {
    model: "Energy / infrastructure project finance",
    mustParseLabel: "offtake, PPA or contracted revenue",
    mustParse: (s) => s.contractedRevenueUsd !== null || s.regulatoryMilestones.some((m) => /PPA|Grid/i.test(m)),
    strong: base({
      name: "Meridian Grid", sector: "climate", stage: "growth", askUsd: 120_000_000,
      description: "Utility-scale battery storage co-located with solar. A grid interconnection agreement is executed and a 15-year power purchase agreement is signed with the regional utility. The first pilot plant has been running for 14 months.",
      tractionNotes: "Contracted revenue of $210M under signed offtake agreements. 3 production sites operational. Gross margin 34%.",
    }),
    weak: base({
      name: "Vantage Storage", sector: "climate", stage: "growth", askUsd: 120_000_000,
      description: "Utility-scale battery storage co-located with solar. The team is in discussions with a regional utility and has applied for grid interconnection. No plant has been built.",
      tractionNotes: "No signed offtake. No interconnection agreement. No revenue.",
    }),
  },
  {
    model: "Marketplace",
    mustParseLabel: "GMV and take rate",
    mustParse: (s) => s.gmvUsd !== null && s.takeRatePct !== null,
    strong: base({
      name: "Harborline", sector: "marketplace", stage: "series-a", askUsd: 30_000_000,
      description: "Two-sided marketplace matching independent freight brokers with verified carriers, handling payments, insurance and dispute resolution on platform.",
      tractionNotes: "GMV of $180M annualized with a 14% take rate. 4,200 carriers transacting. Net revenue retention 118%. 6% annual churn on the carrier side.",
    }),
    weak: base({
      name: "Freightly", sector: "marketplace", stage: "series-a", askUsd: 30_000_000,
      description: "Two-sided marketplace matching independent freight brokers with verified carriers, handling payments, insurance and dispute resolution on platform.",
      tractionNotes: "GMV of $9M annualized with a 2% take rate. 140 carriers transacting. 9% monthly churn on the carrier side.",
    }),
  },
  {
    model: "Medical device",
    mustParseLabel: "clearance and clinical validation",
    mustParse: (s) => s.regulatoryMilestones.length > 0 && s.technicalProof.length > 0,
    strong: base({
      name: "Lumen Diagnostics", sector: "healthtech", stage: "series-a", askUsd: 35_000_000,
      description: "Point-of-care optical assay for early sepsis detection. FDA 510(k) clearance granted and CE marked. Clinical validation reported 93% sensitivity and 89% specificity in a 1,400-patient study, peer-reviewed.",
      tractionNotes: "Deployed in 38 hospitals. $4.2M revenue, 62% gross margin, 4% annual churn. 9 design wins with group purchasing organisations.",
    }),
    weak: base({
      name: "Sable Health", sector: "healthtech", stage: "series-a", askUsd: 35_000_000,
      description: "Point-of-care optical assay for early sepsis detection. The team expects to submit for FDA clearance next year and is designing a validation study.",
      tractionNotes: "No clearance. No clinical validation data. No hospital deployments.",
    }),
  },
  {
    model: "Semiconductor / hard hardware",
    mustParseLabel: "design wins or a running production line",
    mustParse: (s) => s.pilots !== null || s.technicalProof.length > 0,
    strong: base({
      name: "Nyx Silicon", sector: "ai_infra", stage: "series-a", askUsd: 80_000_000,
      description: "Inference accelerator for transformer workloads. First silicon is back and benchmarked at 2.4x the incumbent on tokens per watt; the result is independently reproduced. A production line at the foundry partner is running.",
      tractionNotes: "14 design wins with cloud and enterprise buyers. $46M backlog of purchase orders. $6M non-dilutive award.",
    }),
    weak: base({
      name: "Kestrel Compute", sector: "ai_infra", stage: "series-a", askUsd: 80_000_000,
      description: "Inference accelerator for transformer workloads. The architecture is simulated and the team expects first silicon in eighteen months.",
      tractionNotes: "No design wins. No silicon. No purchase orders.",
    }),
  },
];

let pass = 0, fail = 0;
const ok = (label: string, cond: boolean, info = "") => {
  if (cond) { console.log(`    ✓ ${label}`); pass++; }
  else { console.error(`    ✗ ${label}${info ? " — " + info : ""}`); fail++; }
};

console.log("\nQVenture — complex business models");
console.log("Matched strong/weak pairs in one sector: any gap comes from disclosure, not priors.\n");

const gaps: number[] = [];
for (const p of PAIRS) {
  const s = analyze(p.strong), w = analyze(p.weak);
  const sig = parsePlanSignals(`${p.strong.description} ${p.strong.tractionNotes ?? ""}`);
  const gap = Math.round((s.composite - w.composite) * 10) / 10;
  gaps.push(gap);
  console.log(`── ${p.model} ──`);
  console.log(`    strong ${s.composite} ${s.verdict.padEnd(6)} coverage ${Math.round(s.signalCoverage * 100)}%   |   weak ${w.composite} ${w.verdict.padEnd(6)} coverage ${Math.round(w.signalCoverage * 100)}%   |   gap ${gap}`);
  ok(`reads ${p.mustParseLabel}`, p.mustParse(sig),
    JSON.stringify({ contracted: sig.contractedRevenueUsd, gmv: sig.gmvUsd, take: sig.takeRatePct, pilots: sig.pilots, nonDilutive: sig.nonDilutiveUsd, reg: sig.regulatoryMilestones, proof: sig.technicalProof }));
  ok("strong scores above weak", s.composite > w.composite, `${s.composite} vs ${w.composite}`);
  ok("gap is decision-relevant (>= 6 points)", gap >= 6, `gap ${gap}`);
  ok("strong is scored on company evidence (coverage >= 40%)", s.signalCoverage >= 0.4, `${Math.round(s.signalCoverage * 100)}%`);
  ok("weak does not read as strong (verdict not invest)", w.verdict !== "invest", w.verdict);
  console.log("");
}

const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
console.log("── Summary ──");
console.log(`  mean strong/weak gap: ${mean(gaps).toFixed(1)} points (min ${Math.min(...gaps)}, max ${Math.max(...gaps)})`);
console.log(`\n${fail === 0 ? "✅" : "❌"} hard cases: ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
