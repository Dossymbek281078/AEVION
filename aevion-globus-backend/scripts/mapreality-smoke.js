#!/usr/bin/env node
/**
 * MapReality smoke test.
 * Usage: BASE=http://localhost:4001 node scripts/mapreality-smoke.js
 */
const BASE = (process.env.BASE || "http://127.0.0.1:4001").replace(/\/$/, "");
let passed = 0, failed = 0;

function assert(label, cond, info = "") {
  if (cond) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ ${label}${info ? " — " + info : ""}`); failed++; }
}

async function req(method, path, body) {
  const opts = { method, headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(8000) };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${BASE}${path}`, opts);
  const text = await r.text();
  try { return { status: r.status, body: JSON.parse(text) }; }
  catch { return { status: r.status, body: text }; }
}

async function run() {
  console.log(`\nMapReality smoke → ${BASE}\n`);

  console.log("1. Health");
  const h = await req("GET", "/api/mapreality/health");
  assert("GET /health → 200", h.status === 200, String(h.status));
  assert("ok === true", h.body?.ok === true);
  assert("totalSignals >= 0", typeof h.body?.totalSignals === "number");

  console.log("\n2. Submit signal");
  const alias = `smoke-${Date.now()}`;
  const sub = await req("POST", "/api/mapreality/signals", {
    title: "Smoke signal — нужен детский сад",
    description: "Автоматический smoke test — сигнал можно удалить",
    category: "need",
    country: "KZ",
    city: "Almaty",
    authorAlias: alias,
  });
  assert("POST /signals → 200 or 201", [200, 201].includes(sub.status), String(sub.status));
  const signal = sub.body?.data;
  assert("response has signal.id", !!signal?.id, JSON.stringify(sub.body).slice(0, 200));
  assert("supportCount === 0", signal?.supportCount === 0 || signal?.support_count === 0);

  const signalId = signal?.id;

  console.log("\n3. List signals");
  const list = await req("GET", "/api/mapreality/signals?limit=10");
  assert("GET /signals → 200", list.status === 200, String(list.status));
  assert("data is array", Array.isArray(list.body?.data));

  console.log("\n4. Single signal");
  if (signalId) {
    const single = await req("GET", `/api/mapreality/signals/${signalId}`);
    assert("GET /signals/:id → 200", single.status === 200, String(single.status));
    assert("signal.id matches", single.body?.data?.id === signalId);
  }

  console.log("\n5. Support signal");
  if (signalId) {
    const supporter = `voter-${Date.now()}`;
    const s1 = await req("POST", `/api/mapreality/signals/${signalId}/support`, { supporterAlias: supporter });
    assert("POST /support → 200 or 201", [200, 201].includes(s1.status), String(s1.status));
    assert("supportCount incremented", (s1.body?.data?.supportCount ?? 0) >= 1);

    const s2 = await req("POST", `/api/mapreality/signals/${signalId}/support`, { supporterAlias: supporter });
    assert("duplicate support → 409", s2.status === 409, String(s2.status));
  }

  console.log("\n6. Filter by category");
  const needs = await req("GET", "/api/mapreality/signals?category=need&limit=5");
  assert("GET /signals?category=need → 200", needs.status === 200, String(needs.status));
  const items = needs.body?.data ?? [];
  assert("all filtered items are needs", items.every(s => s.category === "need"));

  console.log("\n7. Stats");
  const stats = await req("GET", "/api/mapreality/stats");
  assert("GET /stats → 200", stats.status === 200, String(stats.status));
  assert("stats.total >= 1", (stats.body?.data?.total ?? 0) >= 1);
  assert("byCategory present", typeof stats.body?.data?.byCategory === "object");
  assert("topSignals is array", Array.isArray(stats.body?.data?.topSignals));

  console.log(`\nMapReality: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });
