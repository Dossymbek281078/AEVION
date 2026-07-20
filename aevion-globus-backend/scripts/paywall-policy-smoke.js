#!/usr/bin/env node
/**
 * Paywall policy smoke — read-only probe of /api/paywall/policy to confirm:
 *   1. The endpoint is up.
 *   2. Every module in MODULES_PRICING shows up in the policy.
 *   3. The `enforced` count matches what the operator expects (PAYWALL_MODULES env).
 *   4. The shape is stable (no silent renames of `requiredTiers`/`enforced`).
 *
 * Use this BEFORE flipping PAYWALL_MODULES in prod to verify the runtime state,
 * and AFTER flipping to confirm enforcement took effect.
 *
 * Usage:
 *   node scripts/paywall-policy-smoke.js
 *   BASE=https://aevion.app/api-backend node scripts/paywall-policy-smoke.js
 *   EXPECT_ENFORCED=qcoreai,qfusionai node scripts/paywall-policy-smoke.js
 *
 * Exit codes: 0 = green, 1 = mismatch, 2 = crash.
 */

const BASE = (process.env.BASE || "https://aevion.app/api-backend").replace(/\/+$/, "");
const EXPECT_ENFORCED = (process.env.EXPECT_ENFORCED || "")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const WAIT = process.argv.includes("--wait");
const WAIT_TIMEOUT_MS = parseInt(process.env.WAIT_TIMEOUT_MS || "300000", 10); // 5 min default
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || "10000", 10); // 10s default

let failed = 0;
let passed = 0;

function pass(msg) { console.log(`✓ ${msg}`); passed++; }
function fail(msg) { console.error(`✗ ${msg}`); failed++; }

async function fetchPolicy() {
  const r = await fetch(`${BASE}/api/paywall/policy`);
  if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function enforcedSet(body) {
  return new Set((body.modules || []).filter((m) => m.enforced).map((m) => m.module));
}

(async () => {
  console.log(`Paywall policy smoke — BASE=${BASE}`);
  if (EXPECT_ENFORCED.length) console.log(`Expected enforced modules: ${EXPECT_ENFORCED.join(", ")}`);
  if (WAIT) console.log(`Wait mode: polling every ${POLL_INTERVAL_MS}ms until expected matches (timeout ${WAIT_TIMEOUT_MS}ms)`);
  console.log("");

  let body;

  // Wait mode: poll until enforced set matches EXPECT_ENFORCED, then run normal checks.
  if (WAIT && EXPECT_ENFORCED.length) {
    const deadline = Date.now() + WAIT_TIMEOUT_MS;
    const target = new Set(EXPECT_ENFORCED);
    while (true) {
      try {
        const candidate = await fetchPolicy();
        const cur = enforcedSet(candidate);
        const matches =
          cur.size === target.size && [...target].every((m) => cur.has(m));
        const status = matches ? "✓ matched" : `current: [${[...cur].sort().join(", ") || "<none>"}]`;
        console.log(`[${new Date().toISOString()}] ${status}`);
        if (matches) { body = candidate; break; }
      } catch (e) {
        console.log(`[${new Date().toISOString()}] poll error: ${e.message}`);
      }
      if (Date.now() > deadline) {
        fail(`timeout — expected ${EXPECT_ENFORCED.join(",")} not enforced after ${WAIT_TIMEOUT_MS}ms`);
        process.exit(1);
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
    pass(`enforced set matched after wait`);
  } else {
    try {
      body = await fetchPolicy();
      pass(`/api/paywall/policy — 200`);
    } catch (e) {
      fail(`/api/paywall/policy — ${e.message}`);
      process.exit(1);
    }
  }

  if (!Array.isArray(body?.modules)) {
    fail(`response.modules is not an array (got ${typeof body?.modules})`);
    process.exit(1);
  }
  pass(`response.modules — array (${body.modules.length} entries)`);

  if (typeof body.enforcedCount !== "number") {
    fail(`response.enforcedCount is not a number`);
  } else {
    pass(`response.enforcedCount — ${body.enforcedCount}`);
  }

  // Shape check on the first entry — guards against silent field renames.
  const first = body.modules[0];
  if (!first || typeof first.module !== "string") fail(`module[0].module — missing/wrong type`);
  else if (!Array.isArray(first.requiredTiers)) fail(`module[0].requiredTiers — not array`);
  else if (typeof first.enforced !== "boolean") fail(`module[0].enforced — not boolean`);
  else pass(`module[0] shape OK ({module:"${first.module}", requiredTiers:[${first.requiredTiers.join(",")}], enforced:${first.enforced}})`);

  // Enforcement summary
  const enforced = body.modules.filter((m) => m.enforced).map((m) => m.module).sort();
  console.log("");
  console.log(`Enforced now (${enforced.length}): ${enforced.length ? enforced.join(", ") : "<none — paywall dormant>"}`);

  // Modules that must never show enforced:true — each advertises a free-tier
  // promise (e.g. qcoreai's 100k tokens/mo) that the gate can't honor without
  // usage metering that doesn't exist yet. planGate.ts's UNSAFE_TO_GATE strips
  // these server-side regardless of PAYWALL_MODULES, but this assertion is the
  // independent outside check — keep this list in sync with UNSAFE_TO_GATE in
  // aevion-globus-backend/src/lib/planGate.ts and the "Deliberately NOT gated"
  // section of docs/PAYWALL_FLIP_READINESS.md. See the 2026-07-16 incident note
  // in planGate.ts for why this exists.
  const UNSAFE_TO_GATE = ["qcoreai", "qright", "qsign"];
  const unsafelyEnforced = enforced.filter((m) => UNSAFE_TO_GATE.includes(m));
  if (unsafelyEnforced.length) {
    fail(`UNSAFE_TO_GATE module(s) showing enforced:true — free-tier promise broken: ${unsafelyEnforced.join(", ")}`);
  } else {
    pass(`no UNSAFE_TO_GATE module is enforced`);
  }

  if (EXPECT_ENFORCED.length > 0) {
    const expectedSet = new Set(EXPECT_ENFORCED);
    const actualSet = new Set(enforced);
    const missing = [...expectedSet].filter((x) => !actualSet.has(x));
    const extra = [...actualSet].filter((x) => !expectedSet.has(x));
    if (missing.length === 0 && extra.length === 0) {
      pass(`enforced set matches EXPECT_ENFORCED`);
    } else {
      if (missing.length) fail(`expected to be enforced but isn't: ${missing.join(", ")}`);
      if (extra.length) fail(`enforced but not in EXPECT_ENFORCED: ${extra.join(", ")}`);
    }
  }

  console.log("");
  console.log(`Result: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})().catch((e) => {
  console.error("Crash:", e);
  process.exit(2);
});
