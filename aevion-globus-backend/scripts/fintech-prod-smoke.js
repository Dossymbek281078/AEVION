#!/usr/bin/env node
/**
 * Fintech PROD smoke — 25 read-only health + stats checks across the
 * aevion-build zone: QGood, QMaskCard, VeilNetX Ledger, Z-Tide, QChainGov,
 * QMedia, QFusionAI.
 *
 * Safe to run anywhere — every endpoint is GET, anonymous, and read-only.
 * No DB writes, no auth, no test users. Designed for the daily-smoke CI
 * workflow's READ_ONLY=1 track against production.
 *
 * Default BASE points at production (https://aevion-production-a70c.up.railway.app)
 * unlike the other smokes which default to localhost.
 *
 * Usage:
 *   node scripts/fintech-prod-smoke.js
 *   BASE=https://aevion-production-a70c.up.railway.app node scripts/fintech-prod-smoke.js
 *   BASE=http://localhost:4001 node scripts/fintech-prod-smoke.js
 */

const BASE = (process.env.BASE || process.env.BACKEND_URL || "https://aevion-production-a70c.up.railway.app").replace(/\/+$/, "");

let passed = 0; let failed = 0;
function ok(l, e) { passed++; console.log(`  ✓ ${l}${e ? "  " + e : ""}`); }
function fail(l, r) { failed++; console.error(`  ✗ ${l}${r ? "  ↳ " + r : ""}`); }

async function req(method, path) {
  try {
    const r = await fetch(`${BASE}${path}`, { method, headers: { "Accept": "application/json" } });
    let json; try { json = await r.json(); } catch { json = {}; }
    return { status: r.status, body: json };
  } catch (e) {
    return { status: 0, body: {}, error: e?.message || String(e) };
  }
}

function isHex64(s) {
  return typeof s === "string" && /^[0-9a-fA-F]{64}$/.test(s);
}

async function run() {
  console.log(`\nFintech PROD smoke → ${BASE}\n`);

  // ── QGood ────────────────────────────────────────────────────────────────
  // 1. QGood health
  let r = await req("GET", "/api/qgood/health");
  if (r.status === 200 && r.body?.status === "ok" && r.body?.service === "qgood") {
    ok("GET /api/qgood/health", "service=qgood status=ok");
  } else {
    fail("GET /api/qgood/health", `${r.status} ${r.error || JSON.stringify(r.body).slice(0, 80)}`);
  }

  // 2. QGood stats
  r = await req("GET", "/api/qgood/stats");
  if (r.status === 200 && typeof r.body?.total_campaigns === "number") {
    ok("GET /api/qgood/stats", `total_campaigns=${r.body.total_campaigns}`);
  } else {
    fail("GET /api/qgood/stats", `${r.status} ${r.error || JSON.stringify(r.body).slice(0, 80)}`);
  }

  // ── QMaskCard ────────────────────────────────────────────────────────────
  // 3. QMaskCard health
  r = await req("GET", "/api/qmaskcard/health");
  if (r.status === 200 && r.body?.service === "qmaskcard") {
    ok("GET /api/qmaskcard/health", "service=qmaskcard");
  } else {
    fail("GET /api/qmaskcard/health", `${r.status} ${r.error || JSON.stringify(r.body).slice(0, 80)}`);
  }

  // 4. QMaskCard stats
  r = await req("GET", "/api/qmaskcard/stats");
  if (r.status === 200 && typeof r.body?.active_masks === "number") {
    ok("GET /api/qmaskcard/stats", `active_masks=${r.body.active_masks}`);
  } else {
    fail("GET /api/qmaskcard/stats", `${r.status} ${r.error || JSON.stringify(r.body).slice(0, 80)}`);
  }

  // ── VeilNetX Ledger ──────────────────────────────────────────────────────
  // 5. VeilNetX health
  r = await req("GET", "/api/veilnetx-ledger/health");
  if (r.status === 200 && r.body?.service === "veilnetx-ledger") {
    ok("GET /api/veilnetx-ledger/health", "service=veilnetx-ledger");
  } else {
    fail("GET /api/veilnetx-ledger/health", `${r.status} ${r.error || JSON.stringify(r.body).slice(0, 80)}`);
  }

  // 6. VeilNetX chain head
  r = await req("GET", "/api/veilnetx-ledger/chain/head");
  const zeroHead = "0".repeat(64);
  const headOk = r.status === 200
    && typeof r.body?.head === "string"
    && (isHex64(r.body.head) || r.body.head === zeroHead)
    && typeof r.body?.length === "number";
  if (headOk) {
    ok("GET /api/veilnetx-ledger/chain/head", `len=${r.body.length} head=${r.body.head.slice(0, 12)}…`);
  } else {
    fail("GET /api/veilnetx-ledger/chain/head", `${r.status} ${r.error || JSON.stringify(r.body).slice(0, 80)}`);
  }

  // 7. VeilNetX chain verify — MUST be true
  r = await req("GET", "/api/veilnetx-ledger/chain/verify");
  if (r.status === 200 && r.body?.verified === true) {
    ok("GET /api/veilnetx-ledger/chain/verify", "verified=true");
  } else if (r.status === 200 && r.body?.verified === false) {
    fail("GET /api/veilnetx-ledger/chain/verify", "verified=FALSE — chain integrity broken!");
  } else {
    fail("GET /api/veilnetx-ledger/chain/verify", `${r.status} ${r.error || JSON.stringify(r.body).slice(0, 80)}`);
  }

  // ── Z-Tide ───────────────────────────────────────────────────────────────
  // 8. Z-Tide health
  r = await req("GET", "/api/ztide/health");
  if (r.status === 200 && r.body?.service === "ztide") {
    ok("GET /api/ztide/health", "service=ztide");
  } else {
    fail("GET /api/ztide/health", `${r.status} ${r.error || JSON.stringify(r.body).slice(0, 80)}`);
  }

  // 9. Z-Tide stats — ranks array length === 7
  r = await req("GET", "/api/ztide/stats");
  if (r.status === 200 && Array.isArray(r.body?.ranks) && r.body.ranks.length === 7) {
    ok("GET /api/ztide/stats", `ranks.length=7`);
  } else {
    fail("GET /api/ztide/stats", `${r.status} ranks=${r.body?.ranks?.length} ${r.error || JSON.stringify(r.body).slice(0, 80)}`);
  }

  // 10. Z-Tide leaderboard
  r = await req("GET", "/api/ztide/leaderboard?limit=5");
  if (r.status === 200 && Array.isArray(r.body?.leaderboard)) {
    ok("GET /api/ztide/leaderboard?limit=5", `entries=${r.body.leaderboard.length}`);
  } else {
    fail("GET /api/ztide/leaderboard?limit=5", `${r.status} ${r.error || JSON.stringify(r.body).slice(0, 80)}`);
  }

  // ── QChainGov ────────────────────────────────────────────────────────────
  // 11. QChainGov health
  r = await req("GET", "/api/qchaingov/health");
  if (r.status === 200 && r.body?.service === "qchaingov") {
    ok("GET /api/qchaingov/health", "service=qchaingov");
  } else {
    fail("GET /api/qchaingov/health", `${r.status} ${r.error || JSON.stringify(r.body).slice(0, 80)}`);
  }

  // 12. QChainGov stats
  r = await req("GET", "/api/qchaingov/stats");
  if (r.status === 200 && typeof r.body?.total_proposals === "number") {
    ok("GET /api/qchaingov/stats", `total_proposals=${r.body.total_proposals}`);
  } else {
    fail("GET /api/qchaingov/stats", `${r.status} ${r.error || JSON.stringify(r.body).slice(0, 80)}`);
  }

  // 13. QChainGov proposals
  r = await req("GET", "/api/qchaingov/proposals?limit=5");
  if (r.status === 200 && Array.isArray(r.body?.proposals)) {
    ok("GET /api/qchaingov/proposals?limit=5", `entries=${r.body.proposals.length}`);
  } else {
    fail("GET /api/qchaingov/proposals?limit=5", `${r.status} ${r.error || JSON.stringify(r.body).slice(0, 80)}`);
  }

  // ── New read-only coverage (14–21) ───────────────────────────────────────
  // 14. QGood matching-pools list — pools[] + total
  r = await req("GET", "/api/qgood/matching-pools");
  if (r.status === 200 && Array.isArray(r.body?.pools) && typeof r.body?.total === "number") {
    ok("GET /api/qgood/matching-pools", `pools=${r.body.pools.length} total=${r.body.total}`);
  } else {
    fail("GET /api/qgood/matching-pools", `${r.status} ${r.error || JSON.stringify(r.body).slice(0, 80)}`);
  }

  // 15. QMaskCard stats — ADDITIONAL field shape (split into two ok/fail lines).
  //     #4 already asserted active_masks; here we check total_masks + authorized_charges types.
  r = await req("GET", "/api/qmaskcard/stats");
  if (r.status === 200 && typeof r.body?.total_masks === "number") {
    ok("GET /api/qmaskcard/stats total_masks:number", `total_masks=${r.body.total_masks}`);
  } else {
    fail("GET /api/qmaskcard/stats total_masks:number", `${r.status} got=${typeof r.body?.total_masks}`);
  }
  if (r.status === 200 && typeof r.body?.authorized_charges === "number") {
    ok("GET /api/qmaskcard/stats authorized_charges:number", `authorized_charges=${r.body.authorized_charges}`);
  } else {
    fail("GET /api/qmaskcard/stats authorized_charges:number", `${r.status} got=${typeof r.body?.authorized_charges}`);
  }

  // 16. VeilNetX ledger entries — entries[] array
  r = await req("GET", "/api/veilnetx-ledger/entries?limit=3");
  if (r.status === 200 && Array.isArray(r.body?.entries)) {
    ok("GET /api/veilnetx-ledger/entries?limit=3", `entries=${r.body.entries.length}`);
  } else {
    fail("GET /api/veilnetx-ledger/entries?limit=3", `${r.status} ${r.error || JSON.stringify(r.body).slice(0, 80)}`);
  }

  // 17. VeilNetX ledger search — accept 200 (empty or with matches) OR 400
  //     (some deploys enforce >4-char min); just assert no 5xx.
  r = await req("GET", "/api/veilnetx-ledger/search?hash=0000");
  if (r.status === 200 || r.status === 400) {
    ok("GET /api/veilnetx-ledger/search?hash=0000", `status=${r.status}`);
  } else {
    fail("GET /api/veilnetx-ledger/search?hash=0000", `${r.status} ${r.error || JSON.stringify(r.body).slice(0, 80)}`);
  }

  // 18. Z-Tide leaderboard — ADDITIONAL row-shape check (split into ok/fail lines).
  //     #10 already asserted array shape; here we check each row has position/userId/score/rank.
  r = await req("GET", "/api/ztide/leaderboard?limit=3");
  if (r.status === 200 && Array.isArray(r.body?.leaderboard)) {
    const rows = r.body.leaderboard;
    if (rows.length === 0) {
      ok("GET /api/ztide/leaderboard row-shape", "empty leaderboard (vacuous PASS)");
    } else {
      const bad = rows.find(row =>
        typeof row?.position !== "number" ||
        typeof row?.userId !== "string" ||
        typeof row?.score !== "number" ||
        typeof row?.rank !== "string"
      );
      if (!bad) {
        ok("GET /api/ztide/leaderboard row-shape", `n=${rows.length} fields=position,userId,score,rank`);
      } else {
        fail("GET /api/ztide/leaderboard row-shape", `bad row: ${JSON.stringify(bad).slice(0, 120)}`);
      }
    }
  } else {
    fail("GET /api/ztide/leaderboard row-shape", `${r.status} ${r.error || JSON.stringify(r.body).slice(0, 80)}`);
  }

  // 19. Z-Tide rank for nonexistent user → rank.id === "seedling"
  r = await req("GET", "/api/ztide/rank/nonexistent-user");
  if (r.status === 200 && r.body?.rank?.id === "seedling") {
    ok("GET /api/ztide/rank/nonexistent-user", `rank.id=seedling score=${r.body.score}`);
  } else {
    fail("GET /api/ztide/rank/nonexistent-user", `${r.status} rank.id=${r.body?.rank?.id} ${r.error || JSON.stringify(r.body).slice(0, 80)}`);
  }

  // 20. QChainGov proposals filtered by status=open
  r = await req("GET", "/api/qchaingov/proposals?limit=3&status=open");
  if (r.status === 200 && Array.isArray(r.body?.proposals)) {
    ok("GET /api/qchaingov/proposals?status=open", `entries=${r.body.proposals.length}`);
  } else {
    fail("GET /api/qchaingov/proposals?status=open", `${r.status} ${r.error || JSON.stringify(r.body).slice(0, 80)}`);
  }

  // 21. QChainGov proposals filtered by status=executed (often empty, that's fine)
  r = await req("GET", "/api/qchaingov/proposals?status=executed&limit=3");
  if (r.status === 200 && Array.isArray(r.body?.proposals)) {
    ok("GET /api/qchaingov/proposals?status=executed", `entries=${r.body.proposals.length}`);
  } else {
    fail("GET /api/qchaingov/proposals?status=executed", `${r.status} ${r.error || JSON.stringify(r.body).slice(0, 80)}`);
  }

  // ── QMedia (read-only) ───────────────────────────────────────────────────
  // 22. QMedia health (accepts 200 with db=ok OR 503 with db=down per upgraded /health)
  r = await req("GET", "/api/qmedia/health");
  if ((r.status === 200 || r.status === 503) && r.body?.service === "qmedia") {
    ok("GET /api/qmedia/health", `status=${r.body.ok ? "ok" : "degraded"} db=${r.body.db ?? "n/a"} storage=${r.body.storage ?? "n/a"}`);
  } else {
    fail("GET /api/qmedia/health", `${r.status} ${r.error || JSON.stringify(r.body).slice(0, 80)}`);
  }

  // 23. QMedia public tracks (empty OK)
  r = await req("GET", "/api/qmedia/tracks?limit=3");
  if (r.status === 200 && Array.isArray(r.body?.items)) {
    ok("GET /api/qmedia/tracks", `n=${r.body.items.length}`);
  } else {
    fail("GET /api/qmedia/tracks", `${r.status} ${r.error || JSON.stringify(r.body).slice(0, 80)}`);
  }

  // 24. QMedia public videos (empty OK)
  r = await req("GET", "/api/qmedia/videos?limit=3");
  if (r.status === 200 && Array.isArray(r.body?.items)) {
    ok("GET /api/qmedia/videos", `n=${r.body.items.length}`);
  } else {
    fail("GET /api/qmedia/videos", `${r.status} ${r.error || JSON.stringify(r.body).slice(0, 80)}`);
  }

  // ── QFusionAI (read-only) ────────────────────────────────────────────────
  // 25. QFusionAI health — providers list + routes catalog
  r = await req("GET", "/api/qfusionai/health");
  if (r.status === 200 && r.body?.module === "qfusionai" && Array.isArray(r.body?.providers) && Array.isArray(r.body?.routes)) {
    const configured = r.body.providers.filter((p) => p.configured).length;
    ok("GET /api/qfusionai/health", `providers=${r.body.providers.length} configured=${configured} routes=${r.body.routes.length}`);
  } else {
    fail("GET /api/qfusionai/health", `${r.status} ${r.error || JSON.stringify(r.body).slice(0, 80)}`);
  }

  console.log(`\n${passed + failed} assertions — ${passed} PASS  ${failed} FAIL\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error("crash:", e); process.exit(2); });
