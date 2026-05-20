import type pg from "pg";

type PgPoolInstance = InstanceType<typeof pg.Pool>;

let ensured = false;
let dbReady: boolean | null = null;
let dbError: string | null = null;

export function isShadowNetDbReady(): boolean {
  return dbReady === true;
}

export function getShadowNetDbError(): string | null {
  return dbError;
}

/**
 * Create the shadownet tables if they don't exist. Falls back to in-memory
 * mode (handled by the caller) when the database is unavailable.
 *
 * Storage is OPAQUE — we only persist the client-encrypted ciphertext plus
 * the IV and salt needed for the client to derive the key again. We never
 * see the plaintext or password.
 */
export async function ensureShadowNetTables(pool: PgPoolInstance): Promise<void> {
  if (ensured) return;
  try {
    await pool.query("SELECT 1");
  } catch (e: unknown) {
    dbReady = false;
    ensured = true;
    dbError = e instanceof Error ? e.message : "database unavailable";
    console.warn(
      `[ShadowNet] Database unavailable — falling back to in-memory store: ${dbError}`,
    );
    return;
  }
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS shadownet_posts (
        id          SERIAL PRIMARY KEY,
        alias       TEXT NOT NULL,
        ciphertext  TEXT NOT NULL,
        iv          TEXT NOT NULL,
        salt        TEXT NOT NULL,
        size_bytes  INTEGER,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_shadownet_alias
        ON shadownet_posts(alias);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_shadownet_created
        ON shadownet_posts(created_at DESC);
    `);
    dbReady = true;
    console.log("[ShadowNet] Tables ready");
  } catch (e: unknown) {
    dbReady = false;
    dbError = e instanceof Error ? e.message : "table creation failed";
    console.warn(
      `[ShadowNet] Could not create tables — falling back to in-memory: ${dbError}`,
    );
  } finally {
    ensured = true;
  }
}
