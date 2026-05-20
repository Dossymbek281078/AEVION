#!/usr/bin/env node
/**
 * MVP Concepts PROD smoke — read-only checks for 12 ownerless-module
 * concept-board / MVP routers that lacked individual *-prod-smoke.js files.
 *
 * Coverage closes the prod-surface gap revealed by 2026-05-19 audit:
 *   deepsan, kids-ai-content (as /kids-ai), mapreality, psyapp-deps,
 *   qfusionai, qlife, qpersona, shadownet, startup-exchange (as /startupx),
 *   voice-of-earth, lifebox, globus.
 *
 * Per module: 2 assertions (health + one read endpoint that exists on
 * prod and is safe to hit anonymously). Plus 1 Content-Type sanity.
 *
 * Mutates: NO. Pure GET. Safe for prod + read-only orchestrator.
 */

const BASE = (process.env.BASE || process.env.BACKEND_URL || "https://aevion-production-a70c.up.railway.app").replace(/\/+$/, "");

let passed = 0; let failed = 0;
function ok(l, e) { passed++; console.log(`  ✓ ${l}${e ? "  " + e : ""}`); }
function fail(l, r) { failed++; console.error(`  ✗ ${l}${r ? "  ↳ " + r : ""}`); }

async function req(path) {
  try {
    const r = await fetch(`${BASE}${path}`, {
      method: "GET",
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    const ct = r.headers.get("content-type") || "";
    let json; try { json = await r.json(); } catch { json = {}; }
    return { status: r.status, body: json, ct };
  } catch (e) { return { status: 0, body: {}, ct: "", error: e?.message }; }
}

const MODULES = [
  { name: "deepsan",          health: "/api/deepsan/health",         list: "/api/deepsan/runs" },
  { name: "kids-ai",          health: "/api/kids-ai/health",         list: "/api/kids-ai/stats" },
  { name: "mapreality",       health: "/api/mapreality/health",      list: "/api/mapreality/claims" },
  { name: "psyapp-deps",      health: "/api/psyapp-deps/health",     list: "/api/psyapp-deps/assessments" },
  { name: "qfusionai",        health: "/api/qfusionai/health",       list: "/api/qfusionai/stats" },
  { name: "qlife",            health: "/api/qlife/health",           list: "/api/qlife/prompts" },
  { name: "qpersona",         health: "/api/qpersona/health",        list: "/api/qpersona/personas" },
  { name: "shadownet",        health: "/api/shadownet/health",       list: "/api/shadownet/posts" },
  { name: "startupx",         health: "/api/startupx/health",        list: "/api/startupx/ideas" },
  { name: "voice-of-earth",   health: "/api/voice-of-earth/health",  list: "/api/voice-of-earth/tracks" },
  { name: "lifebox",          health: "/api/lifebox/health",         list: "/api/lifebox/capsules" },
  // Globus uses /ping (not /health) and /projects as the canonical registry.
  { name: "globus",           health: "/api/globus/ping",            list: "/api/globus/projects" },
];

async function run() {
  console.log(`\nMVP Concepts PROD smoke → ${BASE}\n`);

  for (const m of MODULES) {
    // Health
    let r = await req(m.health);
    if (r.status === 200) {
      ok(`${m.name} health`, m.health);
    } else fail(`${m.name} health`, `${r.status} ${m.health}`);

    // List endpoint — accept either array under common keys or any 200 JSON
    r = await req(m.list);
    const body = r.body || {};
    const arr = body.items ?? body.runs ?? body.claims ?? body.assessments
              ?? body.prompts ?? body.personas ?? body.posts ?? body.ideas
              ?? body.tracks ?? body.capsules ?? body.projects;
    if (r.status === 200) {
      if (Array.isArray(arr)) {
        ok(`${m.name} list`, `${m.list} items=${arr.length}`);
      } else if (typeof body === "object" && Object.keys(body).length > 0) {
        // stats-like endpoints return objects, not arrays — that's also valid
        ok(`${m.name} list (object shape)`, `${m.list} keys=${Object.keys(body).length}`);
      } else fail(`${m.name} list shape`, `${m.list} body=${JSON.stringify(body).slice(0, 60)}`);
    } else fail(`${m.name} list`, `${r.status} ${m.list}`);
  }

  // Content-Type sanity on first 3 modules' health endpoints
  const headers = await Promise.all(MODULES.slice(0, 3).map((m) => req(m.health)));
  const allJson = headers.every((h) => h.status === 200 && /application\/json/i.test(h.ct));
  if (allJson) ok("Content-Type application/json on sample health endpoints");
  else fail("Content-Type json sample", `cts: ${headers.map((h) => h.ct.slice(0, 20)).join("|")}`);

  console.log(`\n${passed + failed} assertions — ${passed} PASS  ${failed} FAIL\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => { console.error("crash:", e); process.exit(2); });
