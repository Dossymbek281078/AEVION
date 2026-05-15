import type pg from "pg";

type PgPoolInstance = InstanceType<typeof pg.Pool>;

let ensured = false;
let _dbReady: boolean | null = null;
let _dbError: string | null = null;

export function isLifeBoxDbReady(): boolean {
  return _dbReady === true;
}

export function getLifeBoxDbError(): string | null {
  return _dbError;
}

export async function ensureLifeBoxTables(pool: PgPoolInstance): Promise<void> {
  if (ensured) return;

  try {
    await pool.query("SELECT 1");
  } catch (e: any) {
    _dbReady = false;
    ensured = true;
    _dbError = e?.message || "database unavailable";
    console.warn(`[LifeBox] Database unavailable — falling back to in-memory store: ${_dbError}`);
    return;
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS lifebox_capsules (
        id           SERIAL PRIMARY KEY,
        alias        TEXT NOT NULL,
        title        TEXT NOT NULL,
        content      TEXT NOT NULL,
        category     TEXT NOT NULL CHECK (category IN (
                       'knowledge','values','instructions','future_self','advice'
                     )),
        unlock_at    TIMESTAMPTZ NOT NULL,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        unlocked_at  TIMESTAMPTZ
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_lifebox_alias
        ON lifebox_capsules (alias);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_lifebox_unlock_at
        ON lifebox_capsules (unlock_at);
    `);

    _dbReady = true;
    ensured = true;
    console.log("[LifeBox] Tables ready.");
  } catch (e: any) {
    _dbReady = false;
    ensured = true;
    _dbError = e?.message || "DDL failed";
    console.warn(`[LifeBox] Schema bootstrap failed — falling back to in-memory store: ${_dbError}`);
  }
}
