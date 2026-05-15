#!/usr/bin/env node
/**
 * Fintech Uptime Monitor — long-running continuous probe of all 5 fintech
 * modules. Designed to run as a sidecar / cron / systemd service.
 *
 * Emits structured JSON-per-line logs to stdout for log aggregators.
 * Tracks uptime percentage, latency p50/p95, and consecutive-failure counts.
 *
 * Usage:
 *   node scripts/fintech-uptime-monitor.mjs
 *   INTERVAL=60 BASE=http://localhost:4001 node scripts/fintech-uptime-monitor.mjs
 *   ALERT_THRESHOLD=3 node scripts/fintech-uptime-monitor.mjs --once
 *
 * Env vars:
 *   BASE             default https://aevion-production-a70c.up.railway.app
 *   INTERVAL         seconds between checks (default: 60)
 *   ALERT_THRESHOLD  consecutive failures before "alert" log (default: 3)
 *
 * Flags:
 *   --once           run a single check and exit (CI-friendly)
 *
 * Exit codes (--once mode):
 *   0 — all modules ok
 *   1 — at least one degraded/down
 */

const BASE = (process.env.BASE || "https://aevion-production-a70c.up.railway.app").replace(/\/+$/, "");
const INTERVAL_S = parseInt(process.env.INTERVAL || "60", 10);
const ALERT_THRESHOLD = parseInt(process.env.ALERT_THRESHOLD || "3", 10);
const ONCE = process.argv.includes("--once");

const MODULES = [
  { key: "veilnetx",  path: "/api/veilnetx-ledger/health" },
  { key: "qgood",     path: "/api/qgood/health" },
  { key: "qmaskcard", path: "/api/qmaskcard/health" },
  { key: "ztide",     path: "/api/ztide/health" },
  { key: "qchaingov", path: "/api/qchaingov/health" },
];

// Per-module state
const state = new Map();
for (const m of MODULES) {
  state.set(m.key, {
    ok: 0,
    fail: 0,
    consecutiveFail: 0,
    lastStatus: null,
    latencies: [], // last 100 latencies for percentile calculation
  });
}

function log(level, msg, extra = {}) {
  const line = { ts: new Date().toISOString(), level, msg, ...extra };
  console.log(JSON.stringify(line));
}

async function probe(module) {
  const t0 = Date.now();
  try {
    const r = await fetch(`${BASE}${module.path}`, {
      signal: AbortSignal.timeout(5000),
      headers: { Accept: "application/json" },
    });
    const dt = Date.now() - t0;
    const body = await r.json().catch(() => ({}));
    const s = state.get(module.key);
    s.latencies.push(dt);
    if (s.latencies.length > 100) s.latencies.shift();
    if (r.ok && (body?.status === "ok" || body?.service)) {
      s.ok++;
      const wasAlerting = s.consecutiveFail >= ALERT_THRESHOLD;
      s.consecutiveFail = 0;
      s.lastStatus = "ok";
      if (wasAlerting) log("info", "recovered", { module: module.key, latency_ms: dt });
      return { module: module.key, status: "ok", latency_ms: dt };
    } else {
      s.fail++;
      s.consecutiveFail++;
      s.lastStatus = "degraded";
      const lvl = s.consecutiveFail >= ALERT_THRESHOLD ? "alert" : "warn";
      log(lvl, "degraded", { module: module.key, http_status: r.status, consecutive_fail: s.consecutiveFail });
      return { module: module.key, status: "degraded", http_status: r.status };
    }
  } catch (e) {
    const s = state.get(module.key);
    s.fail++;
    s.consecutiveFail++;
    s.lastStatus = "down";
    const lvl = s.consecutiveFail >= ALERT_THRESHOLD ? "alert" : "warn";
    log(lvl, "down", { module: module.key, error: e.message, consecutive_fail: s.consecutiveFail });
    return { module: module.key, status: "down", error: e.message };
  }
}

function percentile(arr, p) {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx];
}

function summarize() {
  const summary = {};
  for (const m of MODULES) {
    const s = state.get(m.key);
    const total = s.ok + s.fail;
    summary[m.key] = {
      uptime_pct: total > 0 ? Math.round((s.ok / total) * 10000) / 100 : null,
      checks: total,
      consecutive_fail: s.consecutiveFail,
      last_status: s.lastStatus,
      latency_p50_ms: percentile(s.latencies, 0.5),
      latency_p95_ms: percentile(s.latencies, 0.95),
    };
  }
  return summary;
}

async function tick() {
  const results = await Promise.all(MODULES.map(m => probe(m)));
  const allOk = results.every(r => r.status === "ok");
  return allOk;
}

async function main() {
  log("info", "uptime-monitor-start", { base: BASE, interval_s: INTERVAL_S, alert_threshold: ALERT_THRESHOLD, once: ONCE });
  const allOk = await tick();

  if (ONCE) {
    log("info", "once-summary", summarize());
    process.exit(allOk ? 0 : 1);
  }

  // Long-running mode
  setInterval(async () => {
    await tick();
  }, INTERVAL_S * 1000);

  // Periodic summary every 5 minutes
  setInterval(() => {
    log("info", "summary", summarize());
  }, 5 * 60 * 1000);
}

main().catch(e => {
  log("alert", "fatal", { error: e.message });
  process.exit(1);
});
