import type pg from "pg";

/**
 * QCoreAI multi-agent persistence schema.
 *
 * Follows the same "raw SQL via pg Pool + ensure-on-first-use" pattern as
 * QRight / AEVIONUser. A fresh database gets its tables auto-bootstrapped on
 * the first /api/qcoreai/multi-agent call; existing databases get missing
 * columns patched with ALTER TABLE ... ADD COLUMN IF NOT EXISTS.
 */

type PgPoolInstance = InstanceType<typeof pg.Pool>;

let ensured = false;

export async function ensureQCoreTables(pool: PgPoolInstance): Promise<void> {
  if (ensured) return;

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

  // QCoreRun — strategy column (sequential | parallel | debate) + cost total.
  await pool.query(`ALTER TABLE "QCoreRun" ADD COLUMN IF NOT EXISTS "strategy" TEXT;`);
  await pool.query(`ALTER TABLE "QCoreRun" ADD COLUMN IF NOT EXISTS "totalCostUsd" DOUBLE PRECISION;`);

  // QCoreMessage — per-call cost (computed from provider/model/tokens at runtime).
  await pool.query(`ALTER TABLE "QCoreMessage" ADD COLUMN IF NOT EXISTS "costUsd" DOUBLE PRECISION;`);

  ensured = true;
}
