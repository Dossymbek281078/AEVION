"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isQNewsDbReady = isQNewsDbReady;
exports.getQNewsDbError = getQNewsDbError;
exports.ensureQNewsTables = ensureQNewsTables;
let ensured = false;
let dbReady = null;
let dbError = null;
function isQNewsDbReady() {
    return dbReady === true;
}
function getQNewsDbError() {
    return dbError;
}
async function ensureQNewsTables(pool) {
    if (ensured)
        return;
    try {
        await pool.query("SELECT 1");
    }
    catch (e) {
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
    }
    catch (e) {
        dbReady = false;
        dbError = e instanceof Error ? e.message : "table creation failed";
        console.warn(`[QNews] Could not create tables — falling back to in-memory: ${dbError}`);
    }
    finally {
        ensured = true;
    }
}
