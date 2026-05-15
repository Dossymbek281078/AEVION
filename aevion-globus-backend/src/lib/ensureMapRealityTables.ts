import type pg from "pg";

type PgPoolInstance = InstanceType<typeof pg.Pool>;

let ensured = false;
let dbReady: boolean | null = null;
let dbError: string | null = null;

export function isMapRealityDbReady(): boolean {
  return dbReady === true;
}

export function getMapRealityDbError(): string | null {
  return dbError;
}

export async function ensureMapRealityTables(pool: PgPoolInstance): Promise<void> {
  if (ensured) return;
  try {
    await pool.query("SELECT 1");
  } catch (e: unknown) {
    dbReady = false;
    ensured = true;
    dbError = e instanceof Error ? e.message : "database unavailable";
    console.warn(`[MapReality] Database unavailable — falling back to in-memory: ${dbError}`);
    return;
  }
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mapreality_signals (
        id            SERIAL PRIMARY KEY,
        title         TEXT NOT NULL,
        description   TEXT NOT NULL,
        category      TEXT NOT NULL CHECK (category IN ('need','event','request')),
        country       TEXT NOT NULL,
        city          TEXT,
        lat           DOUBLE PRECISION,
        lng           DOUBLE PRECISION,
        author_alias  TEXT NOT NULL,
        support_count INTEGER NOT NULL DEFAULT 0,
        status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','resolved','flagged')),
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_mapreality_signals_category
        ON mapreality_signals(category);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_mapreality_signals_country
        ON mapreality_signals(country);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_mapreality_signals_support
        ON mapreality_signals(support_count DESC);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_mapreality_signals_status
        ON mapreality_signals(status);
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mapreality_supports (
        id               SERIAL PRIMARY KEY,
        signal_id        INTEGER NOT NULL REFERENCES mapreality_signals(id) ON DELETE CASCADE,
        supporter_alias  TEXT NOT NULL,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (signal_id, supporter_alias)
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_mapreality_supports_signal
        ON mapreality_supports(signal_id);
    `);
    dbReady = true;
    console.log("[MapReality] Tables ready");
  } catch (e: unknown) {
    dbReady = false;
    dbError = e instanceof Error ? e.message : "table creation failed";
    console.warn(`[MapReality] Could not create tables — falling back to in-memory: ${dbError}`);
  } finally {
    ensured = true;
  }
}
