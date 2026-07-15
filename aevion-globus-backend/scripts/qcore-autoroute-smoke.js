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

  console.log(`\n${fail === 0 ? "PASS" : "FAIL"} — ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
})();
