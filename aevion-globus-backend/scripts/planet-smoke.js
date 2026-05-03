#!/usr/bin/env node
/**
 * Planet Compliance — end-to-end smoke test.
 *
 * Walks the live /api/planet surface:
 *   health → register → submit music artifact (mediaFingerprint +
 *   mediaDescriptor) → stats baseline → list recent → fetch artifact
 *   /public → confirm /me/code-symbol returns shape.
 *
 * Pass/fail per step; exits 1 on first failure.
 *
 * Usage (from aevion-globus-backend/, with `npm run dev` running):
 *   node scripts/planet-smoke.js
 *
 * Env overrides:
 *   BASE      default http://127.0.0.1:4001
 *   EMAIL     default planet-smoke-<ts>@aevion.test  (unique per run)
 *   PASSWORD  default smoke-password-123
 *
 * Requires Node 18+ (global fetch, crypto.randomBytes).
 */

const crypto = require("crypto");

const BASE = (process.env.BASE || "http://127.0.0.1:4001").replace(/\/+$/, "");
const EMAIL = process.env.EMAIL || `planet-smoke-${Date.now()}@aevion.test`;
const PASSWORD = process.env.PASSWORD || "smoke-password-123";

let step = 0;
let failed = 0;

function ok(name, extra) {
  step += 1;
  console.log(`  ${String(step).padStart(2, "0")}  PASS  ${name}${extra ? "  " + extra : ""}`);
}
function fail(name, reason) {
  step += 1;
  failed += 1;
  console.error(`  ${String(step).padStart(2, "0")}  FAIL  ${name}`);
  console.error(`       ↳ ${reason}`);
}

async function call(method, path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (opts.body) headers["content-type"] = "application/json";
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /**/
  }
  return { status: res.status, body: json };
}

async function main() {
  console.log(`Planet Compliance smoke against ${BASE}`);
  console.log(`  email = ${EMAIL}`);
  console.log("");

  // 1. health
  let r = await call("GET", "/api/planet/health");
  if (r.status !== 200) return fail("GET /api/planet/health", `status=${r.status}`);
  ok("GET /health", `ok=${r.body?.status || r.body?.ok}`);

  // 2. register
  r = await call("POST", "/api/auth/register", {
    body: { email: EMAIL, password: PASSWORD, name: "Planet smoke" },
  });
  if (r.status !== 200 || !r.body?.token) return fail("register", `status=${r.status}`);
  const token = r.body.token;
  ok("register", `userId=${r.body?.user?.id?.slice(0, 8)}…`);

  const auth = { authorization: `Bearer ${token}` };

  // 3. baseline stats
  r = await call("GET", "/api/planet/stats");
  if (r.status !== 200) return fail("baseline GET /api/planet/stats", `status=${r.status}`);
  const baselineSubmissions = Number(r.body?.submissions ?? 0);
  ok("baseline /stats", `submissions=${baselineSubmissions}`);

  // 4. submit a music artifact — minimum valid payload
  const fingerprint = crypto.randomBytes(32).toString("hex");
  r = await call("POST", "/api/planet/submissions", {
    headers: auth,
    body: {
      artifactType: "music",
      title: `smoke-music-${Date.now()}`,
      productKey: "smoke-music-test",
      mediaFingerprint: fingerprint,
      mediaDescriptor: {
        title: "Smoke test track",
        artist: "Smoke Bot",
        durationSec: 180,
      },
    },
  });
  if (r.status !== 201 && r.status !== 200) {
    return fail("POST /submissions (music)", `status=${r.status} body=${JSON.stringify(r.body)?.slice(0, 200)}`);
  }
  const submissionId = r.body?.submissionId || r.body?.id;
  const artifactVersionId = r.body?.artifactVersionId;
  if (!submissionId || !artifactVersionId) {
    return fail("POST /submissions response shape", `missing submissionId/artifactVersionId, got ${JSON.stringify(r.body)?.slice(0, 200)}`);
  }
  ok("POST /submissions (music)", `version=${artifactVersionId.slice(0, 8)}…`);

  // 5. fetch the artifact's public view
  r = await call("GET", `/api/planet/artifacts/${encodeURIComponent(artifactVersionId)}/public`);
  if (r.status !== 200) return fail("GET /artifacts/:id/public", `status=${r.status}`);
  if (r.body?.id !== artifactVersionId) {
    return fail("public artifact id mismatch", `expected ${artifactVersionId}, got ${r.body?.id}`);
  }
  ok("GET /artifacts/:id/public", "id matches");

  // 6. recent list includes our artifact
  r = await call("GET", "/api/planet/artifacts/recent?limit=10");
  if (r.status !== 200) return fail("GET /artifacts/recent", `status=${r.status}`);
  const recent = Array.isArray(r.body?.items) ? r.body.items : Array.isArray(r.body) ? r.body : [];
  if (!recent.find((x) => (x.id || x.artifactVersionId) === artifactVersionId)) {
    return fail("recent contains our artifact", `not found in ${recent.length} items`);
  }
  ok("GET /artifacts/recent", `our artifact present in ${recent.length} items`);

  // 7. stats incremented
  r = await call("GET", "/api/planet/stats");
  if (r.status !== 200) return fail("post-submit GET /stats", `status=${r.status}`);
  const newSubmissions = Number(r.body?.submissions ?? 0);
  if (newSubmissions <= baselineSubmissions) {
    return fail("stats incremented", `${baselineSubmissions} → ${newSubmissions} (no increment)`);
  }
  ok("/stats incremented", `${baselineSubmissions} → ${newSubmissions}`);

  // 8. /me/code-symbol shape (per-user identity-stable code)
  r = await call("GET", "/api/planet/me/code-symbol", { headers: auth });
  if (r.status !== 200) return fail("GET /me/code-symbol", `status=${r.status}`);
  if (!r.body?.symbol && !r.body?.codeSymbol) {
    return fail("/me/code-symbol shape", `no 'symbol' or 'codeSymbol' field: ${JSON.stringify(r.body)?.slice(0, 200)}`);
  }
  ok("/me/code-symbol", "symbol returned");

  console.log("");
  if (failed > 0) {
    console.log(`  ${failed} step(s) failed.`);
    process.exit(1);
  }
  console.log("  All steps passed — Planet Compliance pipeline works end-to-end.");
  process.exit(0);
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(2);
});
