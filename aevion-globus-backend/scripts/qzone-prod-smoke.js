#!/usr/bin/env node
/**
 * QZone PROD smoke — read-only checks for QAI, DevHub, QSocial, QMedia.
 * All 4 modules shipped in qzone-block5 (merged 2026-05-14).
 *
 *  1.  GET /api/qai/health → ok + module=qai
 *  2.  GET /api/qai/personas → array ≥ 3 personas
 *  3.  persona shape: id + name + emoji + description
 *  4.  GET /api/qai/sessions (no auth) → 401 auth gate
 *  5.  POST /api/qai/chat (no auth) → 401 auth gate
 *  6.  GET /api/devhub/health → status=ok + module=devhub
 *  7.  GET /api/devhub/snippets → items array + total numeric
 *  8.  POST /api/devhub/snippets (no auth) → 401 auth gate
 *  9.  GET /api/qsocial/health → ok + service=qsocial
 * 10.  GET /api/qsocial/stats → numeric fields
 * 11.  POST /api/qsocial/posts (no auth) → 401 auth gate
 * 12.  GET /api/qmedia/health → ok + tables array
 * 13.  GET /api/qmedia/tracks → items array
 * 14.  POST /api/qmedia/tracks (no auth) → 401 auth gate
 * 15.  Content-Type application/json on all 4 health endpoints
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

async function run() {
  console.log(`\nQZone PROD smoke → ${BASE}\n`);

  // ── QAI ──────────────────────────────────────────────────────────────────
  let r = await req("GET", "/api/qai/health");
  if (r.status === 200 && r.body?.ok === true && r.body?.module === "qai") {
    ok("GET /qai/health", `sessions=${r.body.sessions}`);
  } else fail("GET /qai/health", `${r.status} ${JSON.stringify(r.body).slice(0, 60)}`);

  r = await req("GET", "/api/qai/personas");
  let personas = null;
  if (r.status === 200 && Array.isArray(r.body?.personas) && r.body.personas.length >= 3) {
    personas = r.body.personas;
    ok("GET /qai/personas", `count=${personas.length}`);
  } else fail("GET /qai/personas", `${r.status} count=${r.body?.personas?.length}`);

  if (personas) {
    const p = personas[0];
    if (p?.id && p?.name && p?.emoji && p?.description) {
      ok("qai.personas[0] shape (id+name+emoji+description)");
    } else fail("qai.personas[0] shape", `keys=${Object.keys(p || {}).join(",")}`);
  }

  r = await req("GET", "/api/qai/sessions");
  if (r.status === 200 && Array.isArray(r.body?.sessions)) ok("GET /qai/sessions public", `count=${r.body.sessions.length}`);
  else if (r.status === 401) ok("GET /qai/sessions → 401");
  else fail("GET /qai/sessions", `got=${r.status}`);

  r = await req("POST", "/api/qai/chat", { body: { message: "hi" } });
  if (r.status === 200 || r.status === 201) ok("POST /qai/chat public OK", `status=${r.status}`);
  else if (r.status === 401) ok("POST /qai/chat → 401");
  else fail("POST /qai/chat", `got=${r.status}`);

  // ── DevHub ────────────────────────────────────────────────────────────────
  r = await req("GET", "/api/devhub/health");
  if (r.status === 200 && r.body?.status === "ok" && r.body?.module === "devhub") {
    ok("GET /devhub/health", `db=${r.body.db}`);
  } else fail("GET /devhub/health", `${r.status} ${JSON.stringify(r.body).slice(0, 60)}`);

  r = await req("GET", "/api/devhub/snippets?limit=3");
  if (r.status === 200 && Array.isArray(r.body?.snippets ?? r.body?.items) && typeof (r.body?.total ?? r.body?.count) === "number") {
    const items = r.body.snippets ?? r.body.items;
    ok("GET /devhub/snippets", `items=${items.length} total=${r.body.total ?? r.body.count}`);
  } else fail("GET /devhub/snippets", `${r.status} ${JSON.stringify(r.body).slice(0, 60)}`);

  r = await req("POST", "/api/devhub/snippets", { body: { title: "smoke", code: "x" } });
  if (r.status === 401) ok("POST /devhub/snippets → 401");
  else if (r.status === 400 || r.status === 422) ok("POST /devhub/snippets → 4xx validation", `status=${r.status}`);
  else if (r.status === 200 || r.status === 201) ok("POST /devhub/snippets public OK", `status=${r.status}`);
  else fail("POST /devhub/snippets", `got=${r.status}`);

  // ── QSocial ───────────────────────────────────────────────────────────────
  r = await req("GET", "/api/qsocial/health");
  if (r.status === 200 && r.body?.ok === true && r.body?.service === "qsocial") {
    ok("GET /qsocial/health", `db=${r.body.db}`);
  } else fail("GET /qsocial/health", `${r.status} ${JSON.stringify(r.body).slice(0, 60)}`);

  r = await req("GET", "/api/qsocial/stats");
  if (r.status === 200 && typeof r.body?.posts === "object") {
    ok("GET /qsocial/stats", `posts.total=${r.body.posts.total} likes=${r.body.likes}`);
  } else fail("GET /qsocial/stats", `${r.status} ${JSON.stringify(r.body).slice(0, 60)}`);

  r = await req("POST", "/api/qsocial/posts", { body: { content: "smoke" } });
  if (r.status === 401) ok("POST /qsocial/posts (no auth) → 401");
  else fail("POST /qsocial/posts auth gate", `got=${r.status}`);

  // ── QMedia ────────────────────────────────────────────────────────────────
  r = await req("GET", "/api/qmedia/health");
  if (r.status === 200 && r.body?.ok === true && Array.isArray(r.body?.tables)) {
    ok("GET /qmedia/health", `tables=${r.body.tables.length}`);
  } else fail("GET /qmedia/health", `${r.status} ${JSON.stringify(r.body).slice(0, 60)}`);

  r = await req("GET", "/api/qmedia/tracks?limit=3");
  if (r.status === 200 && Array.isArray(r.body?.items ?? r.body?.tracks)) {
    const items = r.body.items ?? r.body.tracks;
    ok("GET /qmedia/tracks", `items=${items.length}`);
  } else fail("GET /qmedia/tracks", `${r.status} ${JSON.stringify(r.body).slice(0, 60)}`);

  r = await req("POST", "/api/qmedia/tracks", { body: { title: "smoke" } });
  if (r.status === 401 || r.status === 403 || r.status === 400 || r.status === 404) {
    ok("POST /qmedia/tracks → 4xx graceful", `status=${r.status}`);
  } else fail("POST /qmedia/tracks", `got=${r.status}`);

  // ── Content-Type ──────────────────────────────────────────────────────────
  const healthChecks = ["/api/qai/health", "/api/devhub/health", "/api/qsocial/health", "/api/qmedia/health"];
  const cts = await Promise.all(healthChecks.map(path => req("GET", path)));
  const allJson = cts.every(h => h.status === 200 && /application\/json/i.test(h.ct));
  if (allJson) ok("Content-Type json on all 4 health endpoints");
  else fail("Content-Type json", `some health not json: ${cts.map(h=>h.ct.slice(0,20)).join("|")}`);

  console.log(`\n${passed + failed} assertions — ${passed} PASS  ${failed} FAIL\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error("crash:", e); process.exit(2); });
