"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureModuleHitTable = ensureModuleHitTable;
exports.recordModuleHit = recordModuleHit;
exports.loadTrending = loadTrending;
const crypto_1 = __importDefault(require("crypto"));
let ensured = false;
async function ensureModuleHitTable(pool) {
    if (ensured)
        return;
    await pool.query(`
    CREATE TABLE IF NOT EXISTS "ModuleHit" (
      "id" TEXT PRIMARY KEY,
      "moduleId" TEXT NOT NULL,
      "surface" TEXT NOT NULL,
      "at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
    await pool.query(`CREATE INDEX IF NOT EXISTS "ModuleHit_module_at_idx" ON "ModuleHit" ("moduleId", "at" DESC);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS "ModuleHit_at_idx" ON "ModuleHit" ("at" DESC);`);
    ensured = true;
}
/**
 * Fire-and-forget hit increment. Never throws — public surfaces should
 * stay fast even if the hit log can't be written. Errors are warn-logged
 * (rate-limited by the surrounding rate limiter, so no log flood risk).
 */
function recordModuleHit(pool, moduleId, surface) {
    setImmediate(() => {
        ensureModuleHitTable(pool)
            .then(() => pool.query(`INSERT INTO "ModuleHit" ("id","moduleId","surface") VALUES ($1,$2,$3)`, [crypto_1.default.randomUUID(), moduleId, surface]))
            .catch((e) => {
            console.warn("[modules-hits] insert failed:", e instanceof Error ? e.message : String(e));
        });
    });
}
const WINDOW_INTERVAL = {
    "24h": "24 hours",
    "7d": "7 days",
};
async function loadTrending(pool, window, limit) {
    await ensureModuleHitTable(pool);
    const r = await pool.query(`SELECT "moduleId", COUNT(*)::int AS hits
     FROM "ModuleHit"
     WHERE "at" >= NOW() - $1::interval
     GROUP BY "moduleId"
     ORDER BY hits DESC, "moduleId" ASC
     LIMIT $2`, [WINDOW_INTERVAL[window], limit]);
    return r.rows.map((row) => ({ moduleId: row.moduleId, hits: row.hits }));
}
