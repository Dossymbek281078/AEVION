import type pg from "pg";

type PgPoolInstance = InstanceType<typeof pg.Pool>;

let ensured = false;
let dbReady: boolean | null = null;
let dbError: string | null = null;

export function isDeepSanDbReady(): boolean {
  return dbReady === true;
}

export function getDeepSanDbError(): string | null {
  return dbError;
}

export async function ensureDeepSanTables(pool: PgPoolInstance): Promise<void> {
  if (ensured) return;
  try {
    await pool.query("SELECT 1");
  } catch (e: unknown) {
    dbReady = false;
    ensured = true;
    dbError = e instanceof Error ? e.message : "database unavailable";
    console.warn(`[DeepSan] Database unavailable — falling back to in-memory store: ${dbError}`);
    return;
  }
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS deepsan_tasks (
        id          SERIAL PRIMARY KEY,
        title       TEXT NOT NULL,
        description TEXT,
        priority    TEXT NOT NULL DEFAULT 'medium'
                      CHECK (priority IN ('low','medium','high','critical')),
        done        BOOLEAN NOT NULL DEFAULT FALSE,
        due_date    DATE,
        tags        TEXT[],
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_deepsan_tasks_done
        ON deepsan_tasks(done);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_deepsan_tasks_priority
        ON deepsan_tasks(priority);
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS deepsan_sessions (
        id                  SERIAL PRIMARY KEY,
        task_id             INTEGER REFERENCES deepsan_tasks(id) ON DELETE SET NULL,
        duration_min        INTEGER NOT NULL,
        actual_duration_min INTEGER,
        started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ended_at            TIMESTAMPTZ,
        status              TEXT NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active','done','abandoned'))
      );
    `);
    dbReady = true;
    console.log("[DeepSan] Tables ready");
  } catch (e: unknown) {
    dbReady = false;
    dbError = e instanceof Error ? e.message : "table creation failed";
    console.warn(`[DeepSan] Could not create tables — falling back to in-memory: ${dbError}`);
  } finally {
    ensured = true;
  }
}
