#!/usr/bin/env node
/**
 * QFusionAI smoke test — providers/route/stats.
 * Usage: BASE=http://localhost:4001 node scripts/qfusionai-smoke.js
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
  console.log(`\nQFusionAI smoke → ${BASE}\n`);

  const h = await req("GET", "/api/qfusionai/health");
  assert("health → 200", h.status === 200, String(h.status));
  assert("ok true", h.body?.ok === true);

  const providers = await req("GET", "/api/qfusionai/providers");
  assert("GET /providers → 200", providers.status === 200);
  const pList = providers.body?.data ?? providers.body?.providers ?? providers.body;
  assert("providers is array", Array.isArray(pList));
  assert("at least 1 provider", (pList?.length ?? 0) >= 1);

  const route = await req("POST", "/api/qfusionai/route", {
    prompt: "Say hello in one word",
    strategy: "speed",
  });
  assert("POST /route → 200", route.status === 200, String(route.status));
  const data = route.body?.data ?? route.body;
  assert("result present", typeof data?.result === "string" && data.result.length > 0);
  assert("provider present", typeof data?.provider === "string");
  assert("strategy present", typeof data?.strategy === "string");
  assert("latencyMs present", typeof data?.latencyMs === "number");

  const routeAuto = await req("POST", "/api/qfusionai/route", { prompt: "Hello", strategy: "auto" });
  assert("POST /route auto → 200", routeAuto.status === 200);

  const stats = await req("GET", "/api/qfusionai/stats");
  assert("GET /stats → 200", stats.status === 200);
  const s = stats.body?.data ?? stats.body;
  assert("stats.total >= 0", typeof s?.total === "number");

  console.log(`\nQFusionAI: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}
run().catch(e => { console.error(e); process.exit(1); });
