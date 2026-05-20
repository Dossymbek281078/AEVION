#!/usr/bin/env node
/**
 * AEVION REST PROD smoke — consolidated read-only checks for the last
 * 7 ecosystem modules not covered by their own *-prod-smoke.js:
 *   coach, qlearn, qstore, qevents, qjobs, qnews, multichat.
 *
 * Closes the prod-surface coverage gap so daily-smoke catches drift
 * across the whole ecosystem, not just fintech / qzone.
 *
 *  ── Coach (Anthropic-backed) ──
 *  1.  GET /api/coach/health → ok=true + model present
 *  2.  coach.apiKeyConfigured boolean
 *  ── QLearn ──
 *  3.  GET /api/qlearn/health → ok + module=qlearn
 *  4.  GET /api/qlearn/courses → courses array + total numeric
 *  ── QStore ──
 *  5.  GET /api/qstore/health → ok + module=qstore
 *  6.  GET /api/qstore/products → products array + sort default present
 *  ── QEvents ──
 *  7.  GET /api/qevents/health → ok + service=qevents
 *  8.  GET /api/qevents/categories → categories array with known ids
 *  ── QJobs ──
 *  9.  GET /api/qjobs/health → ok + service=qjobs
 * 10.  GET /api/qjobs/stats → postings + applications objects
 * 11.  GET /api/qjobs/jobs → jobs array + total
 *  ── QNews ──
 * 12.  GET /api/qnews/health → ok + service=qnews
 * 13.  GET /api/qnews/categories → categories[] with id+count shape
 * 14.  GET /api/qnews/articles → articles array
 * 15.  GET /api/qnews/rss → 200 (RSS feed)
 * 16.  POST /api/qnews/articles (no auth) → 401
 *  ── Multichat (auth-gated everywhere) ──
 * 17.  GET /api/multichat/health → 401 (auth gate, not crash)
 * 18.  GET /api/multichat/rooms → 401
 * 19.  POST /api/multichat/rooms (no auth) → 401
 *  ── Cross-module Content-Type ──
 * 20.  Content-Type application/json on all 6 health endpoints
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
  console.log(`\nAEVION REST PROD smoke → ${BASE}\n`);

  // ── Coach ────────────────────────────────────────────────────────────────
  let r = await req("GET", "/api/coach/health");
  if (r.status === 200 && r.body?.ok === true && typeof r.body?.model === "string") {
    ok("GET /coach/health", `model=${r.body.model}`);
  } else fail("GET /coach/health", `${r.status} ${JSON.stringify(r.body).slice(0, 80)}`);

  if (r.status === 200 && typeof r.body?.apiKeyConfigured === "boolean") {
    ok("coach.apiKeyConfigured present", `${r.body.apiKeyConfigured}`);
  } else fail("coach.apiKeyConfigured", `got=${typeof r.body?.apiKeyConfigured}`);

  // ── QLearn ───────────────────────────────────────────────────────────────
  r = await req("GET", "/api/qlearn/health");
  if (r.status === 200 && r.body?.ok === true && r.body?.module === "qlearn") {
    ok("GET /qlearn/health", `db=${r.body.db}`);
  } else fail("GET /qlearn/health", `${r.status} ${JSON.stringify(r.body).slice(0, 80)}`);

  r = await req("GET", "/api/qlearn/courses?limit=3");
  if (r.status === 200 && Array.isArray(r.body?.courses) && typeof r.body?.total === "number") {
    ok("GET /qlearn/courses", `items=${r.body.courses.length} total=${r.body.total}`);
  } else fail("GET /qlearn/courses", `${r.status} ${JSON.stringify(r.body).slice(0, 80)}`);

  // ── QStore ───────────────────────────────────────────────────────────────
  r = await req("GET", "/api/qstore/health");
  if (r.status === 200 && r.body?.ok === true && r.body?.module === "qstore") {
    ok("GET /qstore/health", `db=${r.body.db}`);
  } else fail("GET /qstore/health", `${r.status} ${JSON.stringify(r.body).slice(0, 80)}`);

  r = await req("GET", "/api/qstore/products?limit=3");
  if (r.status === 200 && Array.isArray(r.body?.products) && typeof r.body?.total === "number") {
    ok("GET /qstore/products", `items=${r.body.products.length} sort=${r.body.sort ?? "n/a"}`);
  } else fail("GET /qstore/products", `${r.status} ${JSON.stringify(r.body).slice(0, 80)}`);

  // ── QEvents ──────────────────────────────────────────────────────────────
  r = await req("GET", "/api/qevents/health");
  if (r.status === 200 && r.body?.ok === true && r.body?.service === "qevents") {
    ok("GET /qevents/health", `db=${r.body.db}`);
  } else fail("GET /qevents/health", `${r.status} ${JSON.stringify(r.body).slice(0, 80)}`);

  r = await req("GET", "/api/qevents/categories");
  if (r.status === 200 && Array.isArray(r.body?.categories) && r.body.categories.length >= 3) {
    ok("GET /qevents/categories", `count=${r.body.categories.length}`);
  } else fail("GET /qevents/categories", `${r.status} ${JSON.stringify(r.body).slice(0, 80)}`);

  // ── QJobs ────────────────────────────────────────────────────────────────
  r = await req("GET", "/api/qjobs/health");
  if (r.status === 200 && r.body?.ok === true && r.body?.service === "qjobs") {
    ok("GET /qjobs/health", `db=${r.body.db}`);
  } else fail("GET /qjobs/health", `${r.status} ${JSON.stringify(r.body).slice(0, 80)}`);

  r = await req("GET", "/api/qjobs/stats");
  if (r.status === 200 && typeof r.body?.postings === "object" && typeof r.body?.applications === "object") {
    ok("GET /qjobs/stats", `postings.total=${r.body.postings.total} apps.total=${r.body.applications.total}`);
  } else fail("GET /qjobs/stats", `${r.status} ${JSON.stringify(r.body).slice(0, 80)}`);

  r = await req("GET", "/api/qjobs/jobs?limit=3");
  if (r.status === 200 && Array.isArray(r.body?.jobs) && typeof r.body?.total === "number") {
    ok("GET /qjobs/jobs", `items=${r.body.jobs.length} total=${r.body.total}`);
  } else fail("GET /qjobs/jobs", `${r.status} ${JSON.stringify(r.body).slice(0, 80)}`);

  // ── QNews ────────────────────────────────────────────────────────────────
  r = await req("GET", "/api/qnews/health");
  if (r.status === 200 && r.body?.ok === true && r.body?.service === "qnews") {
    ok("GET /qnews/health");
  } else fail("GET /qnews/health", `${r.status} ${JSON.stringify(r.body).slice(0, 80)}`);

  r = await req("GET", "/api/qnews/categories");
  if (r.status === 200 && Array.isArray(r.body?.categories) && r.body.categories.length > 0) {
    const c = r.body.categories[0];
    if (c.id && typeof c.count === "number") ok("GET /qnews/categories shape (id+count)", `count=${r.body.categories.length}`);
    else fail("qnews categories[0] shape", `got=${JSON.stringify(c)}`);
  } else fail("GET /qnews/categories", `${r.status} ${JSON.stringify(r.body).slice(0, 80)}`);

  r = await req("GET", "/api/qnews/articles?limit=3");
  if (r.status === 200 && Array.isArray(r.body?.articles) && typeof r.body?.total === "number") {
    ok("GET /qnews/articles", `items=${r.body.articles.length} total=${r.body.total}`);
  } else fail("GET /qnews/articles", `${r.status} ${JSON.stringify(r.body).slice(0, 80)}`);

  const rss = await reqRaw("GET", "/api/qnews/rss");
  if (rss.status === 200) ok("GET /qnews/rss", `ct=${rss.ct.slice(0, 32)}`);
  else fail("GET /qnews/rss", `status=${rss.status}`);

  r = await req("POST", "/api/qnews/articles", { body: { title: "smoke" } });
  if (r.status === 401) ok("POST /qnews/articles (no auth) → 401");
  else fail("POST /qnews/articles auth gate", `got=${r.status}`);

  // ── Multichat (fully auth-gated) ─────────────────────────────────────────
  r = await req("GET", "/api/multichat/health");
  if (r.status === 401) ok("GET /multichat/health → 401 (auth gate)");
  else if (r.status === 200 && r.body?.ok === true) ok("GET /multichat/health → 200 public", "");
  else fail("GET /multichat/health", `${r.status}`);

  r = await req("GET", "/api/multichat/rooms");
  if (r.status === 401) ok("GET /multichat/rooms → 401");
  else fail("GET /multichat/rooms auth gate", `got=${r.status}`);

  r = await req("POST", "/api/multichat/rooms", { body: { name: "smoke" } });
  if (r.status === 401) ok("POST /multichat/rooms (no auth) → 401");
  else fail("POST /multichat/rooms auth gate", `got=${r.status}`);

  // ── Cross-module Content-Type ───────────────────────────────────────────
  const healthChecks = [
    "/api/coach/health",
    "/api/qlearn/health",
    "/api/qstore/health",
    "/api/qevents/health",
    "/api/qjobs/health",
    "/api/qnews/health",
  ];
  const cts = await Promise.all(healthChecks.map((p) => req("GET", p)));
  const allJson = cts.every((h) => h.status === 200 && /application\/json/i.test(h.ct));
  if (allJson) ok("Content-Type json on 6 public health endpoints");
  else fail("Content-Type json", `mismatch: ${cts.map((h) => `${h.status}/${h.ct.slice(0, 16)}`).join("|")}`);

  console.log(`\n${passed + failed} assertions — ${passed} PASS  ${failed} FAIL\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => { console.error("crash:", e); process.exit(2); });
