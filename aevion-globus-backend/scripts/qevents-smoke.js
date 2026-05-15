#!/usr/bin/env node
/**
 * QEvents smoke test — events platform: create/list/rsvp/calendar/health.
 * Usage: BASE=http://localhost:4001 node scripts/qevents-smoke.js
 */
const BASE = (process.env.BASE || "http://127.0.0.1:4001").replace(/\/$/, "");
let passed = 0, failed = 0;

function assert(label, cond, info = "") {
  if (cond) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ ${label}${info ? " — " + info : ""}`); failed++; }
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
  console.log(`\nQEvents smoke → ${BASE}\n`);

  console.log("1. Health");
  const h = await req("GET", "/api/qevents/health");
  assert("GET /health → 200", h.status === 200, String(h.status));
  assert("ok === true", h.body?.ok === true || h.body?.status === "ok");

  console.log("\n2. Categories");
  const cats = await req("GET", "/api/qevents/categories");
  assert("GET /categories → 200", cats.status === 200, String(cats.status));
  assert("categories is array", Array.isArray(cats.body?.data ?? cats.body?.categories ?? cats.body));

  console.log("\n3. List events");
  const list = await req("GET", "/api/qevents/events?limit=10");
  assert("GET /events → 200", list.status === 200, String(list.status));
  const events = list.body?.data ?? list.body?.events ?? list.body?.items ?? [];
  assert("events is array", Array.isArray(events));

  console.log("\n4. Create event (auth optional — expect 200 or 401)");
  const tag = `smoke-${Date.now()}`;
  const created = await req("POST", "/api/qevents/me/events", {
    title: `Smoke Event ${tag}`,
    description: "Automated smoke test — ignore",
    startAt: new Date(Date.now() + 86400000).toISOString(),
    endAt: new Date(Date.now() + 90000000).toISOString(),
    category: "conference",
    location: "Online",
  });
  assert("POST /me/events → 200/201 or 401", [200, 201, 401].includes(created.status), String(created.status));

  console.log("\n5. Calendar endpoint");
  const cal = await req("GET", "/api/qevents/calendar");
  assert("GET /calendar → 200", cal.status === 200, String(cal.status));

  console.log("\n6. Single event (if any exist)");
  if (Array.isArray(events) && events.length > 0) {
    const id = events[0]?.id;
    if (id) {
      const single = await req("GET", `/api/qevents/events/${id}`);
      assert("GET /events/:id → 200", single.status === 200, String(single.status));
    } else {
      console.log("  (skipped — no event id)");
    }
  } else {
    console.log("  (skipped — no events)");
  }

  console.log(`\nQEvents: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });
