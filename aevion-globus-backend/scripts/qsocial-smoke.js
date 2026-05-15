#!/usr/bin/env node
/**
 * QSocial smoke test — social feed, posts, likes, comments, stats.
 * Usage: BASE=http://localhost:4001 node scripts/qsocial-smoke.js
 *        TEST_JWT=<token> BASE=... node scripts/qsocial-smoke.js
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
  console.log(`\nQSocial smoke → ${BASE}\n`);

  console.log("1. Health");
  const h = await req("GET", "/api/qsocial/health");
  assert("GET /health → 200", h.status === 200);
  assert("ok === true", h.body?.ok === true);
  assert("db reported", ["postgres","in-memory"].includes(h.body?.db));

  console.log("\n2. Public feed");
  const feed = await req("GET", "/api/qsocial/feed");
  assert("GET /feed → 200", feed.status === 200);
  assert("posts array", Array.isArray(feed.body?.posts));

  console.log("\n3. Stats");
  const stats = await req("GET", "/api/qsocial/stats");
  assert("GET /stats → 200", stats.status === 200);
  assert("posts.total is number", typeof stats.body?.posts?.total === "number");
  assert("likes is number", typeof stats.body?.likes === "number");
  assert("comments is number", typeof stats.body?.comments === "number");

  console.log("\n4. Trending tags");
  const tags = await req("GET", "/api/qsocial/trending-tags");
  assert("GET /trending-tags → 200", tags.status === 200);
  assert("tags array", Array.isArray(tags.body?.tags));

  console.log("\n5. Auth gates");
  const noAuthPost = await req("POST", "/api/qsocial/posts", { content: "Test" });
  assert("POST /posts without auth → 401", noAuthPost.status === 401);

  if (JWT) {
    console.log("\n6. Authenticated flow");
    const authH = { Authorization: `Bearer ${JWT}` };

    const create = await req("POST", "/api/qsocial/posts",
      { content: "Smoke test post — safe to delete", isPublic: true, tags: ["smoke","test"] },
      authH);
    assert("POST /posts → 201", create.status === 201);
    const pid = create.body?.post?.id;
    assert("post.id present", !!pid);

    if (pid) {
      const get = await req("GET", `/api/qsocial/posts/${pid}`);
      assert("GET /posts/:id → 200", get.status === 200);

      const like = await req("POST", `/api/qsocial/posts/${pid}/like`, null, authH);
      assert("POST /like → 200", like.status === 200);

      const comment = await req("POST", `/api/qsocial/posts/${pid}/comments`,
        { content: "Smoke test comment" }, authH);
      assert("POST /comments → 201", comment.status === 201);

      const comments = await req("GET", `/api/qsocial/posts/${pid}/comments`);
      assert("GET /comments → 200", comments.status === 200);
      assert("comment count ≥ 1", (comments.body?.comments?.length ?? 0) >= 1);

      // Cleanup
      const del = await req("DELETE", `/api/qsocial/posts/${pid}`, null, authH);
      assert("DELETE /posts/:id → 200", del.status === 200);
    }
  } else {
    console.log("\n6. [Skipping auth flow — no TEST_JWT]");
  }

  console.log(`\nQSocial: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
