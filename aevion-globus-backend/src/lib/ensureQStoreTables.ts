import type pg from "pg";

type PgPoolInstance = InstanceType<typeof pg.Pool>;

let ensured = false;
let dbReady: boolean | null = null;
let dbError: string | null = null;

export function isQStoreDbReady(): boolean {
  return dbReady === true;
}

export function getQStoreDbError(): string | null {
  return dbError;
}

export async function ensureQStoreTables(pool: PgPoolInstance): Promise<void> {
  if (ensured) return;
  try {
    await pool.query("SELECT 1");
  } catch (e: unknown) {
    dbReady = false;
    ensured = true;
    dbError = e instanceof Error ? e.message : "database unavailable";
    console.warn(`[QStore] Database unavailable — falling back to in-memory store: ${dbError}`);
    return;
  }
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "QStoreProduct" (
        "id"          TEXT PRIMARY KEY,
        "sellerId"    TEXT NOT NULL,
        "title"       TEXT NOT NULL,
        "description" TEXT,
        "category"    TEXT NOT NULL DEFAULT 'template',
        "price"       INTEGER NOT NULL DEFAULT 0,
        "currency"    TEXT NOT NULL DEFAULT 'usd',
        "previewUrl"  TEXT,
        "tags"        TEXT[] DEFAULT '{}',
        "salesCount"  INTEGER NOT NULL DEFAULT 0,
        "isPublic"    BOOLEAN NOT NULL DEFAULT TRUE,
        "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "QStoreProduct_cat_idx"
        ON "QStoreProduct" ("category", "salesCount" DESC);
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "QStorePurchase" (
        "id"              TEXT PRIMARY KEY,
        "productId"       TEXT NOT NULL,
        "buyerId"         TEXT NOT NULL,
        "amount"          INTEGER NOT NULL DEFAULT 0,
        "status"          TEXT NOT NULL DEFAULT 'pending',
        "stripeSessionId" TEXT,
        "paidAt"          TIMESTAMPTZ,
        "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(`ALTER TABLE "QStorePurchase" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'pending'`);
    await pool.query(`ALTER TABLE "QStorePurchase" ADD COLUMN IF NOT EXISTS "stripeSessionId" TEXT`);
    await pool.query(`ALTER TABLE "QStorePurchase" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMPTZ`);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "QStorePurchase_buyer_idx"
        ON "QStorePurchase" ("buyerId");
    `);
    dbReady = true;
    console.log("[QStore] Tables ready");
  } catch (e: unknown) {
    dbReady = false;
    dbError = e instanceof Error ? e.message : "table creation failed";
    console.warn(`[QStore] Could not create tables — falling back to in-memory: ${dbError}`);
  } finally {
    ensured = true;
  }
}
