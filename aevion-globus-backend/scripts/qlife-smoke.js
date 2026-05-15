#!/usr/bin/env node
/**
 * QLife smoke test — biomarkers / trends / AI plan.
 * Usage: BASE=http://localhost:4001 node scripts/qlife-smoke.js
 */
const BASE = (process.env.BASE || "http://127.0.0.1:4001").replace(/\/$/, "");
let passed = 0, failed = 0;
function assert(label, cond, info = "") {
  if (cond) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ ${label}${info ? " — " + info : ""}`); failed++; }
}
async function req(method, path, body) {
  const opts = { method, headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(12000) };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${BASE}${path}`, opts);
  const text = await r.text();
  try { return { status: r.status, body: JSON.parse(text) }; } catch { return { status: r.status, body: text }; }
}
async function run() {
  console.log(`\nQLife smoke → ${BASE}\n`);

  const h = await req("GET", "/api/qlife/health");
  assert("health → 200", h.status === 200, String(h.status));
  assert("ok true", h.body?.ok === true);

  const userId = `smoke-${Date.now()}`;
  const log = await req("POST", "/api/qlife/biomarkers", {
    userId, type: "weight_kg", value: 75, unit: "kg", notes: "Smoke test",
  });
  assert("POST /biomarkers → 200/201", [200,201].includes(log.status));

  const list = await req("GET", `/api/qlife/biomarkers?type=weight_kg&userId=${userId}&limit=10`);
  assert("GET /biomarkers → 200", list.status === 200);
  assert("data array", Array.isArray(list.body?.data ?? list.body));

  const trends = await req("GET", `/api/qlife/biomarkers/trends?userId=${userId}`);
  assert("GET /trends → 200", trends.status === 200);

  const stats = await req("GET", "/api/qlife/stats");
  assert("GET /stats → 200", stats.status === 200);

  console.log(`\nQLife: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}
run().catch(e => { console.error(e); process.exit(1); });
