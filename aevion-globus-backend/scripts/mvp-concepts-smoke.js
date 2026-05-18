#!/usr/bin/env node
/**
 * MVP concept routers smoke — exercises the 10 ownerless-module concept
 * surfaces shipped in 122c9d1d (`routes/mvpConcepts.ts`).
 *
 * For each module:
 *   1. GET /<noun>                  — list endpoint shape
 *   2. POST /<noun>                 — create item, expect 201 + id
 *   3. GET /<noun>/:itemId          — fetch the just-created item
 *   4. GET /concept-stats           — stats shape + total ≥ 1
 *   5. POST /<noun> missing field   — expect 400 with missing_field
 *
 * Mutates: writes one item per module via the public POST endpoint
 * (rate-limited but not auth-gated). Safe for CI ephemeral envs and
 * tolerable on staging. NOT for prod unless you accept 10 test items.
 *
 * Usage:
 *   node scripts/mvp-concepts-smoke.js
 *   BASE=http://localhost:4001 node scripts/mvp-concepts-smoke.js
 */

const BASE = (process.env.BASE || process.env.BACKEND_URL || "http://localhost:4001").replace(/\/+$/, "");

// Must mirror CONCEPTS in src/routes/mvpConcepts.ts (id, noun, required fields).
const MODULES = [
  { id: "startup-exchange", noun: "listings",   create: { company: "TestCo", stage: "seed",  pitch: "smoke" } },
  { id: "mapreality",       noun: "claims",     create: { claim: "smoke",  lat: 51.16, lng: 71.45, evidence: "test" } },
  { id: "kids-ai-content",  noun: "items",      create: { topic: "Smoke",  ageRange: "6-8", summary: "test" } },
  { id: "qlife",            noun: "prompts",    create: { prompt: "Smoke prompt", rationale: "test" } },
  { id: "psyapp-deps",      noun: "assessments",create: { title: "Smoke",  category: "test" } },
  { id: "qpersona",         noun: "personas",   create: { alias: `sm${Date.now()}`, displayName: "Smoke Bot", traits: ["test"], blueprint: "x" } },
  { id: "voice-of-earth",   noun: "feeds",      create: { location: "Test", metric: "pm2.5", observation: "x" } },
  { id: "deepsan",          noun: "runs",       create: { facility: "TestF", method: "uv",   } },
  { id: "shadownet",        noun: "posts",      create: { alias: `smoke${Date.now()}`, title: "Smoke", body: "Anon test body", ciphertext: "c2lnbmVkLXNtb2tlLXRlc3Q=", iv: "smoke-iv-aevion", salt: "smoke-salt-aevion" } },
  { id: "lifebox",          noun: "capsules",   create: { alias: `lb${Date.now()}`, title: "Smoke capsule", content: "Test capsule content", category: "knowledge", unlock_at: "2099-01-01T00:00:00Z", year: 2026, occasion: "test" } },
];

let passed = 0; let failed = 0;
function ok(l, e) { passed++; console.log(`  ✓ ${l}${e ? "  " + e : ""}`); }
function fail(l, r) { failed++; console.error(`  ✗ ${l}${r ? "  ↳ " + r : ""}`); }

async function req(method, path, body) {
  const h = { "Content-Type": "application/json" };
  const r = await fetch(`${BASE}${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  let json; try { json = await r.json(); } catch { json = {}; }
  return { status: r.status, body: json };
}

async function exercise(m) {
  console.log(`\n[${m.id}]`);

  // 1. list
  let r = await req("GET", `/api/${m.id}/${m.noun}?limit=3`);
  const listArr = r.body?.items ?? r.body?.[m.noun] ?? r.body;
  if (r.status === 200 && Array.isArray(listArr)) ok(`GET /api/${m.id}/${m.noun}`, `total=${r.body?.total ?? listArr.length}`);
  else { fail(`list /${m.noun}`, `${r.status}`); return; }

  // 2. create
  r = await req("POST", `/api/${m.id}/${m.noun}`, m.create);
  if (r.status === 201 && r.body?.id) ok(`POST /api/${m.id}/${m.noun}`, `id=${r.body.id.slice(0, 8)}…`);
  else { fail(`create /${m.noun}`, `${r.status} ${JSON.stringify(r.body).slice(0, 80)}`); return; }
  const itemId = r.body.id;

  // 3. fetch the created item
  r = await req("GET", `/api/${m.id}/${m.noun}/${itemId}`);
  if (r.status === 200 && r.body?.id === itemId) ok(`GET /api/${m.id}/${m.noun}/:id`);
  else fail(`fetch /${m.noun}/:id`, `${r.status}`);

  // 4. stats
  r = await req("GET", `/api/${m.id}/concept-stats`);
  if (r.status === 200 && typeof r.body?.total === "number" && r.body.total >= 1) {
    ok(`GET /api/${m.id}/concept-stats`, `total=${r.body.total} 7d=${r.body.last7days}`);
  } else fail(`stats`, `${r.status}`);

  // 5. missing-field validation
  r = await req("POST", `/api/${m.id}/${m.noun}`, {});
  if (r.status === 400 && r.body?.error === "missing_field") ok(`POST /${m.noun} 400 missing_field`);
  else fail(`missing-field validation`, `${r.status} ${JSON.stringify(r.body).slice(0, 80)}`);
}

async function run() {
  console.log(`\nMVP concepts smoke → ${BASE}\n`);
  // Backend up first
  const h = await req("GET", "/api/health");
  if (h.status !== 200) { console.error(`backend unreachable: ${h.status}`); process.exit(2); }

  for (const m of MODULES) await exercise(m);

  console.log(`\n${passed + failed} assertions across ${MODULES.length} modules — ${passed} PASS  ${failed} FAIL\n`);
  if (failed > 0) process.exit(1);
}

run().catch((e) => { console.error("crash:", e); process.exit(2); });
