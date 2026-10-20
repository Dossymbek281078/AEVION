"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isQPersonaDbReady = isQPersonaDbReady;
exports.getQPersonaDbError = getQPersonaDbError;
exports.ensureQPersonaTables = ensureQPersonaTables;
let ensured = false;
let _dbReady = null;
let _dbError = null;
function isQPersonaDbReady() {
    return _dbReady === true;
}
function getQPersonaDbError() {
    return _dbError;
}
async function ensureQPersonaTables(pool) {
    if (ensured)
        return;
    try {
        await pool.query("SELECT 1");
    }
    catch (e) {
        _dbReady = false;
        ensured = true;
        _dbError = e?.message || "database unavailable";
        console.warn(`[QPersona] Database unavailable — falling back to in-memory store: ${_dbError}`);
        return;
    }
    try {
        await pool.query(`
      CREATE TABLE IF NOT EXISTS qpersona_profiles (
        id           SERIAL PRIMARY KEY,
        alias        TEXT NOT NULL UNIQUE CHECK (alias ~ '^[a-z0-9_-]{3,30}$'),
        display_name TEXT NOT NULL,
        bio          TEXT,
        avatar_prompt TEXT,
        skills       JSONB NOT NULL DEFAULT '[]',
        links        JSONB NOT NULL DEFAULT '[]',
        visibility   TEXT NOT NULL DEFAULT 'public'
                     CHECK (visibility IN ('public', 'private')),
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
        await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_qpersona_alias
        ON qpersona_profiles (alias);
    `);
        await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_qpersona_visibility
        ON qpersona_profiles (visibility);
    `);
        _dbReady = true;
        ensured = true;
        console.log("[QPersona] Tables ready.");
    }
    catch (e) {
        _dbReady = false;
        ensured = true;
        _dbError = e?.message || "DDL failed";
        console.warn(`[QPersona] Schema bootstrap failed — falling back to in-memory store: ${_dbError}`);
    }
}
