#!/usr/bin/env node
/**
 * ls-webhook-smoke — exercise POST /api/lemonsqueezy/webhook end-to-end.
 *
 * The route has two runtime modes:
 *   - STUB  (LEMON_SQUEEZY_WEBHOOK_SECRET unset on the backend): every hit
 *     returns 200 { mode: "stub" }. Smoke detects this and reports a 1-check
 *     skip (route mounted) — full assertions need the secret.
 *   - REAL  (secret set): x-signature HMAC enforced, subscription_* events
 *     mapped to plan provisioning.
 *
 * Detection: send a deliberately-bad signature first.
 *   200 + mode:"stub" → stub mode (skip rest)
 *   401               → real mode (run full set)
 *
 * Full-mode assertions (need LEMON_SQUEEZY_WEBHOOK_SECRET in the SMOKE env,
 * matching the backend's secret):
 *   - bad signature                          → 401
 *   - subscription_created (valid sig)       → 200 action=activated tierId=pro
 *   - subscription_cancelled (valid sig)     → 200 action=downgraded
 *   - order_created (valid sig)              → 200 ignored (not subscription_*)
 *   - subscription_created w/o user_email    → 400
 *   - replay same created payload            → 200 deduped
 *
 * Usage (backend must run with the same secret):
 *   LEMON_SQUEEZY_WEBHOOK_SECRET=test-secret node scripts/ls-webhook-smoke.js
 *   BASE=https://aevion.app/api-backend node scripts/ls-webhook-smoke.js
 *
 * Mutates state in real mode (appends to subscriptions.jsonl) — readOnly:false.
 */

"use strict";

const crypto = require("crypto");

const BASE = (process.env.BASE || "http://127.0.0.1:4001").replace(/\/+$/, "");
const SECRET = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET || "";
const PATH = "/api/lemonsqueezy/webhook";
const EMAIL = `ls-smoke-${Date.now()}@test.aevion.dev`;

let pass = 0;
let fail = 0;
const failures = [];

function ok(label) {
  pass++;
  console.log(`  ✓ ${label}`);
}
function ko(label, detail) {
  fail++;
  failures.push({ label, detail });
  console.error(`  ✗ ${label}${detail ? " — " + detail : ""}`);
}

function sign(rawBody) {
  return crypto.createHmac("sha256", SECRET).update(rawBody, "utf8").digest("hex");
}

// Send a payload. signature: "valid" → HMAC, "bad" → garbage, null → none.
async function post(payloadObj, signature = "valid") {
  const raw = JSON.stringify(payloadObj);
  const headers = { "Content-Type": "application/json" };
  if (signature === "valid") headers["x-signature"] = sign(raw);
  else if (signature === "bad") headers["x-signature"] = "deadbeef".repeat(8);
  // signature === null → omit header
  const res = await fetch(`${BASE}${PATH}`, { method: "POST", headers, body: raw });
  let json;
  try {
    json = await res.json();
  } catch {
    json = {};
  }
  return { status: res.status, json };
}

function subPayload(event, { email = EMAIL, id = `sub_${Math.random().toString(36).slice(2, 10)}`, variantId = 999999, renewsAt = "2026-06-25T00:00:00.000Z" } = {}) {
  return {
    meta: { event_name: event, custom_data: { email } },
    data: {
      id,
      attributes: {
        user_email: email,
        variant_id: variantId,
        status: event === "subscription_created" ? "active" : "cancelled",
        renews_at: renewsAt,
        ends_at: null,
      },
    },
  };
}

(async () => {
  console.log(`\nLemon Squeezy webhook smoke → ${BASE}${PATH}\n`);

  // ── Mode probe: bad signature ──────────────────────────────────────────────
  const probe = await post(subPayload("subscription_created"), "bad");

  if (probe.status === 200 && probe.json && probe.json.mode === "stub") {
    ok("route mounted (STUB mode — LEMON_SQUEEZY_WEBHOOK_SECRET unset on backend)");
    console.log("\n  [skip] Set LEMON_SQUEEZY_WEBHOOK_SECRET on the backend (and in this");
    console.log("         smoke's env) to run the full signature + provisioning assertions.");
    console.log(`\n[ls-webhook-smoke] ${pass} passed, ${fail} failed\n`);
    process.exit(fail > 0 ? 1 : 0);
  }

  if (probe.status === 401) {
    ok("bad signature → 401");
  } else {
    ko("bad signature → 401", `got ${probe.status} ${JSON.stringify(probe.json)}`);
  }

  // Real mode confirmed. Without the matching secret we can't forge a valid
  // signature, so skip the valid-sig legs gracefully.
  if (!SECRET) {
    console.log("\n  [skip] Backend is in REAL mode but LEMON_SQUEEZY_WEBHOOK_SECRET is not");
    console.log("         set in THIS smoke's env — valid-signature legs skipped.");
    console.log(`\n[ls-webhook-smoke] ${pass} passed, ${fail} failed\n`);
    process.exit(fail > 0 ? 1 : 0);
  }

  // ── Activate ────────────────────────────────────────────────────────────────
  const created = await post(subPayload("subscription_created"));
  if (created.status === 200 && created.json.action === "activated" && created.json.tierId === "pro") {
    ok("subscription_created → 200 activated (tierId=pro)");
  } else {
    ko("subscription_created → 200 activated", `got ${created.status} ${JSON.stringify(created.json)}`);
  }

  // ── Deactivate ────────────────────────────────────────────────────────────────
  const cancelled = await post(subPayload("subscription_cancelled"));
  if (cancelled.status === 200 && cancelled.json.action === "downgraded") {
    ok("subscription_cancelled → 200 downgraded");
  } else {
    ko("subscription_cancelled → 200 downgraded", `got ${cancelled.status} ${JSON.stringify(cancelled.json)}`);
  }

  // ── Non-subscription event ignored ──────────────────────────────────────────
  const order = await post({ meta: { event_name: "order_created" }, data: { id: "o1", attributes: { user_email: EMAIL } } });
  if (order.status === 200 && order.json.ignored) {
    ok("order_created → 200 ignored (not subscription_*)");
  } else {
    ko("order_created → 200 ignored", `got ${order.status} ${JSON.stringify(order.json)}`);
  }

  // ── Missing user_email → 400 ────────────────────────────────────────────────
  const noEmail = {
    meta: { event_name: "subscription_created" },
    data: { id: "noemail1", attributes: { variant_id: 999999, status: "active" } },
  };
  const missing = await post(noEmail);
  if (missing.status === 400) {
    ok("subscription_created w/o user_email → 400");
  } else {
    ko("subscription_created w/o user_email → 400", `got ${missing.status} ${JSON.stringify(missing.json)}`);
  }

  // ── Dedup: replay an identical created payload twice ─────────────────────────
  const dedupPayload = subPayload("subscription_created", { id: "dedup-fixed-id", renewsAt: "2026-07-01T00:00:00.000Z" });
  const first = await post(dedupPayload);
  const replay = await post(dedupPayload);
  if (first.status === 200 && replay.status === 200 && replay.json.deduped === true) {
    ok("replayed identical payload → 200 deduped");
  } else {
    ko("replayed identical payload → 200 deduped", `first=${first.status} replay=${replay.status} ${JSON.stringify(replay.json)}`);
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log(`\n[ls-webhook-smoke] ${pass} passed, ${fail} failed`);
  if (fail > 0) {
    console.error("\nFailures:");
    for (const f of failures) console.error(`  - ${f.label}${f.detail ? "  " + f.detail : ""}`);
    process.exit(1);
  }
  process.exit(0);
})().catch((e) => {
  console.error("[ls-webhook-smoke] crashed:", e.message);
  process.exit(2);
});
