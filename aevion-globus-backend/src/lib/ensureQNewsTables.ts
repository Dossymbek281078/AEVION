import type pg from "pg";

type PgPoolInstance = InstanceType<typeof pg.Pool>;

let ensured = false;
let dbReady: boolean | null = null;
let dbError: string | null = null;

export function isQNewsDbReady(): boolean {
  return dbReady === true;
}

export function getQNewsDbError(): string | null {
  return dbError;
}

export async function ensureQNewsTables(pool: PgPoolInstance): Promise<void> {
  if (ensured) return;
  try {
    await pool.query("SELECT 1");
  } catch (e: unknown) {
    dbReady = false;
    ensured = true;
    dbError = e instanceof Error ? e.message : "database unavailable";
    console.warn(`[QNews] Database unavailable — falling back to in-memory: ${dbError}`);
    return;
  }
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "QNewsArticle" (
        "id"          TEXT PRIMARY KEY,
        "title"       TEXT NOT NULL,
        "summary"     TEXT NOT NULL,
        "url"         TEXT NOT NULL,
        "source"      TEXT NOT NULL,
        "category"    TEXT NOT NULL DEFAULT 'tech',
        "tags"        TEXT[] DEFAULT '{}',
        "authorId"    TEXT,
        "publishedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "QNewsArticle_category_idx"
        ON "QNewsArticle" ("category", "publishedAt" DESC);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "QNewsArticle_published_idx"
        ON "QNewsArticle" ("publishedAt" DESC);
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "QNewsBookmark" (
        "id"        TEXT PRIMARY KEY,
        "userId"    TEXT NOT NULL,
        "articleId" TEXT NOT NULL REFERENCES "QNewsArticle"("id") ON DELETE CASCADE,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE ("userId", "articleId")
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "QNewsBookmark_user_idx"
        ON "QNewsBookmark" ("userId", "createdAt" DESC);
    `);
    dbReady = true;
    console.log("[QNews] Tables ready");
  } catch (e: unknown) {
    dbReady = false;
    dbError = e instanceof Error ? e.message : "table creation failed";
    console.warn(`[QNews] Could not create tables — falling back to in-memory: ${dbError}`);
  } finally {
    ensured = true;
  }
}
