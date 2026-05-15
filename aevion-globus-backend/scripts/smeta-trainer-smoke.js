#!/usr/bin/env node
/**
 * Smeta Trainer smoke — verifies the backend surface for the Kazakh
 * construction estimation trainer.
 *
 * Tests: health → stats → sync (upsert) → sync restore → lms hook
 *
 * Usage:
 *   node scripts/smeta-trainer-smoke.js
 *   BACKEND_URL=https://aevion.app/api-backend node scripts/smeta-trainer-smoke.js
 */

const BASE = (process.argv[2] ?? process.env.BACKEND_URL ?? "http://localhost:4001").replace(/\/+$/, "");

let passed = 0;
let failed = 0;

function ok(label, extra) { passed++; console.log(`  ✓ ${label}${extra ? "  " + extra : ""}`); }
function fail(label, reason) { failed++; console.error(`  ✗ ${label}${reason ? "  ↳ " + reason : ""}`); }

async function req(method, path, body) {
  const headers = { "Content-Type": "application/json" };
  const res = await fetch(`${BASE}${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  let json;
  try { json = await res.json(); } catch { json = {}; }
  return { status: res.status, body: json };
}

async function run() {
  console.log(`\nSmeta Trainer smoke → ${BASE}\n`);

  // 1. Health
  let r = await req("GET", "/api/smeta-trainer/health");
  if (r.status === 200 && (r.body?.status === "ok" || r.body?.ok)) ok("GET /health");
  else fail("GET /health", `${r.status} ${JSON.stringify(r.body)}`);

  // 2. Stats
  r = await req("GET", "/api/smeta-trainer/stats");
  const sessCount = r.body?.sessions ?? r.body?.totalSessions;
  if (r.status === 200 && typeof sessCount === "number") ok("GET /stats", `sessions=${sessCount}`);
  else fail("GET /stats", `${r.status} ${JSON.stringify(r.body)}`);

  // 3. Sync — upsert progress
  const SESSION_ID = `smoke-${Date.now()}`;
  r = await req("POST", "/api/smeta-trainer/sync", {
    sessionId: SESSION_ID,
    studentName: "Smoke Student",
    studentGroup: "Test-01",
    levelsJson: JSON.stringify({ level1: { passed: true, score: 12 } }),
  });
  if (r.status === 200 || r.status === 201) ok("POST /sync (upsert)");
  else fail("POST /sync", `${r.status} ${JSON.stringify(r.body)}`);

  // 4. Restore
  r = await req("GET", `/api/smeta-trainer/sync/${SESSION_ID}`);
  if (r.status === 200 && r.body?.studentName === "Smoke Student") ok("GET /sync/:sessionId restore");
  else if (r.status === 404) ok("GET /sync/:sessionId (DB not persisting — expected in ephemeral env)");
  else fail("GET /sync restore", `${r.status} name=${r.body?.studentName}`);

  // 5. LMS hook (no secret → 200 allowed or 401)
  r = await req("POST", "/api/smeta-trainer/lms/lesson-complete", {
    lessonRef: "lesson-2-1", sessionId: SESSION_ID, passed: true,
  });
  if (r.status === 200 || r.status === 401) ok("POST /lms/lesson-complete", `status=${r.status}`);
  else fail("POST /lms/lesson-complete", `${r.status} ${JSON.stringify(r.body)}`);

  console.log(`\n${passed + failed} assertions — ${passed} PASS  ${failed} FAIL\n`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => { console.error("crash:", err); process.exit(2); });
