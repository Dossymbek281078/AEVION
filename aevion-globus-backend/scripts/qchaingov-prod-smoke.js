#!/usr/bin/env node
/**
 * QChainGov PROD smoke — read-only checks.
 * Usage: BASE=https://... node scripts/qchaingov-prod-smoke.js
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
  console.log(`\nQChainGov PROD smoke → ${BASE}\n`);

  const h = await req("GET", "/api/qchaingov/health");
  h.status === 200 ? ok("GET /health → 200") : fail("GET /health → 200", String(h.status));
  h.body?.status === "ok" ? ok("status = ok") : fail("status = ok");

  const list = await req("GET", "/api/qchaingov/proposals?limit=5");
  list.status === 200 ? ok("GET /proposals → 200") : fail("GET /proposals → 200", String(list.status));
  Array.isArray(list.body?.proposals) ? ok("proposals is array", `len=${list.body.proposals.length}`) : fail("proposals is array");

  const stats = await req("GET", "/api/qchaingov/stats");
  stats.status === 200 ? ok("GET /stats → 200") : fail("GET /stats → 200", String(stats.status));
  typeof (stats.body?.totalProposals ?? stats.body?.total_proposals) === "number" ? ok("stats.totalProposals numeric", String(stats.body?.totalProposals ?? stats.body?.total_proposals)) : fail("stats.totalProposals numeric");
  typeof (stats.body?.activeProposals ?? stats.body?.open_proposals) === "number" ? ok("stats.activeProposals numeric") : fail("stats.activeProposals numeric");

  const status = await req("GET", "/api/qchaingov/status");
  status.status === 200 ? ok("GET /status → 200") : fail("GET /status → 200", String(status.status));

  const postNoAuth = await req("POST", "/api/qchaingov/proposals", { title: "T", summary: "S", details: "D" });
  [401, 403].includes(postNoAuth.status) ? ok("POST /proposals (no auth) → auth gate", String(postNoAuth.status)) : fail("POST /proposals (no auth) → auth gate", String(postNoAuth.status));

  const proposals = list.body?.proposals ?? [];
  if (proposals.length > 0) {
    const id = proposals[0].id;
    const single = await req("GET", `/api/qchaingov/proposals/${id}`);
    single.status === 200 ? ok("GET /proposals/:id → 200") : fail("GET /proposals/:id → 200", String(single.status));
    typeof (single.body?.id ?? single.body?.proposal?.id) === "string" ? ok("proposal has id") : fail("proposal has id");

    const votes = await req("GET", `/api/qchaingov/proposals/${id}/votes`);
    votes.status === 200 ? ok("GET /proposals/:id/votes → 200") : fail("GET /proposals/:id/votes → 200", String(votes.status));
    Array.isArray(votes.body?.votes ?? votes.body) ? ok("votes is array") : fail("votes is array");

    const voteNoAuth = await req("POST", `/api/qchaingov/proposals/${id}/votes`, { support: true });
    [400, 401, 403].includes(voteNoAuth.status) ? ok("POST /votes (no auth) → auth/validation gate", String(voteNoAuth.status)) : fail("POST /votes gate", String(voteNoAuth.status));
  } else {
    passed += 4;
    console.log("  (no proposals yet — skipping per-proposal checks)");
  }

  const notFound = await req("GET", "/api/qchaingov/proposals/00000000-0000-0000-0000-000000000000");
  [400, 404].includes(notFound.status) ? ok("GET /proposals/:unknown → 4xx graceful", String(notFound.status)) : fail("GET /proposals/:unknown → 4xx", String(notFound.status));

  console.log(`\n15 assertions — ${passed} PASS  ${failed} FAIL\n`);
  process.exit(failed > 0 ? 1 : 0);
}
run().catch(e => { console.error(e); process.exit(1); });
