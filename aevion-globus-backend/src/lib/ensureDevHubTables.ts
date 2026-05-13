import type pg from "pg";

type PgPoolInstance = InstanceType<typeof pg.Pool>;

let ensured = false;
let dbReady: boolean | null = null;
let dbError: string | null = null;

export function isDevHubDbReady(): boolean {
  return dbReady === true;
}

export function getDevHubDbError(): string | null {
  return dbError;
}

export async function ensureDevHubTables(pool: PgPoolInstance): Promise<void> {
  if (ensured) return;
  try {
    await pool.query("SELECT 1");
  } catch (e: any) {
    dbReady = false;
    ensured = true;
    dbError = e?.message || "database unavailable";
    console.warn(`[DevHub] Database unavailable — falling back to in-memory store: ${dbError}`);
    return;
  }
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "DevHubProject" (
        "id"           TEXT PRIMARY KEY,
        "userId"       TEXT NOT NULL,
        "name"         TEXT NOT NULL,
        "description"  TEXT,
        "stack"        TEXT NOT NULL DEFAULT 'next',
        "status"       TEXT NOT NULL DEFAULT 'draft',
        "repoUrl"      TEXT,
        "deployUrl"    TEXT,
        "customDomain" TEXT,
        "envVars"      JSONB NOT NULL DEFAULT '{}'::jsonb,
        "collaborators" JSONB NOT NULL DEFAULT '[]'::jsonb,
        "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    // V2 migration: add collaborators column if not present (idempotent)
    await pool.query(`
      ALTER TABLE "DevHubProject"
        ADD COLUMN IF NOT EXISTS "collaborators" JSONB NOT NULL DEFAULT '[]'::jsonb;
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "DevHubProject_user_idx"
        ON "DevHubProject" ("userId", "updatedAt" DESC);
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS "DevHubFile" (
        "id"        TEXT PRIMARY KEY,
        "projectId" TEXT NOT NULL,
        "path"      TEXT NOT NULL,
        "content"   TEXT NOT NULL DEFAULT '',
        "language"  TEXT NOT NULL DEFAULT 'typescript',
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE ("projectId", "path")
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "DevHubFile_project_idx"
        ON "DevHubFile" ("projectId");
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS "DevHubDeployment" (
        "id"          TEXT PRIMARY KEY,
        "projectId"   TEXT NOT NULL,
        "userId"      TEXT NOT NULL,
        "status"      TEXT NOT NULL DEFAULT 'pending',
        "deployUrl"   TEXT,
        "buildLog"    TEXT,
        "triggeredAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "completedAt" TIMESTAMPTZ
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "DevHubDeployment_project_idx"
        ON "DevHubDeployment" ("projectId", "triggeredAt" DESC);
    `);

    // Snippet shelf — publicly shareable code snippets (DEV.to / gist-style)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "DevHubSnippet" (
        "id"        TEXT PRIMARY KEY,
        "userId"    TEXT NOT NULL,
        "title"     TEXT NOT NULL,
        "content"   TEXT NOT NULL DEFAULT '',
        "language"  TEXT NOT NULL DEFAULT 'plaintext',
        "tags"      JSONB NOT NULL DEFAULT '[]'::jsonb,
        "stars"     INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "DevHubSnippet_created_idx"
        ON "DevHubSnippet" ("createdAt" DESC);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "DevHubSnippet_user_idx"
        ON "DevHubSnippet" ("userId", "createdAt" DESC);
    `);

    dbReady = true;
    ensured = true;
  } catch (e: any) {
    dbReady = false;
    ensured = true;
    dbError = e?.message || "database DDL failed";
    console.warn(`[DevHub] Schema bootstrap failed — falling back to in-memory store: ${dbError}`);
  }
}
