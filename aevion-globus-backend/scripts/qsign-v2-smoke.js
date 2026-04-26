#!/usr/bin/env node
/**
 * QSign v2 — end-to-end smoke test.
 *
 * Walks the live /api/qsign/v2 surface: health → register/login → sign →
 * stateless verify → DB verify → public view → revoke → post-revoke recheck.
 * Pass/fail is printed per step; process exits 1 on the first failure.
 *
 * Usage (from aevion-globus-backend/):
 *   node scripts/qsign-v2-smoke.js
 *
 * Env overrides:
 *   BASE      default http://127.0.0.1:4001
 *   EMAIL     default qsign-smoke-<ts>@aevion.test  (unique per run)
 *   PASSWORD  default smoke-password-123
 *   NO_REVOKE set to 1 to skip the revoke step
 *
 * Requires Node 18+ (global fetch).
 */

const BASE = (process.env.BASE || "http://127.0.0.1:4001").replace(/\/+$/, "");
const EMAIL = process.env.EMAIL || `qsign-smoke-${Date.now()}@aevion.test`;
const PASSWORD = process.env.PASSWORD || "smoke-password-123";
const SKIP_REVOKE = process.env.NO_REVOKE === "1";

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
  console.log(`\n  QSign v2 smoke test`);
  console.log(`  BASE  = ${BASE}`);
  console.log(`  EMAIL = ${EMAIL}`);
  console.log(`  ─────────────────────────────────────────────\n`);

  // 1 — health
  try {
    const r = await jsonFetch("GET", "/api/qsign/v2/health");
    if (!r.ok) return fail("health", `HTTP ${r.status}: ${JSON.stringify(r.data)}`);
    if (r.data?.status !== "ok")
      return fail("health", `unexpected status ${r.data?.status}`);
    if (!r.data?.activeKeys?.hmac || !r.data?.activeKeys?.ed25519)
      return fail("health", "missing activeKeys");
    pass(
      "health",
      `hmac=${r.data.activeKeys.hmac} ed25519=${r.data.activeKeys.ed25519}`,
    );
  } catch (e) {
    return fail("health", e?.message || String(e));
  }

  // 2 — register (idempotent enough: re-registering same email fails,
  //     so we use a unique email per run by default)
  {
    const r = await jsonFetch("POST", "/api/auth/register", {
      body: { email: EMAIL, password: PASSWORD, name: "Smoke" },
    });
    if (!r.ok && r.status !== 409)
      return fail("register", `HTTP ${r.status}: ${JSON.stringify(r.data)}`);
    pass("register", r.status === 409 ? "already-exists (ok)" : "created");
  }

  // 3 — login
  let token = null;
  {
    const r = await jsonFetch("POST", "/api/auth/login", {
      body: { email: EMAIL, password: PASSWORD },
    });
    if (!r.ok || !r.data?.token)
      return fail("login", `HTTP ${r.status}: ${JSON.stringify(r.data)}`);
    token = r.data.token;
    pass("login", `token len ${token.length}`);
  }

  // 4 — sign
  const payload = { hello: "AEVION", ts: Math.floor(Date.now() / 1000), zeta: 1, alpha: 2 };
  let signed = null;
  {
    const r = await jsonFetch("POST", "/api/qsign/v2/sign", {
      body: { payload, gps: { lat: 43.238949, lng: 76.889709 } },
      token,
    });
    if (!r.ok) return fail("sign", `HTTP ${r.status}: ${JSON.stringify(r.data)}`);
    if (!r.data?.id || !r.data?.hmac?.signature || !r.data?.ed25519?.signature)
      return fail("sign", `malformed response: ${JSON.stringify(r.data)}`);
    signed = r.data;
    pass(
      "sign",
      `id=${signed.id.slice(0, 8)} kids=${signed.hmac.kid}/${signed.ed25519.kid}`,
    );
  }

  // 5 — stateless verify (should be valid)
  {
    const r = await jsonFetch("POST", "/api/qsign/v2/verify", {
      body: {
        payload,
        hmacKid: signed.hmac.kid,
        signatureHmac: signed.hmac.signature,
        ed25519Kid: signed.ed25519.kid,
        signatureEd25519: signed.ed25519.signature,
      },
    });
    if (!r.ok)
      return fail("stateless verify", `HTTP ${r.status}: ${JSON.stringify(r.data)}`);
    if (!r.data?.valid)
      return fail("stateless verify", `valid=false: ${JSON.stringify(r.data)}`);
    pass("stateless verify", `hmac+ed25519 valid`);
  }

  // 6 — stateless verify with tampered payload (should fail)
  {
    const tampered = { ...payload, hello: "NOT_AEVION" };
    const r = await jsonFetch("POST", "/api/qsign/v2/verify", {
      body: {
        payload: tampered,
        hmacKid: signed.hmac.kid,
        signatureHmac: signed.hmac.signature,
      },
    });
    if (!r.ok)
      return fail("tampered verify", `HTTP ${r.status}: ${JSON.stringify(r.data)}`);
    if (r.data?.valid)
      return fail("tampered verify", "valid=true but payload was tampered");
    pass("tampered verify", "correctly invalid");
  }

  // 7 — DB verify by id
  {
    const r = await jsonFetch("GET", `/api/qsign/v2/verify/${signed.id}`);
    if (!r.ok) return fail("db verify", `HTTP ${r.status}: ${JSON.stringify(r.data)}`);
    if (!r.data?.valid || r.data?.revoked)
      return fail("db verify", `unexpected: ${JSON.stringify(r.data)}`);
    pass("db verify", `valid=${r.data.valid} revoked=${r.data.revoked}`);
  }

  // 8 — public view
  {
    const r = await jsonFetch("GET", `/api/qsign/v2/${signed.id}/public`);
    if (!r.ok) return fail("public view", `HTTP ${r.status}: ${JSON.stringify(r.data)}`);
    if (r.data?.id !== signed.id || !r.data?.payloadCanonical)
      return fail("public view", `malformed: ${JSON.stringify(r.data).slice(0, 200)}`);
    pass("public view", `payloadHash=${r.data.payloadHash.slice(0, 16)}…`);
  }

  // 9 — keys registry
  {
    const r = await jsonFetch("GET", "/api/qsign/v2/keys");
    if (!r.ok) return fail("keys list", `HTTP ${r.status}`);
    if (!Array.isArray(r.data?.keys) || r.data.keys.length < 2)
      return fail("keys list", `expected >=2 keys, got ${r.data?.keys?.length}`);
    pass("keys list", `total=${r.data.total}`);
  }

  // 9b — public stats
  {
    const r = await jsonFetch("GET", "/api/qsign/v2/stats");
    if (!r.ok) return fail("stats", `HTTP ${r.status}: ${JSON.stringify(r.data)}`);
    if (typeof r.data?.signatures?.total !== "number")
      return fail("stats", "malformed signatures totals");
    if (r.data.signatures.total < 1)
      return fail("stats", `expected total >= 1, got ${r.data.signatures.total}`);
    pass(
      "stats",
      `total=${r.data.signatures.total} last24h=${r.data.signatures.last24h} countries=${r.data.geo.uniqueCountries}`,
    );
  }

  // 9c — public recent feed
  {
    const r = await jsonFetch("GET", "/api/qsign/v2/recent?limit=5");
    if (!r.ok) return fail("recent", `HTTP ${r.status}: ${JSON.stringify(r.data)}`);
    if (!Array.isArray(r.data?.items) || r.data.items.length < 1)
      return fail("recent", `expected at least 1 item, got ${r.data?.items?.length}`);
    const ours = r.data.items.find((it) => it.id === signed.id);
    if (!ours) return fail("recent", "signed id not present in /recent");
    // sanity: feed must not leak identifying fields
    const leakedKeys = Object.keys(ours).filter((k) =>
      ["issuerEmail", "issuerUserId", "signatureHmac", "signatureEd25519", "payloadCanonical", "payloadHash"].includes(k),
    );
    if (leakedKeys.length)
      return fail("recent", `leaked sensitive fields: ${leakedKeys.join(", ")}`);
    pass("recent", `includes signed id, no leaked fields`);
  }

  // 10 — revoke (unless skipped)
  if (!SKIP_REVOKE) {
    const r = await jsonFetch("POST", `/api/qsign/v2/revoke/${signed.id}`, {
      body: { reason: "smoke test revocation" },
      token,
    });
    if (!r.ok) return fail("revoke", `HTTP ${r.status}: ${JSON.stringify(r.data)}`);
    if (!r.data?.revoked)
      return fail("revoke", `not revoked: ${JSON.stringify(r.data)}`);
    pass("revoke", `revokedAt=${r.data.revocation.revokedAt}`);

    // 11 — post-revoke verify should return valid=false
    const r2 = await jsonFetch("GET", `/api/qsign/v2/verify/${signed.id}`);
    if (!r2.ok) return fail("post-revoke verify", `HTTP ${r2.status}`);
    if (r2.data?.valid)
      return fail(
        "post-revoke verify",
        `valid=true after revoke: ${JSON.stringify(r2.data)}`,
      );
    if (!r2.data?.revoked)
      return fail("post-revoke verify", "revoked=false");
    pass("post-revoke verify", `valid=${r2.data.valid} revoked=${r2.data.revoked}`);

    // 12 — double-revoke must return 409
    const r3 = await jsonFetch("POST", `/api/qsign/v2/revoke/${signed.id}`, {
      body: { reason: "double revoke" },
      token,
    });
    if (r3.status !== 409)
      return fail("double revoke", `expected 409, got ${r3.status}`);
    pass("double revoke", "409 conflict (expected)");
  }

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n  ─────────────────────────────────────────────`);
  console.log(
    `  ${failed === 0 ? "ALL PASSED" : `${failed} FAILED`} · ${results.length} steps\n`,
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("\n  UNCAUGHT ERROR:", e?.message || e);
  process.exit(1);
});
