#!/usr/bin/env node
/**
 * AEVION waitlist unsubscribe smoke — verifies one-click unsub flow on a
 * factory-registered planning module (defaults to qpersona).
 *
 * Flow:
 *   1. POST /waitlist with fresh email → expect 201, captures email
 *   2. GET /unsubscribe?token=<garbage> → expect 400 (invalid)
 *   3. GET /unsubscribe with no token → expect 400
 *   4. (We can't generate a valid token client-side without the secret,
 *      so we only test that endpoint exists and rejects invalid input.
 *      Valid-token flow is tested via the email link in real use.)
 *   5. Re-POST same email to /waitlist → expect 200 (alreadyJoined)
 *
 * Read-only-ish — does insert a new waitlist row per run but uses unique
 * timestamped email so safe to run anywhere including prod.
 */

const BASE = (process.env.BASE || "http://127.0.0.1:4001").replace(/\/+$/, "");
const MODULE_ID = process.env.SMOKE_MODULE || "qpersona";

let pass = 0;
let fail = 0;

async function step(name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    const ms = Date.now() - t0;
    console.log(`  ✅ ${name} (${ms}ms)`);
    pass++;
  } catch (e) {
    const ms = Date.now() - t0;
    console.log(`  ❌ ${name} (${ms}ms): ${e.message}`);
    fail++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

(async () => {
  console.log(`[waitlist-unsub-smoke] Target: ${BASE}, module: ${MODULE_ID}`);
  console.log("");

  const email = `unsub-smoke+${MODULE_ID}-${Date.now()}@aevion.app`;

  await step(`POST /api/${MODULE_ID}/waitlist creates new signup`, async () => {
    const r = await fetch(`${BASE}/api/${MODULE_ID}/waitlist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    assert(r.status === 201, `expected 201, got ${r.status}`);
    const d = await r.json();
    assert(d.ok === true, "ok must be true");
    assert(d.alreadyJoined === false, "first signup, alreadyJoined should be false");
  });

  await step(`GET /api/${MODULE_ID}/unsubscribe with no token rejects 400`, async () => {
    const r = await fetch(`${BASE}/api/${MODULE_ID}/unsubscribe`);
    assert(r.status === 400, `expected 400, got ${r.status}`);
  });

  await step(`GET /api/${MODULE_ID}/unsubscribe with garbage token rejects 400`, async () => {
    const r = await fetch(`${BASE}/api/${MODULE_ID}/unsubscribe?token=not.a.real.token`);
    assert(r.status === 400, `expected 400, got ${r.status}`);
  });

  await step(`GET /api/${MODULE_ID}/unsubscribe with tampered HMAC rejects 400`, async () => {
    // Plausible-looking but wrong signature
    const fakeToken = `${Buffer.from(MODULE_ID).toString("base64url")}.${Buffer.from("deadbeef").toString("base64url")}.AAAAAAAA`;
    const r = await fetch(`${BASE}/api/${MODULE_ID}/unsubscribe?token=${encodeURIComponent(fakeToken)}`);
    assert(r.status === 400, `expected 400, got ${r.status}`);
  });

  await step(`Re-POST same email returns 200 + alreadyJoined`, async () => {
    const r = await fetch(`${BASE}/api/${MODULE_ID}/waitlist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    assert(r.status === 200, `expected 200 for duplicate, got ${r.status}`);
    const d = await r.json();
    assert(d.alreadyJoined === true, "duplicate must be alreadyJoined=true");
  });

  console.log("");
  console.log(`[waitlist-unsub-smoke] PASS=${pass} FAIL=${fail}`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => {
  console.error("[waitlist-unsub-smoke] FATAL:", e?.stack || e);
  process.exit(2);
});
