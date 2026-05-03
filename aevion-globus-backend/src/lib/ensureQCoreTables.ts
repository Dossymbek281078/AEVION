import type pg from "pg";

/**
 * QCoreAI multi-agent persistence schema.
 *
 * Follows the same "raw SQL via pg Pool + ensure-on-first-use" pattern as
 * QRight / AEVIONUser. A fresh database gets its tables auto-bootstrapped on
 * the first /api/qcoreai/multi-agent call; existing databases get missing
 * columns patched with ALTER TABLE ... ADD COLUMN IF NOT EXISTS.
 *
 * Also handles a degraded mode: if the database is unreachable (e.g. password
 * changed, PG down, no DATABASE_URL in dev env), `ensureQCoreTables` flips an
 * internal flag and the store dispatches to an in-memory implementation so
 * the pipeline still runs end-to-end. Demo-first, DB-optional.
 */

type PgPoolInstance = InstanceType<typeof pg.Pool>;

let ensured = false;
let dbReady: boolean | null = null;
let dbError: string | null = null;

/** True once connectivity has been probed successfully; false when fallback is active. */
export function isDbReady(): boolean {
  return dbReady === true;
}

/** One-line error summary when the DB is unavailable (for logs / health checks). */
export function getDbError(): string | null {
  return dbError;
}

export async function ensureQCoreTables(pool: PgPoolInstance): Promise<void> {
  if (ensured) return;
  // Probe reachability with a cheap query first. If this fails we mark the
  // store as in-memory and return quietly — all store functions check
  // isDbReady() and fall back to Maps.
  try {
    await pool.query("SELECT 1");
  } catch (e: any) {
    dbReady = false;
    ensured = true;
    dbError = e?.message || "database unavailable";
    console.warn(`[QCoreAI] Database unavailable — falling back to in-memory store: ${dbError}`);
    return;
  }
  try {

  await pool.query(`
    CREATE TABLE IF NOT EXISTS "QCoreSession" (
      "id"        TEXT PRIMARY KEY,
      "userId"    TEXT,
      "title"     TEXT NOT NULL DEFAULT 'New session',
      "mode"      TEXT NOT NULL DEFAULT 'multi-agent',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS "QCoreSession_userId_updatedAt_idx"
      ON "QCoreSession" ("userId", "updatedAt" DESC);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS "QCoreRun" (
      "id"              TEXT PRIMARY KEY,
      "sessionId"       TEXT NOT NULL,
      "userInput"       TEXT NOT NULL,
      "status"          TEXT NOT NULL DEFAULT 'pending',
      "error"           TEXT,
      "agentConfig"     JSONB,
      "finalContent"    TEXT,
      "totalDurationMs" INTEGER,
      "startedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "finishedAt"      TIMESTAMPTZ
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS "QCoreRun_sessionId_startedAt_idx"
      ON "QCoreRun" ("sessionId", "startedAt" DESC);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS "QCoreMessage" (
      "id"         TEXT PRIMARY KEY,
      "runId"      TEXT NOT NULL,
      "role"       TEXT NOT NULL,
      "stage"      TEXT,
      "instance"   TEXT,
      "provider"   TEXT,
      "model"      TEXT,
      "content"    TEXT NOT NULL,
      "tokensIn"   INTEGER,
      "tokensOut"  INTEGER,
      "durationMs" INTEGER,
      "ordering"   INTEGER NOT NULL,
      "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  // Older databases: patch missing column.
  await pool.query(`ALTER TABLE "QCoreMessage" ADD COLUMN IF NOT EXISTS "instance" TEXT;`);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS "QCoreMessage_runId_ordering_idx"
      ON "QCoreMessage" ("runId", "ordering");
  `);

  // QCoreRun — strategy column (sequential | parallel | debate) + cost total + share token.
  await pool.query(`ALTER TABLE "QCoreRun" ADD COLUMN IF NOT EXISTS "strategy" TEXT;`);
  await pool.query(`ALTER TABLE "QCoreRun" ADD COLUMN IF NOT EXISTS "totalCostUsd" DOUBLE PRECISION;`);
  await pool.query(`ALTER TABLE "QCoreRun" ADD COLUMN IF NOT EXISTS "shareToken" TEXT;`);
  await pool.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS "QCoreRun_shareToken_key" ON "QCoreRun" ("shareToken") WHERE "shareToken" IS NOT NULL;`
  );

  // QCoreMessage — per-call cost (computed from provider/model/tokens at runtime).
  await pool.query(`ALTER TABLE "QCoreMessage" ADD COLUMN IF NOT EXISTS "costUsd" DOUBLE PRECISION;`);

  // QCoreRun — free-form tags ([]) + GIN index for tag-filter chip strip.
  await pool.query(`ALTER TABLE "QCoreRun" ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT '{}';`);
  await pool.query(`CREATE INDEX IF NOT EXISTS "QCoreRun_tags_gin_idx" ON "QCoreRun" USING GIN ("tags");`);

  // Per-user webhook config. One row per JWT sub. URL is required, secret
  // optional (when set, run.completed POSTs include X-QCore-Signature).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "QCoreUserWebhook" (
      "userId"    TEXT PRIMARY KEY,
      "url"       TEXT NOT NULL,
      "secret"    TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Agent marketplace — community-shared presets. Owner can publish, others
  // can browse and import to their personal localStorage presets bar.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "QCoreSharedPreset" (
      "id"          TEXT PRIMARY KEY,
      "ownerUserId" TEXT NOT NULL,
      "name"        TEXT NOT NULL,
      "description" TEXT,
      "strategy"    TEXT NOT NULL DEFAULT 'sequential',
      "overrides"   JSONB NOT NULL DEFAULT '{}'::jsonb,
      "isPublic"    BOOLEAN NOT NULL DEFAULT TRUE,
      "importCount" INTEGER NOT NULL DEFAULT 0,
      "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS "QCoreSharedPreset_public_imports_idx"
      ON "QCoreSharedPreset" ("isPublic", "importCount" DESC, "updatedAt" DESC);
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS "QCoreSharedPreset_owner_idx"
      ON "QCoreSharedPreset" ("ownerUserId");
  `);

  // Eval harness — test suites and runs for regression tracking. A suite
  // is a list of cases (input + judge config); a run executes every case
  // through the orchestrator and aggregates a 0..1 score.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "QCoreEvalSuite" (
      "id"          TEXT PRIMARY KEY,
      "ownerUserId" TEXT NOT NULL,
      "name"        TEXT NOT NULL,
      "description" TEXT,
      "strategy"    TEXT NOT NULL DEFAULT 'sequential',
      "overrides"   JSONB NOT NULL DEFAULT '{}'::jsonb,
      "cases"       JSONB NOT NULL DEFAULT '[]'::jsonb,
      "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS "QCoreEvalSuite_owner_updated_idx"
      ON "QCoreEvalSuite" ("ownerUserId", "updatedAt" DESC);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS "QCoreEvalRun" (
      "id"             TEXT PRIMARY KEY,
      "suiteId"        TEXT NOT NULL,
      "ownerUserId"    TEXT NOT NULL,
      "status"         TEXT NOT NULL DEFAULT 'running',
      "score"          DOUBLE PRECISION,
      "totalCases"     INTEGER NOT NULL DEFAULT 0,
      "passedCases"    INTEGER NOT NULL DEFAULT 0,
      "totalCostUsd"   DOUBLE PRECISION NOT NULL DEFAULT 0,
      "results"        JSONB NOT NULL DEFAULT '[]'::jsonb,
      "errorMessage"   TEXT,
      "startedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "completedAt"    TIMESTAMPTZ
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS "QCoreEvalRun_suite_started_idx"
      ON "QCoreEvalRun" ("suiteId", "startedAt" DESC);
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS "QCoreEvalRun_owner_started_idx"
      ON "QCoreEvalRun" ("ownerUserId", "startedAt" DESC);
  `);

  // Prompts library — versioned custom system prompts per agent role.
  // parentPromptId chains versions; root prompts have parentPromptId=null.
  // Public prompts can be browsed and forked into the user's own library.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "QCorePrompt" (
      "id"              TEXT PRIMARY KEY,
      "ownerUserId"     TEXT NOT NULL,
      "name"            TEXT NOT NULL,
      "description"     TEXT,
      "role"            TEXT NOT NULL DEFAULT 'writer',
      "content"         TEXT NOT NULL,
      "version"         INTEGER NOT NULL DEFAULT 1,
      "parentPromptId"  TEXT,
      "isPublic"        BOOLEAN NOT NULL DEFAULT FALSE,
      "importCount"     INTEGER NOT NULL DEFAULT 0,
      "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS "QCorePrompt_owner_updated_idx"
      ON "QCorePrompt" ("ownerUserId", "updatedAt" DESC);
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS "QCorePrompt_parent_idx"
      ON "QCorePrompt" ("parentPromptId");
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS "QCorePrompt_public_imports_idx"
      ON "QCorePrompt" ("isPublic", "importCount" DESC, "updatedAt" DESC);
  `);

  // Batch runs — run N prompts against the same agent config in one call.
  // Each individual QCoreRun gets a batchId FK; the batch row tracks aggregate progress.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "QCoreBatch" (
      "id"             TEXT PRIMARY KEY,
      "ownerUserId"    TEXT NOT NULL,
      "strategy"       TEXT NOT NULL DEFAULT 'sequential',
      "overrides"      JSONB NOT NULL DEFAULT '{}'::jsonb,
      "status"         TEXT NOT NULL DEFAULT 'running',
      "totalRuns"      INTEGER NOT NULL DEFAULT 0,
      "completedRuns"  INTEGER NOT NULL DEFAULT 0,
      "failedRuns"     INTEGER NOT NULL DEFAULT 0,
      "totalCostUsd"   DOUBLE PRECISION NOT NULL DEFAULT 0,
      "inputs"         JSONB NOT NULL DEFAULT '[]'::jsonb,
      "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "completedAt"    TIMESTAMPTZ
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "QCoreBatch_owner_created_idx" ON "QCoreBatch" ("ownerUserId", "createdAt" DESC);`
  );
  await pool.query(`ALTER TABLE "QCoreRun" ADD COLUMN IF NOT EXISTS "batchId" TEXT;`);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "QCoreRun_batchId_idx" ON "QCoreRun" ("batchId") WHERE "batchId" IS NOT NULL;`
  );

  // QCoreRun — threading: parentRunId links to the previous run in a thread;
  // threadId is always set to the root run's id so we can retrieve all replies
  // in one WHERE clause. The root run has parentRunId=NULL, threadId=its own id.
  await pool.query(`ALTER TABLE "QCoreRun" ADD COLUMN IF NOT EXISTS "parentRunId" TEXT;`);
  await pool.query(`ALTER TABLE "QCoreRun" ADD COLUMN IF NOT EXISTS "threadId" TEXT;`);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "QCoreRun_threadId_startedAt_idx" ON "QCoreRun" ("threadId", "startedAt");`
  );

  // Run templates — save input + strategy + overrides as a named, reusable bundle.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "QCoreTemplate" (
      "id"          TEXT PRIMARY KEY,
      "ownerUserId" TEXT NOT NULL,
      "name"        TEXT NOT NULL,
      "description" TEXT,
      "input"       TEXT NOT NULL,
      "strategy"    TEXT NOT NULL DEFAULT 'sequential',
      "overrides"   JSONB NOT NULL DEFAULT '{}'::jsonb,
      "isPublic"    BOOLEAN NOT NULL DEFAULT FALSE,
      "useCount"    INTEGER NOT NULL DEFAULT 0,
      "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS "QCoreTemplate_owner_updated_idx"
      ON "QCoreTemplate" ("ownerUserId", "updatedAt" DESC);
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS "QCoreTemplate_public_uses_idx"
      ON "QCoreTemplate" ("isPublic", "useCount" DESC, "updatedAt" DESC);
  `);

    dbReady = true;
    ensured = true;
  } catch (e: any) {
    // DDL failed — mark in-memory so requests don't 500.
    dbReady = false;
    ensured = true;
    dbError = e?.message || "database DDL failed";
    console.warn(`[QCoreAI] Schema bootstrap failed — falling back to in-memory store: ${dbError}`);
  }
}
