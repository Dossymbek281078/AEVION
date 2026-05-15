import type pg from "pg";

type PgPoolInstance = InstanceType<typeof pg.Pool>;

let ensured = false;
let _dbReady: boolean | null = null;
let _dbError: string | null = null;

export function isPsyAppDbReady(): boolean {
  return _dbReady === true;
}

export function getPsyAppDbError(): string | null {
  return _dbError;
}

/**
 * PsyApp-Deps tables — addiction recovery tracker.
 *
 * Three tables:
 *   psyapp_users     — per-alias program state (addiction kind, started_at, current streak anchor)
 *   psyapp_triggers  — log of urges/cravings with intensity 1..10 and free-text notes
 *   psyapp_relapses  — append-only history of resets; never deleted, total_relapses on user row
 *
 * Falls back silently to in-memory store if DATABASE_URL is missing or DDL fails.
 */
export async function ensurePsyAppTables(pool: PgPoolInstance): Promise<void> {
  if (ensured) return;

  try {
    await pool.query("SELECT 1");
  } catch (e: any) {
    _dbReady = false;
    ensured = true;
    _dbError = e?.message || "database unavailable";
    console.warn(`[PsyApp] Database unavailable — falling back to in-memory store: ${_dbError}`);
    return;
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS psyapp_users (
        alias            TEXT PRIMARY KEY,
        addiction        TEXT NOT NULL CHECK (addiction IN ('alcohol','smoking','other')),
        started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        streak_start_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        total_relapses   INTEGER NOT NULL DEFAULT 0
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS psyapp_triggers (
        id            SERIAL PRIMARY KEY,
        alias         TEXT NOT NULL,
        trigger_type  TEXT NOT NULL CHECK (trigger_type IN ('craving','stress','social','emotion')),
        intensity     INTEGER NOT NULL CHECK (intensity BETWEEN 1 AND 10),
        note          TEXT,
        coped_how     TEXT,
        logged_at     TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS psyapp_relapses (
        id           SERIAL PRIMARY KEY,
        alias        TEXT NOT NULL,
        relapsed_at  TIMESTAMPTZ DEFAULT NOW(),
        reason       TEXT
      );
    `);

    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_psyapp_triggers_alias ON psyapp_triggers (alias, logged_at DESC);`
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_psyapp_relapses_alias ON psyapp_relapses (alias, relapsed_at DESC);`
    );

    _dbReady = true;
    ensured = true;
    console.log("[PsyApp] Tables ready.");
  } catch (e: any) {
    _dbReady = false;
    ensured = true;
    _dbError = e?.message || "DDL failed";
    console.warn(`[PsyApp] Schema bootstrap failed — falling back to in-memory store: ${_dbError}`);
  }
}
