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

    // ── Listing tiers (2026-07) ──────────────────────────────────────────────
    // The exchange used to have one kind of row for everything from a one-line
    // idea to a revenue-earning product, with no deal terms at all. `tier` is
    // now the primary axis and carries its own terms; the original `stage`
    // column stays (it has a CHECK constraint and old rows depend on it) and is
    // written from the tier so the two can never drift apart.
    await pool.query(`ALTER TABLE startup_ideas ADD COLUMN IF NOT EXISTS tier TEXT;`);
    await pool.query(`ALTER TABLE startup_ideas ADD COLUMN IF NOT EXISTS sector TEXT;`);
    await pool.query(`ALTER TABLE startup_ideas ADD COLUMN IF NOT EXISTS geography TEXT;`);
    await pool.query(`ALTER TABLE startup_ideas ADD COLUMN IF NOT EXISTS demo_url TEXT;`);
    await pool.query(`ALTER TABLE startup_ideas ADD COLUMN IF NOT EXISTS repo_url TEXT;`);
    await pool.query(`ALTER TABLE startup_ideas ADD COLUMN IF NOT EXISTS deal JSONB;`);
    await pool.query(`ALTER TABLE startup_ideas ADD COLUMN IF NOT EXISTS metrics JSONB;`);
    // Assessment snapshot: stored so the feed can sort and filter by score
    // without recomputing, and so a score can be traced to the rules that made
    // it (assessment_version) instead of being silently re-graded by new rules.
    await pool.query(`ALTER TABLE startup_ideas ADD COLUMN IF NOT EXISTS assessment JSONB;`);
    await pool.query(`ALTER TABLE startup_ideas ADD COLUMN IF NOT EXISTS assessment_score INTEGER;`);
    await pool.query(`ALTER TABLE startup_ideas ADD COLUMN IF NOT EXISTS assessment_version INTEGER;`);

    // Backfill: every pre-tier row gets the tier its legacy stage implies.
    // Runs once — after this, `tier IS NULL` matches nothing.
    await pool.query(`
      UPDATE startup_ideas SET tier = CASE
        WHEN stage = 'idea' THEN 'idea'
        WHEN stage IN ('prototype','mvp') THEN 'mvp'
        WHEN stage = 'scaling' THEN 'product'
        ELSE 'idea' END
      WHERE tier IS NULL;
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_startup_ideas_tier ON startup_ideas(tier);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_startup_ideas_score ON startup_ideas(assessment_score DESC NULLS LAST);`);

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
    // An "interest" with no terms is a comment. These three columns make it an
    // offer the founder can answer yes or no to.
    await pool.query(`ALTER TABLE startup_interests ADD COLUMN IF NOT EXISTS intent TEXT;`);
    await pool.query(`ALTER TABLE startup_interests ADD COLUMN IF NOT EXISTS ticket_usd BIGINT;`);
    await pool.query(`ALTER TABLE startup_interests ADD COLUMN IF NOT EXISTS equity_pct NUMERIC;`);

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
