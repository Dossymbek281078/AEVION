import type pg from "pg";

type PgPoolInstance = InstanceType<typeof pg.Pool>;

let ensured = false;
let dbReady: boolean | null = null;
let dbError: string | null = null;

export function isQEventsDbReady(): boolean {
  return dbReady === true;
}

export function getQEventsDbError(): string | null {
  return dbError;
}

export async function ensureQEventsTables(pool: PgPoolInstance): Promise<void> {
  if (ensured) return;
  try {
    await pool.query("SELECT 1");
  } catch (e: unknown) {
    dbReady = false;
    ensured = true;
    dbError = e instanceof Error ? e.message : "database unavailable";
    console.warn(`[QEvents] Database unavailable — falling back to in-memory store: ${dbError}`);
    return;
  }
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "QEvent" (
        "id"            TEXT PRIMARY KEY,
        "organizerId"   TEXT NOT NULL,
        "title"         TEXT NOT NULL,
        "description"   TEXT,
        "category"      TEXT NOT NULL DEFAULT 'tech',
        "location"      TEXT NOT NULL DEFAULT 'Online',
        "startAt"       TIMESTAMPTZ NOT NULL,
        "endAt"         TIMESTAMPTZ,
        "capacity"      INTEGER NOT NULL DEFAULT 100,
        "price"         INTEGER NOT NULL DEFAULT 0,
        "attendeeCount" INTEGER NOT NULL DEFAULT 0,
        "isPublic"      BOOLEAN NOT NULL DEFAULT TRUE,
        "coverUrl"      TEXT,
        "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "QEvent_start_idx"
        ON "QEvent" ("startAt");
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "QEventRSVP" (
        "id"        TEXT PRIMARY KEY,
        "eventId"   TEXT NOT NULL,
        "userId"    TEXT NOT NULL,
        "status"    TEXT NOT NULL DEFAULT 'going',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "QEventRSVP_uniq"
        ON "QEventRSVP" ("eventId", "userId");
    `);
    dbReady = true;
    console.log("[QEvents] Tables ready");
  } catch (e: unknown) {
    dbReady = false;
    dbError = e instanceof Error ? e.message : "table creation failed";
    console.warn(`[QEvents] Could not create tables — falling back to in-memory: ${dbError}`);
  } finally {
    ensured = true;
  }
}
