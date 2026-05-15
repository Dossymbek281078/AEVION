import { Router, Request, Response } from "express";
import { getQtradeMetrics } from "./qtrade";
import { getEcosystemMetrics, ensureEcosystemLoaded } from "./ecosystem";
import { isSentryEnabled } from "../lib/sentry";

// Plain-text Prometheus exposition. Read by ops dashboards / oncall.
//
// Auth model:
//   - If METRICS_TOKEN is set, require Authorization: Bearer <token>.
//     Use this in production when /metrics shouldn't be world-readable.
//   - If unset, the endpoint is public — fine for the test net since the
//     numbers are not sensitive (counts of accounts, transfers, etc.).
//
// Prometheus scrapers don't speak JWT, so we use a static bearer token
// rather than reusing requireAuth.
//
// We deliberately don't expose per-user labels — the metrics are
// global counters. Per-tenant breakdowns belong in a separate ledger
// query, not in /metrics.

export const metricsRouter = Router();

const startedAt = Date.now();

function fmtMetric(name: string, type: "counter" | "gauge", help: string, value: number): string {
  return `# HELP ${name} ${help}\n# TYPE ${name} ${type}\n${name} ${value}\n`;
}

// Token gate shared by both /metrics (Prometheus) and /metrics/json (UI).
// Returns true if the request is allowed to proceed.
function checkMetricsAuth(req: Request, res: Response): boolean {
  const required = process.env.METRICS_TOKEN;
  if (!required) return true;
  const auth = req.headers.authorization || "";
  const expected = `Bearer ${required}`;
  if (auth !== expected) {
    res.status(401).type("text/plain").send("metrics token required");
    return false;
  }
  return true;
}

// Single source of truth for the numbers we expose. Both renderers (Prom +
// JSON) read from this so they stay in lockstep — if we add a metric to one
// we get it in the other for free.
type MetricEntry = {
  name: string;
  type: "counter" | "gauge";
  help: string;
  value: number;
};

async function collectMetrics(): Promise<MetricEntry[]> {
  // Ecosystem counts come from the persisted store; warm it up first so a
  // fresh scrape doesn't return zeros for a process that hasn't yet served
  // any /api/ecosystem/* request.
  await ensureEcosystemLoaded();

  const q = getQtradeMetrics();
  const e = getEcosystemMetrics();
  const mem = process.memoryUsage();
  const uptimeSec = Math.floor((Date.now() - startedAt) / 1000);

  return [
    { name: "aevion_accounts_total", type: "gauge", help: "Number of qtrade accounts", value: q.accounts },
    { name: "aevion_transfers_total", type: "counter", help: "Number of completed transfers", value: q.transfers },
    { name: "aevion_operations_total", type: "counter", help: "Number of ledger operations", value: q.operations },
    { name: "aevion_idempotency_cache_size", type: "gauge", help: "Live idempotency-key cache entries", value: q.idemCache },
    { name: "aevion_royalty_events_total", type: "counter", help: "QRight royalty events recorded", value: e.royaltyEvents },
    { name: "aevion_chess_prizes_total", type: "counter", help: "CyberChess prizes recorded", value: e.chessPrizes },
    { name: "aevion_planet_certs_total", type: "counter", help: "Planet certifications recorded", value: e.planetCerts },
    { name: "aevion_uptime_seconds", type: "counter", help: "Process uptime in seconds", value: uptimeSec },
    { name: "aevion_mem_heap_used_bytes", type: "gauge", help: "Process heap used in bytes", value: mem.heapUsed },
    { name: "aevion_mem_heap_total_bytes", type: "gauge", help: "Process heap total in bytes", value: mem.heapTotal },
    { name: "aevion_mem_rss_bytes", type: "gauge", help: "Process RSS in bytes", value: mem.rss },
    { name: "aevion_mem_external_bytes", type: "gauge", help: "Process external memory in bytes", value: mem.external },
    { name: "aevion_sentry_enabled", type: "gauge", help: "1 if Sentry SDK is initialised", value: isSentryEnabled() ? 1 : 0 },
  ];
}

metricsRouter.get("/", async (req, res) => {
  if (!checkMetricsAuth(req, res)) return;

  const entries = await collectMetrics();
  const out = entries.map((m) => fmtMetric(m.name, m.type, m.help, m.value)).join("");

  res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  res.send(out);
});

// JSON variant — same numbers, friendlier shape for the /status UI and ad-hoc
// scripts. We expose three things:
//   - `metrics[]`: the full Prometheus list with type/help (so a UI can render
//     a self-documenting table without round-tripping through a parser).
//   - `summary`: flat key/value map of just the values (most code only needs
//     this).
//   - `process`: pre-derived runtime info (uptime in seconds + memory bytes,
//     Node version) so a UI doesn't have to do bytes math on the metrics
//     array.
//
// Same auth gate as the Prometheus endpoint — if METRICS_TOKEN is set, you
// need the bearer token here too.
metricsRouter.get("/json", async (req, res) => {
  if (!checkMetricsAuth(req, res)) return;

  const entries = await collectMetrics();
  const summary: Record<string, number> = {};
  for (const m of entries) summary[m.name] = m.value;

  const mem = process.memoryUsage();
  const uptimeSec = Math.floor((Date.now() - startedAt) / 1000);

  res.setHeader("Cache-Control", "no-store");
  res.json({
    generatedAt: new Date().toISOString(),
    process: {
      node: process.version,
      pid: process.pid,
      uptimeSec,
      memory: {
        heapUsedBytes: mem.heapUsed,
        heapTotalBytes: mem.heapTotal,
        rssBytes: mem.rss,
        externalBytes: mem.external,
      },
      sentryEnabled: isSentryEnabled(),
    },
    summary,
    metrics: entries,
  });
});
