#!/usr/bin/env node
/**
 * QChainGov smoke — verifies /api/qchaingov/* surface.
 *
 * Tests: health → stats → list → register → create draft → vote-on-draft-rejected → cleanup
 *
 * Usage:
 *   node scripts/qchaingov-smoke.js
 */

const BASE = (process.env.BASE || process.env.BACKEND_URL || "http://localhost:4001").replace(/\/+$/, "");

let passed = 0; let failed = 0;
function ok(l, e) { passed++; console.log(`  ✓ ${l}${e ? "  " + e : ""}`); }
function fail(l, r) { failed++; console.error(`  ✗ ${l}${r ? "  ↳ " + r : ""}`); }

async function req(method, path, body, token) {
  const h = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  const r = await fetch(`${BASE}${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  let json; try { json = await r.json(); } catch { json = {}; }
  return { status: r.status, body: json };
}

async function run() {
  console.log(`\nQChainGov smoke → ${BASE}\n`);

  let r = await req("GET", "/api/qchaingov/health");
  if (r.status === 200) ok("GET /health");
  else fail("GET /health", `${r.status}`);

  r = await req("GET", "/api/qchaingov/stats");
  if (r.status === 200 && typeof r.body?.total_proposals === "number") ok("GET /stats");
  else fail("GET /stats", `${r.status}`);

  r = await req("GET", "/api/qchaingov/proposals?limit=5");
  if (r.status === 200 && Array.isArray(r.body?.proposals)) ok("GET /proposals", `count=${r.body.proposals.length}`);
  else fail("GET /proposals", `${r.status}`);

  // Register
  const EMAIL = `qcg-smoke-${Date.now()}@aevion.test`;
  r = await req("POST", "/api/auth/register", { email: EMAIL, password: "Qcg123!", name: "QcgBot" });
  if ((r.status === 200 || r.status === 201) && r.body?.token) ok("register");
  else { fail("register", `${r.status}`); process.exit(1); }
  const token = r.body.token;

  // Create draft proposal
  r = await req("POST", "/api/qchaingov/proposals", {
    title: "Smoke Test Proposal " + Date.now(),
    summary: "Automated smoke proposal — please ignore.",
    body: "This proposal is created by the automated smoke test suite. Vote 'abstain' if you see it in production.",
    category: "operations",
    voteMode: "yes-no-abstain",
    options: ["yes", "no", "abstain"],
    quorumPercent: 10,
    passThreshold: 50,
  }, token);
  if ((r.status === 200 || r.status === 201) && r.body?.id) ok("POST /proposals (draft)", `id=${r.body.id.slice(0, 8)}`);
  else { fail("POST /proposals", `${r.status}`); process.exit(1); }
  const proposalId = r.body.id;

  // Read it back
  r = await req("GET", `/api/qchaingov/proposals/${proposalId}`);
  if (r.status === 200 && r.body?.proposal?.id === proposalId && Array.isArray(r.body?.tally)) {
    ok("GET /proposals/:id", `tally=${r.body.tally.length}`);
  } else fail("GET /proposals/:id", `${r.status}`);

  // Vote on draft should be rejected
  r = await req("POST", `/api/qchaingov/proposals/${proposalId}/votes`, {
    choice: "yes", weight: 1, rationale: "smoke",
  }, token);
  if (r.status === 400 && r.body?.error === "voting_not_open") ok("vote on draft → 400 voting_not_open");
  else fail("vote on draft should reject", `${r.status} ${r.body?.error}`);

  // Bad choice validation
  r = await req("POST", `/api/qchaingov/proposals/${proposalId}/votes`, { choice: "maybe" }, token);
  if (r.status === 400) ok("invalid choice → 400");
  else fail("invalid choice should 400", `${r.status}`);

  // Open without admin → 403
  r = await req("POST", `/api/qchaingov/proposals/${proposalId}/open`, {}, token);
  if (r.status === 403) ok("open without admin → 403");
  else fail("open without admin", `expected 403 got ${r.status}`);

  // Public votes list
  r = await req("GET", `/api/qchaingov/proposals/${proposalId}/votes`);
  if (r.status === 200 && Array.isArray(r.body?.votes)) ok("GET /proposals/:id/votes");
  else fail("GET /proposals/:id/votes", `${r.status}`);

  // Cleanup
  r = await req("DELETE", "/api/auth/account", { password: "Qcg123!" }, token);
  if (r.status === 200 || r.status === 204) ok("DELETE /account");
  else fail("DELETE /account", `${r.status}`);

  console.log(`\n${passed + failed} assertions — ${passed} PASS  ${failed} FAIL\n`);
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error("crash:", e); process.exit(2); });
