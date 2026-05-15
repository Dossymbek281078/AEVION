#!/usr/bin/env node
/**
 * QNews smoke test — public endpoints + auth gates.
 * Usage: BASE=http://localhost:4001 node scripts/qnews-smoke.js
 *        TEST_JWT=<token> BASE=... node scripts/qnews-smoke.js
 */
const BASE = (process.env.BASE || "http://127.0.0.1:4001").replace(/\/$/, "");
const JWT  = process.env.TEST_JWT || "";

let passed = 0, failed = 0;

function assert(label, cond, info = "") {
  if (cond) { console.log(`  ✓ ${label}`); passed++; }
  else       { console.error(`  ✗ ${label}${info ? " — " + info : ""}`); failed++; }
}

async function req(method, path, body, headers = {}) {
  const opts = { method, headers: { "Content-Type": "application/json", ...headers } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${BASE}${path}`, opts);
  const text = await r.text();
  try { return { status: r.status, body: JSON.parse(text) }; }
  catch { return { status: r.status, body: text }; }
}

async function run() {
  console.log(`\nQNews smoke → ${BASE}\n`);

  console.log("1. Health");
  const h = await req("GET", "/api/qnews/health");
  assert("GET /health → 200", h.status === 200, String(h.status));
  assert("ok === true", h.body?.ok === true);

  console.log("\n2. Categories");
  const cats = await req("GET", "/api/qnews/categories");
  assert("GET /categories → 200", cats.status === 200);
  assert("categories array present", Array.isArray(cats.body?.categories));

  console.log("\n3. Articles list");
  const list = await req("GET", "/api/qnews/articles");
  assert("GET /articles → 200", list.status === 200);
  assert("articles array present", Array.isArray(list.body?.articles));
  assert("total field present", typeof list.body?.total === "number");

  console.log("\n4. Trending");
  const trend = await req("GET", "/api/qnews/trending");
  assert("GET /trending → 200", trend.status === 200);
  assert("articles array in trending", Array.isArray(trend.body?.articles));

  console.log("\n5. Stats");
  const stats = await req("GET", "/api/qnews/stats");
  assert("GET /stats → 200", stats.status === 200);
  assert("total is number", typeof stats.body?.total === "number");
  assert("byCategory object", typeof stats.body?.byCategory === "object");

  console.log("\n6. RSS feed");
  const rss = await req("GET", "/api/qnews/rss");
  assert("GET /rss → 200", rss.status === 200);

  console.log("\n7. Auth gates");
  const noAuth = await req("POST", "/api/qnews/articles", { title: "T", summary: "S", url: "https://x.com", source: "x" });
  assert("POST /articles without auth → 401", noAuth.status === 401);
  const noAuthBm = await req("POST", "/api/qnews/articles/x/bookmark");
  assert("POST /bookmark without auth → 401", noAuthBm.status === 401);

  if (JWT) {
    console.log("\n8. Authenticated flow");
    const authH = { Authorization: `Bearer ${JWT}` };
    const create = await req("POST", "/api/qnews/articles",
      { title: "Smoke Test Article", summary: "Test summary", url: "https://aevion.app/smoke-test", source: "smoke", category: "technology", tags: ["test"] },
      authH);
    assert("POST /articles → 201", create.status === 201);
    const aid = create.body?.article?.id;
    if (aid) {
      const get = await req("GET", `/api/qnews/articles/${aid}`);
      assert("GET /articles/:id → 200", get.status === 200);
      const bm = await req("POST", `/api/qnews/articles/${aid}/bookmark`, null, authH);
      assert("POST /bookmark → 200", bm.status === 200);
      const bookmarks = await req("GET", "/api/qnews/me/bookmarks", null, authH);
      assert("GET /me/bookmarks → 200", bookmarks.status === 200);
    }
  } else {
    console.log("\n8. [Skipping auth flow — no TEST_JWT]");
  }

  console.log(`\nQNews: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
