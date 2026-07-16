/* Deterministic unit test for company-specific signal scoring. Run:
 *   npx ts-node --transpile-only scripts/qventure-signals-test.ts
 */
import { parsePlanSignals } from "../src/lib/qventure/signals";
import { analyze } from "../src/lib/qventure/engine";
import { stressTest } from "../src/lib/qventure/stress";

let pass = 0, fail = 0;
const ok = (label: string, cond: boolean, info = "") => {
  if (cond) { console.log(`  ✓ ${label}`); pass++; }
  else { console.error(`  ✗ ${label}${info ? " — " + info : ""}`); fail++; }
};

console.log("\n1. Signal parsing");
const rich = "We do $2.4M ARR growing 18% MoM with 80% gross margin, LTV:CAC of 4:1, 9 month payback, 3% churn and 1,200 paying customers. TAM of $12B. Patent-pending core.";
const s = parsePlanSignals(rich);
ok("revenue $2.4M ARR → 2,400,000", s.revenueUsd === 2_400_000, String(s.revenueUsd));
ok("growth 18% MoM", s.growthPct === 18 && s.growthPeriod === "MoM", `${s.growthPct}/${s.growthPeriod}`);
ok("gross margin 80%", s.grossMarginPct === 80, String(s.grossMarginPct));
ok("LTV:CAC 4", s.ltvCacRatio === 4, String(s.ltvCacRatio));
ok("payback 9mo", s.paybackMonths === 9, String(s.paybackMonths));
ok("churn 3%", s.churnPct === 3, String(s.churnPct));
ok("customers 1200", s.customers === 1200, String(s.customers));
ok("bottom-up TAM $12B", s.bottomUpTamUsd === 12_000_000_000, String(s.bottomUpTamUsd));
ok("patent flagged", s.mentionsPatent === true);
ok("fieldsFound >= 8", s.fieldsFound >= 8, String(s.fieldsFound));

console.log("\n2. MRR annualization + no-number flag");
const mrr = parsePlanSignals("$50k MRR, revenue growing fast");
ok("MRR annualized ×12 → 600,000", mrr.revenueUsd === 600_000, String(mrr.revenueUsd));
ok("basis MRR", mrr.revenueBasis === "MRR");
const vague = parsePlanSignals("We will monetize via subscription revenue eventually.");
ok("revenue-without-number flag", vague.mentionsRevenueNoNumber === true && vague.revenueUsd === null);

console.log("\n3. Company-specific scoring beats bare plan");
const base = { name: "Co", sector: "saas", stage: "seed" as const, geography: "US" };
const bare = analyze({ ...base, description: "A B2B SaaS tool for teams to collaborate on documents efficiently." });
const strong = analyze({ ...base, description: "A B2B SaaS tool for teams. $3M ARR growing 20% MoM, 85% gross margin, LTV:CAC 5:1, 2,000 customers." });
ok("bare plan: coverage 0", bare.signalCoverage === 0, String(bare.signalCoverage));
ok("strong plan: coverage > 0", strong.signalCoverage > 0, String(strong.signalCoverage));
ok("strong execution > bare execution", (strong.factors.find(f => f.key === "execution")!.score) > (bare.factors.find(f => f.key === "execution")!.score));
ok("strong economics >= bare economics", (strong.factors.find(f => f.key === "economics")!.score) >= (bare.factors.find(f => f.key === "economics")!.score));
ok("strong composite > bare composite", strong.composite > bare.composite, `${strong.composite} vs ${bare.composite}`);

console.log("\n4. Red flags fire on bad signals");
const badMargin = analyze({ ...base, sector: "ecommerce", description: "DTC brand with 95% gross margin claim and huge upside." });
ok("inflated margin flagged", badMargin.redFlags.some(f => /gross margin/.test(f)), badMargin.redFlags.join("|"));
const badUnit = analyze({ ...base, description: "SaaS with LTV:CAC of 0.6 currently." });
ok("LTV/CAC < 1 flagged", badUnit.redFlags.some(f => /LTV\/CAC/.test(f)));
const inflatedTam = analyze({ ...base, sector: "proptech", description: "Proptech play. TAM of $500B addressable market." });
ok("inflated TAM flagged", inflatedTam.redFlags.some(f => /TAM/.test(f)), inflatedTam.redFlags.join("|"));
ok("trillion unit parsed ($50T)", parsePlanSignals("TAM of $50T addressable market").bottomUpTamUsd === 50_000_000_000_000);
const trillionTam = analyze({ ...base, sector: "ecommerce", description: "DTC with a TAM of $50T addressable market." });
ok("trillion TAM inflation flagged", trillionTam.redFlags.some(f => /TAM/.test(f)), trillionTam.redFlags.join("|"));

console.log("\n5. Determinism: same input twice = identical");
const a1 = analyze({ ...base, description: strong.signals ? "A B2B SaaS tool for teams. $3M ARR growing 20% MoM, 85% gross margin, LTV:CAC 5:1, 2,000 customers." : "" });
const a2 = analyze({ ...base, description: "A B2B SaaS tool for teams. $3M ARR growing 20% MoM, 85% gross margin, LTV:CAC 5:1, 2,000 customers." });
ok("composite reproducible", a1.composite === a2.composite, `${a1.composite} vs ${a2.composite}`);
ok("coverage reproducible", a1.signalCoverage === a2.signalCoverage);

console.log("\n6. Financial stress test");
const robust = stressTest(parsePlanSignals("LTV:CAC of 8:1, 6 month payback, 80% gross margin, 2% churn"));
ok("robust: resilience robust (worst ≥3)", robust.resilience === "robust", `${robust.resilience}/${robust.worstLtvCac}`);
ok("robust: 6 scenarios incl margin + downturn", robust.scenarios.length === 6, String(robust.scenarios.length));
ok("robust: CAC×2 halves LTV/CAC (8→4)", robust.scenarios.find(s => s.label === "CAC ×2")!.ltvCac === 4);
const fragile = stressTest(parsePlanSignals("LTV:CAC of 2.2:1, 14 month payback"));
ok("fragile: resilience fragile", fragile.resilience === "fragile", `${fragile.resilience}/${fragile.worstLtvCac}`);
ok("fragile: downturn pushes below 1.5", (fragile.worstLtvCac ?? 9) < 1.5, String(fragile.worstLtvCac));
const underwater = stressTest(parsePlanSignals("LTV:CAC of 1.1:1 currently"));
ok("underwater: a shock pushes < 1", underwater.resilience === "underwater", `${underwater.resilience}/${underwater.worstLtvCac}`);
const noData = stressTest(parsePlanSignals("Great SaaS product for teams."));
ok("insufficient-data when no unit economics", noData.resilience === "insufficient-data" && noData.scenarios.length === 0);
ok("stress wired into analyze() — base 5 → fragile (downturn 2.2)", analyze({ name: "X", sector: "saas", stage: "seed", description: "SaaS with LTV:CAC of 5:1 and 8 month payback." }).stress.resilience === "fragile");
ok("stress wired into analyze() — base 8 → robust", analyze({ name: "Y", sector: "saas", stage: "seed", description: "SaaS with LTV:CAC of 8:1 and 6 month payback." }).stress.resilience === "robust");

console.log(`\n${fail === 0 ? "✅" : "❌"} signals test: ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
