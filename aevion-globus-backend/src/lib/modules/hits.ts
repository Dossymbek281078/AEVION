import crypto from "crypto";
import pg from "pg";

type PgPool = InstanceType<typeof pg.Pool>;

// Public-surface hit log. Used to compute trending modules over rolling
// 24h / 7d windows. Writes are fire-and-forget so /embed and /badge.svg
// stay fast; reads are cheap thanks to a single index on (moduleId, at).
//
// The table is intentionally narrow — no IP, no user-agent, no headers.
// We only need "module M was loaded N times in window W" to rank, and
// keeping it narrow means we can prune aggressively later without
// losing referent meaning.

export type ModuleHitSurface = "embed" | "badge" | "detail";

let ensured = false;

export async function ensureModuleHitTable(pool: PgPool): Promise<void> {
  if (ensured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "ModuleHit" (
      "id" TEXT PRIMARY KEY,
      "moduleId" TEXT NOT NULL,
      "surface" TEXT NOT NULL,
      "at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "ModuleHit_module_at_idx" ON "ModuleHit" ("moduleId", "at" DESC);`
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "ModuleHit_at_idx" ON "ModuleHit" ("at" DESC);`
  );
  ensured = true;
}

/**
 * Fire-and-forget hit increment. Never throws — public surfaces should
 * stay fast even if the hit log can't be written. Errors are warn-logged
 * (rate-limited by the surrounding rate limiter, so no log flood risk).
 */
export function recordModuleHit(
  pool: PgPool,
  moduleId: string,
  surface: ModuleHitSurface
): void {
  setImmediate(() => {
    ensureModuleHitTable(pool)
      .then(() =>
        pool.query(
          `INSERT INTO "ModuleHit" ("id","moduleId","surface") VALUES ($1,$2,$3)`,
          [crypto.randomUUID(), moduleId, surface]
        )
      )
      .catch((e: unknown) => {
        console.warn(
          "[modules-hits] insert failed:",
          e instanceof Error ? e.message : String(e)
        );
      });
  });
}

export type TrendingWindow = "24h" | "7d";

const WINDOW_INTERVAL: Record<TrendingWindow, string> = {
  "24h": "24 hours",
  "7d": "7 days",
};

export async function loadTrending(
  pool: PgPool,
  window: TrendingWindow,
  limit: number
): Promise<{ moduleId: string; hits: number }[]> {
  await ensureModuleHitTable(pool);
  const r = await pool.query(
    `SELECT "moduleId", COUNT(*)::int AS hits
     FROM "ModuleHit"
     WHERE "at" >= NOW() - $1::interval
     GROUP BY "moduleId"
     ORDER BY hits DESC, "moduleId" ASC
     LIMIT $2`,
    [WINDOW_INTERVAL[window], limit]
  );
  return r.rows.map((row: any) => ({ moduleId: row.moduleId, hits: row.hits }));
}
