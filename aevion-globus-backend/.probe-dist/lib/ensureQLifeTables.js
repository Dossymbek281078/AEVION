"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isQLifeDbReady = isQLifeDbReady;
exports.getQLifeDbError = getQLifeDbError;
exports.ensureQLifeTables = ensureQLifeTables;
let ensured = false;
let _dbReady = null;
let _dbError = null;
function isQLifeDbReady() {
    return _dbReady === true;
}
function getQLifeDbError() {
    return _dbError;
}
async function ensureQLifeTables(pool) {
    if (ensured)
        return;
    try {
        await pool.query("SELECT 1");
    }
    catch (e) {
        _dbReady = false;
        ensured = true;
        _dbError = e?.message || "database unavailable";
        console.warn(`[QLife] Database unavailable — falling back to in-memory store: ${_dbError}`);
        return;
    }
    try {
        await pool.query(`
      CREATE TABLE IF NOT EXISTS qlife_biomarkers (
        id          SERIAL PRIMARY KEY,
        user_id     TEXT NOT NULL DEFAULT 'anonymous',
        type        TEXT NOT NULL CHECK (type IN (
                      'blood_pressure','weight_kg','sleep_hours',
                      'vo2max','hrv','glucose','stress_level'
                    )),
        value       NUMERIC NOT NULL,
        unit        TEXT NOT NULL,
        notes       TEXT,
        measured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
        await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_qlife_type
        ON qlife_biomarkers (type);
    `);
        await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_qlife_user
        ON qlife_biomarkers (user_id);
    `);
        await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_qlife_measured
        ON qlife_biomarkers (measured_at DESC);
    `);
        _dbReady = true;
        ensured = true;
        console.log("[QLife] Tables ready.");
    }
    catch (e) {
        _dbReady = false;
        ensured = true;
        _dbError = e?.message || "DDL failed";
        console.warn(`[QLife] Schema bootstrap failed — falling back to in-memory store: ${_dbError}`);
    }
}
