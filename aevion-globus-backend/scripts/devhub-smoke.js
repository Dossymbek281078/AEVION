#!/usr/bin/env node
/**
 * DevHub Snippet Shelf smoke test.
 * Tests POST/GET/list/star flow for /api/devhub/snippets.
 *
 * Usage: BASE=http://localhost:4001 node scripts/devhub-smoke.js
 *        BASE=https://aevion-production-a70c.up.railway.app node scripts/devhub-smoke.js
 */
const BASE = (process.env.BASE || "http://127.0.0.1:4001").replace(/\/$/, "");
let passed = 0, failed = 0;

function assert(label, cond, info = "") {
  if (cond) { console.log(`  ✓ ${label}`); passed++; }
  else      { console.error(`  ✗ ${label}${info ? " — " + info : ""}`); failed++; }
}

async function req(method, path, body, headers = {}) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    signal: AbortSignal.timeout(8000),
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${BASE}${path}`, opts);
  const text = await r.text();
  try { return { status: r.status, body: JSON.parse(text) }; }
  catch { return { status: r.status, body: text }; }
}

async function run() {
  console.log(`\nDevHub Snippet Shelf smoke → ${BASE}\n`);

  console.log("1. Health");
  const health = await req("GET", "/health");
  assert("GET /health → 200", health.status === 200, String(health.status));

  console.log("\n2. Create snippet");
  const uniqueTag = `smoke-${Date.now()}`;
  const created = await req("POST", "/api/devhub/snippets", {
    title: "Smoke snippet",
    content: "console.log('hello from smoke test');",
    language: "javascript",
    tags: [uniqueTag, "smoke"],
  });
  assert("POST /snippets → 201", created.status === 201, String(created.status));
  const snippet = created.body?.snippet;
  assert("response has snippet.id", !!snippet?.id, JSON.stringify(created.body).slice(0, 200));
  assert("snippet.title matches", snippet?.title === "Smoke snippet");
  assert("snippet.language matches", snippet?.language === "javascript");
  assert("snippet.stars === 0", snippet?.stars === 0);
  assert("snippet.tags has uniqueTag", Array.isArray(snippet?.tags) && snippet.tags.includes(uniqueTag));

  const snippetId = snippet?.id;
  if (!snippetId) {
    console.log(`\nDevHub: ${passed} passed, ${failed} failed`);
    process.exit(1);
  }

  console.log("\n3. Get single snippet");
  const fetched = await req("GET", `/api/devhub/snippets/${snippetId}`);
  assert("GET /snippets/:id → 200", fetched.status === 200, String(fetched.status));
  assert("fetched.title matches", fetched.body?.snippet?.title === "Smoke snippet");
  assert("fetched.content matches", fetched.body?.snippet?.content?.includes("hello from smoke test"));

  console.log("\n4. List filtered by tag");
  const listByTag = await req("GET", `/api/devhub/snippets?tag=${encodeURIComponent(uniqueTag)}&limit=10`);
  assert("GET /snippets?tag=… → 200", listByTag.status === 200, String(listByTag.status));
  const arr = listByTag.body?.snippets;
  assert("snippets is array", Array.isArray(arr));
  assert("filter returns our snippet", Array.isArray(arr) && arr.some((s) => s.id === snippetId));

  console.log("\n5. List with limit");
  const listLim = await req("GET", "/api/devhub/snippets?limit=5");
  assert("GET /snippets?limit=5 → 200", listLim.status === 200, String(listLim.status));
  const arrLim = listLim.body?.snippets;
  assert("snippets ≤ 5", Array.isArray(arrLim) && arrLim.length <= 5);

  console.log("\n6. Star snippet");
  const starred = await req("POST", `/api/devhub/snippets/${snippetId}/star`);
  assert("POST /:id/star → 200", starred.status === 200, String(starred.status));
  assert("response.ok === true", starred.body?.ok === true);
  assert("response.stars === 1", starred.body?.stars === 1, `got ${starred.body?.stars}`);

  console.log("\n7. Star again — stars should be 2");
  const starredAgain = await req("POST", `/api/devhub/snippets/${snippetId}/star`);
  assert("POST /:id/star → 200 (second)", starredAgain.status === 200);
  assert("response.stars === 2", starredAgain.body?.stars === 2, `got ${starredAgain.body?.stars}`);

  console.log("\n8. Get missing snippet → 404");
  const notFound = await req("GET", "/api/devhub/snippets/nonexistent-id-xyz-123");
  assert("GET missing → 404", notFound.status === 404, String(notFound.status));

  console.log("\n9. Validation — POST without title → 400");
  const bad = await req("POST", "/api/devhub/snippets", { content: "no title" });
  assert("POST /snippets without title → 400", bad.status === 400, String(bad.status));

  console.log(`\nDevHub Snippet Shelf: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
