#!/usr/bin/env node
/**
 * DeepSan smoke test — tasks/focus/stats.
 * Usage: BASE=http://localhost:4001 node scripts/deepsan-smoke.js
 */
const BASE = (process.env.BASE || "http://127.0.0.1:4001").replace(/\/$/, "");
let passed = 0, failed = 0;
function assert(label, cond, info = "") {
  if (cond) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ ${label}${info ? " — " + info : ""}`); failed++; }
}
async function req(method, path, body) {
  const opts = { method, headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(8000) };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${BASE}${path}`, opts);
  const text = await r.text();
  try { return { status: r.status, body: JSON.parse(text) }; } catch { return { status: r.status, body: text }; }
}
async function run() {
  console.log(`\nDeepSan smoke → ${BASE}\n`);

  const h = await req("GET", "/api/deepsan/health");
  assert("health → 200", h.status === 200, String(h.status));
  assert("ok true", h.body?.success === true);

  const tag = `smoke-${Date.now()}`;
  const t = await req("POST", "/api/deepsan/tasks", { title: `Smoke task ${tag}`, priority: "high" });
  assert("POST /tasks → 200/201", [200,201].includes(t.status), String(t.status));
  const taskId = t.body?.data?.id;
  assert("task.id present", !!taskId);

  const list = await req("GET", "/api/deepsan/tasks?limit=10");
  assert("GET /tasks → 200", list.status === 200);
  assert("tasks array", Array.isArray(list.body?.data ?? list.body?.tasks ?? list.body));

  if (taskId) {
    const patch = await req("PATCH", `/api/deepsan/tasks/${taskId}`, { done: true });
    assert("PATCH done → 200", patch.status === 200);

    const focus = await req("POST", "/api/deepsan/focus", { taskId, durationMin: 25 });
    assert("POST /focus → 200/201", [200,201].includes(focus.status));
    const focusId = focus.body?.data?.id;

    if (focusId) {
      const done = await req("PATCH", `/api/deepsan/focus/${focusId}/done`, {});
      assert("PATCH focus done → 200", done.status === 200);
    }
  }

  const stats = await req("GET", "/api/deepsan/stats");
  assert("GET /stats → 200", stats.status === 200);
  assert("stats.total >= 0", typeof stats.body?.data?.totalTasks === "number");

  console.log(`\nDeepSan: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}
run().catch(e => { console.error(e); process.exit(1); });
