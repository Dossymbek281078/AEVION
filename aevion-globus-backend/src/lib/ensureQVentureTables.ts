import type pg from "pg";

type PgPoolInstance = InstanceType<typeof pg.Pool>;

let ensured = false;
let dbReady: boolean | null = null;
let dbError: string | null = null;

export function isQVentureDbReady(): boolean {
  return dbReady === true;
}

export function getQVentureDbError(): string | null {
  return dbError;
}

/**
 * Create the QVenture tables on first call. Defensive: if Postgres is
 * unavailable, flip dbReady=false and let the route use its in-memory store —
 * same pattern as ensureStartupExchangeTables / ensureQNewsTables.
 */
export async function ensureQVentureTables(pool: PgPoolInstance): Promise<void> {
  if (ensured) return;
  try {
    await pool.query("SELECT 1");
  } catch (e: unknown) {
    dbReady = false;
    ensured = true;
    dbError = e instanceof Error ? e.message : "database unavailable";
    console.warn(`[QVenture] Database unavailable — in-memory store active: ${dbError}`);
    return;
  }
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS qventure_analyses (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        sector TEXT NOT NULL,
        stage TEXT NOT NULL,
        geography TEXT,
        ask_usd BIGINT,
        composite NUMERIC NOT NULL,
        verdict TEXT NOT NULL,
        result JSONB NOT NULL,
        content_hash TEXT,
        visibility TEXT NOT NULL DEFAULT 'public',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    // The analysed plan itself, kept so a past verdict can be re-derived when the
    // rubric changes. Without it a stored analysis is unreproducible: the record
    // holds only the derived scores, so an engine fix cannot be applied backwards
    // and a founder cannot be shown why the number moved. Never served over the
    // API — see redactInput() — because these are confidential business plans and
    // analyses are public by default.
    await pool.query(`ALTER TABLE qventure_analyses ADD COLUMN IF NOT EXISTS analysis_input JSONB;`);
    // Dedupe key over every scoring-relevant field (not content_hash, which covers
    // only name/sector/stage/description). Lets re-submitting the same plan return
    // the existing analysis instead of minting a duplicate that inflates the
    // gallery and skews percentiles — and saves the council LLM calls.
    await pool.query(`ALTER TABLE qventure_analyses ADD COLUMN IF NOT EXISTS dedupe_hash TEXT;`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_qventure_dedupe ON qventure_analyses(dedupe_hash);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_qventure_created ON qventure_analyses(created_at DESC);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_qventure_verdict ON qventure_analyses(verdict);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_qventure_sector ON qventure_analyses(sector);`);
    // Per-investor saved-deals list. Stores a lightweight summary snapshot so the
    // watchlist renders without joining back to qventure_analyses (and survives
    // even if the underlying analysis is later evicted). Keyed by (user, deal).
    await pool.query(`
      CREATE TABLE IF NOT EXISTS qventure_watchlist (
        user_id TEXT NOT NULL,
        analysis_id TEXT NOT NULL,
        name TEXT NOT NULL,
        sector TEXT NOT NULL,
        stage TEXT NOT NULL,
        composite NUMERIC NOT NULL DEFAULT 0,
        verdict TEXT NOT NULL DEFAULT '',
        saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, analysis_id)
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_qventure_watchlist_user ON qventure_watchlist(user_id, saved_at DESC);`);
    dbReady = true;
    ensured = true;
    console.log("[QVenture] Tables ready (Postgres).");
  } catch (e: unknown) {
    dbReady = false;
    ensured = true;
    dbError = e instanceof Error ? e.message : "table creation failed";
    console.warn(`[QVenture] Table creation failed — in-memory store active: ${dbError}`);
  }
}
