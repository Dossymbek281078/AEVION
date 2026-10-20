"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isShadowNetDbReady = isShadowNetDbReady;
exports.getShadowNetDbError = getShadowNetDbError;
exports.ensureShadowNetTables = ensureShadowNetTables;
let ensured = false;
let dbReady = null;
let dbError = null;
function isShadowNetDbReady() {
    return dbReady === true;
}
function getShadowNetDbError() {
    return dbError;
}
/**
 * Create the shadownet tables if they don't exist. Falls back to in-memory
 * mode (handled by the caller) when the database is unavailable.
 *
 * Storage is OPAQUE — we only persist the client-encrypted ciphertext plus
 * the IV and salt needed for the client to derive the key again. We never
 * see the plaintext or password.
 */
async function ensureShadowNetTables(pool) {
    if (ensured)
        return;
    try {
        await pool.query("SELECT 1");
    }
    catch (e) {
        dbReady = false;
        ensured = true;
        dbError = e instanceof Error ? e.message : "database unavailable";
        console.warn(`[ShadowNet] Database unavailable — falling back to in-memory store: ${dbError}`);
        return;
    }
    try {
        await pool.query(`
      CREATE TABLE IF NOT EXISTS shadownet_posts (
        id          SERIAL PRIMARY KEY,
        alias       TEXT NOT NULL,
        ciphertext  TEXT NOT NULL,
        iv          TEXT NOT NULL,
        salt        TEXT NOT NULL,
        size_bytes  INTEGER,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
        await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_shadownet_alias
        ON shadownet_posts(alias);
    `);
        await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_shadownet_created
        ON shadownet_posts(created_at DESC);
    `);
        dbReady = true;
        console.log("[ShadowNet] Tables ready");
    }
    catch (e) {
        dbReady = false;
        dbError = e instanceof Error ? e.message : "table creation failed";
        console.warn(`[ShadowNet] Could not create tables — falling back to in-memory: ${dbError}`);
    }
    finally {
        ensured = true;
    }
}
