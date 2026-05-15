#!/usr/bin/env node
/**
 * webhook-sig-smoke — exercise webhookSig.ts sign+verify roundtrip locally.
 *
 *   - sign with current secret → verify with current secret           → OK
 *   - sign with current secret → verify with [current, prev] rotation → OK (index 0)
 *   - sign with prev secret    → verify with [current, prev] rotation → OK (index 1)
 *   - sign with wrong secret   → verify                               → REJECT
 *   - tamper body              → verify                               → REJECT
 *   - timestamp drift > 5 min  → verify                               → REJECT
 *   - missing timestamp        → verify                               → REJECT
 *   - sha256= prefix in header → verify                               → OK (prefix stripped)
 *   - legacy bearer fallback   → verify                               → OK (mode=legacy)
 *   - WEBHOOK_REQUIRE_HMAC=1 + legacy only → verify                   → REJECT
 *
 * No backend required — pure crypto test of lib/webhookSig.ts.
 *
 * Run from aevion-globus-backend/:
 *   node scripts/webhook-sig-smoke.js
 */

"use strict";

const path = require("path");
const Module = require("module");

// Ensure ts-node can load .ts files when this smoke is run before build.
try {
  require("ts-node/register/transpile-only");
} catch (_) {
  // After build, fall back to dist/.
}

function loadWebhookSig() {
  try {
    return require(path.join(__dirname, "..", "src", "lib", "webhookSig.ts"));
  } catch (eTs) {
    try {
      return require(path.join(__dirname, "..", "dist", "lib", "webhookSig.js"));
    } catch (eJs) {
      console.error("[webhook-sig-smoke] cannot load webhookSig from src or dist");
      console.error("ts-node error:", eTs.message);
      console.error("dist error:", eJs.message);
      process.exit(2);
    }
  }
}

const { verifyWebhookSig, signWebhookPayload, assertWebhookSig } = loadWebhookSig();

let passed = 0;
let failed = 0;
const failures = [];

function assert(name, ok, detail = "") {
  if (ok) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    failures.push({ name, detail });
    console.error(`  ✗ ${name}${detail ? "  — " + detail : ""}`);
  }
}

// ──────────────────────────────────────────────────────────────
// Setup
// ──────────────────────────────────────────────────────────────
const SECRET_NEW = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const SECRET_OLD = "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";
const WRONG     = "00000000000000000000000000000000";
const BODY = { id: "evt_01J", type: "transfer.completed", module: "qpaynet", data: { txId: "u1", amountKzt: 1000 } };

console.log("\n[webhook-sig-smoke] start");

// ──────────────────────────────────────────────────────────────
// 1. sign + verify roundtrip
// ──────────────────────────────────────────────────────────────
{
  const { signature, timestamp } = signWebhookPayload({ body: BODY, secret: SECRET_NEW });
  const r = verifyWebhookSig({ body: BODY, secret: SECRET_NEW, signature, timestamp: String(timestamp) });
  assert("1.sign+verify happy path → ok", r.ok === true && r.mode === "hmac", JSON.stringify(r));
  assert("1.secretIndex on plain verify = 0", r.ok && r.secretIndex === 0);
}

// ──────────────────────────────────────────────────────────────
// 2. sha256= prefix tolerance
// ──────────────────────────────────────────────────────────────
{
  const { signature, timestamp } = signWebhookPayload({ body: BODY, secret: SECRET_NEW });
  const r = verifyWebhookSig({ body: BODY, secret: SECRET_NEW, signature: `sha256=${signature}`, timestamp: String(timestamp) });
  assert("2.sha256= prefix accepted", r.ok === true);
}

// ──────────────────────────────────────────────────────────────
// 3. hmac-sha256: prefix tolerance
// ──────────────────────────────────────────────────────────────
{
  const { signature, timestamp } = signWebhookPayload({ body: BODY, secret: SECRET_NEW });
  const r = verifyWebhookSig({ body: BODY, secret: SECRET_NEW, signature: `hmac-sha256:${signature}`, timestamp: String(timestamp) });
  assert("3.hmac-sha256: prefix accepted", r.ok === true);
}

// ──────────────────────────────────────────────────────────────
// 4. rotation — old secret still accepted via previousSecrets
// ──────────────────────────────────────────────────────────────
{
  const { signature, timestamp } = signWebhookPayload({ body: BODY, secret: SECRET_OLD });
  const r = verifyWebhookSig({
    body: BODY,
    secret: SECRET_NEW,
    previousSecrets: [SECRET_OLD],
    signature,
    timestamp: String(timestamp),
  });
  assert("4.rotation: old secret accepted", r.ok === true && r.secretIndex === 1, JSON.stringify(r));
}

// ──────────────────────────────────────────────────────────────
// 5. rotation — current still wins index 0
// ──────────────────────────────────────────────────────────────
{
  const { signature, timestamp } = signWebhookPayload({ body: BODY, secret: SECRET_NEW });
  const r = verifyWebhookSig({
    body: BODY,
    secret: SECRET_NEW,
    previousSecrets: [SECRET_OLD],
    signature,
    timestamp: String(timestamp),
  });
  assert("5.rotation: current secret wins index 0", r.ok === true && r.secretIndex === 0);
}

// ──────────────────────────────────────────────────────────────
// 6. wrong secret rejected
// ──────────────────────────────────────────────────────────────
{
  const { signature, timestamp } = signWebhookPayload({ body: BODY, secret: WRONG });
  const r = verifyWebhookSig({ body: BODY, secret: SECRET_NEW, signature, timestamp: String(timestamp) });
  assert("6.wrong secret → signature mismatch", r.ok === false && /signature mismatch/.test(r.reason), JSON.stringify(r));
}

// ──────────────────────────────────────────────────────────────
// 7. tampered body rejected
// ──────────────────────────────────────────────────────────────
{
  const { signature, timestamp } = signWebhookPayload({ body: BODY, secret: SECRET_NEW });
  const tampered = { ...BODY, data: { ...BODY.data, amountKzt: 999999 } };
  const r = verifyWebhookSig({ body: tampered, secret: SECRET_NEW, signature, timestamp: String(timestamp) });
  assert("7.tampered body → signature mismatch", r.ok === false && /signature mismatch/.test(r.reason));
}

// ──────────────────────────────────────────────────────────────
// 8. timestamp drift > 5 min rejected
// ──────────────────────────────────────────────────────────────
{
  const oldTs = Math.floor(Date.now() / 1000) - 700; // 11+ minutes old
  const { signature } = signWebhookPayload({ body: BODY, secret: SECRET_NEW, timestamp: oldTs });
  const r = verifyWebhookSig({ body: BODY, secret: SECRET_NEW, signature, timestamp: String(oldTs) });
  assert("8.stale timestamp → reject (skew>300s)", r.ok === false && /timestamp skew/.test(r.reason), JSON.stringify(r));
}

// ──────────────────────────────────────────────────────────────
// 9. non-numeric timestamp rejected
// ──────────────────────────────────────────────────────────────
{
  const { signature } = signWebhookPayload({ body: BODY, secret: SECRET_NEW });
  const r = verifyWebhookSig({ body: BODY, secret: SECRET_NEW, signature, timestamp: "not-a-number" });
  assert("9.non-numeric timestamp → reject", r.ok === false && /timestamp not numeric/.test(r.reason));
}

// ──────────────────────────────────────────────────────────────
// 10. missing HMAC headers + legacy match → ok
// ──────────────────────────────────────────────────────────────
{
  const r = verifyWebhookSig({ body: BODY, secret: SECRET_NEW, legacySecret: SECRET_NEW });
  assert("10.legacy bearer fallback → ok (mode=legacy)", r.ok === true && r.mode === "legacy");
}

// ──────────────────────────────────────────────────────────────
// 11. legacy rotation — old legacy secret accepted via previousSecrets
// ──────────────────────────────────────────────────────────────
{
  const r = verifyWebhookSig({ body: BODY, secret: SECRET_NEW, previousSecrets: [SECRET_OLD], legacySecret: SECRET_OLD });
  assert("11.legacy rotation: old secret accepted", r.ok === true && r.mode === "legacy" && r.secretIndex === 1, JSON.stringify(r));
}

// ──────────────────────────────────────────────────────────────
// 12. requireHmac=true + only legacy → reject
// ──────────────────────────────────────────────────────────────
{
  const r = verifyWebhookSig({ body: BODY, secret: SECRET_NEW, legacySecret: SECRET_NEW, requireHmac: true });
  assert("12.requireHmac=true + legacy → reject", r.ok === false && /HMAC headers required/.test(r.reason));
}

// ──────────────────────────────────────────────────────────────
// 13. requireHmac=true + valid HMAC → ok
// ──────────────────────────────────────────────────────────────
{
  const { signature, timestamp } = signWebhookPayload({ body: BODY, secret: SECRET_NEW });
  const r = verifyWebhookSig({ body: BODY, secret: SECRET_NEW, signature, timestamp: String(timestamp), requireHmac: true });
  assert("13.requireHmac=true + valid HMAC → ok", r.ok === true && r.mode === "hmac");
}

// ──────────────────────────────────────────────────────────────
// 14. body key reordering still verifies (stable stringify)
// ──────────────────────────────────────────────────────────────
{
  const reordered = { data: BODY.data, module: BODY.module, type: BODY.type, id: BODY.id };
  const { signature, timestamp } = signWebhookPayload({ body: BODY, secret: SECRET_NEW });
  const r = verifyWebhookSig({ body: reordered, secret: SECRET_NEW, signature, timestamp: String(timestamp) });
  assert("14.key-reordered body still verifies (canonical-JSON)", r.ok === true, JSON.stringify(r));
}

// ──────────────────────────────────────────────────────────────
// 15. assertWebhookSig throws with statusCode=401 on bad
// ──────────────────────────────────────────────────────────────
{
  let threw = null;
  try { assertWebhookSig({ ok: false, reason: "test" }); } catch (e) { threw = e; }
  assert("15.assertWebhookSig throws 401 on bad", threw && threw.statusCode === 401);
}

// ──────────────────────────────────────────────────────────────
// 16. assertWebhookSig passes through ok
// ──────────────────────────────────────────────────────────────
{
  let threw = null;
  try { assertWebhookSig({ ok: true, mode: "hmac" }); } catch (e) { threw = e; }
  assert("16.assertWebhookSig no-throw on ok", threw === null);
}

// ──────────────────────────────────────────────────────────────
// Summary
// ──────────────────────────────────────────────────────────────
console.log(`\n[webhook-sig-smoke] ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error("\nFailures:");
  for (const f of failures) console.error(`  - ${f.name}${f.detail ? "  " + f.detail : ""}`);
  process.exit(1);
}
process.exit(0);
