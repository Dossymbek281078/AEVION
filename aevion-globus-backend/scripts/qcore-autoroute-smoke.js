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

const { runMultiAgent, parseRouteToken } = require(orchPath);

console.log("QCoreAI auto-router smoke\n");

// 1. Pure decision rule — only an explicit FACT token routes to the single path.
ok("parseRouteToken FACT → fact", parseRouteToken("FACT") === "fact");
ok("parseRouteToken lowercase 'fact.' → fact", parseRouteToken("fact.") === "fact");
ok("parseRouteToken 'FACTUAL' → fact", parseRouteToken("FACTUAL") === "fact");
ok("parseRouteToken OPEN → open", parseRouteToken("OPEN") === "open");
ok("parseRouteToken empty → open (safe default)", parseRouteToken("") === "open");
ok("parseRouteToken garbage → open (safe default)", parseRouteToken("I think council") === "open");
ok("parseRouteToken 'this is a FACT' (not prefix) → open", parseRouteToken("this is a FACT") === "open");

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
  ok("auto plan strategy is council", plan?.strategy === "council");
  ok("auto run produced a final answer", !!final && typeof final.content === "string" && final.content.length > 0);
  ok("auto run completed with done", !!done);

  console.log(`\n${fail === 0 ? "PASS" : "FAIL"} — ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
})();
