#!/usr/bin/env node
/**
 * Planet Compliance PROD smoke — read-only checks for the central
 * compliance layer (proofs, certificates, votes, activity feed).
 *
 * Planet is the cross-cutting compliance surface: every other module's
 * QRight objects + QSign signatures eventually flow into Planet
 * submissions → artifact versions → certificates. A regression here
 * silently breaks the trust chain for the whole ecosystem.
 *
 *  1.  GET /api/planet/health → status=ok + service=planet
 *  2.  health has ISO timestamp
 *  3.  GET /api/planet/stats → eligibleParticipants numeric
 *  4.  stats.submissions numeric ≥ 0
 *  5.  stats.artifactVersions numeric ≥ 0
 *  6.  stats.certifiedArtifactVersions ≤ artifactVersions (logical)
 *  7.  stats.definitions object present (transparency docs)
 *  8.  GET /api/planet/artifacts/recent → items array
 *  9.  artifacts.items[0] shape (if non-empty)
 * 10.  GET /api/planet/activity → items array with kind+at+id
 * 11.  activity.items[0].at is ISO timestamp parseable as Date
 * 12.  GET /api/planet/transparency → 200 (public, rate-limited)
 * 13.  POST /api/planet/submissions (no auth) → 401 auth gate
 * 14.  GET /api/planet/admin/whoami (no auth) → 401 auth gate
 * 15.  Content-Type application/json on /planet/health
 */

const BASE = (process.env.BASE || process.env.BACKEND_URL || "https://aevion-production-a70c.up.railway.app").replace(/\/+$/, "");

let passed = 0; let failed = 0;
function ok(l, e) { passed++; console.log(`  ✓ ${l}${e ? "  " + e : ""}`); }
function fail(l, r) { failed++; console.error(`  ✗ ${l}${r ? "  ↳ " + r : ""}`); }

async function req(method, path, opts = {}) {
  try {
    const headers = { "Accept": "application/json", ...(opts.headers || {}) };
    const init = { method, headers };
    if (opts.body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(opts.body);
    }
    const r = await fetch(`${BASE}${path}`, init);
    const ct = r.headers.get("content-type") || "";
    let json; try { json = await r.json(); } catch { json = {}; }
    return { status: r.status, body: json, ct };
  } catch (e) { return { status: 0, body: {}, ct: "", error: e?.message }; }
}

async function reqRaw(method, path) {
  try {
    const r = await fetch(`${BASE}${path}`, { method, headers: { "Accept": "*/*" } });
    return { status: r.status, ct: r.headers.get("content-type") || "" };
  } catch (e) { return { status: 0, ct: "", error: e?.message }; }
}

async function run() {
  console.log(`\nPlanet PROD smoke → ${BASE}\n`);

  // 1. Health
  let r = await req("GET", "/api/planet/health");
  let health = null;
  if (r.status === 200 && r.body?.status === "ok" && r.body?.service === "planet") {
    health = r.body;
    ok("GET /planet/health", `service=${health.service}`);
  } else fail("GET /planet/health", `${r.status} ${JSON.stringify(r.body).slice(0, 80)}`);

  // 2. health.timestamp ISO
  if (health) {
    if (typeof health.timestamp === "string" && !isNaN(Date.parse(health.timestamp))) {
      ok("health.timestamp ISO", health.timestamp.slice(0, 16));
    } else fail("health.timestamp ISO", `got=${health.timestamp}`);
  }

  // 3. Stats
  r = await req("GET", "/api/planet/stats");
  let stats = null;
  if (r.status === 200 && typeof r.body?.eligibleParticipants === "number") {
    stats = r.body;
    ok("GET /planet/stats", `eligible=${stats.eligibleParticipants}`);
  } else fail("GET /planet/stats", `${r.status} ${JSON.stringify(r.body).slice(0, 80)}`);

  // 4. submissions numeric
  if (stats) {
    if (typeof stats.submissions === "number" && stats.submissions >= 0) {
      ok("stats.submissions numeric ≥ 0", `${stats.submissions}`);
    } else fail("stats.submissions", `got=${stats.submissions}`);
  }

  // 5. artifactVersions numeric
  if (stats) {
    if (typeof stats.artifactVersions === "number" && stats.artifactVersions >= 0) {
      ok("stats.artifactVersions numeric ≥ 0", `${stats.artifactVersions}`);
    } else fail("stats.artifactVersions", `got=${stats.artifactVersions}`);
  }

  // 6. certified ≤ total (invariant)
  if (stats) {
    if (typeof stats.certifiedArtifactVersions === "number" && stats.certifiedArtifactVersions <= stats.artifactVersions) {
      ok("stats: certified ≤ artifactVersions", `${stats.certifiedArtifactVersions}/${stats.artifactVersions}`);
    } else fail("stats: certified ≤ artifactVersions", `cert=${stats.certifiedArtifactVersions} total=${stats.artifactVersions}`);
  }

  // 7. definitions object (transparency)
  if (stats) {
    if (typeof stats.definitions === "object" && stats.definitions && Object.keys(stats.definitions).length >= 3) {
      ok("stats.definitions present", `${Object.keys(stats.definitions).length} keys`);
    } else fail("stats.definitions", `keys=${Object.keys(stats.definitions || {}).length}`);
  }

  // 8. Recent artifacts
  r = await req("GET", "/api/planet/artifacts/recent");
  let artifacts = null;
  if (r.status === 200 && Array.isArray(r.body?.items)) {
    artifacts = r.body.items;
    ok("GET /planet/artifacts/recent", `count=${artifacts.length}`);
  } else fail("GET /planet/artifacts/recent", `${r.status} ${JSON.stringify(r.body).slice(0, 80)}`);

  // 9. Artifacts item shape (if any)
  if (artifacts) {
    if (artifacts.length === 0) {
      ok("artifacts list empty — OK", "no records yet");
    } else {
      const a = artifacts[0];
      const hasTitle = a.title !== undefined || a.submissionTitle !== undefined;
      const hasTime = a.createdAt || a.at;
      if (a.id && hasTitle && hasTime) {
        ok("artifacts[0] shape", `id=${String(a.id).slice(0, 8)} type=${a.artifactType}`);
      } else fail("artifacts[0] shape", `keys=${Object.keys(a).join(",")}`);
    }
  }

  // 10. Activity feed
  r = await req("GET", "/api/planet/activity?limit=5");
  let activity = null;
  if (r.status === 200 && Array.isArray(r.body?.items)) {
    activity = r.body.items;
    ok("GET /planet/activity", `count=${activity.length}`);
  } else fail("GET /planet/activity", `${r.status} ${JSON.stringify(r.body).slice(0, 80)}`);

  // 11. Activity timestamp parseable
  if (activity && activity.length > 0) {
    const e = activity[0];
    if (e.kind && e.at && !isNaN(Date.parse(e.at)) && e.id) {
      ok("activity[0] shape (kind+at ISO+id)", `${e.kind} ${e.at.slice(0, 16)}`);
    } else fail("activity[0] shape", `kind=${e.kind} at=${e.at} id=${e.id}`);
  } else if (activity && activity.length === 0) {
    ok("activity list empty — OK", "no records yet");
  }

  // 12. Transparency page (public, may return HTML or JSON)
  const tr = await reqRaw("GET", "/api/planet/transparency");
  if (tr.status === 200) {
    ok("GET /planet/transparency", `ct=${tr.ct.slice(0, 32)}`);
  } else fail("GET /planet/transparency", `${tr.status}`);

  // 13. Submissions POST no auth → 401
  r = await req("POST", "/api/planet/submissions", { body: { title: "smoke" } });
  if (r.status === 401) ok("POST /planet/submissions (no auth) → 401");
  else fail("POST /planet/submissions auth gate", `got=${r.status}`);

  // 14. Admin whoami no auth → 401
  r = await req("GET", "/api/planet/admin/whoami");
  if (r.status === 401 || r.status === 403) {
    ok("GET /planet/admin/whoami (no auth) → 401/403", `status=${r.status}`);
  } else fail("GET /planet/admin/whoami auth gate", `got=${r.status}`);

  // 15. Content-Type
  r = await req("GET", "/api/planet/health");
  if (r.status === 200 && /application\/json/i.test(r.ct || "")) {
    ok("Content-Type application/json on /planet/health", r.ct);
  } else fail("Content-Type /planet/health", `ct='${r.ct}'`);

  console.log(`\n${passed + failed} assertions — ${passed} PASS  ${failed} FAIL\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => { console.error("crash:", e); process.exit(2); });
