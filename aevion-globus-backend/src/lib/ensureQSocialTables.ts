import type pg from "pg";

type PgPoolInstance = InstanceType<typeof pg.Pool>;

let ensured = false;
let dbReady: boolean | null = null;
let dbError: string | null = null;

export function isQSocialDbReady(): boolean {
  return dbReady === true;
}

export function getQSocialDbError(): string | null {
  return dbError;
}

export async function ensureQSocialTables(pool: PgPoolInstance): Promise<void> {
  if (ensured) return;
  try {
    await pool.query("SELECT 1");
  } catch (e: unknown) {
    dbReady = false;
    ensured = true;
    dbError = e instanceof Error ? e.message : "database unavailable";
    console.warn(`[QSocial] Database unavailable — falling back to in-memory store: ${dbError}`);
    return;
  }
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "QSocialPost" (
        "id"            TEXT PRIMARY KEY,
        "userId"        TEXT NOT NULL,
        "content"       TEXT NOT NULL,
        "mediaUrl"      TEXT,
        "type"          TEXT NOT NULL DEFAULT 'text',
        "likesCount"    INTEGER NOT NULL DEFAULT 0,
        "commentsCount" INTEGER NOT NULL DEFAULT 0,
        "isPublic"      BOOLEAN NOT NULL DEFAULT TRUE,
        "tags"          TEXT[] DEFAULT '{}',
        "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "QSocialPost_user_idx"
        ON "QSocialPost" ("userId", "createdAt" DESC);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "QSocialPost_public_idx"
        ON "QSocialPost" ("isPublic", "createdAt" DESC)
        WHERE "isPublic"=TRUE;
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "QSocialFollow" (
        "followerId"  TEXT NOT NULL,
        "followingId" TEXT NOT NULL,
        "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY ("followerId", "followingId")
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "QSocialLike" (
        "userId"    TEXT NOT NULL,
        "postId"    TEXT NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY ("userId", "postId")
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "QSocialComment" (
        "id"        TEXT PRIMARY KEY,
        "postId"    TEXT NOT NULL,
        "userId"    TEXT NOT NULL,
        "content"   TEXT NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "QSocialComment_post_idx"
        ON "QSocialComment" ("postId", "createdAt");
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "QSocialNotification" (
        "id"        TEXT PRIMARY KEY,
        "userId"    TEXT NOT NULL,
        "type"      TEXT NOT NULL,
        "message"   TEXT NOT NULL,
        "read"      BOOLEAN NOT NULL DEFAULT FALSE,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "QSocialNotif_user_idx"
        ON "QSocialNotification" ("userId", "createdAt" DESC);
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "QSocialDM" (
        "id"        TEXT PRIMARY KEY,
        "fromId"    TEXT NOT NULL,
        "toId"      TEXT NOT NULL,
        "content"   TEXT NOT NULL,
        "read"      BOOLEAN NOT NULL DEFAULT FALSE,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "QSocialDM_pair_idx"
        ON "QSocialDM" (LEAST("fromId","toId"), GREATEST("fromId","toId"), "createdAt");
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "QSocialDM_to_unread_idx"
        ON "QSocialDM" ("toId", "read") WHERE "read"=FALSE;
    `);
    dbReady = true;
    console.log("[QSocial] Tables ready");
  } catch (e: unknown) {
    dbReady = false;
    dbError = e instanceof Error ? e.message : "table creation failed";
    console.warn(`[QSocial] Could not create tables — falling back to in-memory: ${dbError}`);
  } finally {
    ensured = true;
  }
}
