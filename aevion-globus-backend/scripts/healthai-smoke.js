#!/usr/bin/env node
/**
 * HealthAI smoke — end-to-end against a running backend.
 *
 * Covers: health · profile create · log metric · history · PHQ-9 ·
 *         GAD-7 · plan · population · risks · leaderboard · export ·
 *         AI check-llm (soft-check — needs ANTHROPIC_API_KEY)
 *
 * Usage:
 *   node scripts/healthai-smoke.js
 *   BASE=http://127.0.0.1:4001 node scripts/healthai-smoke.js
 *
 * Exit 0 = all pass, exit 1 = at least one fail.
 * Requires Node 18+ (global fetch).
 */

const BASE = (process.env.BASE || "http://127.0.0.1:4001").replace(/\/+$/, "");
const RUN = Date.now();
const EMAIL = `healthai-smoke-${RUN}@aevion.test`;
const PASSWORD = "smoke-pass-1234";

let step = 0;
let failed = 0;

function ok(name, extra = "") {
  step += 1;
  console.log(`  ${String(step).padStart(2, "0")}  PASS  ${name}${extra ? "  " + extra : ""}`);
}
function fail(name, reason) {
  step += 1;
  failed += 1;
  console.error(`  ${String(step).padStart(2, "0")}  FAIL  ${name}`);
  console.error(`       ↳ ${reason}`);
}
function info(msg) {
  step += 1;
  console.log(`  ${String(step).padStart(2, "0")}  INFO  ${msg}`);
}

async function call(method, path, { body, token } = {}) {
  const headers = {};
  if (body) headers["content-type"] = "application/json";
  if (token) headers["authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /**/ }
  return { status: res.status, body: json };
}

async function run() {
  console.log(`\nHealthAI smoke  BASE=${BASE}  email=${EMAIL}`);
  console.log("─".repeat(60));

  // ── Public endpoints ─────────────────────────────────────────
  let r = await call("GET", "/api/healthai/health");
  if (r.status === 200 && r.body?.status === "ok") ok("/health");
  else fail("/health", `status=${r.status}`);

  r = await call("GET", "/api/healthai/leaderboard");
  if (r.status === 200 && Array.isArray(r.body?.leaderboard)) ok("/leaderboard", `n=${r.body.leaderboard.length}`);
  else fail("/leaderboard", `status=${r.status}`);

  r = await call("GET", "/api/healthai/openapi.json");
  if (r.status === 200 && r.body?.openapi) ok("/openapi.json");
  else fail("/openapi.json", `status=${r.status}`);

  r = await call("GET", "/api/healthai/referrals");
  if (r.status === 200) ok("/referrals");
  else fail("/referrals", `status=${r.status}`);

  // ── Auth ──────────────────────────────────────────────────────
  r = await call("POST", "/api/auth/register", { body: { email: EMAIL, password: PASSWORD, name: "HAI Smoke" } });
  const token = r.body?.token;
  if (!token) { fail("auth register", "no token"); return; }
  ok("auth register");

  // ── Profile ───────────────────────────────────────────────────
  r = await call("POST", "/api/healthai/profile", {
    token,
    body: { age: 30, sex: "male", heightCm: 180, weightKg: 80, activityLevel: "moderate", smoker: false, goals: ["weight_loss", "fitness"] },
  });
  const profileId = r.body?.profile?.id;
  if (r.status === 200 && profileId) ok("POST /profile", `id=${profileId.slice(0, 12)}`);
  else fail("POST /profile", `status=${r.status} body=${JSON.stringify(r.body).slice(0, 80)}`);

  if (!profileId) {
    await call("DELETE", "/api/auth/account", { token });
    console.log(`\nTotal steps: ${step}, failed: ${failed}`);
    process.exit(failed > 0 ? 1 : 0);
  }

  r = await call("GET", "/api/healthai/profiles/me", { token });
  if (r.status === 200 && Array.isArray(r.body?.profiles) && r.body.profiles.length >= 1) ok("GET /profiles/me", `n=${r.body.profiles.length}`);
  else fail("GET /profiles/me", `status=${r.status}`);

  // ── Log metrics ───────────────────────────────────────────────
  r = await call("POST", "/api/healthai/log", {
    token,
    body: { profileId, metric: "weight", value: 79.5, unit: "kg" },
  });
  if (r.status === 200 && r.body?.log?.id) ok("POST /log (weight)");
  else fail("POST /log (weight)", `status=${r.status} body=${JSON.stringify(r.body).slice(0, 80)}`);

  r = await call("POST", "/api/healthai/log", {
    token,
    body: { profileId, metric: "sleep", value: 7.5, unit: "h" },
  });
  if (r.status === 200 && r.body?.log?.id) ok("POST /log (sleep)");
  else fail("POST /log (sleep)", `status=${r.status}`);

  // ── History & trends ──────────────────────────────────────────
  r = await call("GET", `/api/healthai/history/${profileId}`, { token });
  if (r.status === 200 && (r.body?.logs !== undefined || r.body?.checks !== undefined)) ok("GET /history/:id", `logs=${r.body?.logs?.length ?? 0}`);
  else fail("GET /history/:id", `status=${r.status}`);

  r = await call("GET", `/api/healthai/trends/${profileId}`, { token });
  if (r.status === 200) ok("GET /trends/:id");
  else fail("GET /trends/:id", `status=${r.status}`);

  // ── Screeners ─────────────────────────────────────────────────
  r = await call("POST", "/api/healthai/screener/phq9", {
    token,
    body: { profileId, answers: [1, 0, 1, 0, 1, 0, 1, 0, 1] },
  });
  if (r.status === 200 && r.body?.score !== undefined) ok("POST /screener/phq9", `score=${r.body.score} severity=${r.body.severity}`);
  else fail("POST /screener/phq9", `status=${r.status}`);

  r = await call("POST", "/api/healthai/screener/gad7", {
    token,
    body: { profileId, answers: [1, 0, 1, 0, 1, 0, 1] },
  });
  if (r.status === 200 && r.body?.score !== undefined) ok("POST /screener/gad7", `score=${r.body.score}`);
  else fail("POST /screener/gad7", `status=${r.status}`);

  // ── Risk assessment ───────────────────────────────────────────
  r = await call("GET", `/api/healthai/risks/${profileId}`, { token });
  if (r.status === 200 && (r.body?.risks !== undefined || r.body?.riskFactors !== undefined)) ok("GET /risks/:id");
  else fail("GET /risks/:id", `status=${r.status} body=${JSON.stringify(r.body).slice(0, 80)}`);

  // ── Wellness plan ─────────────────────────────────────────────
  r = await call("GET", `/api/healthai/plan/${profileId}`, { token });
  if (r.status === 200 && r.body?.plan !== undefined) ok("GET /plan/:profileId");
  else fail("GET /plan/:profileId", `status=${r.status}`);

  // ── Population comparison ─────────────────────────────────────
  r = await call("GET", `/api/healthai/population/${profileId}`, { token });
  if (r.status === 200) ok("GET /population/:profileId");
  else fail("GET /population/:profileId", `status=${r.status}`);

  // ── Export ────────────────────────────────────────────────────
  r = await call("GET", `/api/healthai/export/${profileId}`, { token });
  if (r.status === 200) ok("GET /export/:profileId");
  else fail("GET /export/:profileId", `status=${r.status}`);

  // ── AI check-llm (soft — needs ANTHROPIC_API_KEY) ────────────
  r = await call("POST", "/api/healthai/check-llm", {
    token,
    body: { profileId, symptoms: ["headache", "fatigue"], durationH: 24, lang: "en" },
  });
  if (r.status === 200 && r.body?.advice) ok("POST /check-llm (AI)", `advice_len=${r.body.advice.length}`);
  else if (r.status === 503 || (r.body?.error || "").includes("not configured")) info("/check-llm skipped — ANTHROPIC_API_KEY not set");
  else fail("POST /check-llm (AI)", `status=${r.status} body=${JSON.stringify(r.body).slice(0, 80)}`);

  // ── Cleanup ───────────────────────────────────────────────────
  await call("DELETE", "/api/auth/account", { token });
  ok("auth cleanup");

  console.log("─".repeat(60));
  console.log(`Total steps: ${step}, failed: ${failed}`);
}

run()
  .catch((err) => {
    failed += 1;
    console.error("CRASH:", err.message);
  })
  .finally(() => process.exit(failed > 0 ? 1 : 0));
