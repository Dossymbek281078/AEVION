#!/usr/bin/env node
/**
 * QContract PROD smoke — read-only checks.
 * Usage: BASE=https://... node scripts/qcontract-prod-smoke.js
 */
const BASE = (process.env.BASE || "https://aevion-production-a70c.up.railway.app").replace(/\/+$/, "");
let passed = 0, failed = 0;
function ok(l, i = "") { passed++; console.log(`  ✓ ${l}${i ? "  " + i : ""}`); }
function fail(l, i = "") { failed++; console.error(`  ✗ ${l}${i ? "  " + i : ""}`); }
async function req(method, path, body) {
  const opts = { method, headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(10000) };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${BASE}${path}`, opts);
  const text = await r.text();
  try { return { status: r.status, body: JSON.parse(text) }; } catch { return { status: r.status, body: text }; }
}
async function run() {
  console.log(`\nQContract PROD smoke → ${BASE}\n`);

  const h = await req("GET", "/api/qcontract/health");
  h.status === 200 ? ok("GET /health → 200") : fail("GET /health → 200", String(h.status));
  h.body?.status === "ok" ? ok("status = ok") : fail("status = ok", String(h.body?.status));

  const tmpl = await req("GET", "/api/qcontract/templates");
  tmpl.status === 200 ? ok("GET /templates → 200") : fail("GET /templates → 200", String(tmpl.status));
  Array.isArray(tmpl.body?.templates) ? ok("templates is array", `len=${tmpl.body.templates.length}`) : fail("templates is array");
  (tmpl.body?.templates?.length ?? 0) >= 3 ? ok("≥ 3 templates") : fail("≥ 3 templates", String(tmpl.body?.templates?.length));

  const nda = tmpl.body?.templates?.find((t) => t.id === "nda");
  nda ? ok("NDA template present") : fail("NDA template present");
  typeof nda?.title === "string" ? ok("NDA has title", nda.title.slice(0, 40)) : fail("NDA has title");

  const stats = await req("GET", "/api/qcontract/stats");
  stats.status === 200 ? ok("GET /stats → 200") : fail("GET /stats → 200", String(stats.status));
  typeof stats.body?.totalDocuments === "number" ? ok("stats.totalDocuments numeric", String(stats.body.totalDocuments)) : fail("stats.totalDocuments numeric");

  const postNoAuth = await req("POST", "/api/qcontract/documents", { title: "T", parties: [], type: "nda", content: "x" });
  postNoAuth.status === 401 ? ok("POST /documents (no auth) → 401") : fail("POST /documents (no auth) → 401", String(postNoAuth.status));

  const listNoAuth = await req("GET", "/api/qcontract/documents");
  listNoAuth.status === 401 ? ok("GET /documents (no auth) → 401") : fail("GET /documents (no auth) → 401", String(listNoAuth.status));

  const badView = await req("POST", "/api/qcontract/view/bad-token-xyz", {});
  [400, 404].includes(badView.status) ? ok("POST /view/:bad → 4xx graceful", String(badView.status)) : fail("POST /view/:bad → 4xx", String(badView.status));

  const openapi = await req("GET", "/api/qcontract/openapi.json");
  openapi.status === 200 ? ok("GET /openapi.json → 200") : fail("GET /openapi.json → 200", String(openapi.status));
  typeof openapi.body?.paths === "object" ? ok("openapi has paths", `count=${Object.keys(openapi.body.paths).length}`) : fail("openapi has paths");

  const status = await req("GET", "/api/qcontract/status");
  status.status === 200 ? ok("GET /status → 200") : fail("GET /status → 200", String(status.status));

  const tplById = await req("GET", "/api/qcontract/templates/nda");
  tplById.status === 200 ? ok("GET /templates/nda → 200") : fail("GET /templates/nda → 200", String(tplById.status));
  typeof (tplById.body?.template?.content ?? tplById.body?.content) === "string" ? ok("template has content") : fail("template has content");

  console.log(`\n15 assertions — ${passed} PASS  ${failed} FAIL\n`);
  process.exit(failed > 0 ? 1 : 0);
}
run().catch(e => { console.error(e); process.exit(1); });
