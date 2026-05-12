#!/usr/bin/env node
/**
 * Z-Tide audit — read-only sanity walker over the leaderboard.
 *
 * Confirms that every row's `rank` matches the score band defined in
 * `lib/ecosystemEvents.ts` (ZTIDE_RANK_THRESHOLDS). Catches drift between
 * a stored `rank` column and the band a `score` would land in today —
 * usually a sign that the threshold table changed without a backfill,
 * or that a write path forgot to call rankIdFor().
 *
 * Read-only. Safe against prod.
 *
 * Usage:
 *   node scripts/ztide-audit.js
 *   BASE=https://aevion-production-a70c.up.railway.app node scripts/ztide-audit.js
 */

const BASE = (process.env.BASE || process.env.BACKEND_URL || "http://localhost:4001").replace(/\/+$/, "");

// Must mirror ZTIDE_RANK_THRESHOLDS in src/lib/ecosystemEvents.ts.
const RANK_THRESHOLDS = [
  { id: "seedling", min: 0 },
  { id: "current",  min: 50 },
  { id: "wave",     min: 200 },
  { id: "stream",   min: 750 },
  { id: "tide",     min: 2_500 },
  { id: "river",    min: 8_000 },
  { id: "ocean",    min: 25_000 },
];

function expectedRank(score) {
  let id = "seedling";
  for (const r of RANK_THRESHOLDS) {
    if (score >= r.min) id = r.id;
    else break;
  }
  return id;
}

async function getJson(path) {
  const r = await fetch(`${BASE}${path}`);
  let body = {}; try { body = await r.json(); } catch { /* ignore */ }
  return { status: r.status, body };
}

async function main() {
  console.log(`Z-Tide audit → ${BASE}\n`);

  const r = await getJson("/api/ztide/leaderboard?limit=1000");
  if (r.status !== 200 || !Array.isArray(r.body?.leaderboard)) {
    console.error(`Leaderboard fetch failed: ${r.status}`);
    process.exit(2);
  }
  const rows = r.body.leaderboard;
  console.log(`Walking ${rows.length} leaderboard rows…\n`);

  let mismatches = 0;
  const rankCounts = {};
  for (const row of rows) {
    const score = Number(row.score ?? 0);
    const stored = String(row.rank?.id ?? row.rank ?? "");
    const expected = expectedRank(score);
    rankCounts[stored] = (rankCounts[stored] || 0) + 1;
    if (stored !== expected) {
      mismatches++;
      console.log(`✗ user ${(row.userId ?? "").slice(0, 8)}…  score=${score}  stored=${stored}  expected=${expected}`);
    }
  }

  console.log(`\nRank distribution (${rows.length} users):`);
  for (const t of RANK_THRESHOLDS) {
    console.log(`  ${t.id.padEnd(10)} ≥${String(t.min).padStart(6)}   ${rankCounts[t.id] ?? 0}`);
  }

  if (mismatches === 0) {
    console.log(`\n✓ All ${rows.length} rows have correct rank for their score.`);
    process.exit(0);
  } else {
    console.log(`\n${mismatches} mismatches — write path may be skipping rank update. Investigate emitZTideEvent / ztide.ts.`);
    process.exit(1);
  }
}

main().catch((e) => { console.error("crash:", e instanceof Error ? e.message : e); process.exit(2); });
