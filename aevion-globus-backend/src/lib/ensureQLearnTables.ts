import type pg from "pg";

type PgPoolInstance = InstanceType<typeof pg.Pool>;

let ensured = false;
let dbReady: boolean | null = null;
let dbError: string | null = null;

export function isQLearnDbReady(): boolean {
  return dbReady === true;
}

export function getQLearnDbError(): string | null {
  return dbError;
}

export async function ensureQLearnTables(pool: PgPoolInstance): Promise<void> {
  if (ensured) return;
  try {
    await pool.query("SELECT 1");
  } catch (e: unknown) {
    dbReady = false;
    ensured = true;
    dbError = e instanceof Error ? e.message : "database unavailable";
    console.warn(`[QLearn] Database unavailable — falling back to in-memory store: ${dbError}`);
    return;
  }
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "QLearnCourse" (
        "id"              TEXT PRIMARY KEY,
        "authorId"        TEXT NOT NULL,
        "title"           TEXT NOT NULL,
        "description"     TEXT,
        "category"        TEXT NOT NULL DEFAULT 'tech',
        "level"           TEXT NOT NULL DEFAULT 'beginner',
        "price"           INTEGER NOT NULL DEFAULT 0,
        "isPublic"        BOOLEAN NOT NULL DEFAULT TRUE,
        "enrollmentCount" INTEGER NOT NULL DEFAULT 0,
        "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "QLearnCourse_cat_idx"
        ON "QLearnCourse" ("category", "enrollmentCount" DESC);
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "QLearnLesson" (
        "id"        TEXT PRIMARY KEY,
        "courseId"  TEXT NOT NULL,
        "title"     TEXT NOT NULL,
        "content"   TEXT NOT NULL DEFAULT '',
        "videoUrl"  TEXT,
        "duration"  INTEGER NOT NULL DEFAULT 0,
        "order"     INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "QLearnLesson_course_idx"
        ON "QLearnLesson" ("courseId", "order");
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "QLearnEnrollment" (
        "id"         TEXT PRIMARY KEY,
        "courseId"   TEXT NOT NULL,
        "userId"     TEXT NOT NULL,
        "progress"   INTEGER NOT NULL DEFAULT 0,
        "enrolledAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "QLearnEnrollment_uniq"
        ON "QLearnEnrollment" ("courseId", "userId");
    `);
    dbReady = true;
    console.log("[QLearn] Tables ready");
  } catch (e: unknown) {
    dbReady = false;
    dbError = e instanceof Error ? e.message : "table creation failed";
    console.warn(`[QLearn] Could not create tables — falling back to in-memory: ${dbError}`);
  } finally {
    ensured = true;
  }
}
