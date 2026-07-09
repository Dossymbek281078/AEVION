#!/usr/bin/env node
"use strict";
/**
 * Desktop orchestrator smoke — pure Node, no Electron, no child processes spawned.
 * Verifies the orchestration helpers and path resolution are sound.
 *
 *   node smoke.js   (from desktop/)
 */
const fs = require("node:fs");
const { Orchestrator, resolvePaths, probe, waitFor } = require("./lib/orchestrator");

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`); }
}

(async () => {
  console.log("AEVION Council desktop smoke\n");

  // Path resolution (dev checkout).
  const p = resolvePaths();
  ok("resolvePaths returns backend path", typeof p.backend === "string" && p.backend.endsWith("aevion-globus-backend"));
  ok("resolvePaths returns frontend path", typeof p.frontend === "string" && p.frontend.endsWith("frontend"));
  ok("backend folder exists", fs.existsSync(p.backend));
  ok("frontend folder exists", fs.existsSync(p.frontend));

  // probe: a definitely-closed port answers false, fast.
  const closed = await probe("http://127.0.0.1:59999/", 1000);
  ok("probe of closed port is false", closed === false);

  // waitFor times out (returns false) on an unreachable URL without throwing.
  const t0 = Date.now();
  const waited = await waitFor("http://127.0.0.1:59999/", { timeoutMs: 1500, intervalMs: 300 });
  ok("waitFor times out to false", waited === false);
  ok("waitFor respected the timeout window", Date.now() - t0 >= 1400 && Date.now() - t0 < 6000);

  // Orchestrator constructs cleanly and starts with no children.
  const orch = new Orchestrator({ onLog: () => {} });
  ok("orchestrator constructs", Array.isArray(orch.children) && orch.children.length === 0);
  ok("orchestrator resolved paths", !!orch.paths && !!orch.paths.backend);
  orch.stop();
  ok("orchestrator.stop is idempotent", orch.children.length === 0);

  console.log(`\n${fail === 0 ? "PASS" : "FAIL"} — ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
})();
