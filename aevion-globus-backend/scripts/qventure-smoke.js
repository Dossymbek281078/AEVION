#!/usr/bin/env node
/**
 * QVenture smoke test.
 * Usage: BASE=http://localhost:4001 node scripts/qventure-smoke.js
 *        BASE=https://aevion-production-a70c.up.railway.app node scripts/qventure-smoke.js
 */
const BASE = (process.env.BASE || "http://127.0.0.1:4001").replace(/\/$/, "");
let passed = 0, failed = 0;

function assert(label, cond, info = "") {
  if (cond) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ ${label}${info ? " — " + info : ""}`); failed++; }
}

async function req(method, path, body) {
  const opts = { method, headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(30000) };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${BASE}${path}`, opts);
  const text = await r.text();
  try { return { status: r.status, body: JSON.parse(text) }; }
  catch { return { status: r.status, body: text }; }
}

async function run() {
  console.log(`\nQVenture smoke → ${BASE}\n`);

  console.log("1. Health");
  const h = await req("GET", "/api/qventure/health");
  assert("GET /health → 200", h.status === 200, String(h.status));
  assert("ok === true", h.body?.ok === true);
  assert("reports storage mode", typeof h.body?.storage === "string", JSON.stringify(h.body).slice(0, 120));
  assert("exposes stages", Array.isArray(h.body?.stages) && h.body.stages.length >= 4);

  console.log("\n2. Sectors catalog");
  const sec = await req("GET", "/api/qventure/sectors");
  assert("GET /sectors → 200", sec.status === 200, String(sec.status));
  assert("returns >= 10 sectors", Array.isArray(sec.body?.data) && sec.body.data.length >= 10, String(sec.body?.data?.length));

  console.log("\n3. Validation guards");
  const badName = await req("POST", "/api/qventure/analyze", { description: "x".repeat(50), stage: "seed" });
  assert("missing name → 400", badName.status === 400, String(badName.status));
  const badDesc = await req("POST", "/api/qventure/analyze", { name: "Acme", description: "too short", stage: "seed" });
  assert("short description → 400", badDesc.status === 400, String(badDesc.status));

  console.log("\n4. Analyze (fintech, seed) — core engine + council");
  const a = await req("POST", "/api/qventure/analyze", {
    name: `Smoke Ledger ${Date.now()}`,
    sector: "fintech",
    stage: "seed",
    geography: "US",
    askUsd: 4_000_000,
    description: "Embedded real-time treasury and stablecoin payment rails for SaaS platforms, with on-device fraud scoring.",
    tractionNotes: "$40k MRR growing 18% MoM, 3 enterprise pilots, 92% retention cohort, LTV/CAC 4.2x.",
  });
  assert("POST /analyze → 200", a.status === 200, String(a.status));
  const d = a.body?.data;
  assert("has id", !!d?.id, JSON.stringify(a.body).slice(0, 160));
  assert("composite is 0..100", typeof d?.composite === "number" && d.composite >= 0 && d.composite <= 100, String(d?.composite));
  assert("verdict in {invest,watch,pass}", ["invest", "watch", "pass"].includes(d?.verdict), String(d?.verdict));
  assert("8 scoring factors", Array.isArray(d?.result?.factors) && d.result.factors.length === 8, String(d?.result?.factors?.length));
  assert("factor weights sum ≈ 1", Math.abs(d.result.factors.reduce((s, f) => s + f.weight, 0) - 1) < 0.001);
  assert("has entry strategy", !!d?.result?.strategy, "");
  assert("ticket target > 0", d?.result?.strategy?.ticketUsd?.target > 0, String(d?.result?.strategy?.ticketUsd?.target));
  assert("valuation band ordered", d.result.strategy.valuationBandUsd.low <= d.result.strategy.valuationBandUsd.base
    && d.result.strategy.valuationBandUsd.base <= d.result.strategy.valuationBandUsd.high);
  assert("tranches sum to 100%", d.result.strategy.tranches.reduce((s, t) => s + t.pct, 0) === 100,
    String(d.result.strategy.tranches.reduce((s, t) => s + t.pct, 0)));
  assert("returns.expectedMoic present", typeof d.result.strategy.returns.expectedMoic === "number");
  assert("targetIrrPct present", typeof d.result.strategy.returns.targetIrrPct === "number");
  assert("4-role council present", Array.isArray(d?.result?.council?.lenses) && d.result.council.lenses.length === 4,
    String(d?.result?.council?.lenses?.length));
  assert("council roles are the 4 experts", ["scientist", "data_analyst", "economist", "lawyer"]
    .every((id) => d.result.council.lenses.some((l) => l.lens === id)));
  assert("each lens has points+risks", d.result.council.lenses.every((l) => l.points.length > 0 && l.risks.length > 0));
  assert("synthesis memo present", typeof d?.result?.council?.memo === "string" && d.result.council.memo.length > 40);
  assert("assumptions surfaced", Array.isArray(d?.result?.assumptions) && d.result.assumptions.length >= 2);
  const analysisId = d?.id;

  console.log("\n5. Determinism — same input twice = same score");
  const base = { name: "Det Co", sector: "saas", stage: "series-a", description: "Horizontal B2B SaaS analytics platform with usage-based pricing." };
  const r1 = await req("POST", "/api/qventure/analyze", base);
  const r2 = await req("POST", "/api/qventure/analyze", base);
  assert("composite reproducible", r1.body?.data?.composite === r2.body?.data?.composite,
    `${r1.body?.data?.composite} vs ${r2.body?.data?.composite}`);

  console.log("\n6. Retrieve + list + stats");
  const g = await req("GET", `/api/qventure/analyses/${analysisId}`);
  assert("GET /analyses/:id → 200", g.status === 200, String(g.status));
  assert("retrieved id matches", g.body?.data?.id === analysisId);
  const list = await req("GET", "/api/qventure/analyses?limit=10");
  assert("GET /analyses → 200", list.status === 200, String(list.status));
  assert("list is array", Array.isArray(list.body?.data));
  assert("list items are summaries (no council)", list.body.data.every((x) => x.council === undefined && typeof x.composite === "number"));
  const missing = await req("GET", "/api/qventure/analyses/does-not-exist-xyz");
  assert("unknown id → 404", missing.status === 404, String(missing.status));
  const stats = await req("GET", "/api/qventure/stats");
  assert("GET /stats → 200", stats.status === 200, String(stats.status));
  assert("stats.total >= 3", stats.body?.data?.total >= 3, String(stats.body?.data?.total));
  assert("stats has byVerdict", !!stats.body?.data?.byVerdict);

  console.log(`\n${failed === 0 ? "✅" : "❌"} QVenture smoke: ${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((e) => { console.error("smoke crashed:", e); process.exit(1); });
