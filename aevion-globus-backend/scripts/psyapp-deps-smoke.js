#!/usr/bin/env node
/**
 * PsyApp-Deps smoke test — addiction recovery.
 * Usage: BASE=http://localhost:4001 node scripts/psyapp-deps-smoke.js
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
  try { return { status: r.status, body: JSON.parse(text) }; } catch { return { status: r.status, body: text }; }
}
async function run() {
  console.log(`\nPsyApp-Deps smoke → ${BASE}\n`);
  const alias = `smoke-${Date.now()}`;

  const h = await req("GET", "/api/psyapp-deps/health");
  assert("health → 200", h.status === 200, String(h.status));
  assert("ok true", h.body?.ok === true);

  const start = await req("POST", `/api/psyapp-deps/users/${alias}/start`, { addiction: "smoking" });
  assert("POST /users/:alias/start → 200/201", [200,201].includes(start.status));

  const user = await req("GET", `/api/psyapp-deps/users/${alias}`);
  assert("GET /users/:alias → 200", user.status === 200);
  assert("addiction matches", (user.body?.data?.addiction ?? user.body?.addiction) === "smoking");

  const trigger = await req("POST", "/api/psyapp-deps/triggers", {
    alias, trigger_type: "craving", intensity: 7, note: "Smoke test", copedHow: "deep breathing",
  });
  assert("POST /triggers → 200/201", [200,201].includes(trigger.status), String(trigger.status));

  const triggers = await req("GET", `/api/psyapp-deps/triggers/${alias}`);
  assert("GET /triggers/:alias → 200", triggers.status === 200);
  assert("triggers is array", Array.isArray(triggers.body?.data ?? triggers.body));

  const affirm = await req("GET", "/api/psyapp-deps/affirmations");
  assert("GET /affirmations → 200", affirm.status === 200);
  const aList = affirm.body?.data ?? affirm.body;
  assert("≥ 5 affirmations", Array.isArray(aList) && aList.length >= 5);

  const stats = await req("GET", "/api/psyapp-deps/stats");
  assert("GET /stats → 200", stats.status === 200);

  console.log(`\nPsyApp-Deps: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}
run().catch(e => { console.error(e); process.exit(1); });
