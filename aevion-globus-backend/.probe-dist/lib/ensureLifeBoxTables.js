"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isLifeBoxDbReady = isLifeBoxDbReady;
exports.getLifeBoxDbError = getLifeBoxDbError;
exports.ensureLifeBoxTables = ensureLifeBoxTables;
let ensured = false;
let _dbReady = null;
let _dbError = null;
function isLifeBoxDbReady() {
    return _dbReady === true;
}
function getLifeBoxDbError() {
    return _dbError;
}
async function ensureLifeBoxTables(pool) {
    if (ensured)
        return;
    try {
        await pool.query("SELECT 1");
    }
    catch (e) {
        _dbReady = false;
        ensured = true;
        _dbError = e?.message || "database unavailable";
        console.warn(`[LifeBox] Database unavailable — falling back to in-memory store: ${_dbError}`);
        return;
    }
    try {
        await pool.query(`
      CREATE TABLE IF NOT EXISTS lifebox_capsules (
        id           SERIAL PRIMARY KEY,
        alias        TEXT NOT NULL,
        title        TEXT NOT NULL,
        content      TEXT NOT NULL,
        category     TEXT NOT NULL CHECK (category IN (
                       'knowledge','values','instructions','future_self','advice'
                     )),
        unlock_at    TIMESTAMPTZ NOT NULL,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        unlocked_at  TIMESTAMPTZ
      );
    `);
        await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_lifebox_alias
        ON lifebox_capsules (alias);
    `);
        await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_lifebox_unlock_at
        ON lifebox_capsules (unlock_at);
    `);
        _dbReady = true;
        ensured = true;
        console.log("[LifeBox] Tables ready.");
    }
    catch (e) {
        _dbReady = false;
        ensured = true;
        _dbError = e?.message || "DDL failed";
        console.warn(`[LifeBox] Schema bootstrap failed — falling back to in-memory store: ${_dbError}`);
    }
}
