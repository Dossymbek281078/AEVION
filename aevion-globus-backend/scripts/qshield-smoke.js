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

  // 7b — Idempotency-Key on reconstruct: same key returns cached verdict and
  // does NOT bump verifiedCount a second time.
  {
    const idemKey = `smoke-idem-${Date.now()}`;
    const before = await jsonFetch("GET", `/api/quantum-shield/${shieldId}/public`);
    const beforeCount = before.data?.verifiedCount ?? 0;

    const r1 = await fetch(
      `${BASE}/api/quantum-shield/${shieldId}/reconstruct`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idemKey,
        },
        body: JSON.stringify({ shards: [shards[0], shards[2]] }),
      },
    );
    const j1 = await r1.json();
    if (!j1?.valid) return fail("idempotency.first", JSON.stringify(j1));

    const r2 = await fetch(
      `${BASE}/api/quantum-shield/${shieldId}/reconstruct`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idemKey,
        },
        body: JSON.stringify({ shards: [shards[0], shards[2]] }),
      },
    );
    const j2 = await r2.json();
    if (j2?.idempotent !== "replayed")
      return fail("idempotency.replay", `expected idempotent=replayed, got ${j2?.idempotent}`);

    const after = await jsonFetch("GET", `/api/quantum-shield/${shieldId}/public`);
    const afterCount = after.data?.verifiedCount ?? 0;
    // Allow exactly 1 bump (first call), not 2.
    if (afterCount - beforeCount > 1)
      return fail("idempotency.count", `verifiedCount bumped ${afterCount - beforeCount} times, expected ≤1`);
    pass("idempotency", `replay confirmed, verifiedCount delta=${afterCount - beforeCount}`);
  }

  // 7c — distributed_v2 create: server should NOT keep shard 1 internally
  {
    const r = await jsonFetch("POST", "/api/quantum-shield", {
      token,
      body: {
        objectId: `smoke-dv2-${Date.now()}`,
        objectTitle: "Distributed v2 smoke",
        payload: { distributed: true },
        distribution: "distributed_v2",
      },
    });
    if (r.status !== 201) return fail("distributed.create", `HTTP ${r.status}: ${JSON.stringify(r.data)}`);
    if (r.data?.distribution !== "distributed_v2")
      return fail("distributed.create", `expected distributed_v2, got ${r.data?.distribution}`);
    if (!r.data?.witnessCid)
      return fail("distributed.create", "missing witnessCid");
    const dvId = r.data.id;

    // public projection should advertise the witness
    const pub = await jsonFetch("GET", `/api/quantum-shield/${dvId}/public`);
    if (pub.data?.distribution !== "distributed_v2")
      return fail("distributed.public", "public projection lost policy");
    if (!pub.data?.witnessUrl)
      return fail("distributed.public", "missing witnessUrl");

    // /witness must be publicly retrievable
    const wit = await jsonFetch("GET", `/api/quantum-shield/${dvId}/witness`);
    if (!wit.ok) return fail("distributed.witness", `HTTP ${wit.status}`);
    if (wit.data?.shard?.index !== 3)
      return fail("distributed.witness", `expected shard.index=3, got ${wit.data?.shard?.index}`);
    if (wit.data?.cid !== r.data.witnessCid)
      return fail("distributed.witness", "CID mismatch between create and witness endpoints");

    // GET /:id should return only 2 shards (server-held), not 3
    const full = await jsonFetch("GET", `/api/quantum-shield/${dvId}`);
    const stored = (full.data?.shards || []).map((s) => s.index).sort();
    if (JSON.stringify(stored) !== "[2,3]")
      return fail("distributed.persisted", `expected [2,3] persisted, got ${JSON.stringify(stored)}`);
    pass("distributed_v2", `id=${dvId} cid=${r.data.witnessCid.slice(0, 16)}… server holds shards ${stored.join("+")}`);
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
