/**
 * Cross-module smartComplete run log — Postgres persistence for the platform
 * savings tally, so the "AI spent rationally" number survives restarts and can
 * be broken down per module over all time.
 *
 * Best-effort + DB-optional, matching the QCoreAI store philosophy: if there is
 * no reachable database, every function here quietly no-ops (writes) or returns
 * null (reads), and the caller falls back to the in-memory session tally. Writes
 * are fire-and-forget — logging a run must never slow or fail a user request.
 */
import { getPool } from "./dbPool";

const EST_COUNCIL_COST_USD = 0.077;

let ensured = false;
let dbUsable: boolean | null = null;

async function ensureTable(): Promise<boolean> {
  if (ensured) return dbUsable === true;
  ensured = true;
  try {
    const pool = getPool();
    await pool.query("SELECT 1");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "smart_run_log" (
        "id"        BIGSERIAL PRIMARY KEY,
        "ts"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "module"    TEXT NOT NULL DEFAULT 'qcoreai',
        "resolved"  TEXT NOT NULL,
        "depth"     TEXT,
        "costUsd"   DOUBLE PRECISION NOT NULL DEFAULT 0,
        "savedUsd"  DOUBLE PRECISION NOT NULL DEFAULT 0
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS "smart_run_log_module_ts_idx" ON "smart_run_log" ("module", "ts");`);
    dbUsable = true;
  } catch (e: any) {
    dbUsable = false;
    console.warn(`[smartRunLog] DB unavailable — savings persistence off: ${e?.message || e}`);
  }
  return dbUsable === true;
}

export type SmartRunRow = {
  module: string;
  resolved: "single" | "council";
  depth?: "light" | "deep";
  costUsd: number;
  savedUsd: number;
};

/** Fire-and-forget: persist one routed run. Never throws. */
export function insertSmartRun(row: SmartRunRow): void {
  void (async () => {
    try {
      if (!(await ensureTable())) return;
      await getPool().query(
        `INSERT INTO "smart_run_log" ("module","resolved","depth","costUsd","savedUsd") VALUES ($1,$2,$3,$4,$5)`,
        [row.module, row.resolved, row.depth ?? null, row.costUsd, row.savedUsd]
      );
    } catch {
      /* best-effort — drop silently */
    }
  })();
}

export type SmartModuleAgg = {
  module: string;
  runs: number;
  facts: number;
  light: number;
  deep: number;
  totalCostUsd: number;
  savedUsd: number;
};

export type SmartAllTime = {
  runs: number;
  facts: number;
  light: number;
  deep: number;
  totalCostUsd: number;
  estAlwaysCouncilUsd: number;
  savedUsd: number;
  savedPct: number;
  perModule: SmartModuleAgg[];
};

/** All-time aggregate from the DB, or null when persistence is unavailable. */
export async function aggregateSmartRuns(): Promise<SmartAllTime | null> {
  if (!(await ensureTable())) return null;
  try {
    type Row = { module: string; runs: string; facts: string; light: string; deep: string; cost: string; saved: string };
    const result = await getPool().query(`
      SELECT
        "module",
        COUNT(*)                                             AS runs,
        COUNT(*) FILTER (WHERE "resolved" = 'single')        AS facts,
        COUNT(*) FILTER (WHERE "resolved" = 'council' AND "depth" = 'light') AS light,
        COUNT(*) FILTER (WHERE "resolved" = 'council' AND "depth" = 'deep')  AS deep,
        COALESCE(SUM("costUsd"), 0)                          AS cost,
        COALESCE(SUM("savedUsd"), 0)                         AS saved
      FROM "smart_run_log"
      GROUP BY "module"
      ORDER BY runs DESC
    `);
    const rows = result.rows as Row[];
    const perModule: SmartModuleAgg[] = rows.map((r) => ({
      module: r.module,
      runs: Number(r.runs),
      facts: Number(r.facts),
      light: Number(r.light),
      deep: Number(r.deep),
      totalCostUsd: Number(r.cost),
      savedUsd: Number(r.saved),
    }));
    const total = perModule.reduce(
      (a, m) => {
        a.runs += m.runs; a.facts += m.facts; a.light += m.light; a.deep += m.deep;
        a.totalCostUsd += m.totalCostUsd; a.savedUsd += m.savedUsd;
        return a;
      },
      { runs: 0, facts: 0, light: 0, deep: 0, totalCostUsd: 0, savedUsd: 0 }
    );
    const estAlwaysCouncilUsd = total.runs * EST_COUNCIL_COST_USD;
    const savedPct = estAlwaysCouncilUsd > 0 ? (100 * total.savedUsd) / estAlwaysCouncilUsd : 0;
    return { ...total, estAlwaysCouncilUsd, savedPct, perModule };
  } catch {
    return null;
  }
}
