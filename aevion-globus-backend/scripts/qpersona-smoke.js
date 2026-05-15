#!/usr/bin/env node
/**
 * QPersona smoke test — persona CRUD + stats.
 * Usage: BASE=http://localhost:4001 node scripts/qpersona-smoke.js
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
  console.log(`\nQPersona smoke → ${BASE}\n`);

  const h = await req("GET", "/api/qpersona/health");
  assert("health → 200", h.status === 200, String(h.status));
  assert("ok true", h.body?.ok === true);

  const alias = `smoke-${Date.now()}-x`.slice(0, 30);
  const create = await req("POST", "/api/qpersona/personas", {
    alias, displayName: "Smoke Test User",
    bio: "Automated smoke test persona", skills: ["testing","automation"],
    links: [], avatarPrompt: "blue tech robot",
  });
  assert("POST /personas → 200/201", [200,201].includes(create.status), String(create.status));
  assert("persona.alias", create.body?.persona?.alias === alias);

  const get = await req("GET", `/api/qpersona/personas/${alias}`);
  assert("GET /personas/:alias → 200", get.status === 200);
  assert("displayName matches", get.body?.persona?.display_name === "Smoke Test User");

  const list = await req("GET", "/api/qpersona/personas?limit=5");
  assert("GET /personas → 200", list.status === 200);
  assert("list is array", Array.isArray(list.body?.personas));

  const patch = await req("PATCH", `/api/qpersona/personas/${alias}`, { bio: "Updated bio" });
  assert("PATCH /personas/:alias → 200", patch.status === 200);

  const stats = await req("GET", "/api/qpersona/stats");
  assert("GET /stats → 200", stats.status === 200);
  assert("stats.total >= 1", (stats.body?.total ?? 0) >= 1);

  console.log(`\nQPersona: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}
run().catch(e => { console.error(e); process.exit(1); });
