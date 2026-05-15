/**
 * QGood Psychology Platform — table bootstrap.
 *
 * Creates qgood_moods and qgood_completions if they don't exist.
 * Silent fallback to in-memory mode if DB is unreachable.
 * Patterned on ensureKidsAiTables.ts.
 */

import type pg from "pg";

type PgPoolInstance = InstanceType<typeof pg.Pool>;

let ensured = false;
let dbReady: boolean | null = null;
let dbError: string | null = null;

export function isQGoodDbReady(): boolean {
  return dbReady === true;
}

export function getQGoodDbError(): string | null {
  return dbError;
}

export async function ensureQGoodTables(pool: PgPoolInstance): Promise<void> {
  if (ensured) return;
  try {
    await pool.query("SELECT 1");
  } catch (e: unknown) {
    dbReady = false;
    ensured = true;
    dbError = e instanceof Error ? e.message : "database unavailable";
    console.warn(`[QGood] Database unavailable — falling back to in-memory: ${dbError}`);
    return;
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS qgood_moods (
        id         SERIAL PRIMARY KEY,
        user_id    TEXT NOT NULL DEFAULT 'anonymous',
        score      INTEGER NOT NULL CHECK (score BETWEEN 1 AND 10),
        emotion    TEXT,
        context    TEXT,
        logged_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_qgood_moods_user_id
        ON qgood_moods(user_id, logged_at DESC);
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS qgood_completions (
        id            SERIAL PRIMARY KEY,
        user_id       TEXT NOT NULL DEFAULT 'anonymous',
        exercise_id   TEXT NOT NULL,
        completed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_qgood_completions_user_id
        ON qgood_completions(user_id, completed_at DESC);
    `);

    dbReady = true;
    console.log("[QGood] Tables ready");
  } catch (e: unknown) {
    dbReady = false;
    dbError = e instanceof Error ? e.message : "table creation failed";
    console.warn(`[QGood] Could not create tables — falling back to in-memory: ${dbError}`);
  } finally {
    ensured = true;
  }
}
