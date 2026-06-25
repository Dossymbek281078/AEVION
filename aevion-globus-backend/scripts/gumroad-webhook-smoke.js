#!/usr/bin/env node
/**
 * gumroad-webhook-smoke — exercise POST /api/gumroad/webhook end-to-end.
 *
 * Gumroad pings are application/x-www-form-urlencoded. This smoke doubles as
 * a regression guard for the body-parser fix: without express.urlencoded the
 * raw form body is dropped and every ping is silently ignored as no_email, so
 * the "paid → activated" assertion below would fail.
 *
 * Assertions:
 *   - paid ping (email + sale_id)          → 200 action=activated, tierId
 *   - refunded ping                        → 200 action=downgraded
 *   - ping without email                   → 200 ignored=no_email
 *   - replay paid ping (same sale_id)      → 200 deduped
 *
 * Signature: if GUMROAD_WEBHOOK_SECRET is set (and matches the backend's),
 * each ping is signed via x-gumroad-signature = HMAC-SHA256(rawBody). When
 * unset, pings are sent unsigned (works against a backend with no secret).
 *
 * Usage (backend must run with the same secret if it has one):
 *   node scripts/gumroad-webhook-smoke.js
 *   BASE=https://aevion.app/api-backend GUMROAD_WEBHOOK_SECRET=... node scripts/gumroad-webhook-smoke.js
 *
 * Mutates state (appends to subscriptions.jsonl) — readOnly:false.
 */

"use strict";

const crypto = require("crypto");

const BASE = (process.env.BASE || "http://127.0.0.1:4001").replace(/\/+$/, "");
const SECRET = process.env.GUMROAD_WEBHOOK_SECRET || "";
const PATH = "/api/gumroad/webhook";
const EMAIL = `gumroad-smoke-${Date.now()}@test.aevion.dev`;
const SALE = `sale_${Date.now()}`;

let pass = 0;
let fail = 0;
const failures = [];
const ok = (l) => { pass++; console.log(`  ✓ ${l}`); };
const ko = (l, d) => { fail++; failures.push({ l, d }); console.error(`  ✗ ${l}${d ? " — " + d : ""}`); };

// Send a form-encoded ping. fields: object → urlencoded body.
async function ping(fields) {
  const raw = new URLSearchParams(fields).toString();
  const headers = { "Content-Type": "application/x-www-form-urlencoded" };
  if (SECRET) headers["x-gumroad-signature"] = crypto.createHmac("sha256", SECRET).update(raw).digest("hex");
  const res = await fetch(`${BASE}${PATH}`, { method: "POST", headers, body: raw });
  let json;
  try { json = await res.json(); } catch { json = {}; }
  return { status: res.status, json };
}

(async () => {
  console.log(`\nGumroad webhook smoke → ${BASE}${PATH}\n`);

  // ── GET liveness probe (browser-friendly) ───────────────────────────────────
  {
    const r = await fetch(`${BASE}${PATH}`);
    let json; try { json = await r.json(); } catch { json = {}; }
    (r.status === 200 && json.endpoint === "gumroad webhook")
      ? ok("GET liveness → 200 JSON manifest")
      : ko("GET liveness → 200", `${r.status} ${JSON.stringify(json)}`);
  }

  // ── paid → activated ────────────────────────────────────────────────────────
  const paid = await ping({ sale_id: SALE, email: EMAIL, product_id: "TESTPROD", sale_timestamp: new Date().toISOString() });
  if (paid.status === 200 && paid.json.action === "activated" && paid.json.tierId) {
    ok(`paid ping → 200 activated (tierId=${paid.json.tierId})`);
  } else if (paid.status === 200 && paid.json.ignored === "no_email") {
    ko("paid ping → activated", "got ignored=no_email — form body not parsed (express.urlencoded missing?)");
  } else {
    ko("paid ping → activated", `${paid.status} ${JSON.stringify(paid.json)}`);
  }

  // ── refunded → downgraded ─────────────────────────────────────────────────────
  const refunded = await ping({ sale_id: `${SALE}_r`, email: EMAIL, product_id: "TESTPROD", refunded: "true" });
  (refunded.status === 200 && refunded.json.action === "downgraded")
    ? ok("refunded ping → 200 downgraded")
    : ko("refunded ping → downgraded", `${refunded.status} ${JSON.stringify(refunded.json)}`);

  // ── no email → ignored ────────────────────────────────────────────────────────
  const noEmail = await ping({ sale_id: `${SALE}_n`, product_id: "TESTPROD" });
  (noEmail.status === 200 && noEmail.json.ignored === "no_email")
    ? ok("ping w/o email → 200 ignored=no_email")
    : ko("ping w/o email → ignored", `${noEmail.status} ${JSON.stringify(noEmail.json)}`);

  // ── dedup: replay paid ping (same sale_id + status) ──────────────────────────
  const replay = await ping({ sale_id: SALE, email: EMAIL, product_id: "TESTPROD", sale_timestamp: new Date().toISOString() });
  (replay.status === 200 && replay.json.deduped === true)
    ? ok("replayed paid ping → 200 deduped")
    : ko("replayed paid ping → deduped", `${replay.status} ${JSON.stringify(replay.json)}`);

  // ── bad signature → 401 (only meaningful when backend enforces a secret) ─────
  if (SECRET) {
    const raw = new URLSearchParams({ sale_id: `${SALE}_bad`, email: EMAIL, product_id: "TESTPROD" }).toString();
    const res = await fetch(`${BASE}${PATH}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "x-gumroad-signature": "deadbeefbadsignature" },
      body: raw,
    });
    let json; try { json = await res.json(); } catch { json = {}; }
    (res.status === 401 && json.error === "invalid_signature")
      ? ok("bad signature → 401 invalid_signature (not silently ignored)")
      : ko("bad signature → 401", `${res.status} ${JSON.stringify(json)}`);
  } else {
    console.log("  [skip] bad-signature leg — GUMROAD_WEBHOOK_SECRET not in env");
  }

  console.log(`\n[gumroad-webhook-smoke] ${pass} passed, ${fail} failed`);
  if (fail > 0) {
    console.error("\nFailures:");
    for (const f of failures) console.error(`  - ${f.l}${f.d ? "  " + f.d : ""}`);
    process.exit(1);
  }
  process.exit(0);
})().catch((e) => {
  console.error("[gumroad-webhook-smoke] crashed:", e.message);
  process.exit(2);
});
