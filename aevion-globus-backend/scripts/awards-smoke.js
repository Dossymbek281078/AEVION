#!/usr/bin/env node
/**
 * AEVION Awards — read-shape smoke test.
 *
 * Awards entries require an open admin-created season AND a Planet
 * artifact owned by the caller — both of which depend on seed data. So
 * this smoke focuses on the read surfaces every public consumer hits:
 *   /seasons → /:type/leaderboard (music + film) →
 *   /transparency → /og.svg → /sitemap.xml.
 *
 * If a season is open, also tries to submit an entry (chained to a
 * planet submission) — but treats absence of an open season as SKIP,
 * not FAIL.
 *
 * Pass/fail per step; exits 1 on first failure.
 *
 * Usage (from aevion-globus-backend/, with `npm run dev` running):
 *   node scripts/awards-smoke.js
 *
 * Env overrides:
 *   BASE      default http://127.0.0.1:4001
 *   EMAIL     default awards-smoke-<ts>@aevion.test
 *   PASSWORD  default smoke-password-123
 *
 * Requires Node 18+ (global fetch, crypto.randomBytes).
 */

const crypto = require("crypto");

const BASE = (process.env.BASE || "http://127.0.0.1:4001").replace(/\/+$/, "");
const EMAIL = process.env.EMAIL || `awards-smoke-${Date.now()}@aevion.test`;
const PASSWORD = process.env.PASSWORD || "smoke-password-123";

let step = 0;
let failed = 0;
let skipped = 0;

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
function skip(name, reason) {
  step += 1;
  skipped += 1;
  console.log(`  ${String(step).padStart(2, "0")}  SKIP  ${name}  (${reason})`);
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

async function rawGet(path) {
  const res = await fetch(`${BASE}${path}`);
  const text = await res.text();
  return { status: res.status, headers: res.headers, text };
}

async function main() {
  console.log(`Awards smoke against ${BASE}`);
  console.log(`  email = ${EMAIL}`);
  console.log("");

  // 1. seasons list
  let r = await call("GET", "/api/awards/seasons");
  if (r.status !== 200) return fail("GET /seasons", `status=${r.status}`);
  const seasons = Array.isArray(r.body?.items) ? r.body.items : Array.isArray(r.body) ? r.body : [];
  ok("GET /seasons", `${seasons.length} season(s)`);
  const openSeason = seasons.find((s) => s.status === "open");

  // 2. leaderboard (music)
  r = await call("GET", "/api/awards/music/leaderboard");
  if (r.status !== 200) return fail("GET /music/leaderboard", `status=${r.status}`);
  ok("GET /music/leaderboard", `${(r.body?.items || r.body || []).length || 0} rows`);

  // 3. leaderboard (film)
  r = await call("GET", "/api/awards/film/leaderboard");
  if (r.status !== 200) return fail("GET /film/leaderboard", `status=${r.status}`);
  ok("GET /film/leaderboard", `${(r.body?.items || r.body || []).length || 0} rows`);

  // 4. transparency
  r = await call("GET", "/api/awards/transparency");
  if (r.status !== 200) return fail("GET /transparency", `status=${r.status}`);
  ok("GET /transparency", "shape ok");

  // 5. OG card returns SVG
  let raw = await rawGet("/api/awards/og.svg");
  if (raw.status !== 200) return fail("GET /og.svg", `status=${raw.status}`);
  if (!(raw.headers.get("content-type") || "").startsWith("image/svg")) {
    return fail("/og.svg content-type", `${raw.headers.get("content-type")}`);
  }
  if (!raw.text.includes("<svg")) return fail("/og.svg payload", "no <svg tag");
  if (!raw.headers.get("etag")) return fail("/og.svg ETag header", "missing");
  ok("GET /og.svg", `etag=${(raw.headers.get("etag") || "").slice(0, 24)}…`);

  // 6. sitemap returns XML
  raw = await rawGet("/api/awards/sitemap.xml");
  if (raw.status !== 200) return fail("GET /sitemap.xml", `status=${raw.status}`);
  if (!(raw.headers.get("content-type") || "").startsWith("application/xml")) {
    return fail("/sitemap.xml content-type", `${raw.headers.get("content-type")}`);
  }
  if (!raw.text.includes("<urlset")) return fail("/sitemap.xml payload", "no <urlset");
  ok("GET /sitemap.xml", `${(raw.text.match(/<url>/g) || []).length} urls`);

  // 7. submit chain — only if an open season exists
  if (!openSeason) {
    skip("submit chain (planet+entry)", "no open AwardSeason in this DB");
  } else {
    // a. register
    r = await call("POST", "/api/auth/register", {
      body: { email: EMAIL, password: PASSWORD, name: "Awards smoke" },
    });
    if ((r.status !== 200 && r.status !== 201) || !r.body?.token) return fail("submit chain · register", `status=${r.status}`);
    const token = r.body.token;
    const auth = { authorization: `Bearer ${token}` };

    // b. submit a planet artifact matching the season's productKey conventions
    const productKey = openSeason.productKey || `awards-${openSeason.type || "music"}-smoke`;
    const fingerprint = crypto.randomBytes(32).toString("hex");
    r = await call("POST", "/api/planet/submissions", {
      headers: auth,
      body: {
        artifactType: openSeason.type === "film" ? "movie" : "music",
        title: `awards-smoke-${Date.now()}`,
        productKey,
        mediaFingerprint: fingerprint,
        mediaDescriptor: { title: "Awards smoke", artist: "Smoke Bot", durationSec: 120 },
      },
    });
    if (r.status !== 201 && r.status !== 200) {
      return fail("submit chain · planet", `status=${r.status} body=${JSON.stringify(r.body)?.slice(0, 200)}`);
    }
    const artifactVersionId = r.body?.artifactVersionId;
    ok("submit chain · planet", `version=${artifactVersionId?.slice(0, 8)}…`);

    // c. submit awards entry
    r = await call("POST", "/api/awards/entries", {
      headers: auth,
      body: { seasonId: openSeason.id, artifactVersionId },
    });
    if (r.status !== 201 && r.status !== 200) {
      return fail("submit chain · entry", `status=${r.status} body=${JSON.stringify(r.body)?.slice(0, 200)}`);
    }
    const entryId = r.body?.id;
    ok("submit chain · entry", `id=${entryId?.slice(0, 8)}…`);

    // d. fetch own entries
    r = await call("GET", "/api/awards/me/entries", { headers: auth });
    if (r.status !== 200) return fail("submit chain · /me/entries", `status=${r.status}`);
    const myEntries = Array.isArray(r.body?.items) ? r.body.items : Array.isArray(r.body) ? r.body : [];
    if (!myEntries.find((e) => e.id === entryId)) {
      return fail("submit chain · /me/entries contains entry", `entry ${entryId} not in own list`);
    }
    ok("submit chain · /me/entries", `${myEntries.length} entries`);
  }

  console.log("");
  console.log(`  total: ${step}, passed: ${step - failed - skipped}, failed: ${failed}, skipped: ${skipped}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(2);
});
