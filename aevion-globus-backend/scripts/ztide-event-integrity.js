#!/usr/bin/env node
/**
 * Z-Tide event integrity — cross-checks aggregate consistency between
 * `/api/ztide/stats` (per-server totals) and `/api/ztide/leaderboard`
 * (per-user rows).
 *
 * Invariants asserted:
 *   1. SUM(leaderboard[i].score)       == stats.total_weight
 *   2. SUM(leaderboard[i].eventCount)  == stats.total_events
 *   3. leaderboard.length              == stats.active_users
 *   4. MAX(leaderboard[i].score)       == stats.top_score
 *   5. Each user's stored rank.min     <= user.score < next-tier.min
 *
 * Drift between any of these usually means a write path emitted an event
 * but skipped the rolling score/rank update — or vice versa.
 *
 * Read-only. Safe against prod.
 *
 * Usage:
 *   node scripts/ztide-event-integrity.js
 *   BASE=https://aevion-production-a70c.up.railway.app \
 *     node scripts/ztide-event-integrity.js
 */

const BASE = (process.env.BASE || process.env.BACKEND_URL || "http://localhost:4001").replace(/\/+$/, "");

let passed = 0; let failed = 0;
function ok(l, e) { passed++; console.log(`  ✓ ${l}${e ? "  " + e : ""}`); }
function fail(l, r) { failed++; console.error(`  ✗ ${l}${r ? "  ↳ " + r : ""}`); }

async function getJson(path) {
  const r = await fetch(`${BASE}${path}`);
  let body = {}; try { body = await r.json(); } catch { /* ignore */ }
  return { status: r.status, body };
}

async function main() {
  console.log(`Z-Tide event integrity → ${BASE}\n`);

  const statsR = await getJson("/api/ztide/stats");
  if (statsR.status !== 200) { fail("GET /stats", `${statsR.status}`); process.exit(1); }
  const stats = statsR.body;
  ok("GET /stats", `active_users=${stats.active_users} total_events=${stats.total_events} total_weight=${stats.total_weight}`);

  const ranks = Array.isArray(stats.ranks) ? stats.ranks : [];
  if (ranks.length === 0) { fail("stats.ranks empty"); process.exit(1); }
  // Make sure ranks are sorted ascending by min for the band check below.
  ranks.sort((a, b) => Number(a.min) - Number(b.min));

  const lbR = await getJson(`/api/ztide/leaderboard?limit=10000`);
  if (lbR.status !== 200 || !Array.isArray(lbR.body?.leaderboard)) {
    fail("GET /leaderboard", `${lbR.status}`); process.exit(1);
  }
  const rows = lbR.body.leaderboard;
  ok("GET /leaderboard", `rows=${rows.length}`);

  // 1. SUM(score)
  const sumScore = rows.reduce((a, r) => a + Number(r.score ?? 0), 0);
  if (String(sumScore) === String(stats.total_weight)) ok(`SUM(score)=${sumScore} matches stats.total_weight`);
  else fail("SUM(score) drift", `sum=${sumScore} vs stats.total_weight=${stats.total_weight}`);

  // 2. SUM(eventCount)
  const sumEvents = rows.reduce((a, r) => a + Number(r.eventCount ?? 0), 0);
  if (sumEvents === Number(stats.total_events)) ok(`SUM(eventCount)=${sumEvents} matches stats.total_events`);
  else fail("SUM(eventCount) drift", `sum=${sumEvents} vs stats.total_events=${stats.total_events}`);

  // 3. rowCount == active_users
  if (rows.length === Number(stats.active_users)) ok(`rows=${rows.length} matches stats.active_users`);
  else fail("rowCount drift", `rows=${rows.length} vs stats.active_users=${stats.active_users}`);

  // 4. MAX(score) == top_score
  const maxScore = rows.length === 0 ? 0 : Math.max(...rows.map((r) => Number(r.score ?? 0)));
  if (rows.length === 0 || String(maxScore) === String(stats.top_score)) ok(`MAX(score)=${maxScore} matches stats.top_score`);
  else fail("MAX(score) drift", `max=${maxScore} vs stats.top_score=${stats.top_score}`);

  // 5. Per-user rank band check
  let bandViolations = 0;
  for (const row of rows) {
    const score = Number(row.score ?? 0);
    const rankId = String(row.rank?.id ?? row.rank ?? "");
    const tier = ranks.find((r) => r.id === rankId);
    if (!tier) { bandViolations++; console.log(`    ✗ user ${(row.userId ?? "").slice(0, 8)}… unknown rank=${rankId}`); continue; }
    const nextTier = ranks.find((r) => Number(r.min) > Number(tier.min));
    const lowOk = score >= Number(tier.min);
    const highOk = !nextTier || score < Number(nextTier.min);
    if (!lowOk || !highOk) {
      bandViolations++;
      console.log(`    ✗ user ${(row.userId ?? "").slice(0, 8)}…  score=${score}  rank=${rankId} (band: ≥${tier.min}, <${nextTier?.min ?? "∞"})`);
    }
  }
  if (bandViolations === 0) ok(`rank-band check passed for all ${rows.length} users`);
  else fail("rank-band violations", `${bandViolations} users`);

  console.log(`\n${passed + failed} assertions — ${passed} PASS  ${failed} FAIL\n`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => { console.error("crash:", e instanceof Error ? e.message : e); process.exit(2); });
