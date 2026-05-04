#!/usr/bin/env node
/**
 * AEVION smoke orchestrator — runs every smoke script in sequence against
 * a single target backend (BASE env), aggregates pass/fail, exits 1 if any
 * step failed.
 *
 * Used by:
 *   - npm run smoke:all                       — local manual run
 *   - .github/workflows/daily-smoke.yml       — daily cron in CI
 *
 * Env overrides:
 *   BASE                  default http://127.0.0.1:4001
 *   ONLY                  comma-separated whitelist (e.g. ONLY=tier3,qshield)
 *   SKIP                  comma-separated blacklist (e.g. SKIP=qcore,build)
 *   READ_ONLY             when "1", run only smokes safe for prod
 *                         (read-only — no DB writes). Defaults to "0".
 *
 * Each child smoke inherits the parent env plus any per-smoke overrides
 * from the SMOKES list below. Output streams through to the parent's
 * stdout/stderr in real time.
 *
 * Requires Node 18+ (global fetch in child smokes).
 */

const { spawnSync } = require("child_process");
const path = require("path");

const BASE = (process.env.BASE || "http://127.0.0.1:4001").replace(/\/+$/, "");
const ONLY = (process.env.ONLY || "").split(",").map((s) => s.trim()).filter(Boolean);
const SKIP = (process.env.SKIP || "").split(",").map((s) => s.trim()).filter(Boolean);
const READ_ONLY = process.env.READ_ONLY === "1";

const SMOKES = [
  // Read-only public endpoints — safe to run anywhere, including prod.
  // Tier 3 amplifier surfaces (OG cards, sitemaps, RSS, badges).
  { name: "tier3", script: "tier3-smoke.js", readOnly: true },

  // The rest mutate state — register users, create records — so they only
  // run in ephemeral CI environments (READ_ONLY=0).
  { name: "auth-replay", script: "auth-replay-smoke.js", readOnly: false },
  { name: "qsign-v2", script: "qsign-v2-smoke.js", readOnly: false },
  { name: "qshield", script: "qshield-smoke.js", readOnly: false },
  { name: "aev", script: "aev-smoke.js", readOnly: false },
  { name: "build", script: "build-smoke.js", readOnly: false },
  { name: "planet", script: "planet-smoke.js", readOnly: false },
  { name: "awards", script: "awards-smoke.js", readOnly: false },
  // qpaynet/qcontract: read-only public legs run anywhere; auth legs gated by TEST_JWT.
  { name: "qpaynet", script: "qpaynet-smoke.js", readOnly: true },
  { name: "qcontract", script: "qcontract-smoke.js", readOnly: true },
  // qcore needs an LLM provider key for the run step. Default to skipping
  // those legs so the smoke validates plumbing (auth + history + analytics)
  // without burning provider tokens. Override via env if you want the full pass.
  {
    name: "qcore",
    script: "qcore-smoke.js",
    readOnly: false,
    env: { SKIP_RUN: process.env.SKIP_RUN ?? "1", SKIP_LLM_JUDGE: process.env.SKIP_LLM_JUDGE ?? "1" },
  },
];

const eligible = SMOKES.filter((sm) => {
  if (ONLY.length > 0 && !ONLY.includes(sm.name)) return false;
  if (SKIP.includes(sm.name)) return false;
  if (READ_ONLY && !sm.readOnly) return false;
  return true;
});

if (eligible.length === 0) {
  console.error("No smokes selected. Check ONLY / SKIP / READ_ONLY env vars.");
  process.exit(2);
}

console.log(`AEVION smoke orchestrator`);
console.log(`  BASE       = ${BASE}`);
console.log(`  READ_ONLY  = ${READ_ONLY ? "yes" : "no"}`);
console.log(`  scripts    = ${eligible.map((s) => s.name).join(", ")}`);
console.log("");

const results = [];
for (const sm of eligible) {
  const banner = `========== ${sm.name} ==========`;
  console.log(`\n${banner}`);
  const start = Date.now();
  const child = spawnSync("node", [path.join(__dirname, sm.script)], {
    stdio: "inherit",
    env: { ...process.env, BASE, ...(sm.env || {}) },
  });
  const elapsed = Date.now() - start;
  const ok = child.status === 0;
  results.push({ name: sm.name, ok, status: child.status, elapsed });
}

console.log("\n========== Summary ==========");
let passed = 0,
  failed = 0;
for (const r of results) {
  const tag = r.ok ? "PASS" : "FAIL";
  const detail = r.ok ? "" : ` (exit=${r.status})`;
  console.log(`  ${tag}  ${r.name.padEnd(12)}  ${(r.elapsed / 1000).toFixed(1)}s${detail}`);
  if (r.ok) passed += 1;
  else failed += 1;
}
console.log(`\n  total: ${results.length}, passed: ${passed}, failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
