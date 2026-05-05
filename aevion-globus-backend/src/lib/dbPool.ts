import pg from "pg";
import { captureException } from "./sentry";

type PgPoolInstance = InstanceType<typeof pg.Pool>;
type PgPoolClient = InstanceType<typeof pg.Client>;

let pool: PgPoolInstance | null = null;

/**
 * Single shared Postgres pool for all routes.
 *
 * Tuning rationale (production):
 *   - max: 20 — Railway free Postgres caps at 100 connections; we keep
 *     headroom for migrations/admin tools while serving spiky burst traffic.
 *     Override via PG_POOL_MAX.
 *   - idleTimeoutMillis: 30s — frees idle conns during quiet periods.
 *   - connectionTimeoutMillis: 5s — quick fail-fast so /health flips to
 *     degraded instead of hanging on cold-start storms.
 *   - keepAlive: true — avoids dropped TCP after long idle behind Railway's
 *     proxy. Without this we'd see ECONNRESET on first query after ~10min idle.
 *   - statement_timeout (per-conn): 10s — kills runaway queries before they
 *     pile up and exhaust the pool.
 *
 * Errors on idle clients are reported to Sentry (when configured) and logged,
 * never re-thrown — pg's pool error event is fired off the request path so
 * letting it propagate would crash the process.
 */
export function getPool(): PgPoolInstance {
  if (!pool) {
    const max = Number(process.env.PG_POOL_MAX ?? 20);
    const idleMs = Number(process.env.PG_POOL_IDLE_MS ?? 30_000);
    const connMs = Number(process.env.PG_POOL_CONN_MS ?? 5_000);
    const stmtMs = Number(process.env.PG_STATEMENT_TIMEOUT_MS ?? 10_000);

    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max,
      idleTimeoutMillis: idleMs,
      connectionTimeoutMillis: connMs,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10_000,
      application_name: "aevion-backend",
    });

    // Set per-connection statement timeout. This bounds how long any single
    // query can run, protecting the pool from runaway queries.
    pool.on("connect", (client: PgPoolClient) => {
      client.query(`SET statement_timeout = ${stmtMs}`).catch((err: Error) => {
        console.warn("[dbPool] failed to set statement_timeout:", err?.message || err);
      });
    });

    pool.on("error", (err: Error) => {
      // Idle client errors are NOT request-bound; they happen out-of-band when
      // the DB closes a TCP connection. Logging + Sentry is enough — never throw.
      console.warn("[dbPool] idle client error:", err?.message || err);
      captureException(err, { source: "dbPool", phase: "idle" });
    });

    if (process.env.NODE_ENV !== "test") {
      console.log(
        `[dbPool] init max=${max} idleMs=${idleMs} connMs=${connMs} stmtMs=${stmtMs}`,
      );
    }
  }
  return pool;
}

/**
 * Pool stats for /health and runbook diagnostics.
 * Returns null if pool was never initialised (no queries yet).
 */
export function getPoolStats(): { total: number; idle: number; waiting: number } | null {
  if (!pool) return null;
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  };
}
