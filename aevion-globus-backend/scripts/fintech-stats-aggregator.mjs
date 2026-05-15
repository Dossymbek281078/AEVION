#!/usr/bin/env node
/**
 * Fintech Stats Aggregator — pulls live stats from each fintech module
 * and prints a human-readable summary to stdout. Useful for ops checks,
 * scheduled reports, and debugging.
 *
 * Usage:
 *   node scripts/fintech-stats-aggregator.mjs
 *   BASE=http://localhost:4001 node scripts/fintech-stats-aggregator.mjs
 *   BASE=https://aevion-production-a70c.up.railway.app node scripts/fintech-stats-aggregator.mjs --json
 *
 * Output modes:
 *   - default: human-readable table with module/metric/value columns
 *   - --json:  machine-parsable JSON for piping into other tools
 *
 * Exit codes:
 *   0 — at least one module returned valid data
 *   1 — all modules failed (network/server down)
 *   2 — invalid args
 */

const BASE = (process.env.BASE || "https://aevion-production-a70c.up.railway.app").replace(/\/+$/, "");
const OUTPUT_JSON = process.argv.includes("--json");

const FETCH_TIMEOUT_MS = 6000;

async function fetchJson(path) {
  try {
    const r = await fetch(`${BASE}${path}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: "application/json" },
    });
    if (!r.ok) return { ok: false, status: r.status, body: null };
    const body = await r.json().catch(() => null);
    return { ok: true, status: r.status, body };
  } catch (e) {
    return { ok: false, status: 0, body: null, error: e.message };
  }
}

function fmt(v) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
    return v.toLocaleString("en-US");
  }
  if (typeof v === "string" && v.length > 20) return `${v.slice(0, 8)}…${v.slice(-4)}`;
  return String(v);
}

async function main() {
  const t0 = Date.now();
  const [veilHead, veilStats, qgoodStats, qgoodCamp, ztideLb, qchainProps, qmaskHealth] = await Promise.all([
    fetchJson("/api/veilnetx-ledger/head"),
    fetchJson("/api/veilnetx-ledger/stats"),
    fetchJson("/api/qgood/stats"),
    fetchJson("/api/qgood/campaigns"),
    fetchJson("/api/ztide/leaderboard"),
    fetchJson("/api/qchaingov/proposals?status=active"),
    fetchJson("/api/qmaskcard/health"),
  ]);

  const summary = {
    base: BASE,
    timestamp: new Date().toISOString(),
    latency_ms: Date.now() - t0,
    modules: {
      veilnetx: {
        chain_length: veilHead.body?.length ?? veilStats.body?.total ?? null,
        head_hash: veilHead.body?.hash ?? null,
        live: veilHead.ok || veilStats.ok,
      },
      qgood: {
        total_raised_cents: qgoodStats.body?.total_raised_cents ?? null,
        active_campaigns: qgoodCamp.body?.campaigns?.length ?? null,
        live: qgoodStats.ok || qgoodCamp.ok,
      },
      qmaskcard: {
        live: qmaskHealth.ok,
        service: qmaskHealth.body?.service ?? null,
      },
      ztide: {
        leaderboard_size: ztideLb.body?.entries?.length ?? null,
        top_user: ztideLb.body?.entries?.[0]?.username ?? ztideLb.body?.entries?.[0]?.userId ?? null,
        live: ztideLb.ok,
      },
      qchaingov: {
        active_proposals: qchainProps.body?.proposals?.length ?? null,
        live: qchainProps.ok,
      },
    },
  };

  if (OUTPUT_JSON) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(`\n🔗 AEVION Fintech Stats — ${BASE}`);
    console.log(`   ${summary.timestamp}  ·  ${summary.latency_ms}ms\n`);
    const rows = [
      ["VeilNetX",  "chain length",        fmt(summary.modules.veilnetx.chain_length)],
      ["VeilNetX",  "head hash",           fmt(summary.modules.veilnetx.head_hash)],
      ["QGood",     "total raised (¢)",    fmt(summary.modules.qgood.total_raised_cents)],
      ["QGood",     "active campaigns",    fmt(summary.modules.qgood.active_campaigns)],
      ["QMaskCard", "service",             fmt(summary.modules.qmaskcard.service)],
      ["Z-Tide",    "leaderboard size",    fmt(summary.modules.ztide.leaderboard_size)],
      ["Z-Tide",    "top user",            fmt(summary.modules.ztide.top_user)],
      ["QChainGov", "active proposals",    fmt(summary.modules.qchaingov.active_proposals)],
    ];
    const colWidths = [12, 24, 24];
    console.log("   ┌─" + "─".repeat(colWidths[0]) + "─┬─" + "─".repeat(colWidths[1]) + "─┬─" + "─".repeat(colWidths[2]) + "─┐");
    console.log("   │ " + "Module".padEnd(colWidths[0]) + " │ " + "Metric".padEnd(colWidths[1]) + " │ " + "Value".padEnd(colWidths[2]) + " │");
    console.log("   ├─" + "─".repeat(colWidths[0]) + "─┼─" + "─".repeat(colWidths[1]) + "─┼─" + "─".repeat(colWidths[2]) + "─┤");
    for (const [m, k, v] of rows) {
      console.log(`   │ ${m.padEnd(colWidths[0])} │ ${k.padEnd(colWidths[1])} │ ${v.padEnd(colWidths[2])} │`);
    }
    console.log("   └─" + "─".repeat(colWidths[0]) + "─┴─" + "─".repeat(colWidths[1]) + "─┴─" + "─".repeat(colWidths[2]) + "─┘");

    const liveCount = Object.values(summary.modules).filter(m => m.live).length;
    const totalCount = Object.keys(summary.modules).length;
    console.log(`\n   Status: ${liveCount}/${totalCount} modules live\n`);
  }

  const anyLive = Object.values(summary.modules).some(m => m.live);
  process.exit(anyLive ? 0 : 1);
}

main();
