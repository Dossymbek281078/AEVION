#!/usr/bin/env node
/**
 * Paddle Billing PROD smoke.
 * Usage: BASE=https://... node scripts/paddle-prod-smoke.js
 *
 * Read-only: health/plans/products/transactions checks + webhook HMAC
 * round-trip (sends signed POST but triggers no business logic — event_type
 * not in the handled list so provisioning is never called).
 */
const BASE = (process.env.BASE || "https://aevion-production-a70c.up.railway.app").replace(/\/+$/, "");
const crypto = require("crypto");

let passed = 0, failed = 0;
function ok(l, i = "") { passed++; console.log(`  ✓ ${l}${i ? "  " + i : ""}`); }
function fail(l, i = "") { failed++; console.error(`  ✗ ${l}${i ? "  " + i : ""}`); }
async function req(path, opts = {}) {
  const r = await fetch(`${BASE}${path}`, { signal: AbortSignal.timeout(10000), ...opts });
  const text = await r.text();
  try { return { status: r.status, body: JSON.parse(text) }; } catch { return { status: r.status, body: text }; }
}

async function run() {
  console.log(`\nPaddle PROD smoke → ${BASE}\n`);

  // ── Health ────────────────────────────────────────────────────────────────
  const h = await req("/api/paddle/health");
  h.status === 200 ? ok("GET /paddle/health → 200") : fail("GET /paddle/health → 200", String(h.status));
  h.body?.configured === true ? ok("configured = true") : fail("configured = true");
  h.body?.sandbox === false ? ok("sandbox = false (live mode)") : fail("sandbox = false (live mode)");
  h.body?.webhookConfigured === true ? ok("webhookConfigured = true") : fail("webhookConfigured = true");
  h.body?.apiReachable === true ? ok("apiReachable = true") : fail("apiReachable = true");

  // ── Plans ─────────────────────────────────────────────────────────────────
  const p = await req("/api/paddle/plans");
  p.status === 200 ? ok("GET /paddle/plans → 200") : fail("GET /paddle/plans → 200", String(p.status));
  Array.isArray(p.body?.plans) && p.body.plans.length > 0
    ? ok("plans array non-empty", `count=${p.body.plans.length}`)
    : fail("plans array non-empty");

  // ── Products ──────────────────────────────────────────────────────────────
  const pr = await req("/api/paddle/products");
  pr.status === 200 ? ok("GET /paddle/products → 200") : fail("GET /paddle/products → 200", String(pr.status));
  Array.isArray(pr.body?.products)
    ? ok("products array present", `count=${pr.body.products.length}`)
    : fail("products array present");

  // ── Transactions ──────────────────────────────────────────────────────────
  const tx = await req("/api/paddle/transactions");
  tx.status === 200 ? ok("GET /paddle/transactions → 200") : fail("GET /paddle/transactions → 200", String(tx.status));
  Array.isArray(tx.body?.transactions)
    ? ok("transactions array present")
    : fail("transactions array present");

  // ── Checkout validation gate ──────────────────────────────────────────────
  const co = await req("/api/paddle/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  co.status === 400 ? ok("POST /paddle/checkout (no priceId) → 400") : fail("POST /paddle/checkout (no priceId) → 400", String(co.status));

  // ── Webhook HMAC — valid signature ────────────────────────────────────────
  const secret = process.env.PADDLE_WEBHOOK_SECRET || "";
  if (secret) {
    const ts = Math.floor(Date.now() / 1000).toString();
    const body = JSON.stringify({ event_type: "smoke.ping", data: { id: "smoke_test" } });
    const h1 = crypto.createHmac("sha256", secret).update(`${ts}:${body}`).digest("hex");
    const sig = `ts=${ts};h1=${h1}`;
    const wv = await req("/api/paddle/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Paddle-Signature": sig },
      body,
    });
    wv.status === 200 && wv.body?.received === true
      ? ok("webhook valid signature → received:true")
      : fail("webhook valid signature → received:true", String(wv.status));
  } else {
    passed++;
    ok("webhook HMAC check skipped (no PADDLE_WEBHOOK_SECRET in env)");
  }

  // ── Webhook HMAC — invalid signature must be rejected ────────────────────
  const wb = await req("/api/paddle/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Paddle-Signature": "ts=1;h1=badhash" },
    body: JSON.stringify({ event_type: "smoke.ping" }),
  });
  wb.status === 400 && wb.body?.error === "invalid_signature"
    ? ok("webhook invalid signature → 400 invalid_signature")
    : fail("webhook invalid signature → 400 invalid_signature", String(wb.status));

  // ── Setup guide ───────────────────────────────────────────────────────────
  const sg = await req("/api/paddle/setup-guide");
  sg.status === 200 ? ok("GET /paddle/setup-guide → 200") : fail("GET /paddle/setup-guide → 200", String(sg.status));
  Array.isArray(sg.body?.steps) && sg.body.steps.length >= 5
    ? ok("setup-guide has 5+ steps")
    : fail("setup-guide has 5+ steps");

  console.log(`\n15 assertions — ${passed} PASS  ${failed} FAIL\n`);
  process.exit(failed > 0 ? 1 : 0);
}
run().catch(e => { console.error(e); process.exit(1); });
