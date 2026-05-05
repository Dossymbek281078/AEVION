#!/usr/bin/env node
/**
 * QContract smoke test — run against live backend
 * Usage: node scripts/qcontract-smoke.js [BASE_URL]
 *   BASE_URL default http://localhost:4001
 *   TEST_JWT env var enables auth-required tests
 */

const BASE = process.argv[2] ?? process.env.BACKEND_URL ?? "http://localhost:4001";
const JWT  = process.env.TEST_JWT ?? "";

let passed = 0;
let failed = 0;

async function req(method, path, body, headers = {}) {
  const opts = { method, headers: { "Content-Type": "application/json", ...headers } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${BASE}${path}`, opts);
  const text = await r.text();
  try { return { status: r.status, body: JSON.parse(text) }; }
  catch { return { status: r.status, body: text }; }
}

function assert(label, cond, info = "") {
  if (cond) { console.log(`  ✓ ${label}`); passed++; }
  else      { console.error(`  ✗ ${label}${info ? " — " + info : ""}`); failed++; }
}

async function run() {
  console.log(`\nQContract smoke test → ${BASE}\n`);
  const auth = JWT ? { Authorization: `Bearer ${JWT}` } : {};

  // 1. Public endpoints
  console.log("1. Public endpoints");
  const stats = await req("GET", "/api/qcontract/stats");
  assert("GET /api/qcontract/stats → 200", stats.status === 200);
  assert("stats.totalDocuments is number", typeof stats.body.totalDocuments === "number");

  const health = await req("GET", "/api/qcontract/health");
  assert("GET /api/qcontract/health → 200", health.status === 200);

  const tpls = await req("GET", "/api/qcontract/templates");
  assert("GET /api/qcontract/templates → 200", tpls.status === 200);
  assert("at least 5 templates", Array.isArray(tpls.body.templates) && tpls.body.templates.length >= 5);

  const tpl = await req("GET", "/api/qcontract/templates/nda");
  assert("GET templates/nda → 200", tpl.status === 200);
  assert("nda has content", typeof tpl.body.content === "string" && tpl.body.content.length > 100);

  if (!JWT) {
    console.log("\n[Skipping auth tests — no TEST_JWT]");
    console.log(`\n${passed} passed, ${failed} failed\n`);
    process.exit(failed > 0 ? 1 : 0);
    return;
  }

  // 2. Create document
  console.log("\n2. Documents");
  const create = await req("POST", "/api/qcontract/documents", {
    title: "Smoke Test Doc",
    content: "Конфиденциальные данные смоук-теста",
    contentType: "text",
    maxViews: 3,
    expiresInDays: 7,
  }, auth);
  assert("POST documents → 201", create.status === 201);
  assert("has accessToken", typeof create.body.accessToken === "string");
  assert("has shareUrl", typeof create.body.shareUrl === "string");
  const docId = create.body.id;
  const token = create.body.accessToken;

  // 3. List
  const list = await req("GET", "/api/qcontract/documents", null, auth);
  assert("GET documents → 200", list.status === 200);
  assert("list contains doc", list.body.documents?.some(d => d.id === docId));

  // 4. View doc
  console.log("\n3. View");
  const view = await req("POST", `/api/qcontract/view/${token}`, {});
  assert("POST view/:token → 200", view.status === 200);
  assert("view returns content", view.body.content?.includes("смоук-теста"));

  // 5. Log
  const log = await req("GET", `/api/qcontract/documents/${docId}/log`, null, auth);
  assert("GET documents/:id/log → 200", log.status === 200);
  assert("log has 1 view", log.body.viewCount >= 1);

  // 5b. Log CSV
  const csvR = await fetch(`${BASE}/api/qcontract/documents/${docId}/log.csv`, { headers: auth });
  const csvText = await csvR.text();
  assert("GET log.csv → 200", csvR.status === 200);
  assert("csv has audit header", csvText.startsWith("view_id,viewer_ip,viewer_email,signed,viewed_at,user_agent"));

  // 6. Extend expiry (NEW)
  console.log("\n4. PATCH (extend)");
  const extend = await req("PATCH", `/api/qcontract/documents/${docId}`, { extendDays: 30 }, auth);
  assert("PATCH extendDays → 200", extend.status === 200);
  assert("expires_at returned", typeof extend.body.expires_at === "string");

  const extendBig = await req("PATCH", `/api/qcontract/documents/${docId}`, { extendDays: 999 }, auth);
  assert("PATCH extendDays > 365 → 400", extendBig.status === 400);

  const extendNone = await req("PATCH", `/api/qcontract/documents/${docId}`, {}, auth);
  assert("PATCH no fields → 400", extendNone.status === 400);

  // 7. Add max views (NEW)
  const addViews = await req("PATCH", `/api/qcontract/documents/${docId}`, { addMaxViews: 5 }, auth);
  assert("PATCH addMaxViews → 200", addViews.status === 200);

  // 8. Revoke
  console.log("\n5. Revoke");
  const revoke = await req("DELETE", `/api/qcontract/documents/${docId}`, null, auth);
  assert("DELETE documents/:id → 200", revoke.status === 200);

  const viewAfter = await req("POST", `/api/qcontract/view/${token}`, {});
  assert("view after revoke → 410/404", viewAfter.status === 410 || viewAfter.status === 404);

  const extendRevoked = await req("PATCH", `/api/qcontract/documents/${docId}`, { extendDays: 7 }, auth);
  assert("PATCH revoked doc → 404", extendRevoked.status === 404);

  console.log(`\n${"═".repeat(40)}`);
  console.log(`QContract smoke: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => { console.error(err); process.exit(1); });
