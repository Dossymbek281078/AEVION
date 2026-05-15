import type pg from "pg";

type PgPoolInstance = InstanceType<typeof pg.Pool>;

let ensured = false;
let dbReady: boolean | null = null;
let dbError: string | null = null;

export function isStartupExchangeDbReady(): boolean {
  return dbReady === true;
}

export function getStartupExchangeDbError(): string | null {
  return dbError;
}

/**
 * Create the StartupX tables (and indexes) on first call.
 *
 * Defensive: if Postgres is unavailable or table creation fails, we flip
 * `dbReady=false` and let the route fall back to its in-memory Map. This
 * keeps `/startup-exchange` functional in local dev / preview deploys
 * without a database — same pattern as ensureQNewsTables / ensureQJobsTables.
 */
export async function ensureStartupExchangeTables(pool: PgPoolInstance): Promise<void> {
  if (ensured) return;
  try {
    await pool.query("SELECT 1");
  } catch (e: unknown) {
    dbReady = false;
    ensured = true;
    dbError = e instanceof Error ? e.message : "database unavailable";
    console.warn(`[StartupX] Database unavailable — falling back to in-memory store: ${dbError}`);
    return;
  }
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS startup_ideas (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        stage TEXT NOT NULL CHECK (stage IN ('idea','prototype','mvp','scaling')),
        founder_email TEXT,
        contact_method TEXT,
        qright_object_id TEXT,
        content_hash TEXT,
        visibility TEXT NOT NULL DEFAULT 'public',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_startup_ideas_stage ON startup_ideas(stage);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_startup_ideas_created ON startup_ideas(created_at DESC);`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS startup_interests (
        id SERIAL PRIMARY KEY,
        idea_id INTEGER NOT NULL REFERENCES startup_ideas(id) ON DELETE CASCADE,
        investor_email TEXT NOT NULL,
        message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_startup_interests_idea ON startup_interests(idea_id);`);

    dbReady = true;
    console.log("[StartupX] Tables ready");
  } catch (e: unknown) {
    dbReady = false;
    dbError = e instanceof Error ? e.message : "table creation failed";
    console.warn(`[StartupX] Could not create tables — falling back to in-memory: ${dbError}`);
  } finally {
    ensured = true;
  }
}
