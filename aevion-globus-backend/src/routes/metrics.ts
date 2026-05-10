import { Router } from "express";
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

metricsRouter.get("/", async (req, res) => {
  const required = process.env.METRICS_TOKEN;
  if (required) {
    const auth = req.headers.authorization || "";
    const expected = `Bearer ${required}`;
    if (auth !== expected) {
      return res.status(401).type("text/plain").send("metrics token required");
    }
  }

  // Ecosystem counts come from the persisted store; warm it up first so a
  // fresh scrape doesn't return zeros for a process that hasn't yet served
  // any /api/ecosystem/* request.
  await ensureEcosystemLoaded();

  const q = getQtradeMetrics();
  const e = getEcosystemMetrics();
  const mem = process.memoryUsage();
  const uptimeSec = Math.floor((Date.now() - startedAt) / 1000);

  const out =
    fmtMetric("aevion_accounts_total", "gauge", "Number of qtrade accounts", q.accounts) +
    fmtMetric("aevion_transfers_total", "counter", "Number of completed transfers", q.transfers) +
    fmtMetric("aevion_operations_total", "counter", "Number of ledger operations", q.operations) +
    fmtMetric("aevion_idempotency_cache_size", "gauge", "Live idempotency-key cache entries", q.idemCache) +
    fmtMetric("aevion_royalty_events_total", "counter", "QRight royalty events recorded", e.royaltyEvents) +
    fmtMetric("aevion_chess_prizes_total", "counter", "CyberChess prizes recorded", e.chessPrizes) +
    fmtMetric("aevion_planet_certs_total", "counter", "Planet certifications recorded", e.planetCerts) +
    fmtMetric("aevion_uptime_seconds", "counter", "Process uptime in seconds", uptimeSec) +
    fmtMetric("aevion_mem_heap_used_bytes", "gauge", "Process heap used in bytes", mem.heapUsed) +
    fmtMetric("aevion_mem_rss_bytes", "gauge", "Process RSS in bytes", mem.rss) +
    fmtMetric("aevion_sentry_enabled", "gauge", "1 if Sentry SDK is initialised", isSentryEnabled() ? 1 : 0);

  res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  res.send(out);
});
