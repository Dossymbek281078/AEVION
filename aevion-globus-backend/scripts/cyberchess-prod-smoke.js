#!/usr/bin/env node
/**
 * CyberChess PROD smoke — READ-ONLY checks for the live CyberChess API surface
 * (/api/cyberchess*, tournaments, spectator). Closes the last live-module
 * prod-coverage gap.
 *
 * Strictly read-only: GET probes against already-deployed endpoints + auth /
 * validation gates. Touches NO game state and NO cyberchess source — the v37
 * redesign work lives in a separate chat/zone and is not modified here.
 *
 * Usage: BASE=<prod> node scripts/cyberchess-prod-smoke.js
 */

const BASE = (process.env.BASE || "https://aevion-production-a70c.up.railway.app").replace(/\/+$/, "");

let pass = 0;
let fail = 0;
const ok = (l, e) => { pass++; console.log(`  ✓ ${l}${e ? "  " + e : ""}`); };
const bad = (l, r) => { fail++; console.error(`  ✗ ${l}${r ? "  ↳ " + r : ""}`); };

async function req(method, path) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(12000),
  });
  let j;
  try { j = await r.json(); } catch { j = {}; }
  return { status: r.status, body: j, ct: r.headers.get("content-type") };
}

async function run() {
  console.log(`\nCyberChess PROD smoke (read-only) → ${BASE}\n`);

  // CPI leaderboard — public, paginated shape.
  let r = await req("GET", "/api/cyberchess/cpi/leaderboard");
  if (r.status === 200 && Array.isArray(r.body?.data?.items)) ok("GET /cyberchess/cpi/leaderboard", `items=${r.body.data.items.length} factor=${r.body.data.factor}`);
  else bad("cpi/leaderboard", `${r.status} ${JSON.stringify(r.body).slice(0, 60)}`);

  // CPI /me requires a userId query param — validation gate.
  r = await req("GET", "/api/cyberchess/cpi/me");
  if (r.status === 400) ok("GET /cyberchess/cpi/me (no userId) → 400", r.body?.error ? String(r.body.error).slice(0, 40) : "");
  else bad("cpi/me validation gate", `got=${r.status}`);

  // Upcoming events — public.
  r = await req("GET", "/api/cyberchess/upcoming");
  if (r.status === 200) ok("GET /cyberchess/upcoming → 200");
  else bad("cyberchess/upcoming", `${r.status}`);

  // Results — auth-gated.
  r = await req("GET", "/api/cyberchess/results");
  if (r.status === 401) ok("GET /cyberchess/results (no auth) → 401");
  else bad("cyberchess/results auth gate", `got=${r.status}`);

  // Tournaments list — public, count + array.
  r = await req("GET", "/api/cyberchess-tournaments/list");
  let firstTid;
  if (r.status === 200 && r.body?.ok && Array.isArray(r.body?.tournaments)) {
    firstTid = r.body.tournaments[0]?.id;
    ok("GET /cyberchess-tournaments/list", `count=${r.body.count} n=${r.body.tournaments.length}`);
  } else bad("tournaments/list", `${r.status}`);

  // Tournament detail by id (if any exist).
  if (firstTid) {
    r = await req("GET", `/api/cyberchess-tournaments/${encodeURIComponent(firstTid)}`);
    if (r.status === 200) ok("GET /cyberchess-tournaments/:id", `id=${firstTid}`);
    else bad("tournaments/:id", `${r.status}`);
  } else {
    ok("GET /cyberchess-tournaments/:id", "skipped — no tournaments listed");
  }

  // Time-controls meta — public matchmaking presets.
  r = await req("GET", "/api/cyberchess-tournaments/__meta/time-controls");
  if (r.status === 200 && Array.isArray(r.body?.matchmaking)) ok("GET /__meta/time-controls", `presets=${r.body.matchmaking.length}`);
  else bad("time-controls", `${r.status}`);

  // Spectator — public list + replays.
  r = await req("GET", "/api/cyberchess-spectator/list");
  if (r.status === 200 && r.body?.ok && Array.isArray(r.body?.games)) ok("GET /cyberchess-spectator/list", `games=${r.body.games.length}`);
  else bad("spectator/list", `${r.status}`);

  r = await req("GET", "/api/cyberchess-spectator/replays");
  if (r.status === 200) ok("GET /cyberchess-spectator/replays → 200");
  else bad("spectator/replays", `${r.status}`);

  // Content-Type on a public endpoint.
  r = await req("GET", "/api/cyberchess-tournaments/list");
  if (/application\/json/i.test(r.ct || "")) ok("Content-Type application/json on /tournaments/list", r.ct);
  else bad("content-type", `ct=${r.ct}`);

  console.log(`\n${pass + fail} assertions — ${pass} PASS  ${fail} FAIL\n`);
  process.exit(fail > 0 ? 1 : 0);
}

run().catch((e) => { console.error("crash:", e); process.exit(2); });
