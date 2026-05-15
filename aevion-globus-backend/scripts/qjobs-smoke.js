#!/usr/bin/env node
/**
 * QJobs smoke test — runs against a live backend.
 * Usage: BASE=http://localhost:4001 node scripts/qjobs-smoke.js
 *        TEST_JWT=<token> BASE=... node scripts/qjobs-smoke.js
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
  console.log(`\nQJobs smoke → ${BASE}\n`);

  // 1. Health
  console.log("1. Health");
  const health = await req("GET", "/api/qjobs/health");
  assert("GET /health → 200", health.status === 200, String(health.status));
  assert("health.ok === true", health.body?.ok === true);
  assert("health.db is set", ["postgres", "in-memory"].includes(health.body?.db), health.body?.db);

  // 2. Job types
  console.log("\n2. Job types");
  const types = await req("GET", "/api/qjobs/types");
  assert("GET /types → 200", types.status === 200);
  assert("types array present", Array.isArray(types.body?.types));
  assert("full-time in types", types.body?.types?.includes?.("full-time"));

  // 3. List jobs (public, no auth)
  console.log("\n3. List jobs");
  const list = await req("GET", "/api/qjobs/jobs");
  assert("GET /jobs → 200", list.status === 200);
  assert("jobs array present", Array.isArray(list.body?.jobs));
  assert("total field present", typeof list.body?.total === "number");

  // 4. List with filters
  console.log("\n4. Filtered list");
  const filtered = await req("GET", "/api/qjobs/jobs?type=full-time&limit=5");
  assert("GET /jobs?type=full-time → 200", filtered.status === 200);
  assert("all returned are full-time",
    (filtered.body?.jobs ?? []).every(j => j.type === "full-time" || filtered.body?.jobs?.length === 0));

  // 5. Stats
  console.log("\n5. Stats");
  const stats = await req("GET", "/api/qjobs/stats");
  assert("GET /stats → 200", stats.status === 200);
  assert("postings.total is number", typeof stats.body?.postings?.total === "number");
  assert("applications.total is number", typeof stats.body?.applications?.total === "number");
  assert("byType object present", typeof stats.body?.byType === "object");

  // 6. Auth-gated — without token
  console.log("\n6. Auth gates");
  const noAuth = await req("POST", "/api/qjobs/me/jobs", { title: "Test", description: "Test", company: "Test" });
  assert("POST /me/jobs without auth → 401", noAuth.status === 401);

  // 7. With JWT (optional — skip if no TEST_JWT)
  if (JWT) {
    console.log("\n7. Authenticated flow");
    const authHeaders = { Authorization: `Bearer ${JWT}` };

    const create = await req("POST", "/api/qjobs/me/jobs",
      { title: "Smoke Test Job", description: "Created by smoke test — safe to delete", company: "AEVION", type: "contract", skills: ["typescript", "node"] },
      authHeaders);
    assert("POST /me/jobs → 201", create.status === 201);
    const jobId = create.body?.job?.id;
    assert("job.id present", !!jobId);

    if (jobId) {
      const get = await req("GET", `/api/qjobs/jobs/${jobId}`);
      assert(`GET /jobs/${jobId.slice(0,8)} → 200`, get.status === 200);
      assert("skills search works", get.body?.job?.skills?.includes("typescript"));

      // Soft-delete (close)
      const del = await req("DELETE", `/api/qjobs/me/jobs/${jobId}`, null, authHeaders);
      assert("DELETE /me/jobs/:id → 200", del.status === 200);
    }
  } else {
    console.log("\n7. [Skipping auth flow — no TEST_JWT]");
  }

  // Summary
  console.log(`\nQJobs: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
