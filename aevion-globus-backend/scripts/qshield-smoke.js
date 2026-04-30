#!/usr/bin/env node
/**
 * Quantum Shield — end-to-end smoke test.
 *
 * Walks the live /api/quantum-shield surface:
 *   health → register → create → list (?mine=1) → public view →
 *   reconstruct (Lagrange + Ed25519 probe-sign) → delete (owner) → 404 recheck.
 *
 * Pass/fail printed per step; process exits 1 on the first failure.
 *
 * Usage (from aevion-globus-backend/):
 *   node scripts/qshield-smoke.js
 *
 * Env overrides:
 *   BASE      default http://127.0.0.1:4001
 *   EMAIL     default qshield-smoke-<ts>@aevion.test  (unique per run)
 *   PASSWORD  default smoke-password-123
 *   NO_DELETE set to 1 to skip the delete step (record will remain in DB)
 *
 * Requires Node 18+ (global fetch).
 */

const BASE = (process.env.BASE || "http://127.0.0.1:4001").replace(/\/+$/, "");
const EMAIL = process.env.EMAIL || `qshield-smoke-${Date.now()}@aevion.test`;
const PASSWORD = process.env.PASSWORD || "smoke-password-123";
const SKIP_DELETE = process.env.NO_DELETE === "1";

let step = 0;
const results = [];

function pass(name, extra) {
  step += 1;
  const line = `  ${String(step).padStart(2, "0")}  PASS  ${name}`;
  console.log(extra ? `${line}  ${extra}` : line);
  results.push({ name, ok: true });
}

function fail(name, reason) {
  step += 1;
  console.error(`  ${String(step).padStart(2, "0")}  FAIL  ${name}`);
  console.error(`       ↳ ${reason}`);
  results.push({ name, ok: false, reason });
}

async function jsonFetch(method, path, { body, token } = {}) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, ok: res.ok, data };
}

async function main() {
  console.log(`\n  Quantum Shield smoke test`);
  console.log(`  BASE  = ${BASE}`);
  console.log(`  EMAIL = ${EMAIL}`);
  console.log(`  ─────────────────────────────────────────────\n`);

  // 1 — health
  {
    const r = await jsonFetch("GET", "/api/quantum-shield/health");
    if (!r.ok) return fail("health", `HTTP ${r.status}: ${JSON.stringify(r.data)}`);
    if (r.data?.status !== "ok")
      return fail("health", `unexpected status ${r.data?.status}`);
    if (typeof r.data?.totalRecords !== "number")
      return fail("health", "missing totalRecords counter");
    pass(
      "health",
      `total=${r.data.totalRecords} active=${r.data.activeRecords} legacy=${r.data.legacyRecords}`,
    );
  }

  // 2 — register fresh user
  let token;
  let userId;
  {
    const r = await jsonFetch("POST", "/api/auth/register", {
      body: { email: EMAIL, password: PASSWORD, name: "QShield Smoke" },
    });
    if (!r.ok) return fail("auth.register", `HTTP ${r.status}: ${JSON.stringify(r.data)}`);
    token = r.data?.token;
    userId = r.data?.user?.id;
    if (!token) return fail("auth.register", "no token in response");
    pass("auth.register", `userId=${userId}`);
  }

  // 3 — create shield record (authenticated → owner is set)
  let shieldId;
  let shards;
  let publicKey;
  {
    const r = await jsonFetch("POST", "/api/quantum-shield", {
      token,
      body: {
        objectId: `smoke-${Date.now()}`,
        objectTitle: "Smoke test artifact",
        payload: { hello: "AEVION", smoke: true },
      },
    });
    if (r.status !== 201) return fail("create", `HTTP ${r.status}: ${JSON.stringify(r.data)}`);
    shieldId = r.data?.id;
    shards = r.data?.shards;
    publicKey = r.data?.publicKey;
    if (!shieldId || !Array.isArray(shards) || shards.length !== 3)
      return fail("create", `unexpected shape: id=${shieldId} shards=${shards?.length}`);
    if (r.data?.ownerUserId !== userId)
      return fail("create", `owner mismatch: ${r.data?.ownerUserId} vs ${userId}`);
    pass("create", `id=${shieldId} threshold=${r.data.threshold}/${r.data.totalShards}`);
  }

  // 4 — list with ?mine=1 (must include our record)
  {
    const r = await jsonFetch("GET", "/api/quantum-shield?mine=1", { token });
    if (!r.ok) return fail("list.mine", `HTTP ${r.status}`);
    const items = r.data?.records || r.data?.items || [];
    const found = items.find((x) => x.id === shieldId);
    if (!found) return fail("list.mine", `our record ${shieldId} missing from ?mine=1`);
    pass("list.mine", `total=${r.data.total} mine=${items.length}`);
  }

  // 5 — public view (no auth, no shards leaked)
  {
    const r = await jsonFetch("GET", `/api/quantum-shield/${shieldId}/public`);
    if (!r.ok) return fail("public", `HTTP ${r.status}`);
    if (r.data?.id !== shieldId) return fail("public", "id mismatch");
    if (r.data?.shards !== undefined) return fail("public", "shards leaked in public view!");
    if (r.data?.publicKey !== publicKey) return fail("public", "publicKey mismatch");
    pass("public", `pubKey=${publicKey.slice(0, 16)}…`);
  }

  // 6 — reconstruct with 2 of 3 shards (Lagrange + Ed25519 probe-sign)
  {
    const twoShards = [shards[0], shards[2]]; // skip middle one to prove threshold works
    const r = await jsonFetch("POST", `/api/quantum-shield/${shieldId}/reconstruct`, {
      body: { shards: twoShards },
    });
    if (!r.ok) return fail("reconstruct", `HTTP ${r.status}: ${JSON.stringify(r.data)}`);
    if (r.data?.ok !== true) return fail("reconstruct", `not ok: ${JSON.stringify(r.data)}`);
    pass("reconstruct", "Lagrange + probe-sign verified");
  }

  // 7 — reconstruct with only 1 shard must fail (threshold guard)
  {
    const r = await jsonFetch("POST", `/api/quantum-shield/${shieldId}/reconstruct`, {
      body: { shards: [shards[0]] },
    });
    if (r.ok) return fail("reconstruct.threshold", "1-of-3 should not succeed");
    pass("reconstruct.threshold", `correctly rejected with HTTP ${r.status}`);
  }

  // 8 — delete (owner can)
  if (!SKIP_DELETE) {
    const r = await jsonFetch("DELETE", `/api/quantum-shield/${shieldId}`, { token });
    if (!r.ok) return fail("delete", `HTTP ${r.status}: ${JSON.stringify(r.data)}`);
    pass("delete", `id=${shieldId}`);

    // 9 — public view after delete should 404
    const r2 = await jsonFetch("GET", `/api/quantum-shield/${shieldId}/public`);
    if (r2.status !== 404) return fail("public.afterDelete", `expected 404, got ${r2.status}`);
    pass("public.afterDelete", "404 as expected");
  } else {
    pass("delete", "SKIPPED (NO_DELETE=1)");
  }

  console.log(`\n  ─────────────────────────────────────────────`);
  const ok = results.every((r) => r.ok);
  const passed = results.filter((r) => r.ok).length;
  console.log(`  ${ok ? "ALL PASS" : "SOME FAILED"}  ${passed}/${results.length}\n`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error("\n  fatal:", e?.message || e);
  process.exit(2);
});
