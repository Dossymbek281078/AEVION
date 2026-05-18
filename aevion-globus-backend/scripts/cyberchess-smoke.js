#!/usr/bin/env node
/**
 * CyberChess smoke — verifies the chess AEV-reward backend surface.
 *
 * Tests: health → auth register → AEV mint (chess win) →
 *        AEV ledger entry → wallet snapshot → cleanup.
 *
 * Frontend drag/premove regression = browser (Playwright) — not here.
 *
 * Usage:
 *   node scripts/cyberchess-smoke.js
 *   BACKEND_URL=https://aevion.app/api-backend node scripts/cyberchess-smoke.js
 */

const BASE = (process.argv[2] ?? process.env.BASE ?? process.env.BACKEND_URL ?? "http://localhost:4001").replace(/\/+$/, "");
const DEVICE = `chess-smoke-${Date.now()}`;

let passed = 0;
let failed = 0;

function ok(label, extra) { passed++; console.log(`  ✓ ${label}${extra ? "  " + extra : ""}`); }
function fail(label, reason) { failed++; console.error(`  ✗ ${label}${reason ? "  ↳ " + reason : ""}`); }

async function req(method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method, headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json;
  try { json = await res.json(); } catch { json = {}; }
  return { status: res.status, body: json };
}

async function run() {
  console.log(`\nCyberChess smoke → ${BASE}\n`);

  // 1. Health
  let r = await req("GET", "/api/health");
  if (r.status === 200 && (r.body?.ok || r.body?.status === "ok")) ok("GET /health", `status=${r.body?.status || r.body?.ok}`);
  else fail("GET /health", `${r.status}`);

  // 2. Register
  const EMAIL = `chess-smoke-${Date.now()}@aevion.test`;
  r = await req("POST", "/api/auth/register", { email: EMAIL, password: "ChessSmoke123!", name: "ChessBot" });
  if ((r.status === 200 || r.status === 201) && r.body?.token) {
    ok("register", `userId=${r.body.user?.id?.slice(0, 8)}`);
  } else {
    fail("register", `${r.status} ${JSON.stringify(r.body)}`);
    process.exit(1);
  }
  const token = r.body.token;

  // 3. AEV mint (chess win via play engine) — requires Bearer in prod
  r = await req("POST", `/api/aev/wallet/${DEVICE}/mint`, {
    amount: 1.0, sourceKind: "play", sourceModule: "cyberchess", reason: "chess-win-smoke",
  }, token);
  if (r.status === 200 && r.body?.wallet?.balance >= 1)
    ok("AEV mint (chess win)", `balance=${r.body.wallet.balance}`);
  else fail("AEV mint", `${r.status} ${JSON.stringify(r.body)}`);

  // 4. AEV ledger
  r = await req("GET", `/api/aev/ledger/${DEVICE}?limit=5`);
  if (r.status === 200 && r.body?.count >= 1) ok("AEV ledger entry", `count=${r.body.count}`);
  else fail("AEV ledger", `${r.status} count=${r.body?.count}`);

  // 5. Wallet snapshot
  r = await req("GET", `/api/aev/wallet/${DEVICE}`);
  if (r.status === 200 && r.body?.wallet?.deviceId === DEVICE)
    ok("AEV wallet snapshot", `balance=${r.body.wallet.balance}`);
  else fail("AEV wallet snapshot", `${r.status}`);

  // 6. Cleanup
  r = await req("DELETE", "/api/auth/account", { password: "ChessSmoke123!" }, token);
  if (r.status === 200 || r.status === 204) ok("DELETE /account (cleanup)");
  else fail("DELETE /account", `${r.status}`);

  console.log(`\n${passed + failed} assertions — ${passed} PASS  ${failed} FAIL\n`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => { console.error("crash:", err); process.exit(2); });
