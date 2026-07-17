#!/usr/bin/env node
/**
 * QCoreAI "auto" strategy — offline smoke.
 *
 * No server / DB / API keys. Uses the offline stub provider (QCOREAI_STUB=1) to
 * exercise the auto-router end-to-end, plus unit-tests the pure decision rule.
 * Asserts:
 *   - parseRouteToken maps only an explicit FACT token to the single path;
 *     OPEN / garbage / empty all fall back to council (quality-safe),
 *   - strategy "auto" emits a `route` event before `plan`, then a `final` +
 *     `done`, and defaults to the council when the classifier can't say FACT,
 *   - the route event carries the classifier's provider/model for the audit trail.
 *
 * Run (from aevion-globus-backend/, after `npx tsc`):
 *   node scripts/qcore-autoroute-smoke.js
 */

const path = require("path");
const orchPath = path.join(__dirname, "..", "dist", "services", "qcoreai", "orchestrator.js");

let pass = 0;
let fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`); }
}

// Clean provider env, then enable ONLY the offline stub so the whole run is
// deterministic and network-free.
for (const k of Object.keys(process.env)) {
  if (/_(API_KEY|TOKEN|BASE_URL)$/.test(k)) delete process.env[k];
}
process.env.QCOREAI_STUB = "1";
process.env.QCOREAI_STUB_DELAY = "0";

const { runMultiAgent, parseRouteToken, assessOpenDepth } = require(orchPath);
const smartPath = path.join(__dirname, "..", "dist", "services", "qcoreai", "smartComplete.js");
const { smartComplete, smartSavingsSnapshot, resetSmartTally, EST_COUNCIL_COST_USD } = require(smartPath);

console.log("QCoreAI auto-router smoke\n");

// 1. Pure decision rule — only an explicit FACT token routes to the single path.
ok("parseRouteToken FACT → fact", parseRouteToken("FACT") === "fact");
ok("parseRouteToken lowercase 'fact.' → fact", parseRouteToken("fact.") === "fact");
ok("parseRouteToken 'FACTUAL' → fact", parseRouteToken("FACTUAL") === "fact");
ok("parseRouteToken OPEN → open", parseRouteToken("OPEN") === "open");
ok("parseRouteToken empty → open (safe default)", parseRouteToken("") === "open");
ok("parseRouteToken garbage → open (safe default)", parseRouteToken("I think council") === "open");
ok("parseRouteToken 'this is a FACT' (not prefix) → open", parseRouteToken("this is a FACT") === "open");

// 1b. Depth grading — short single-ask → light (L1), long/multi-part → deep (L2).
ok("assessOpenDepth short single-ask → 1 (light)",
  assessOpenDepth("What's a good way to name variables?") === 1);
ok("assessOpenDepth empty → 1 (light)", assessOpenDepth("") === 1);
ok("assessOpenDepth two questions → 2 (deep)",
  assessOpenDepth("How should I price this? And what tier structure makes sense?") === 2);
ok("assessOpenDepth enumerated sub-asks → 2 (deep)",
  assessOpenDepth("Do three things:\n1. outline a plan\n2. list risks\n3. suggest a timeline") === 2);
ok("assessOpenDepth long prompt (>=60 words) → 2 (deep)",
  assessOpenDepth(Array(65).fill("word").join(" ")) === 2);
ok("assessOpenDepth multi-part cue + length → 2 (deep)",
  assessOpenDepth("Compare a monolith versus microservices for a small team, weigh the trade-offs across cost, speed, and hiring, and then explain which you'd pick.") === 2);
ok("assessOpenDepth focused reasoning ask → 1 (light)",
  assessOpenDepth("Should a solo founder ship a council or one flagship model?") === 1);
ok("assessOpenDepth inline-enumerated sub-asks → 2 (deep)",
  assessOpenDepth("Do three things: 1. outline a plan, 2. list the top risks, 3. suggest how to measure success.") === 2);
ok("assessOpenDepth imperative task chain (3+ verbs) → 2 (deep)",
  assessOpenDepth("Write a post-mortem: summarize what happened, identify three root causes, and propose concrete process changes.") === 2);
ok("assessOpenDepth single task verb stays light",
  assessOpenDepth("Summarize this article in three sentences.") === 1);
// Borderline-eval fixes (2026-07): genuinely two-part prompts that used to slip
// through as light.
ok("assessOpenDepth 'difference between … and describe …' → 2 (deep)",
  assessOpenDepth("Explain the difference between TCP and UDP, and describe when to use each one.") === 2);
ok("assessOpenDepth ranked-list comparison → 2 (deep)",
  assessOpenDepth("Give me a detailed comparison of the top five project management tools.") === 2);
ok("assessOpenDepth compare-cue + second verb (short) → 2 (deep)",
  assessOpenDepth("Compare in-house hiring versus outsourcing for a small agency, and explain the trade-offs for cost and quality.") === 2);
// Guards: these must STAY light — tuning shouldn't over-trigger the deep tier.
ok("assessOpenDepth long narrative single-ask stays light",
  assessOpenDepth("I have been feeling unmotivated at work lately even though I like my job and my team, and I am wondering what one small change might help me feel more engaged again.") === 1);
ok("assessOpenDepth short 'pros and cons' stays light",
  assessOpenDepth("What are the pros and cons of remote work?") === 1);
ok("assessOpenDepth short single-verb compare stays light",
  assessOpenDepth("Compare Python and JavaScript for web development.") === 1);
ok("assessOpenDepth ranked-list without compare/length stays light",
  assessOpenDepth("What are your top 3 tips for productivity?") === 1);
ok("assessOpenDepth always returns 1 or 2",
  [1, 2].includes(assessOpenDepth("anything")) && [1, 2].includes(assessOpenDepth("")));

// 2. End-to-end auto run via the stub. The stub classifier can't emit "FACT",
//    so auto must default to the council and complete cleanly.
(async () => {
  const events = [];
  try {
    for await (const evt of runMultiAgent({
      strategy: "auto",
      userInput: "Compare buying vs building software for an early startup and recommend.",
      councilSize: 3,
    })) {
      events.push(evt);
    }
  } catch (e) {
    ok("auto run did not throw", false);
    console.log("    " + (e && e.message ? e.message : String(e)));
  }

  const route = events.find((e) => e.type === "route");
  const plan = events.find((e) => e.type === "plan");
  const final = events.find((e) => e.type === "final");
  const done = events.find((e) => e.type === "done");
  const routeIdx = events.findIndex((e) => e.type === "route");
  const planIdx = events.findIndex((e) => e.type === "plan");

  ok("auto emits a route event", !!route);
  ok("route comes before plan", routeIdx >= 0 && planIdx >= 0 && routeIdx < planIdx);
  ok("route classification is open (stub can't say FACT)", route?.classification === "open");
  ok("route resolved to council", route?.resolved === "council");
  ok("route carries classifier provider/model", !!route?.classifier?.provider && !!route?.classifier?.model);
  ok("route carries a depth grade (light|deep)", route?.depth === "light" || route?.depth === "deep");
  ok("route carries a layer count (1–3)", typeof route?.layers === "number" && route.layers >= 1 && route.layers <= 3);
  ok("route depth agrees with layers", (route?.depth === "deep") === (route?.layers >= 2));
  ok("auto plan strategy is council", plan?.strategy === "council");
  ok("auto plan councilLayers matches routed depth", plan?.councilLayers === route?.layers);
  ok("auto run produced a final answer", !!final && typeof final.content === "string" && final.content.length > 0);
  ok("auto run completed with done", !!done);

  // 3. A heavy multi-part open query must resolve DEEP (L2); a focused one LIGHT.
  const heavy = [];
  for await (const evt of runMultiAgent({
    strategy: "auto",
    userInput: "Compare a monolith versus microservices for a small team, weigh the trade-offs across cost, speed, and hiring, and then explain which you'd pick and why.",
    councilSize: 3,
  })) heavy.push(evt);
  const heavyRoute = heavy.find((e) => e.type === "route");
  ok("heavy multi-part query → deep council (L2)", heavyRoute?.depth === "deep" && heavyRoute?.layers === 2);

  const focused = [];
  for await (const evt of runMultiAgent({
    strategy: "auto",
    userInput: "Is TypeScript worth it for a small project?",
    councilSize: 3,
  })) focused.push(evt);
  const focusedRoute = focused.find((e) => e.type === "route");
  ok("focused open query → light council (L1)", focusedRoute?.depth === "light" && focusedRoute?.layers === 1);

  // 4. An explicit councilLayers on an auto run must override the heuristic.
  const forced = [];
  for await (const evt of runMultiAgent({
    strategy: "auto",
    userInput: "Is TypeScript worth it for a small project?",
    councilSize: 3,
    councilLayers: 2,
  })) forced.push(evt);
  const forcedRoute = forced.find((e) => e.type === "route");
  ok("explicit councilLayers overrides heuristic (light query forced deep)",
    forcedRoute?.layers === 2 && forcedRoute?.depth === "deep");

  // 4b. Debate (agents argue Pro vs Con, a Moderator fuses one combined result)
  //     must run in BOTH online and offline (localOnly) mode. Offline convenes
  //     Pro/Con/Moderator from the local stub — no network, same combined output.
  async function runDebate(localOnly) {
    const evts = [];
    for await (const evt of runMultiAgent({
      strategy: "debate",
      userInput: "Should a startup build its own auth or use a managed provider?",
      ...(localOnly ? { localOnly: true } : {}),
    })) evts.push(evt);
    return evts;
  }
  const dOn = await runDebate(false);
  const dOnPlan = dOn.find((e) => e.type === "plan");
  const dOnFinal = dOn.find((e) => e.type === "final");
  ok("online debate plan strategy is debate", dOnPlan?.strategy === "debate");
  ok("online debate yields a combined final", !!dOnFinal && typeof dOnFinal.content === "string" && dOnFinal.content.length > 0);
  ok("online debate completes with done", dOn.some((e) => e.type === "done"));

  const dOff = await runDebate(true);
  const dOffPlan = dOff.find((e) => e.type === "plan");
  const dOffFinal = dOff.find((e) => e.type === "final");
  const dOffErr = dOff.find((e) => e.type === "error");
  ok("offline debate does not error out", !dOffErr);
  ok("offline debate yields a combined final", !!dOffFinal && typeof dOffFinal.content === "string" && dOffFinal.content.length > 0);
  ok("offline debate completes with done", dOff.some((e) => e.type === "done"));
  // Every debate agent must be the local stub (no cloud provider) offline.
  const dOffProviders = (dOffPlan && [dOffPlan.analyst?.provider, dOffPlan.writer?.provider, dOffPlan.writerB?.provider, dOffPlan.critic?.provider].filter(Boolean)) || [];
  ok("offline debate agents are all local (stub)", dOffProviders.length > 0 && dOffProviders.every((p) => p === "stub"));

  // 5. smartComplete — the platform smart-call wrapper. Non-streaming, returns
  //    { answer, routing } and folds each run into the shared savings tally.
  resetSmartTally();
  let sc1;
  try {
    sc1 = await smartComplete({ userInput: "Is TypeScript worth it for a small project?", councilSize: 3 });
  } catch (e) {
    ok("smartComplete did not throw", false);
    console.log("    " + (e && e.message ? e.message : String(e)));
  }
  ok("smartComplete returns a non-empty answer", !!sc1 && typeof sc1.answer === "string" && sc1.answer.length > 0);
  ok("smartComplete routing has resolved council (stub can't say FACT)", sc1?.routing?.resolved === "council");
  ok("smartComplete routing carries depth + layers", (sc1?.routing?.depth === "light" || sc1?.routing?.depth === "deep") && typeof sc1?.routing?.layers === "number");
  ok("smartComplete routing carries a numeric costUsd", typeof sc1?.routing?.costUsd === "number" && sc1.routing.costUsd >= 0);
  ok("smartComplete routing carries durationMs", typeof sc1?.routing?.durationMs === "number" && sc1.routing.durationMs >= 0);

  // A second run under a DIFFERENT module tag — the shared tally must aggregate
  // across calls AND split per module (cross-module dashboard).
  await smartComplete({ userInput: "Compare a monolith versus microservices, weigh the trade-offs across cost and hiring, and recommend which to pick.", councilSize: 3 }, { module: "devhub" });
  const snap = smartSavingsSnapshot();
  ok("savings tally counted both runs", snap.runs === 2);
  ok("savings tally buckets sum to runs", snap.facts + snap.light + snap.deep === snap.runs);
  ok("savings tally tracks estAlwaysCouncil = runs × baseline", Math.abs(snap.estAlwaysCouncilUsd - snap.runs * EST_COUNCIL_COST_USD) < 1e-9);
  ok("savings tally savedPct is within 0–100", snap.savedPct >= 0 && snap.savedPct <= 100);
  ok("savings tally has a per-module breakdown", Array.isArray(snap.perModule) && snap.perModule.length === 2);
  ok("per-module runs sum to total runs", snap.perModule.reduce((s, m) => s + m.runs, 0) === snap.runs);
  ok("per-module tags include qcoreai + devhub", snap.perModule.map((m) => m.module).sort().join(",") === "devhub,qcoreai");
  ok("smartComplete forced-deep override works", (await smartComplete({ userInput: "short", councilSize: 3, councilLayers: 2 })).routing.layers === 2);

  // Durable log helpers are DB-optional — with no database they must return null
  // (never throw), so the route falls back to the in-memory session snapshot.
  const { aggregateSmartRuns, dailySmartRuns } = require(path.join(__dirname, "..", "dist", "lib", "smartRunLog.js"));
  const agg = await aggregateSmartRuns();
  ok("aggregateSmartRuns returns null when no DB (no throw)", agg === null);
  const series = await dailySmartRuns(7);
  ok("dailySmartRuns returns null when no DB (no throw)", series === null);

  console.log(`\n${fail === 0 ? "PASS" : "FAIL"} — ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
})();
