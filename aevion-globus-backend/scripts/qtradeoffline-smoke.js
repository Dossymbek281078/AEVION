#!/usr/bin/env node
/**
 * QTradeOffline smoke test — wallet register / transfer sync / leaderboard.
 * Generates a real ECDSA P-256 keypair in Node, registers two wallets,
 * signs a transfer offline, then syncs and verifies balances.
 *
 * Usage:
 *   node scripts/qtradeoffline-smoke.js
 *   BASE=https://aevion-production-a70c.up.railway.app node scripts/qtradeoffline-smoke.js
 */
const { subtle } = globalThis.crypto ?? require("node:crypto").webcrypto;
const BASE = (process.env.BASE || "http://127.0.0.1:4001").replace(/\/$/, "");
let passed = 0, failed = 0;

function assert(label, cond, info = "") {
  if (cond) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ ${label}${info ? " — " + info : ""}`); failed++; }
}

async function req(method, path, body) {
  const opts = { method, headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(10000) };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${BASE}${path}`, opts);
  const text = await r.text();
  try { return { status: r.status, body: JSON.parse(text) }; }
  catch { return { status: r.status, body: text }; }
}

/** Convert ArrayBuffer to base64. */
function ab2b64(buf) { return Buffer.from(buf).toString("base64"); }

/** ECDSA P-256 sign over UTF-8 message, return raw r||s base64. */
async function ecSign(privateKey, message) {
  const sig = await subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, Buffer.from(message, "utf8"));
  return ab2b64(sig);
}

/** Canonical JSON (sorted keys) — must match backend. */
function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  const keys = Object.keys(value).sort();
  return "{" + keys.map(k => JSON.stringify(k) + ":" + canonicalJson(value[k])).join(",") + "}";
}

async function run() {
  console.log(`\nQTradeOffline smoke → ${BASE}\n`);

  // 1. Health
  const h = await req("GET", "/api/qtradeoffline/health");
  assert("GET /health → 200", h.status === 200, String(h.status));
  assert("service = qtradeoffline", h.body?.service === "qtradeoffline");
  assert("wallets count present", typeof h.body?.wallets === "number");

  // 2. Generate keypairs for sender + receiver
  const aliceKp = await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const bobKp   = await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);

  const aliceJwk = await subtle.exportKey("jwk", aliceKp.publicKey);
  const bobJwk   = await subtle.exportKey("jwk", bobKp.publicKey);

  // Strip non-essential JWK fields
  const alicePub = { kty: aliceJwk.kty, crv: aliceJwk.crv, x: aliceJwk.x, y: aliceJwk.y };
  const bobPub   = { kty: bobJwk.kty,   crv: bobJwk.crv,   x: bobJwk.x,   y: bobJwk.y };

  // 3. Register Alice
  const ar = await req("POST", "/api/qtradeoffline/wallet/register", { publicKeyJwk: alicePub });
  assert("Alice register → 200", ar.status === 200, String(ar.status));
  const aliceId = ar.body?.wallet?.id;
  assert("Alice wallet id present", typeof aliceId === "string" && aliceId.startsWith("AEV-"));
  assert("Alice airdrop balance = 100", ar.body?.wallet?.balance === 100 || ar.body?.airdropped === true);

  // 4. Register Bob
  const br = await req("POST", "/api/qtradeoffline/wallet/register", { publicKeyJwk: bobPub });
  assert("Bob register → 200", br.status === 200, String(br.status));
  const bobId = br.body?.wallet?.id;
  assert("Bob wallet id present", typeof bobId === "string" && bobId.startsWith("AEV-"));

  // 5. GET wallet
  const aw = await req("GET", `/api/qtradeoffline/wallet/${aliceId}`);
  assert("GET /wallet/:id → 200", aw.status === 200, String(aw.status));
  assert("balance >= 100", (aw.body?.wallet?.balance ?? 0) >= 100);

  // 6. Sign transfer offline (Alice → Bob, 10 AEV)
  const nonce = `smoke-${Date.now()}`;
  const ts = Date.now();
  const payload = canonicalJson({ from: aliceId, to: bobId, amount: 10, nonce, timestamp: ts });
  const sig = await ecSign(aliceKp.privateKey, payload);

  const transfer = { from: aliceId, to: bobId, amount: 10, nonce, timestamp: ts, publicKeyJwk: alicePub, signature: sig };

  // 7. Sync
  const sync = await req("POST", "/api/qtradeoffline/sync", { transfers: [transfer] });
  assert("POST /sync → 200", sync.status === 200, String(sync.status));
  assert("transfer applied", sync.body?.results?.[0]?.status === "applied", JSON.stringify(sync.body));

  // 8. Nonce replay rejected
  const replay = await req("POST", "/api/qtradeoffline/sync", { transfers: [transfer] });
  assert("replay → rejected nonce-replay", replay.body?.results?.[0]?.reason === "nonce-replay", JSON.stringify(replay.body?.results?.[0]));

  // 9. Verify balances
  const awAfter = await req("GET", `/api/qtradeoffline/wallet/${aliceId}`);
  assert("Alice balance reduced by 10", (awAfter.body?.wallet?.balance ?? 0) <= 90 + 0.001);

  const bwAfter = await req("GET", `/api/qtradeoffline/wallet/${bobId}`);
  assert("Bob balance increased by 10", (bwAfter.body?.wallet?.balance ?? 0) >= 110 - 0.001);

  // 10. History
  const hist = await req("GET", `/api/qtradeoffline/history/${aliceId}`);
  assert("GET /history/:id → 200", hist.status === 200, String(hist.status));
  assert("history has transfer", Array.isArray(hist.body?.items) && hist.body.items.length >= 1);

  // 11. Leaderboard
  const lb = await req("GET", "/api/qtradeoffline/leaderboard");
  assert("GET /leaderboard → 200", lb.status === 200, String(lb.status));
  assert("leaderboard is array", Array.isArray(lb.body?.items));

  // 12. Stats
  const st = await req("GET", "/api/qtradeoffline/stats");
  assert("GET /stats → 200", st.status === 200, String(st.status));
  assert("stats.wallets >= 2", (st.body?.wallets ?? 0) >= 2);
  assert("stats.transfers >= 1", (st.body?.transfers ?? 0) >= 1);

  console.log(`\nQTradeOffline: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}
run().catch(e => { console.error(e); process.exit(1); });
