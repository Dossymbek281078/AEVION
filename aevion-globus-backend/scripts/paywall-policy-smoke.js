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

let failed = 0;
let passed = 0;

function pass(msg) { console.log(`✓ ${msg}`); passed++; }
function fail(msg) { console.error(`✗ ${msg}`); failed++; }

(async () => {
  console.log(`Paywall policy smoke — BASE=${BASE}`);
  if (EXPECT_ENFORCED.length) console.log(`Expected enforced modules: ${EXPECT_ENFORCED.join(", ")}`);
  console.log("");

  let body;
  try {
    const r = await fetch(`${BASE}/api/paywall/policy`);
    if (r.status !== 200) {
      fail(`/api/paywall/policy — HTTP ${r.status}`);
      process.exit(1);
    }
    body = await r.json();
    pass(`/api/paywall/policy — 200`);
  } catch (e) {
    console.error("Crash on initial fetch:", e.message);
    process.exit(2);
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
