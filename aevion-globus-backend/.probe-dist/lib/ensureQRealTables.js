"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureQRealTables = ensureQRealTables;
let ensured = false;
async function ensureQRealTables(pool) {
    if (ensured)
        return;
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
        await pool.query(`CREATE TABLE IF NOT EXISTS "QRealStoryboardCache" (
      "briefHash" TEXT PRIMARY KEY,
      "shots" JSONB NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`);
        await pool.query(`CREATE TABLE IF NOT EXISTS "QRealQuota" (
      "day" TEXT NOT NULL,
      "ip" TEXT NOT NULL,
      "count" INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY ("day", "ip")
    );`);
    }
    catch { /* in-memory fallback */ }
}
