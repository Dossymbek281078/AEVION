#!/usr/bin/env node
/**
 * CyberChess tournament-finalize → prize webhook smoke (master-plan P2-2 / §6).
 *
 * Exercises the full finalize→Bank-prize path that the Bank UI reads to render
 * ChessWinnings live:
 *
 *   health → register → 401 on unsigned webhook → 401 on bad signature →
 *   201 on valid HMAC finalize (prize recorded) → idempotent replay (no dup) →
 *   400 on malformed payload → GET /results shows the prize (Bearer-scoped) →
 *   results.csv export → cleanup.
 *
 * The webhook accepts either a static legacy secret (X-CyberChess-Secret) or an
 * HMAC-SHA256 over `${timestamp}.${stableStringify(body)}` (X-Aevion-Signature
 * + X-Aevion-Timestamp). This smoke uses HMAC so it also passes when the target
 * has WEBHOOK_REQUIRE_HMAC=1. Secret defaults to the dev secret; override with
 * CYBERCHESS_WEBHOOK_SECRET to run against a real environment.
 *
 * Pure-crypto sign/verify of the lib itself lives in webhook-sig-smoke.js; this
 * is the live end-to-end counterpart. Frontend drag/premove = Playwright.
 *
 * Usage:
 *   node scripts/cyberchess-finalize-smoke.js
 *   CYBERCHESS_WEBHOOK_SECRET=... BASE=https://aevion.app/api-backend node scripts/cyberchess-finalize-smoke.js
 */

"use strict";

const { createHmac } = require("node:crypto");

const BASE = (process.argv[2] ?? process.env.BASE ?? process.env.BACKEND_URL ?? "http://localhost:4001").replace(/\/+$/, "");
const SECRET = process.env.CYBERCHESS_WEBHOOK_SECRET || "dev-chess-webhook";

let passed = 0;
let failed = 0;
function ok(label, extra) { passed++; console.log(`  ✓ ${label}${extra ? "  " + extra : ""}`); }
function fail(label, reason) { failed++; console.error(`  ✗ ${label}${reason ? "  ↳ " + reason : ""}`); }

// ── stableStringify — byte-identical to src/lib/stableStringify.ts so the
// HMAC the server re-derives over stableStringify(req.body) matches ours. ──
function normalize(value) {
  if (value === null || value === undefined) return null;
  const t = typeof value;
  if (t === "string" || t === "number" || t === "boolean") return value;
  if (t === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === "object" && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)) {
    const out = {};
    for (const k of Object.keys(value).sort()) out[k] = normalize(value[k]);
    return out;
  }
  try { return JSON.parse(JSON.stringify(value)); } catch { return String(value); }
}
function stableStringify(value) { return JSON.stringify(normalize(value)); }

function signHeaders(body) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", SECRET).update(`${timestamp}.${stableStringify(body)}`).digest("hex");
  return { "X-Aevion-Signature": `sha256=${signature}`, "X-Aevion-Timestamp": String(timestamp) };
}

async function req(method, path, body, headers = {}, token) {
  const h = { "Content-Type": "application/json", ...headers };
  if (token) h["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  let json, text;
  const raw = await res.text();
  try { json = JSON.parse(raw); } catch { text = raw; }
  return { status: res.status, body: json ?? {}, text: text ?? raw };
}

async function run() {
  console.log(`\nCyberChess finalize→prize smoke → ${BASE}\n`);

  // 1. Health
  let r = await req("GET", "/api/health");
  if (r.status === 200 && (r.body?.ok || r.body?.status === "ok")) ok("GET /health");
  else fail("GET /health", `${r.status}`);

  // 2. Register a winner (lowercase email — prizes are stored/scoped lowercase)
  const EMAIL = `chess-finalize-${Date.now()}@aevion.test`;
  r = await req("POST", "/api/auth/register", { email: EMAIL, password: "ChessSmoke123!", name: "ChessChamp" });
  if ((r.status === 200 || r.status === 201) && r.body?.token) ok("register winner", `userId=${r.body.user?.id?.slice(0, 8)}`);
  else { fail("register winner", `${r.status} ${JSON.stringify(r.body)}`); process.exit(1); }
  const token = r.body.token;

  const TOUR = `tour_smoke_${Date.now()}`;
  const AMOUNT = 42.5;
  const goodBody = { tournamentId: TOUR, podium: [{ email: EMAIL, place: 1, amount: AMOUNT }] };

  // 3. Unsigned webhook → 401
  r = await req("POST", "/api/cyberchess/tournament-finalized", goodBody);
  if (r.status === 401) ok("unsigned finalize → 401");
  else fail("unsigned finalize → 401", `got ${r.status} ${JSON.stringify(r.body)}`);

  // 4. Bad signature → 401
  r = await req("POST", "/api/cyberchess/tournament-finalized", goodBody, {
    "X-Aevion-Signature": "sha256=deadbeef", "X-Aevion-Timestamp": String(Math.floor(Date.now() / 1000)),
  });
  if (r.status === 401) ok("bad signature → 401");
  else fail("bad signature → 401", `got ${r.status} ${JSON.stringify(r.body)}`);

  // 5. Valid HMAC finalize → 201, prize recorded
  r = await req("POST", "/api/cyberchess/tournament-finalized", goodBody, signHeaders(goodBody));
  if (r.status === 201 && Array.isArray(r.body?.recorded) && r.body.recorded.length === 1 && r.body.recorded[0].place === 1)
    ok("valid finalize → 201 recorded", `prizeId=${r.body.recorded[0].id?.slice(0, 12)}`);
  else fail("valid finalize → 201 recorded", `${r.status} ${JSON.stringify(r.body)}`);

  // 6. Idempotent replay → 201, no new record, reported as replayed
  r = await req("POST", "/api/cyberchess/tournament-finalized", goodBody, signHeaders(goodBody));
  if (r.status === 201 && r.body?.recorded?.length === 0 && r.body?.replayed?.length === 1)
    ok("idempotent replay → no dup", `replayed=${r.body.replayed.length}`);
  else fail("idempotent replay → no dup", `${r.status} ${JSON.stringify(r.body)}`);

  // 7. Malformed payload (valid sig, missing podium) → 400
  const badBody = { tournamentId: TOUR };
  r = await req("POST", "/api/cyberchess/tournament-finalized", badBody, signHeaders(badBody));
  if (r.status === 400) ok("malformed payload (valid sig, no podium) → 400");
  else fail("malformed payload → 400", `got ${r.status} ${JSON.stringify(r.body)}`);

  // 8. GET /results — Bearer-scoped, prize visible to the winner
  r = await req("GET", "/api/cyberchess/results?limit=20", null, {}, token);
  const mine = Array.isArray(r.body?.items) ? r.body.items.find((x) => x.tournamentId === TOUR) : null;
  if (r.status === 200 && mine && mine.place === 1 && Number(mine.amount) === AMOUNT)
    ok("GET /results shows prize", `amount=${mine.amount} place=${mine.place}`);
  else fail("GET /results shows prize", `${r.status} item=${JSON.stringify(mine)}`);

  // 9. CSV export contains the tournament
  r = await req("GET", "/api/cyberchess/results.csv", null, {}, token);
  if (r.status === 200 && typeof r.text === "string" && r.text.includes(TOUR)) ok("GET /results.csv export");
  else fail("GET /results.csv export", `${r.status} hasTour=${typeof r.text === "string" && r.text.includes(TOUR)}`);

  // 10. Cleanup
  r = await req("DELETE", "/api/auth/account", { password: "ChessSmoke123!" }, {}, token);
  if (r.status === 200 || r.status === 204) ok("DELETE /account (cleanup)");
  else fail("DELETE /account", `${r.status}`);

  console.log(`\n${passed + failed} assertions — ${passed} PASS  ${failed} FAIL\n`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => { console.error("crash:", err); process.exit(2); });
