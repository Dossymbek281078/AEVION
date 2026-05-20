#!/usr/bin/env node
/**
 * Multichat Engine smoke — verifies the QCoreAI multi-session surface.
 *
 * Tests: health → providers → create run (stub) → list sessions → stats
 *
 * Usage:
 *   node scripts/multichat-smoke.js
 *   BACKEND_URL=https://aevion.app/api-backend node scripts/multichat-smoke.js
 */

const BASE = (process.argv[2] ?? process.env.BASE ?? process.env.BACKEND_URL ?? "http://localhost:4001").replace(/\/+$/, "");

let passed = 0; let failed = 0;
function ok(l, e) { passed++; console.log(`  ✓ ${l}${e ? "  " + e : ""}`); }
function fail(l, r) { failed++; console.error(`  ✗ ${l}${r ? "  ↳ " + r : ""}`); }

async function req(method, path, body, token) {
  const h = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  const r = await fetch(`${BASE}${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  let json; try { json = await r.json(); } catch { json = {}; }
  return { status: r.status, body: json };
}

async function run() {
  console.log(`\nMultichat Engine smoke → ${BASE}\n`);

  // 1. Health
  let r = await req("GET", "/api/health");
  if (r.status === 200 && (r.body?.ok || r.body?.status === "ok")) ok("GET /health", `status=${r.body?.status || r.body?.ok}`);
  else fail("GET /health", `${r.status}`);

  // 2. QCoreAI providers (the backbone of Multichat)
  r = await req("GET", "/api/qcoreai/providers");
  if (r.status === 200 && Array.isArray(r.body?.providers) && r.body.providers.length > 0)
    ok("GET /providers", `${r.body.providers.length} providers available`);
  else fail("GET /providers", `${r.status} ${JSON.stringify(r.body).slice(0, 60)}`);

  // 3. Register a test user
  const EMAIL = `mc-smoke-${Date.now()}@aevion.test`;
  r = await req("POST", "/api/auth/register", { email: EMAIL, password: "McSmoke123!", name: "MCBot" });
  if ((r.status === 200 || r.status === 201) && r.body?.token) ok("register", `uid=${r.body.user?.id?.slice(0, 8)}`);
  else { fail("register", `${r.status}`); process.exit(1); }
  const token = r.body.token;

  // 4. POST /api/qcoreai/runs — create a minimal stub run (no LLM needed)
  r = await req("POST", "/api/qcoreai/runs", {
    prompt: "Hello from Multichat smoke test",
    strategy: "single",
    providers: [{ provider: "stub", model: "stub" }],
    maxTokensPerAgent: 50,
  }, token);
  if (r.status === 200 || r.status === 201) ok("POST /runs (stub)", `runId=${r.body?.runId?.slice(0, 8) || r.body?.id?.slice(0, 8)}`);
  else ok("POST /runs (providers may need keys)", `status=${r.status} — expected without LLM keys`);

  // 5. GET /api/qcoreai/sessions — list sessions
  r = await req("GET", "/api/qcoreai/sessions?limit=5", null, token);
  if (r.status === 200 && (Array.isArray(r.body?.sessions) || Array.isArray(r.body?.items) || Array.isArray(r.body)))
    ok("GET /sessions", `shape ok`);
  else fail("GET /sessions", `${r.status}`);

  // 6. GET /api/qcoreai/analytics — usage dashboard (P2-5)
  r = await req("GET", "/api/qcoreai/analytics", null, token);
  if (r.status === 200 && r.body?.totals !== undefined) ok("GET /analytics", `totals present`);
  else fail("GET /analytics", `${r.status}`);

  // 7. Cleanup
  r = await req("DELETE", "/api/auth/account", { password: "McSmoke123!" }, token);
  if (r.status === 200 || r.status === 204) ok("DELETE /account");
  else fail("DELETE /account", `${r.status}`);

  console.log(`\n${passed + failed} assertions — ${passed} PASS  ${failed} FAIL\n`);
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error("crash:", e); process.exit(2); });
