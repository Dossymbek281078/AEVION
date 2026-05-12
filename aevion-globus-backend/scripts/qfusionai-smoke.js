#!/usr/bin/env node
/**
 * QFusionAI smoke — verifies /api/qfusionai/* surface.
 *
 * Tests: health → validation errors → routing with hint → 503 if no provider
 *
 * Note: a real provider call requires ANTHROPIC_API_KEY / OPENAI_API_KEY / etc.
 * on the server. The smoke is provider-agnostic: it verifies the validation +
 * routing layer, and reports either a 200 reply or a graceful 503 when no
 * provider is configured (which is the documented behavior).
 *
 * Usage:
 *   node scripts/qfusionai-smoke.js
 *   BASE=https://aevion-production-a70c.up.railway.app node scripts/qfusionai-smoke.js
 */

const BASE = (process.env.BASE || process.env.BACKEND_URL || "http://localhost:4001").replace(/\/+$/, "");

let passed = 0; let failed = 0;
function ok(l, e) { passed++; console.log(`  ✓ ${l}${e ? "  " + e : ""}`); }
function fail(l, r) { failed++; console.error(`  ✗ ${l}${r ? "  ↳ " + r : ""}`); }

async function req(method, path, body) {
  const h = { "Content-Type": "application/json" };
  const r = await fetch(`${BASE}${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  let json; try { json = await r.json(); } catch { json = {}; }
  return { status: r.status, body: json };
}

async function run() {
  console.log(`\nQFusionAI smoke → ${BASE}\n`);

  // ── Health
  let r = await req("GET", "/api/qfusionai/health");
  if (r.status === 200 && r.body?.module === "qfusionai" && Array.isArray(r.body?.providers)) {
    const configured = r.body.providers.filter((p) => p.configured).length;
    ok("GET /health", `providers=${r.body.providers.length} configured=${configured} routes=${(r.body.routes || []).length}`);
  } else fail("GET /health", `${r.status}`);

  // ── Validation: missing prompt
  r = await req("POST", "/api/qfusionai/route", {});
  if (r.status === 400 && r.body?.error === "prompt-required") ok("POST /route rejects missing prompt");
  else fail("POST /route should reject missing prompt", `${r.status} ${r.body?.error ?? ""}`);

  // ── Validation: empty prompt string
  r = await req("POST", "/api/qfusionai/route", { prompt: "" });
  if (r.status === 400 && r.body?.error === "prompt-required") ok("POST /route rejects empty prompt");
  else fail("POST /route should reject empty prompt", `${r.status}`);

  // ── Validation: oversized prompt
  const huge = "a".repeat(32001);
  r = await req("POST", "/api/qfusionai/route", { prompt: huge });
  if (r.status === 413 && r.body?.error === "prompt-too-long") ok("POST /route rejects prompt > 32000", `maxLength=${r.body?.maxLength}`);
  else fail("POST /route should reject prompt > 32000", `${r.status}`);

  // ── Real (or stub-failing) request
  r = await req("POST", "/api/qfusionai/route", {
    prompt: "Smoke test: classify this short prompt",
    hint: "auto",
  });
  if (r.status === 200 && typeof r.body?.reply === "string" && r.body?.provider) {
    ok("POST /route (auto)", `provider=${r.body.provider} model=${r.body.model} category=${r.body.category} duration=${r.body.durationMs}ms`);
  } else if (r.status === 503 && r.body?.error === "no-provider-configured") {
    ok("POST /route (auto)", "no provider configured — 503 (expected when API keys absent)");
  } else if (r.status === 502 && r.body?.error === "provider-error") {
    ok("POST /route (auto)", "provider returned error — 502 (provider degraded)");
  } else fail("POST /route", `${r.status} ${JSON.stringify(r.body).slice(0, 120)}`);

  // ── Explicit hint that should classify into a specific category
  r = await req("POST", "/api/qfusionai/route", {
    prompt: "function add(a, b) { return a + b; }",
    hint: "code",
  });
  if (r.status === 200 || r.status === 503 || r.status === 502) {
    ok("POST /route (hint=code)", `status=${r.status}`);
  } else fail("POST /route (hint=code)", `${r.status}`);

  console.log(`\n${passed + failed} assertions — ${passed} PASS  ${failed} FAIL\n`);
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error("crash:", e); process.exit(2); });
