/**
 * Constitution uptime monitor.
 *
 *   GET /api/constitution/status  — returns latest check per service +
 *                                   uptime % + 24h sparkline (5-min buckets)
 *
 * Background job pings 6 endpoints every 30s. Results stored in in-memory
 * ring of last 5000 check-rows per service; Postgres
 * `constitution_uptime` when available.
 */

import { Router, type Request, type Response } from "express";
import { rateLimit } from "../lib/rateLimit";
import { getPool } from "../lib/dbPool";

type ServiceKey =
  | "main"
  | "public_api"
  | "scenarios"
  | "artifacts"
  | "artifact_stats"
  | "plan";

type CheckRow = {
  service: ServiceKey;
  ok: boolean;
  latencyMs: number;
  statusCode: number | null;
  checkedAt: string;
};

const RING_MAX = 5000;
const ring = new Map<ServiceKey, CheckRow[]>([
  ["main", []],
  ["public_api", []],
  ["scenarios", []],
  ["artifacts", []],
  ["artifact_stats", []],
  ["plan", []],
]);

let tableReady = false;
let dbAvailable = false;

async function ensureUptimeTable(): Promise<void> {
  if (tableReady) return;
  try {
    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS constitution_uptime (
        "id"        BIGSERIAL PRIMARY KEY,
        "service"   TEXT NOT NULL,
        "ok"        BOOLEAN NOT NULL,
        "latencyMs" INTEGER NOT NULL,
        "statusCode" INTEGER,
        "checkedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_constitution_uptime_service_checked
        ON constitution_uptime ("service", "checkedAt" DESC);
    `);
    dbAvailable = true;
  } catch {
    dbAvailable = false;
  }
  tableReady = true;
}

async function recordCheck(row: CheckRow): Promise<void> {
  const arr = ring.get(row.service)!;
  arr.unshift(row);
  if (arr.length > RING_MAX) arr.length = RING_MAX;
  await ensureUptimeTable();
  if (dbAvailable) {
    try {
      const pool = getPool();
      await pool.query(
        `INSERT INTO constitution_uptime ("service","ok","latencyMs","statusCode","checkedAt")
         VALUES ($1,$2,$3,$4,$5)`,
        [row.service, row.ok, row.latencyMs, row.statusCode ?? null, row.checkedAt],
      );
    } catch {
      /* ignore — in-memory still recorded */
    }
  }
}

type ServiceConfig = {
  key: ServiceKey;
  name: string;
  path: string;
  method?: "GET" | "HEAD";
  expectStatus?: number;
};

const SERVICES: ServiceConfig[] = [
  { key: "main",           name: "Backend health",    path: "/health",                                    expectStatus: 200 },
  { key: "public_api",     name: "Public API regimes",path: "/api/constitution/public/regimes",           expectStatus: 200 },
  { key: "scenarios",      name: "Scenarios list",    path: "/api/constitution/scenarios?limit=1",        expectStatus: 200 },
  { key: "artifacts",      name: "Planet artifacts",  path: "/api/planet/constitution-artifacts?limit=1", expectStatus: 200 },
  { key: "artifact_stats", name: "Artifact stats",    path: "/api/planet/constitution-artifacts/stats",   expectStatus: 200 },
  { key: "plan",           name: "Plan endpoint",     path: "/api/constitution/me/plan",                  expectStatus: 200 },
];

async function pingService(cfg: ServiceConfig, baseUrl: string): Promise<void> {
  const t0 = Date.now();
  let ok = false;
  let statusCode: number | null = null;
  try {
    const r = await fetch(`${baseUrl}${cfg.path}`, {
      method: cfg.method ?? "GET",
      signal: AbortSignal.timeout(8000),
    });
    statusCode = r.status;
    ok = r.status === (cfg.expectStatus ?? 200);
  } catch {
    ok = false;
  }
  await recordCheck({
    service: cfg.key,
    ok,
    latencyMs: Date.now() - t0,
    statusCode,
    checkedAt: new Date().toISOString(),
  });
}

let checkerRunning = false;

export function startUptimeChecker(port: number | string): void {
  if (checkerRunning) return;
  checkerRunning = true;
  const baseUrl = `http://127.0.0.1:${port}`;
  void ensureUptimeTable();
  // Stagger initial pings 1s apart then run every 30s
  SERVICES.forEach((svc, i) => {
    setTimeout(() => {
      void pingService(svc, baseUrl);
      setInterval(() => void pingService(svc, baseUrl), 30_000);
    }, i * 1000);
  });
}

function uptimePercent(rows: CheckRow[], windowMs = 24 * 60 * 60 * 1000): number {
  const since = Date.now() - windowMs;
  const recent = rows.filter((r) => new Date(r.checkedAt).getTime() > since);
  if (!recent.length) return 100;
  return Math.round((recent.filter((r) => r.ok).length / recent.length) * 1000) / 10;
}

/** 5-minute buckets over last 24h for sparkline. Each bucket: avg latency or null if no checks. */
function sparkline(rows: CheckRow[], buckets = 288): Array<{ t: string; avgMs: number; ok: boolean }> {
  const now = Date.now();
  const bucketMs = (24 * 60 * 60 * 1000) / buckets;
  const result: Array<{ t: string; avgMs: number; ok: boolean }> = [];
  for (let i = buckets - 1; i >= 0; i--) {
    const start = now - (i + 1) * bucketMs;
    const end = now - i * bucketMs;
    const inBucket = rows.filter((r) => {
      const t = new Date(r.checkedAt).getTime();
      return t >= start && t < end;
    });
    if (!inBucket.length) continue;
    const avgMs = Math.round(inBucket.reduce((s, r) => s + r.latencyMs, 0) / inBucket.length);
    const ok = inBucket.every((r) => r.ok);
    result.push({ t: new Date(start).toISOString(), avgMs, ok });
  }
  return result;
}

export const constitutionStatusRouter = Router();

const readLimit = rateLimit({ windowMs: 60_000, max: 120, keyPrefix: "constitution-status" });

constitutionStatusRouter.get(
  "/",
  readLimit as unknown as (req: Request, res: Response, next: () => void) => void,
  (_req: Request, res: Response) => {
    const services = SERVICES.map((svc) => {
      const rows = ring.get(svc.key) ?? [];
      const latest = rows[0] ?? null;
      return {
        key: svc.key,
        name: svc.name,
        status: !latest ? "unknown" : latest.ok ? "up" : "down",
        latestLatencyMs: latest?.latencyMs ?? null,
        latestStatus: latest?.statusCode ?? null,
        lastChecked: latest?.checkedAt ?? null,
        uptime24hPct: uptimePercent(rows),
        sparkline: sparkline(rows),
      };
    });
    const allUp = services.every((s) => s.status === "up");
    const anyDown = services.some((s) => s.status === "down");
    res.json({
      summary: anyDown ? "degraded" : allUp ? "operational" : "pending",
      checkedAt: new Date().toISOString(),
      services,
    });
  },
);
