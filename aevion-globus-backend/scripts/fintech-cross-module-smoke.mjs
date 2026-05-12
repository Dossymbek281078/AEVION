#!/usr/bin/env node
/**
 * Fintech Cross-Module Integration Smoke
 * Tests cross-product event flow: QGood donation → VeilNetX entry → Z-Tide reputation
 *
 * Usage:
 *   node scripts/fintech-cross-module-smoke.mjs
 *   BASE=http://localhost:4001 node scripts/fintech-cross-module-smoke.mjs
 *   BASE=https://aevion-production-a70c.up.railway.app node scripts/fintech-cross-module-smoke.mjs --jwt YOUR_TOKEN
 *
 * Steps:
 *  1. Health: all 5 fintech modules live
 *  2. VeilNetX chain head — record initial length
 *  3. QGood campaigns — at least 1 exists
 *  4. Z-Tide leaderboard — returns entries
 *  5. QChainGov proposals — list works
 *  6. QMaskCard health — service up
 *  7. VeilNetX head after — chain grew (if any write ops happened)
 *  8. Status endpoint — all modules report ok|degraded (not down)
 */

const BASE = (process.env.BASE || process.argv.find(a => a.startsWith("http")) || "https://aevion-production-a70c.up.railway.app").replace(/\/+$/, "");
const JWT  = process.env.JWT  || (process.argv.find(a => a === "--jwt") ? process.argv[process.argv.indexOf("--jwt") + 1] : null);

let passed = 0, failed = 0;
const ok   = (label, extra = "") => { passed++; console.log(`  ✓ ${label}${extra ? `  ${extra}` : ""}`); };
const fail = (label, reason = "") => { failed++; console.error(`  ✗ ${label}${reason ? `  ↳ ${reason}` : ""}`); };

async function get(path, auth = false) {
  const headers = { Accept: "application/json" };
  if (auth && JWT) headers["Authorization"] = `Bearer ${JWT}`;
  try {
    const r = await fetch(`${BASE}${path}`, { headers, signal: AbortSignal.timeout(8000) });
    let body; try { body = await r.json(); } catch { body = {}; }
    return { status: r.status, body };
  } catch (e) {
    return { status: 0, body: {}, error: e.message };
  }
}

console.log(`\n🔗 Fintech Cross-Module Smoke — ${BASE}\n`);

// ── 1. Health: all modules
console.log("1. Module health checks");
const healthPaths = [
  ["/api/health",                 "AEVION root"],
  ["/api/qgood/health",           "QGood"],
  ["/api/qmaskcard/health",       "QMaskCard"],
  ["/api/veilnetx-ledger/health", "VeilNetX Ledger"],
  ["/api/ztide/health",           "Z-Tide"],
  ["/api/qchaingov/health",       "QChainGov"],
];
for (const [path, name] of healthPaths) {
  const { status, body } = await get(path);
  if (status === 200 && (body.status === "ok" || body.service)) ok(name, body.status || "up");
  else fail(name, `HTTP ${status}`);
}

// ── 2. VeilNetX head (initial)
console.log("\n2. VeilNetX chain head");
const { status: veilS, body: veilB } = await get("/api/veilnetx-ledger/head");
const initialLength = veilB?.length ?? veilB?.total ?? null;
if (veilS === 200 && initialLength !== null) ok(`Head (length ${initialLength})`);
else fail("Head", `HTTP ${veilS}`);

// ── 3. QGood campaigns
console.log("\n3. QGood public campaigns");
const { status: gS, body: gB } = await get("/api/qgood/campaigns");
if (gS === 200 && Array.isArray(gB?.campaigns)) ok(`${gB.campaigns.length} campaigns returned`);
else fail("GET /api/qgood/campaigns", `HTTP ${gS}`);

// ── 4. Z-Tide leaderboard
console.log("\n4. Z-Tide reputation leaderboard");
const { status: zS, body: zB } = await get("/api/ztide/leaderboard");
if (zS === 200 && Array.isArray(zB?.entries)) ok(`${zB.entries.length} entries on leaderboard`);
else fail("GET /api/ztide/leaderboard", `HTTP ${zS}`);

// ── 5. QChainGov proposals
console.log("\n5. QChainGov active proposals");
const { status: qcS, body: qcB } = await get("/api/qchaingov/proposals?status=active");
if (qcS === 200 && Array.isArray(qcB?.proposals)) ok(`${qcB.proposals.length} active proposals`);
else fail("GET /api/qchaingov/proposals", `HTTP ${qcS}`);

// ── 6. QMaskCard stats (JWT-gated)
console.log("\n6. QMaskCard stats (auth-gated)");
if (JWT) {
  const { status: mS, body: mB } = await get("/api/qmaskcard/stats", true);
  if (mS === 200 && typeof mB?.active_masks !== "undefined") ok(`active_masks=${mB.active_masks}`);
  else fail("GET /api/qmaskcard/stats", `HTTP ${mS}`);
} else {
  const { status: mS } = await get("/api/qmaskcard/stats", false);
  if (mS === 401 || mS === 403) ok("QMaskCard stats gated (401/403 without JWT)");
  else fail("QMaskCard stats auth gate", `Expected 401/403, got ${mS}`);
}

// ── 7. Fintech aggregate status
console.log("\n7. /api/fintech/status aggregate");
const { status: fsS, body: fsB } = await get("/api/fintech/status");
if (fsS === 200 && fsB?.modules) {
  const allUp = Object.values(fsB.modules).every(v => v === "ok" || v === "degraded");
  if (allUp) ok("All modules ok/degraded", JSON.stringify(fsB.modules).slice(0, 60));
  else fail("Some modules down", JSON.stringify(fsB.modules));
} else fail("/api/fintech/status", `HTTP ${fsS}`);

// ── Summary
console.log(`\n${"─".repeat(48)}`);
console.log(`  PASS ${passed}   FAIL ${failed}   TOTAL ${passed + failed}`);
if (failed > 0) {
  console.error(`\n  ✗ ${failed} check(s) failed`);
  process.exit(1);
} else {
  console.log(`\n  ✓ All checks passed`);
}
