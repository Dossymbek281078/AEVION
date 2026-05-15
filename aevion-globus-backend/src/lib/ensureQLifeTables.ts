import type pg from "pg";

type PgPoolInstance = InstanceType<typeof pg.Pool>;

let ensured = false;
let _dbReady: boolean | null = null;
let _dbError: string | null = null;

export function isQLifeDbReady(): boolean {
  return _dbReady === true;
}

export function getQLifeDbError(): string | null {
  return _dbError;
}

export async function ensureQLifeTables(pool: PgPoolInstance): Promise<void> {
  if (ensured) return;

  try {
    await pool.query("SELECT 1");
  } catch (e: any) {
    _dbReady = false;
    ensured = true;
    _dbError = e?.message || "database unavailable";
    console.warn(`[QLife] Database unavailable — falling back to in-memory store: ${_dbError}`);
    return;
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS qlife_biomarkers (
        id          SERIAL PRIMARY KEY,
        user_id     TEXT NOT NULL DEFAULT 'anonymous',
        type        TEXT NOT NULL CHECK (type IN (
                      'blood_pressure','weight_kg','sleep_hours',
                      'vo2max','hrv','glucose','stress_level'
                    )),
        value       NUMERIC NOT NULL,
        unit        TEXT NOT NULL,
        notes       TEXT,
        measured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_qlife_type
        ON qlife_biomarkers (type);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_qlife_user
        ON qlife_biomarkers (user_id);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_qlife_measured
        ON qlife_biomarkers (measured_at DESC);
    `);

    _dbReady = true;
    ensured = true;
    console.log("[QLife] Tables ready.");
  } catch (e: any) {
    _dbReady = false;
    ensured = true;
    _dbError = e?.message || "DDL failed";
    console.warn(`[QLife] Schema bootstrap failed — falling back to in-memory store: ${_dbError}`);
  }
}
