#!/usr/bin/env node
/**
 * QCoreAI quota policy smoke — read-only probe of /api/qcoreai/quota-policy
 * to confirm:
 *   1. The endpoint is up.
 *   2. Every tier in the response has the expected shape (no silent renames
 *      of llmTokensPerMonth/premiumTokensPerMonth).
 *   3. The three gate flags (freeQuotaEnforced/tierQuotaEnforced/
 *      premiumQuotaEnforced) match what the operator expects.
 *
 * Modeled directly on paywall-policy-smoke.js — see
 * docs/QCOREAI_QUOTA_FLIP_READINESS.md for when to run this (before and
 * after flipping QCOREAI_TIER_QUOTA / QCOREAI_PREMIUM_QUOTA on Railway).
 *
 * Usage:
 *   node scripts/qcoreai-quota-policy-smoke.js
 *   BASE=https://aevion.app/api-backend node scripts/qcoreai-quota-policy-smoke.js
 *   EXPECT_FREE=1 EXPECT_TIER=1 EXPECT_PREMIUM=0 node scripts/qcoreai-quota-policy-smoke.js
 *   EXPECT_TIER=1 node scripts/qcoreai-quota-policy-smoke.js --wait
 *
 * EXPECT_* values: "1" (must be enforced), "0" (must be dormant), unset (no assertion).
 * Exit codes: 0 = green, 1 = mismatch, 2 = crash.
 */

const BASE = (process.env.BASE || "https://aevion.app/api-backend").replace(/\/+$/, "");
const EXPECT_FREE = process.env.EXPECT_FREE; // "1" | "0" | undefined
const EXPECT_TIER = process.env.EXPECT_TIER;
const EXPECT_PREMIUM = process.env.EXPECT_PREMIUM;
const WAIT = process.argv.includes("--wait");
const WAIT_TIMEOUT_MS = parseInt(process.env.WAIT_TIMEOUT_MS || "300000", 10); // 5 min default
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || "10000", 10); // 10s default

const EXPECTED_TIER_IDS = ["free", "lite", "medium", "full", "pro", "enterprise"];

let failed = 0;
let passed = 0;

function pass(msg) { console.log(`✓ ${msg}`); passed++; }
function fail(msg) { console.error(`✗ ${msg}`); failed++; }

async function fetchPolicy() {
  const r = await fetch(`${BASE}/api/qcoreai/quota-policy`);
  if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function matchesExpectation(actual, expected) {
  if (expected === undefined) return true; // no assertion requested
  return actual === (expected === "1");
}

(async () => {
  console.log(`QCoreAI quota policy smoke — BASE=${BASE}`);
  const wants = [];
  if (EXPECT_FREE !== undefined) wants.push(`free=${EXPECT_FREE}`);
  if (EXPECT_TIER !== undefined) wants.push(`tier=${EXPECT_TIER}`);
  if (EXPECT_PREMIUM !== undefined) wants.push(`premium=${EXPECT_PREMIUM}`);
  if (wants.length) console.log(`Expected: ${wants.join(", ")}`);
  if (WAIT) console.log(`Wait mode: polling every ${POLL_INTERVAL_MS}ms until expected matches (timeout ${WAIT_TIMEOUT_MS}ms)`);
  console.log("");

  let body;

  if (WAIT && wants.length) {
    const deadline = Date.now() + WAIT_TIMEOUT_MS;
    while (true) {
      try {
        const candidate = await fetchPolicy();
        const matches =
          matchesExpectation(candidate.freeQuotaEnforced, EXPECT_FREE) &&
          matchesExpectation(candidate.tierQuotaEnforced, EXPECT_TIER) &&
          matchesExpectation(candidate.premiumQuotaEnforced, EXPECT_PREMIUM);
        const status = matches
          ? "✓ matched"
          : `current: free=${candidate.freeQuotaEnforced} tier=${candidate.tierQuotaEnforced} premium=${candidate.premiumQuotaEnforced}`;
        console.log(`[${new Date().toISOString()}] ${status}`);
        if (matches) { body = candidate; break; }
      } catch (e) {
        console.log(`[${new Date().toISOString()}] poll error: ${e.message}`);
      }
      if (Date.now() > deadline) {
        fail(`timeout — expected state not reached after ${WAIT_TIMEOUT_MS}ms`);
        process.exit(1);
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
    pass(`expected gate state matched after wait`);
  } else {
    try {
      body = await fetchPolicy();
      pass(`/api/qcoreai/quota-policy — 200`);
    } catch (e) {
      fail(`/api/qcoreai/quota-policy — ${e.message}`);
      process.exit(1);
    }
  }

  for (const key of ["freeQuotaEnforced", "tierQuotaEnforced", "premiumQuotaEnforced"]) {
    if (typeof body?.[key] !== "boolean") fail(`response.${key} is not a boolean`);
    else pass(`response.${key} — ${body[key]}`);
  }

  if (typeof body?.freeTokenLimit !== "number") {
    fail(`response.freeTokenLimit is not a number`);
  } else {
    pass(`response.freeTokenLimit — ${body.freeTokenLimit.toLocaleString()}`);
  }

  // premiumQuotaScope proves the DEPLOYED build carries each premium-gate
  // wire-in — "orchestrator" appeared 2026-07-26. A missing entry means the
  // build predates that coverage and flipping QCOREAI_PREMIUM_QUOTA would
  // leave multi-agent runs unmetered.
  if (!Array.isArray(body?.premiumQuotaScope)) {
    fail(`response.premiumQuotaScope is not an array (build predates 2026-07-26 orchestrator coverage?)`);
  } else {
    const missingScopes = ["chat", "chat-stream", "orchestrator"].filter((s) => !body.premiumQuotaScope.includes(s));
    if (missingScopes.length) fail(`premiumQuotaScope missing: ${missingScopes.join(", ")}`);
    else pass(`premiumQuotaScope covers chat + chat-stream + orchestrator`);
  }

  if (!Array.isArray(body?.tiers)) {
    fail(`response.tiers is not an array (got ${typeof body?.tiers})`);
  } else {
    pass(`response.tiers — array (${body.tiers.length} entries)`);
    const ids = body.tiers.map((t) => t.tier);
    const missingIds = EXPECTED_TIER_IDS.filter((id) => !ids.includes(id));
    if (missingIds.length) fail(`response.tiers missing expected tier id(s): ${missingIds.join(", ")}`);
    else pass(`response.tiers covers all expected tier ids`);

    const first = body.tiers[0];
    if (!first || typeof first.tier !== "string") fail(`tiers[0].tier — missing/wrong type`);
    else if (!("llmTokensPerMonth" in first)) fail(`tiers[0].llmTokensPerMonth — missing`);
    else if (!("premiumTokensPerMonth" in first)) fail(`tiers[0].premiumTokensPerMonth — missing`);
    else pass(`tiers[0] shape OK ({tier:"${first.tier}", llmTokensPerMonth:${first.llmTokensPerMonth}, premiumTokensPerMonth:${first.premiumTokensPerMonth}})`);

    // Universe/"pro" must have a strictly higher cap than Full — the whole
    // point of the 2026-07-22 repricing/entitlement fix. A regression here
    // would mean the flagship tier stopped being the flagship.
    const full = body.tiers.find((t) => t.tier === "full");
    const pro = body.tiers.find((t) => t.tier === "pro");
    if (full && pro && typeof full.llmTokensPerMonth === "number" && typeof pro.llmTokensPerMonth === "number") {
      if (pro.llmTokensPerMonth > full.llmTokensPerMonth) {
        pass(`pro/Universe llmTokensPerMonth (${pro.llmTokensPerMonth.toLocaleString()}) > full's (${full.llmTokensPerMonth.toLocaleString()})`);
      } else {
        fail(`pro/Universe llmTokensPerMonth (${pro.llmTokensPerMonth}) is NOT greater than full's (${full.llmTokensPerMonth}) — flagship regression?`);
      }
    }
  }

  console.log("");
  if (!matchesExpectation(body?.freeQuotaEnforced, EXPECT_FREE)) fail(`freeQuotaEnforced expected ${EXPECT_FREE === "1"}, got ${body?.freeQuotaEnforced}`);
  if (!matchesExpectation(body?.tierQuotaEnforced, EXPECT_TIER)) fail(`tierQuotaEnforced expected ${EXPECT_TIER === "1"}, got ${body?.tierQuotaEnforced}`);
  if (!matchesExpectation(body?.premiumQuotaEnforced, EXPECT_PREMIUM)) fail(`premiumQuotaEnforced expected ${EXPECT_PREMIUM === "1"}, got ${body?.premiumQuotaEnforced}`);

  console.log(`Result: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})().catch((e) => {
  console.error("Crash:", e);
  process.exit(2);
});
