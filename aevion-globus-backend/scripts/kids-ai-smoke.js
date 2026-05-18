#!/usr/bin/env node
/**
 * Kids AI Content smoke test.
 * Usage: BASE=http://localhost:4001 node scripts/kids-ai-smoke.js
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
  try { return { status: r.status, body: JSON.parse(text) }; }
  catch { return { status: r.status, body: text }; }
}

async function run() {
  console.log(`\nKids AI Content smoke → ${BASE}\n`);

  console.log("1. Health");
  const h = await req("GET", "/api/kids-ai/health");
  assert("GET /health → 200", h.status === 200, String(h.status));
  assert("ok === true", h.body?.ok === true);
  assert("lessonsCount >= 0", typeof h.body?.lessonsCount === "number");

  console.log("\n2. List lessons (all)");
  const all = await req("GET", "/api/kids-ai/lessons?limit=20");
  assert("GET /lessons → 200", all.status === 200, String(all.status));
  assert("data is array", Array.isArray(all.body?.lessons));
  assert("at least 1 lesson", (all.body?.lessons?.length ?? 0) >= 1);

  console.log("\n3. Filter by language");
  const ru = await req("GET", "/api/kids-ai/lessons?lang=ru&limit=10");
  assert("GET /lessons?lang=ru → 200", ru.status === 200, String(ru.status));
  const ruItems = ru.body?.lessons ?? [];
  assert("all ru lessons have language=ru", ruItems.every(l => l.language === "ru"));

  console.log("\n4. Single lesson");
  const lessons = all.body?.lessons ?? [];
  const firstId = lessons[0]?.id;
  if (firstId) {
    const single = await req("GET", `/api/kids-ai/lessons/${firstId}`);
    assert("GET /lessons/:id → 200", single.status === 200, String(single.status));
    assert("lesson has content_md", typeof single.body?.lesson?.content_md === "string");
  } else {
    console.log("  (skipped — no lessons)");
  }

  console.log("\n5. Record progress");
  const alias = `smoke-${Date.now()}`;
  if (firstId) {
    const prog = await req("POST", "/api/kids-ai/progress", {
      childAlias: alias,
      lessonId: firstId,
      score: 85,
    });
    assert("POST /progress → 200 or 201", [200, 201].includes(prog.status), String(prog.status));
    assert("progress recorded", !!(prog.body?.progress?.id));

    const get = await req("GET", `/api/kids-ai/progress/${alias}`);
    assert("GET /progress/:alias → 200", get.status === 200, String(get.status));
    assert("progress has items", Array.isArray(get.body?.progress));
  }

  console.log("\n6. Stats");
  const stats = await req("GET", "/api/kids-ai/stats");
  assert("GET /stats → 200", stats.status === 200, String(stats.status));
  assert("stats.total >= 1", (stats.body?.totalLessons ?? 0) >= 1);
  assert("stats.languages present", typeof stats.body?.languages === "number");

  console.log("\n7. Ask AI (stub check)");
  if (firstId) {
    const ask = await req("POST", "/api/kids-ai/ask", {
      lessonId: firstId,
      question: "Сколько будет 2+2?",
      lang: "ru",
    });
    assert("POST /ask → 200", ask.status === 200, String(ask.status));
    assert("answer is string", typeof (ask.body?.data?.answer ?? ask.body?.answer) === "string");
  }

  console.log(`\nKids AI: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });
