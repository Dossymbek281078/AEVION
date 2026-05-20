#!/usr/bin/env node
/**
 * Startup Exchange smoke test.
 * Usage: BASE=http://localhost:4001 node scripts/startupx-smoke.js
 *        BASE=https://aevion-production-a70c.up.railway.app node scripts/startupx-smoke.js
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
  console.log(`\nStartup Exchange smoke → ${BASE}\n`);

  console.log("1. Health");
  const h = await req("GET", "/api/startupx/health");
  assert("GET /health → 200", h.status === 200, String(h.status));
  assert("ok === true", h.body?.ok === true);

  console.log("\n2. Submit idea");
  const tag = `smoke-${Date.now()}`;
  const sub = await req("POST", "/api/startupx/ideas", {
    title: `Smoke Idea ${tag}`,
    description: "Automated smoke test idea — ignore",
    stage: "mvp",
    founderEmail: "smoke@test.local",
    contactMethod: "@smoke_bot",
  });
  assert("POST /ideas → 200 or 201", [200, 201].includes(sub.status), String(sub.status));
  const idea = sub.body?.data;
  assert("response has idea.id", !!idea?.id, JSON.stringify(sub.body).slice(0, 200));
  assert("contentHash present", typeof idea?.contentHash === "string" && idea.contentHash.length > 0);
  assert("qrightProtected present", typeof idea?.qrightProtected === "boolean");

  const ideaId = idea?.id;

  console.log("\n3. List ideas");
  const list = await req("GET", "/api/startupx/ideas?limit=5");
  assert("GET /ideas → 200", list.status === 200, String(list.status));
  assert("response has data array", Array.isArray(list.body?.data?.ideas));

  console.log("\n4. Single idea");
  if (ideaId) {
    const single = await req("GET", `/api/startupx/ideas/${ideaId}`);
    assert("GET /ideas/:id → 200", single.status === 200, String(single.status));
    assert("idea.id matches", single.body?.data?.id === ideaId);
    assert("interest_count present", typeof single.body?.data?.interest_count === "number");
  } else {
    console.log("  (skipped — no ideaId)");
  }

  console.log("\n5. Express interest");
  if (ideaId) {
    const interest = await req("POST", `/api/startupx/ideas/${ideaId}/interest`, {
      investorEmail: "investor@smoke.local",
      message: "Smoke test interest",
    });
    assert("POST /ideas/:id/interest → 200 or 201", [200, 201].includes(interest.status), String(interest.status));
    assert("interest recorded", interest.body?.success === true);
  }

  console.log("\n6. Stats");
  const stats = await req("GET", "/api/startupx/stats");
  assert("GET /stats → 200", stats.status === 200, String(stats.status));
  assert("stats.total >= 0", typeof stats.body?.data?.total === "number");
  assert("stats.byStage present", typeof stats.body?.data?.byStage === "object");

  console.log(`\nStartup Exchange: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });
