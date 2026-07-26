/* Deterministic unit test for company-specific signal scoring. Run:
 *   npx ts-node --transpile-only scripts/qventure-signals-test.ts
 */
import { parsePlanSignals, mergeStructuredSignals } from "../src/lib/qventure/signals";
import { parseLocaleNumber } from "../src/lib/metrics/periods";
import { analyze } from "../src/lib/qventure/engine";
import { stressTest } from "../src/lib/qventure/stress";
import { triangulateTam } from "../src/lib/qventure/tam";
import { analyzeProjections } from "../src/lib/qventure/projections";
import { resolveSector } from "../src/lib/qventure/sectors";

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

console.log("\n7. Bottom-up TAM triangulation");
const saasSector = resolveSector("saas");
const fullTam = triangulateTam(parsePlanSignals("$2M ARR, 2000 customers, TAM of $12B addressable market"), saasSector);
ok("full mode when TAM + revenue/customers present", fullTam.mode === "full", fullTam.mode);
ok("ACV = revenue/customers ($2M/2000 = $1000)", fullTam.acvUsd === 1000, String(fullTam.acvUsd));
ok("implied accounts = TAM/ACV ($12B/$1000 = 12M)", fullTam.impliedAccounts === 12_000_000, String(fullTam.impliedAccounts));
ok("penetration = rev/TAM (2M/12B ≈ 0.0167%)", fullTam.currentPenetrationPct !== null && fullTam.currentPenetrationPct < 0.02, String(fullTam.currentPenetrationPct));
ok("SOM @1% = $120M", fullTam.somAt1PctUsd === 120_000_000, String(fullTam.somAt1PctUsd));
const inflatedTamT = triangulateTam(parsePlanSignals("$1M ARR, 1000 customers, TAM of $9000B addressable market"), saasSector);
ok("flags TAM > sector", inflatedTamT.flags.some(f => /exceeds the entire/.test(f)), inflatedTamT.flags.join("|"));
const partialTam = triangulateTam(parsePlanSignals("$5M ARR, 5000 customers, strong growth"), saasSector);
ok("partial when only ACV derivable", partialTam.mode === "partial" && partialTam.acvUsd === 1000);
const noTam = triangulateTam(parsePlanSignals("A great product for teams."), saasSector);
ok("insufficient when nothing disclosed", noTam.mode === "insufficient");
ok("tam wired into analyze()", analyze({ name: "T", sector: "saas", stage: "seed", description: "$2M ARR, 2000 customers, TAM of $12B." }).tam.acvUsd === 1000);

console.log("\n8. Structured financials override + projections");
const parsedBase = parsePlanSignals("Roughly $1M revenue, some customers");
const merged = mergeStructuredSignals(parsedBase, { arrUsd: 5_000_000, grossMarginPct: 88, ltvCacRatio: 6, customers: 4000 });
ok("structured ARR overrides parsed revenue", merged.revenueUsd === 5_000_000 && merged.revenueBasis === "ARR", String(merged.revenueUsd));
ok("structured margin set", merged.grossMarginPct === 88);
ok("structured LTV/CAC set", merged.ltvCacRatio === 6);
ok("MRR annualized in merge", mergeStructuredSignals(parsedBase, { mrrUsd: 100_000 }).revenueUsd === 1_200_000);
const structuredAnalyze = analyze({ name: "S", sector: "saas", stage: "seed", description: "vague pitch", financials: { arrUsd: 3_000_000, grossMarginPct: 85, ltvCacRatio: 5, customers: 3000, bottomUpTamUsd: 8_000_000_000 } });
ok("structured financials → high coverage", structuredAnalyze.signalCoverage >= 0.4, String(structuredAnalyze.signalCoverage));
ok("structured financials → TAM full mode", structuredAnalyze.tam.mode === "full", structuredAnalyze.tam.mode);

const saas = resolveSector("saas");
// The benchmark is the stage's venture bar, not the market CAGR: a plan that
// grows at market rate never takes share, and an ordinary venture plan is not a
// hockey stick. Both used to be judged the other way round.
const belowMarket = analyzeProjections([{ year: 2026, revenueUsd: 2_000_000 }, { year: 2029, revenueUsd: 2_400_000 }], saas, "seed");
ok("market-rate plan is below-market, not 'grounded'", belowMarket !== null && belowMarket.verdict === "below-market", belowMarket?.verdict);
const ventureGrade = analyzeProjections([{ year: 2026, revenueUsd: 2_400_000 }, { year: 2028, revenueUsd: 14_000_000 }], saas, "seed");
ok("2.4M→14M seed plan is venture-grade", ventureGrade !== null && ventureGrade.verdict === "venture-grade", `${ventureGrade?.verdict} ${ventureGrade?.impliedCagrPct}%`);
const seriesA = analyzeProjections([{ year: 2026, revenueUsd: 4_800_000 }, { year: 2028, revenueUsd: 17_000_000 }], resolveSector("climate"), "series-a");
ok("Series A 3.5x/2yr is venture-grade", seriesA !== null && seriesA.verdict === "venture-grade", `${seriesA?.verdict} ${seriesA?.impliedCagrPct}%`);
ok("stage bar tightens with stage", (analyzeProjections([{ year: 2026, revenueUsd: 1e6 }, { year: 2027, revenueUsd: 2e6 }], saas, "seed")!.stageBarCagrPct)
  > (analyzeProjections([{ year: 2026, revenueUsd: 1e6 }, { year: 2027, revenueUsd: 2e6 }], saas, "growth")!.stageBarCagrPct));
ok("same plan reads harsher at growth stage than at seed",
  analyzeProjections([{ year: 2026, revenueUsd: 1e6 }, { year: 2028, revenueUsd: 9e6 }], saas, "growth")!.ratioToBar!
  > analyzeProjections([{ year: 2026, revenueUsd: 1e6 }, { year: 2028, revenueUsd: 9e6 }], saas, "seed")!.ratioToBar!);
const conservative = analyzeProjections([{ year: 2026, revenueUsd: 2_000_000 }, { year: 2028, revenueUsd: 3_400_000 }], saas, "seed");
ok("above market but under the bar → conservative", conservative !== null && conservative.verdict === "conservative", `${conservative?.verdict} ${conservative?.impliedCagrPct}%`);
const hockey = analyzeProjections([{ year: 2026, revenueUsd: 1_000_000 }, { year: 2029, revenueUsd: 100_000_000 }], saas, "seed");
ok("100x/3yr still flagged hockey-stick", hockey !== null && hockey.verdict === "hockey-stick", `${hockey?.verdict} ${hockey?.impliedCagrPct}%`);
const preRev = analyzeProjections([{ year: 2026, revenueUsd: 0 }, { year: 2029, revenueUsd: 5_000_000 }], saas, "seed");
ok("pre-revenue projection handled", preRev !== null && preRev.verdict === "pre-revenue", preRev?.verdict);
ok("single point → null", analyzeProjections([{ year: 2026, revenueUsd: 1_000_000 }], saas, "seed") === null);
ok("projections wired into analyze() with the deal's stage", analyze({ name: "P", sector: "saas", stage: "seed", description: "x", projections: [{ year: 2026, revenueUsd: 1_000_000 }, { year: 2029, revenueUsd: 80_000_000 }] }).projections?.stageBarCagrPct === 180);

console.log("\n9. Churn period — 4% a year is not 4% a month");
const churnAnnual = parsePlanSignals("Enterprise SaaS with 4% annual churn and $2M ARR.");
ok("annual churn parsed with its period", churnAnnual.churnPct === 4 && churnAnnual.churnPeriod === "annual", `${churnAnnual.churnPct}/${churnAnnual.churnPeriod}`);
ok("annual churn normalized to ~0.34%/mo", churnAnnual.churnMonthlyPct !== null && Math.abs(churnAnnual.churnMonthlyPct - 0.34) < 0.05, String(churnAnnual.churnMonthlyPct));
const churnMonthly = parsePlanSignals("Consumer app with 4% monthly churn and $2M ARR.");
ok("monthly churn kept as stated", churnMonthly.churnPct === 4 && churnMonthly.churnPeriod === "monthly" && churnMonthly.churnMonthlyPct === 4);
const churnPerYear = parsePlanSignals("Churn of 20% per year across the base.");
ok("'20% per year' → annual", churnPerYear.churnPeriod === "annual" && churnPerYear.churnMonthlyPct !== null && churnPerYear.churnMonthlyPct < 2, `${churnPerYear.churnPeriod}/${churnPerYear.churnMonthlyPct}`);
const churnBare = parsePlanSignals("Churn is 3% and margins are healthy.");
ok("period-less churn read as monthly, and marked", churnBare.churnPct === 3 && churnBare.churnPeriod === "unspecified" && churnBare.churnMonthlyPct === 3);
const annualChurnDeal = analyze({ ...base, description: "B2B SaaS. $3M ARR, 2,000 customers, 20% annual churn, 82% gross margin." });
ok("20% annual churn raises no high-churn flag", !annualChurnDeal.redFlags.some((f) => /churn/i.test(f)), annualChurnDeal.redFlags.join("|"));
const monthlyChurnDeal = analyze({ ...base, description: "B2B SaaS. $3M ARR, 2,000 customers, 20% monthly churn, 82% gross margin." });
ok("20% monthly churn does flag", monthlyChurnDeal.redFlags.some((f) => /churn/i.test(f)), monthlyChurnDeal.redFlags.join("|"));
ok("annual-churn deal scores above the identical monthly-churn deal", annualChurnDeal.composite > monthlyChurnDeal.composite, `${annualChurnDeal.composite} vs ${monthlyChurnDeal.composite}`);
// The churn test above surfaced this: a bare "<n>% monthly" was read as growth.
ok("'20% monthly churn' is not read as 20% MoM growth", parsePlanSignals("SaaS with 20% monthly churn.").growthPct === null, String(parsePlanSignals("SaaS with 20% monthly churn.").growthPct));
ok("'4% annual churn' is not read as growth", parsePlanSignals("SaaS with 4% annual churn.").growthPct === null);
ok("real growth still parses with its period", parsePlanSignals("revenue growing 12% MoM").growthPct === 12 && parsePlanSignals("revenue growing 12% MoM").growthPeriod === "MoM");
ok("'30% month-over-month growth' parses", parsePlanSignals("we see 30% month-over-month growth").growthPct === 30);
ok("'up 15% MoM' parses", parsePlanSignals("bookings up 15% MoM").growthPct === 15);
ok("'growth of 40% annually' → YoY", parsePlanSignals("growth of 40% annually").growthPeriod === "YoY");

console.log("\n10. A money unit must be a unit, not the next word's first letter");
// Found on a real deck: "CAC $3, LTV $2, monthly churn 14%" scored LTV as $2M.
const glued = parsePlanSignals("Unit economics: gross margin 96%, CAC $3, LTV $2, monthly churn 14%.");
ok("'LTV $2, monthly' is $2, not $2M", glued.ltvUsd === 2, String(glued.ltvUsd));
ok("resulting LTV/CAC is 0.7, not 666,666", glued.ltvCacRatio !== null && glued.ltvCacRatio < 1, String(glued.ltvCacRatio));
ok("'$50 tests' is not fifty trillion", parsePlanSignals("ARR of $50 tests per week").revenueUsd !== 50e12, String(parsePlanSignals("ARR of $50 tests per week").revenueUsd));
ok("real units still parse: $2M ARR", parsePlanSignals("$2M ARR").revenueUsd === 2_000_000, String(parsePlanSignals("$2M ARR").revenueUsd));
ok("real units still parse: $2 million ARR", parsePlanSignals("$2 million ARR").revenueUsd === 2_000_000, String(parsePlanSignals("$2 million ARR").revenueUsd));
ok("real units still parse: $500k MRR", parsePlanSignals("$500k MRR").revenueUsd === 6_000_000, String(parsePlanSignals("$500k MRR").revenueUsd));
ok("real units still parse: TAM of $12B", parsePlanSignals("TAM of $12B").bottomUpTamUsd === 12_000_000_000);
ok("real units still parse: TAM of $2 trillion", parsePlanSignals("TAM of $2 trillion").bottomUpTamUsd === 2e12, String(parsePlanSignals("TAM of $2 trillion").bottomUpTamUsd));
ok("customers with a unit still parse: 12k customers", parsePlanSignals("12k customers on the platform").customers === 12_000, String(parsePlanSignals("12k customers on the platform").customers));

console.log("\n11. Evidence that is not SaaS-shaped");
const market = parsePlanSignals("Marketplace with GMV of $180M annualized and a 14% take rate across 4,200 carriers.");
ok("GMV parsed", market.gmvUsd === 180_000_000, String(market.gmvUsd));
ok("take rate parsed", market.takeRatePct === 14, String(market.takeRatePct));
ok("revenue implied from GMV × take rate", market.revenueUsd === 25_200_000, String(market.revenueUsd));
const defence = parsePlanSignals("Backlog of $62M across signed contracts with two federal agencies. ITAR registered. 11 deployments live. $8M non-dilutive from an OTA award.");
ok("contracted backlog parsed", defence.contractedRevenueUsd === 62_000_000, String(defence.contractedRevenueUsd));
ok("non-dilutive award parsed", defence.nonDilutiveUsd === 8_000_000, String(defence.nonDilutiveUsd));
ok("deployments counted as pilots/design wins", defence.pilots === 11, String(defence.pilots));
ok("defence contracting status recognised", defence.regulatoryMilestones.some((m) => /Defence/i.test(m)), defence.regulatoryMilestones.join("|"));
const device = parsePlanSignals("FDA 510(k) clearance granted and CE marked. Clinical validation reported 93% sensitivity and 89% specificity, peer-reviewed.");
ok("FDA clearance recognised", device.regulatoryMilestones.some((m) => /FDA/.test(m)), device.regulatoryMilestones.join("|"));
ok("CE mark recognised", device.regulatoryMilestones.some((m) => /CE mark/.test(m)));
ok("peer review recognised", device.technicalProof.some((p) => /Peer-reviewed/.test(p)), device.technicalProof.join("|"));
// The negation layer has to hold here too: a plan that says it has none of this
// must not be credited with all of it.
const denied = parsePlanSignals("No contracts signed yet. No deployments. No FDA clearance. No peer-reviewed data. No backlog.");
ok("denied backlog is not credited", denied.contractedRevenueUsd === null, String(denied.contractedRevenueUsd));
ok("denied clearance is not credited", denied.regulatoryMilestones.length === 0, denied.regulatoryMilestones.join("|"));
ok("denied peer review is not credited", !denied.technicalProof.some((p) => /Peer-reviewed/.test(p)), denied.technicalProof.join("|"));

const infraStrong = analyze({ name: "S", sector: "climate", stage: "growth", description: "Utility-scale storage. Grid interconnection agreement executed and a 15-year power purchase agreement signed. Pilot plant running 14 months.", tractionNotes: "Contracted revenue of $210M under signed offtake agreements. 3 production sites operational. Gross margin 34%." });
const infraWeak = analyze({ name: "W", sector: "climate", stage: "growth", description: "Utility-scale storage. In discussions with a utility, applied for grid interconnection. No plant has been built.", tractionNotes: "No signed offtake. No interconnection agreement. No revenue." });
ok("contract-shaped evidence lifts the composite", infraStrong.composite - infraWeak.composite >= 15, `${infraStrong.composite} vs ${infraWeak.composite}`);
ok("contract-shaped evidence raises signal coverage", infraStrong.signalCoverage >= 0.5 && infraWeak.signalCoverage === 0, `${infraStrong.signalCoverage} vs ${infraWeak.signalCoverage}`);
ok("science can be company evidence", infraStrong.factors.find((f) => f.key === "science")!.basis === "company-evidence");
ok("legal can be company evidence", infraStrong.factors.find((f) => f.key === "legal")!.basis === "company-evidence");
ok("a science-gated plan with no evidence is charged for it", infraWeak.redFlags.some((f) => /no working hardware|no signed contracts/i.test(f)), infraWeak.redFlags.join("|"));

console.log("\n12. A figure without its currency is not a figure");
const eur = parsePlanSignals("Berlin SaaS with €3M ARR and a CAC of €900.");
ok("EUR revenue converted to USD (not read as $3M)", eur.revenueUsd !== null && eur.revenueUsd > 3_300_000 && eur.revenueUsd < 3_600_000, String(eur.revenueUsd));
ok("plan currency recorded as EUR", eur.currency === "EUR", String(eur.currency));
ok("EUR CAC converted too", eur.cacUsd !== null && eur.cacUsd > 1000 && eur.cacUsd < 1100, String(eur.cacUsd));
const gbp = parsePlanSignals("London fintech, £2M ARR, TAM of £8B.");
ok("GBP revenue converted", gbp.revenueUsd !== null && gbp.revenueUsd > 2_600_000 && gbp.revenueUsd < 2_700_000, String(gbp.revenueUsd));
ok("GBP TAM converted", gbp.bottomUpTamUsd !== null && gbp.bottomUpTamUsd > 10e9 && gbp.bottomUpTamUsd < 11e9, String(gbp.bottomUpTamUsd));
const kzt = parsePlanSignals("Almaty marketplace: ₸450 млн GMV with a 12% take rate.");
ok("Cyrillic scale word parsed (млн)", kzt.gmvUsd !== null, String(kzt.gmvUsd));
ok("KZT GMV converted to ~$957k", kzt.gmvUsd !== null && kzt.gmvUsd > 900_000 && kzt.gmvUsd < 1_000_000, String(kzt.gmvUsd));
ok("KZT recorded as the plan currency", kzt.currency === "KZT", String(kzt.currency));
const usd = parsePlanSignals("US SaaS with $3M ARR.");
ok("USD figures are untouched", usd.revenueUsd === 3_000_000, String(usd.revenueUsd));
const unmarked = parsePlanSignals("SaaS with 3M ARR and no currency stated anywhere.");
ok("an unmarked plan is read as USD, not scaled", unmarked.revenueUsd === 3_000_000, String(unmarked.revenueUsd));
ok("unmarked plan records no currency", unmarked.currency === null, String(unmarked.currency));
const mixed = parsePlanSignals("€5M ARR in Europe; the US market alone is worth $40B.");
ok("first currency named wins as the plan currency", mixed.currency === "EUR", String(mixed.currency));
ok("a locally marked USD figure stays USD", mixed.bottomUpTamUsd === null || mixed.bottomUpTamUsd === 40e9, String(mixed.bottomUpTamUsd));
const eurDeal = analyze({ name: "E", sector: "saas", stage: "seed", description: "Berlin SaaS, €4M ARR, 2,000 customers, 85% gross margin, LTV:CAC 4." });
ok("non-USD plan discloses the conversion in assumptions", eurDeal.assumptions.some((a) => /converted to USD/i.test(a)), eurDeal.assumptions.join(" | ").slice(0, 200));

console.log("\n13. How the world actually writes numbers");
// Every case below came from probing the parser with real-world notations.
const decimalComma = parsePlanSignals("Berlin SaaS with €1,5M ARR.");
ok("'€1,5M' is 1.5 million, not 15 million", decimalComma.revenueUsd !== null && decimalComma.revenueUsd > 1_600_000 && decimalComma.revenueUsd < 1_800_000, String(decimalComma.revenueUsd));
ok("'$1,500,000' still reads as 1.5 million", parsePlanSignals("ARR of $1,500,000.").revenueUsd === 1_500_000, String(parsePlanSignals("ARR of $1,500,000.").revenueUsd));
ok("'$1 500 000' (space groups) reads as 1.5 million", parsePlanSignals("ARR of $1 500 000 this year.").revenueUsd === 1_500_000, String(parsePlanSignals("ARR of $1 500 000 this year.").revenueUsd));
ok("'1.234,56' European full form", parseLocaleNumber("1.234,56") === 1234.56, String(parseLocaleNumber("1.234,56")));
ok("'1,234.56' English full form", parseLocaleNumber("1,234.56") === 1234.56, String(parseLocaleNumber("1,234.56")));
ok("a year is not swallowed as a thousands group", parsePlanSignals("ARR of $3 2026 plan").revenueUsd === 3, String(parsePlanSignals("ARR of $3 2026 plan").revenueUsd));
ok("parenthesised churn parses", parsePlanSignals("Retention is good, churn (2% monthly).").churnPct === 2);
const twoCurrencies = parsePlanSignals("$1M ARR in the US and €2M ARR in the EU.");
ok("a dollar figure is not converted at the euro rate", twoCurrencies.revenueUsd === 1_000_000, String(twoCurrencies.revenueUsd));
ok("'2,5% churn' reads as 2.5, not 25", parsePlanSignals("Churn of 2,5% per month.").churnPct === 2.5, String(parsePlanSignals("Churn of 2,5% per month.").churnPct));
const structuredChurn = mergeStructuredSignals(parsePlanSignals("vague pitch"), { churnPct: 24, churnPeriod: "annual" });
ok("structured annual churn normalized on merge", structuredChurn.churnMonthlyPct !== null && structuredChurn.churnMonthlyPct < 3, String(structuredChurn.churnMonthlyPct));
ok("unspecified-period churn is disclosed in assumptions",
  analyze({ ...base, description: "SaaS with $2M ARR, 1,000 customers and churn of 3%." }).assumptions.some((a) => /read as monthly/.test(a)));

console.log("\n15. A range is a disclosure, not a blank");
const rangeArr = parsePlanSignals("SaaS with ARR between $2M and $4M depending on renewals.");
ok("a range is read at its low end", rangeArr.revenueUsd === 2_000_000, String(rangeArr.revenueUsd));
ok("the choice is stated, not silent", rangeArr.parseNotes.some((n) => /low end/.test(n)), rangeArr.parseNotes.join("|"));
ok("'$2-4M' is $2M, not $2", parsePlanSignals("Revenue of $2-4M this year.").revenueUsd === 2_000_000, String(parsePlanSignals("Revenue of $2-4M this year.").revenueUsd));
const eurRange = parsePlanSignals("€1,5M to €3M ARR in Europe.");
ok("a currency range converts at the low end", eurRange.revenueUsd !== null && eurRange.revenueUsd > 1_600_000 && eurRange.revenueUsd < 1_800_000, String(eurRange.revenueUsd));
ok("a single figure is untouched by the range path", parsePlanSignals("$3M ARR flat.").revenueUsd === 3_000_000);
ok("a single figure carries no range note", parsePlanSignals("$3M ARR flat.").parseNotes.length === 0);
const gmRange = parsePlanSignals("SaaS with gross margin of 70-80% at scale.");
ok("a margin band is read at its low end", gmRange.grossMarginPct === 70, String(gmRange.grossMarginPct));
ok("the margin band is disclosed", gmRange.parseNotes.some((n) => /Gross margin.*low end/.test(n)), gmRange.parseNotes.join("|"));
ok("a plain margin is untouched", parsePlanSignals("DTC with 60% gross margin.").grossMarginPct === 60);
const tamRangeLow = parsePlanSignals("TAM of $5-10B in logistics.");
ok("a TAM band is read at its low end", tamRangeLow.bottomUpTamUsd === 5e9, String(tamRangeLow.bottomUpTamUsd));
// Numbers-first phrasing used to fall through to the single-figure pattern,
// which matched the SECOND figure — i.e. it silently took the ceiling.
const tamReversed = parsePlanSignals("€2B to €4B TAM in the EU.");
ok("'€2B to €4B TAM' takes the floor, not the ceiling",
  tamReversed.bottomUpTamUsd !== null && tamReversed.bottomUpTamUsd < 3e9, String(tamReversed.bottomUpTamUsd));
ok("a plain TAM is untouched", parsePlanSignals("TAM of $12B addressable market.").bottomUpTamUsd === 12e9);
ok("the range assumption reaches the report",
  analyze({ ...base, description: "SaaS with ARR between $2M and $4M depending on renewals, 500 customers." })
    .assumptions.some((a) => /low end/.test(a)));

console.log("\n14. A plan that contradicts itself says so");
const conflict = analyze({ ...base, description: "SaaS platform. We have $2M ARR today. Elsewhere in the deck: the company reached $5M ARR last quarter." });
ok("two present-tense revenue figures are surfaced", conflict.redFlags.some((f) => /more than one current revenue figure/.test(f)), conflict.redFlags.join("|"));
ok("the contradiction does not silently move the score",
  conflict.composite === analyze({ ...base, description: "SaaS platform. We have $2M ARR today." }).composite,
  String(conflict.composite));
const forwardLooking = analyze({ ...base, description: "SaaS platform with $2M ARR today, targeting $5M ARR by year end." });
ok("a forward-looking figure is a plan, not a contradiction", !forwardLooking.redFlags.some((f) => /more than one current revenue/.test(f)), forwardLooking.redFlags.join("|"));
const rounded = analyze({ ...base, description: "SaaS with $2M ARR. Precisely, $2.0M ARR as of last month." });
ok("the same figure written twice is not a contradiction", !rounded.redFlags.some((f) => /more than one current revenue/.test(f)));
// The smoke run caught this: the bare noun "plan" used to count as forward
// intent, so "elsewhere in this plan: $5M ARR" silenced a real contradiction.
const nounPlan = analyze({ ...base, description: "Collaboration platform. We have $2M ARR today. Elsewhere in this plan: the company reached $5M ARR last quarter." });
ok("the noun 'plan' does not silence a contradiction", nounPlan.redFlags.some((f) => /more than one current revenue figure/.test(f)), nounPlan.redFlags.join("|"));
const intentPlan = analyze({ ...base, description: "SaaS with $2M ARR today; the company plans to reach $5M ARR next year." });
ok("'plans to reach' is still read as forward intent", !intentPlan.redFlags.some((f) => /more than one current revenue/.test(f)), intentPlan.redFlags.join("|"));

console.log(`\n${fail === 0 ? "✅" : "❌"} signals test: ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
