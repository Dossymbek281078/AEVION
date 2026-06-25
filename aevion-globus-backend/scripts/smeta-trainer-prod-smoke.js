#!/usr/bin/env node
/**
 * Smeta Trainer PROD smoke — read-only checks for the РК сметный тренажёр API
 * (/api/smeta-trainer). Closes the last live-module prod-coverage gap.
 *
 * Covers: health, leaderboard, per-level stats shape, groups, graceful
 * unknown-student lookup, and the /sync validation gate. Safe for prod — the
 * only POST is an empty-body probe rejected before any write (bad_session_id).
 *
 * Usage: BASE=<prod> node scripts/smeta-trainer-prod-smoke.js
 */

const BASE = (process.env.BASE || "https://aevion-production-a70c.up.railway.app").replace(/\/+$/, "");

let pass = 0;
let fail = 0;
const ok = (l, e) => { pass++; console.log(`  ✓ ${l}${e ? "  " + e : ""}`); };
const bad = (l, r) => { fail++; console.error(`  ✗ ${l}${r ? "  ↳ " + r : ""}`); };

async function req(method, path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(12000),
  });
  let j;
  try { j = await r.json(); } catch { j = {}; }
  return { status: r.status, body: j, ct: r.headers.get("content-type") };
}

async function run() {
  console.log(`\nSmeta Trainer PROD smoke → ${BASE}\n`);

  let r = await req("GET", "/api/smeta-trainer/health");
  if (r.status === 200 && r.body?.status === "ok") ok("GET /smeta-trainer/health", `module=${r.body.module} v=${r.body.version}`);
  else bad("health", `${r.status}`);

  r = await req("GET", "/api/smeta-trainer/leaderboard");
  if (r.status === 200 && Array.isArray(r.body?.leaderboard)) ok("GET /leaderboard", `n=${r.body.leaderboard.length}`);
  else bad("leaderboard", `${r.status} ${JSON.stringify(r.body).slice(0, 60)}`);

  r = await req("GET", "/api/smeta-trainer/stats");
  if (r.status === 200 && typeof r.body?.studentsTotal === "number" && r.body?.perLevel && typeof r.body.perLevel === "object") {
    ok("GET /stats", `students=${r.body.studentsTotal} levels=${Object.keys(r.body.perLevel).length}`);
  } else bad("stats", `${r.status}`);

  r = await req("GET", "/api/smeta-trainer/groups");
  if (r.status === 200 && Array.isArray(r.body?.groups)) ok("GET /groups", `n=${r.body.groups.length}`);
  else bad("groups", `${r.status}`);

  // Unknown student device — graceful empty profile, never a 5xx.
  r = await req("GET", "/api/smeta-trainer/student/__smoke_unknown_device__");
  if (r.status === 200 || r.status === 404) ok("GET /student/<unknown> graceful", `status=${r.status}`);
  else bad("student graceful", `${r.status}`);

  // Validation gate — empty body rejected (bad_session_id) before any write.
  r = await req("POST", "/api/smeta-trainer/sync", {});
  if (r.status >= 400 && r.status < 500) ok("POST /sync {} → 4xx (validation gate)", `status=${r.status} ${r.body?.error ?? ""}`);
  else bad("sync validation gate", `got=${r.status}`);

  r = await req("GET", "/api/smeta-trainer/health");
  if (/application\/json/i.test(r.ct || "")) ok("Content-Type application/json on /health", r.ct);
  else bad("content-type", `ct=${r.ct}`);

  console.log(`\n${pass + fail} assertions — ${pass} PASS  ${fail} FAIL\n`);
  process.exit(fail > 0 ? 1 : 0);
}

run().catch((e) => { console.error("crash:", e); process.exit(2); });
