#!/usr/bin/env node
/**
 * QLearn smoke test — course platform.
 * Usage: BASE=http://localhost:4001 node scripts/qlearn-smoke.js
 *        TEST_JWT=<token> BASE=... node scripts/qlearn-smoke.js
 */
const BASE = (process.env.BASE || "http://127.0.0.1:4001").replace(/\/$/, "");
const JWT  = process.env.TEST_JWT || "";
let passed = 0, failed = 0;

function assert(label, cond, info = "") {
  if (cond) { console.log(`  ✓ ${label}`); passed++; }
  else       { console.error(`  ✗ ${label}${info ? " — " + info : ""}`); failed++; }
}

async function req(method, path, body, headers = {}) {
  const opts = { method, headers: { "Content-Type": "application/json", ...headers }, signal: AbortSignal.timeout(8000) };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${BASE}${path}`, opts);
  const text = await r.text();
  try { return { status: r.status, body: JSON.parse(text) }; }
  catch { return { status: r.status, body: text }; }
}

async function run() {
  console.log(`\nQLearn smoke → ${BASE}\n`);

  console.log("1. Health");
  const h = await req("GET", "/api/qlearn/health");
  assert("GET /health → 200", h.status === 200, String(h.status));
  assert("ok === true", h.body?.ok === true);

  console.log("\n2. Categories");
  const cats = await req("GET", "/api/qlearn/categories");
  assert("GET /categories → 200", cats.status === 200);
  assert("categories array", Array.isArray(cats.body?.categories));

  console.log("\n3. Courses list");
  const courses = await req("GET", "/api/qlearn/courses");
  assert("GET /courses → 200", courses.status === 200, String(courses.status));
  assert("courses array", Array.isArray(courses.body?.courses));
  assert("total field", typeof courses.body?.total === "number");

  console.log("\n4. Courses with filter");
  const filtered = await req("GET", "/api/qlearn/courses?limit=5");
  assert("GET /courses?limit=5 → 200", filtered.status === 200);
  assert("max 5 returned", (filtered.body?.courses?.length ?? 0) <= 5);

  console.log("\n5. Auth gates");
  const noAuth = await req("POST", "/api/qlearn/me/courses", { title: "Test", description: "Test" });
  assert("POST /me/courses without auth → 401", noAuth.status === 401, String(noAuth.status));
  const noAuthEnroll = await req("POST", "/api/qlearn/courses/fake_id/enroll");
  assert("POST /enroll without auth → 401", noAuthEnroll.status === 401, String(noAuthEnroll.status));
  const noAuthBookmark = await req("POST", "/api/qlearn/courses/fake_id/bookmark");
  assert("POST /bookmark without auth → 401", noAuthBookmark.status === 401, String(noAuthBookmark.status));
  const noAuthBookmarkDel = await req("DELETE", "/api/qlearn/courses/fake_id/bookmark");
  assert("DELETE /bookmark without auth → 401", noAuthBookmarkDel.status === 401, String(noAuthBookmarkDel.status));
  const noAuthBookmarks = await req("GET", "/api/qlearn/me/bookmarks");
  assert("GET /me/bookmarks without auth → 401", noAuthBookmarks.status === 401, String(noAuthBookmarks.status));
  const noAuthStreak = await req("GET", "/api/qlearn/me/streak");
  assert("GET /me/streak without auth → 401", noAuthStreak.status === 401, String(noAuthStreak.status));
  const noAuthProgress = await req("GET", "/api/qlearn/me/progress");
  assert("GET /me/progress without auth → 401", noAuthProgress.status === 401, String(noAuthProgress.status));

  if (JWT) {
    console.log("\n6. Authenticated flow");
    const authH = { Authorization: `Bearer ${JWT}` };
    const enrollments = await req("GET", "/api/qlearn/me/enrollments", null, authH);
    assert("GET /me/enrollments → 200", enrollments.status === 200);
    assert("enrollments array", Array.isArray(enrollments.body?.enrollments ?? enrollments.body));

    const streak = await req("GET", "/api/qlearn/me/streak", null, authH);
    assert("GET /me/streak → 200", streak.status === 200);
    assert("streak current is number", typeof streak.body?.current === "number");
    assert("streak longest is number", typeof streak.body?.longest === "number");

    const progress = await req("GET", "/api/qlearn/me/progress", null, authH);
    assert("GET /me/progress → 200", progress.status === 200);
    assert("progress.summary present", progress.body?.summary && typeof progress.body.summary.total === "number");
    assert("continueLearning array", Array.isArray(progress.body?.continueLearning));

    const bookmarks = await req("GET", "/api/qlearn/me/bookmarks", null, authH);
    assert("GET /me/bookmarks → 200", bookmarks.status === 200);
    assert("bookmarks array", Array.isArray(bookmarks.body?.bookmarks));
  } else {
    console.log("\n6. [Skipping auth flow — no TEST_JWT]");
  }

  console.log(`\nQLearn: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
