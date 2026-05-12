import type pg from "pg";
type PgPoolInstance = InstanceType<typeof pg.Pool>;
let ensured = false;

export async function ensureQMediaTables(pool: PgPoolInstance): Promise<void> {
  if (ensured) return;
  ensured = true;
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS "QMediaTrack" (
      "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL,
      "title" TEXT NOT NULL, "artist" TEXT NOT NULL DEFAULT '',
      "genre" TEXT NOT NULL DEFAULT 'other', "duration" INTEGER NOT NULL DEFAULT 0,
      "url" TEXT, "coverUrl" TEXT, "lyrics" TEXT,
      "playCount" INTEGER NOT NULL DEFAULT 0, "isPublic" BOOLEAN NOT NULL DEFAULT FALSE,
      "tags" TEXT[] DEFAULT '{}',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`);
    await pool.query(`CREATE INDEX IF NOT EXISTS "QMediaTrack_user_idx" ON "QMediaTrack" ("userId", "updatedAt" DESC);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS "QMediaTrack_public_idx" ON "QMediaTrack" ("isPublic", "playCount" DESC) WHERE "isPublic"=TRUE;`);
    await pool.query(`CREATE TABLE IF NOT EXISTS "QMediaPlaylist" (
      "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL,
      "name" TEXT NOT NULL, "description" TEXT,
      "isPublic" BOOLEAN NOT NULL DEFAULT FALSE,
      "trackIds" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`);
    await pool.query(`CREATE INDEX IF NOT EXISTS "QMediaPlaylist_user_idx" ON "QMediaPlaylist" ("userId", "updatedAt" DESC);`);
    await pool.query(`CREATE TABLE IF NOT EXISTS "QMediaVideo" (
      "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL,
      "title" TEXT NOT NULL, "description" TEXT, "url" TEXT, "thumbnailUrl" TEXT,
      "duration" INTEGER NOT NULL DEFAULT 0, "viewCount" INTEGER NOT NULL DEFAULT 0,
      "isPublic" BOOLEAN NOT NULL DEFAULT FALSE, "category" TEXT NOT NULL DEFAULT 'other',
      "tags" TEXT[] DEFAULT '{}',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`);
    await pool.query(`CREATE INDEX IF NOT EXISTS "QMediaVideo_user_idx" ON "QMediaVideo" ("userId", "updatedAt" DESC);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS "QMediaVideo_public_idx" ON "QMediaVideo" ("isPublic", "viewCount" DESC) WHERE "isPublic"=TRUE;`);
    await pool.query(`CREATE TABLE IF NOT EXISTS "QMediaLike" (
      "userId" TEXT NOT NULL, "resourceId" TEXT NOT NULL, "resourceType" TEXT NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY ("userId", "resourceId", "resourceType")
    );`);
  } catch { /* in-memory fallback */ }
}
