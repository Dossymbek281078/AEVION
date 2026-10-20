"use strict";
/**
 * QGood Psychology Platform — table bootstrap.
 *
 * Creates qgood_moods and qgood_completions if they don't exist.
 * Silent fallback to in-memory mode if DB is unreachable.
 * Patterned on ensureKidsAiTables.ts.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isQGoodDbReady = isQGoodDbReady;
exports.getQGoodDbError = getQGoodDbError;
exports.ensureQGoodTables = ensureQGoodTables;
let ensured = false;
let dbReady = null;
let dbError = null;
function isQGoodDbReady() {
    return dbReady === true;
}
function getQGoodDbError() {
    return dbError;
}
async function ensureQGoodTables(pool) {
    if (ensured)
        return;
    try {
        await pool.query("SELECT 1");
    }
    catch (e) {
        dbReady = false;
        ensured = true;
        dbError = e instanceof Error ? e.message : "database unavailable";
        console.warn(`[QGood] Database unavailable — falling back to in-memory: ${dbError}`);
        return;
    }
    try {
        await pool.query(`
      CREATE TABLE IF NOT EXISTS qgood_moods (
        id         SERIAL PRIMARY KEY,
        user_id    TEXT NOT NULL DEFAULT 'anonymous',
        score      INTEGER NOT NULL CHECK (score BETWEEN 1 AND 10),
        emotion    TEXT,
        context    TEXT,
        logged_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
        await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_qgood_moods_user_id
        ON qgood_moods(user_id, logged_at DESC);
    `);
        await pool.query(`
      CREATE TABLE IF NOT EXISTS qgood_completions (
        id            SERIAL PRIMARY KEY,
        user_id       TEXT NOT NULL DEFAULT 'anonymous',
        exercise_id   TEXT NOT NULL,
        completed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
        await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_qgood_completions_user_id
        ON qgood_completions(user_id, completed_at DESC);
    `);
        dbReady = true;
        console.log("[QGood] Tables ready");
    }
    catch (e) {
        dbReady = false;
        dbError = e instanceof Error ? e.message : "table creation failed";
        console.warn(`[QGood] Could not create tables — falling back to in-memory: ${dbError}`);
    }
    finally {
        ensured = true;
    }
}
