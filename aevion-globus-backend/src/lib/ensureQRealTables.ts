// QReal P7 persistence: проекты (JSONB), кэш рендеров и суточные квоты в
// Postgres. Урок 2026-07-22: Railway рестартнул инстанс во время платного
// прод-рендера — in-memory проект пересеялся, request id потерян. Эти
// таблицы делают рендеры/квоты/кэш переживающими любой редеплой.
// Паттерн ensureQMediaTables: best-effort, при недоступной БД модуль
// продолжает работать in-memory.
import type pg from "pg";

type PgPoolInstance = InstanceType<typeof pg.Pool>;
let ensured = false;

export async function ensureQRealTables(pool: PgPoolInstance): Promise<void> {
  if (ensured) return;
  ensured = true;
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS "QRealProject" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "data" JSONB NOT NULL,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`);
    await pool.query(`CREATE INDEX IF NOT EXISTS "QRealProject_user_idx" ON "QRealProject" ("userId", "updatedAt" DESC);`);
    await pool.query(`CREATE TABLE IF NOT EXISTS "QRealRenderCache" (
      "cacheKey" TEXT PRIMARY KEY,
      "url" TEXT NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`);
    await pool.query(`CREATE TABLE IF NOT EXISTS "QRealQuota" (
      "day" TEXT NOT NULL,
      "ip" TEXT NOT NULL,
      "count" INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY ("day", "ip")
    );`);
  } catch { /* in-memory fallback */ }
}
