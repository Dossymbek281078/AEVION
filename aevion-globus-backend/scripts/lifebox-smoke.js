#!/usr/bin/env node
/**
 * LifeBox smoke test — time-locked capsules.
 * Usage: BASE=http://localhost:4001 node scripts/lifebox-smoke.js
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
  console.log(`\nLifeBox smoke → ${BASE}\n`);

  const h = await req("GET", "/api/lifebox/health");
  assert("health → 200", h.status === 200, String(h.status));
  assert("ok true", h.body?.ok === true);

  const cats = await req("GET", "/api/lifebox/categories");
  assert("GET /categories → 200", cats.status === 200);
  const cList = cats.body?.data ?? cats.body;
  assert("≥ 5 categories", Array.isArray(cList) && cList.length >= 5);

  const alias = `smoke-${Date.now()}`;
  const futureDate = new Date(Date.now() + 86400000 * 30).toISOString();
  const cap = await req("POST", "/api/lifebox/capsules", {
    alias, title: `Smoke capsule ${alias}`, content: "Secret content for the future",
    category: "future_self", unlock_at: futureDate,
  });
  assert("POST /capsules → 200/201", [200,201].includes(cap.status), String(cap.status));
  const capsule = cap.body?.data ?? cap.body;
  assert("capsule.id present", !!capsule?.id);
  assert("content hidden when locked", !capsule?.content || capsule?.locked === true);

  const myCaps = await req("GET", `/api/lifebox/capsules/${alias}`);
  assert("GET /capsules/:alias → 200", myCaps.status === 200);

  if (capsule?.id) {
    const unlock = await req("GET", `/api/lifebox/capsules/${capsule.id}/unlock?alias=${alias}`);
    assert("locked → 403", unlock.status === 403, String(unlock.status));
  }

  const stats = await req("GET", "/api/lifebox/stats");
  assert("GET /stats → 200", stats.status === 200);

  console.log(`\nLifeBox: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}
run().catch(e => { console.error(e); process.exit(1); });
