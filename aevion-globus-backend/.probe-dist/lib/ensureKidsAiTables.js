"use strict";
/**
 * Kids AI Content — table bootstrap + seed.
 *
 * Creates `kids_lessons` and `kids_progress` if they don't exist, then
 * populates `kids_lessons` from `kidsAiSeed.ts` when it's empty. Patterned
 * on `ensureQLearnTables.ts` — silent fallback to in-memory if the DB
 * can't be reached. We never throw from this module: callers depend on
 * `isKidsAiDbReady()` to branch.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isKidsAiDbReady = isKidsAiDbReady;
exports.getKidsAiDbError = getKidsAiDbError;
exports.ensureKidsAiTables = ensureKidsAiTables;
const kidsAiSeed_1 = require("../data/kidsAiSeed");
let ensured = false;
let dbReady = null;
let dbError = null;
function isKidsAiDbReady() {
    return dbReady === true;
}
function getKidsAiDbError() {
    return dbError;
}
async function ensureKidsAiTables(pool) {
    if (ensured)
        return;
    try {
        await pool.query("SELECT 1");
    }
    catch (e) {
        dbReady = false;
        ensured = true;
        dbError = e instanceof Error ? e.message : "database unavailable";
        console.warn(`[KidsAI] Database unavailable — falling back to in-memory store: ${dbError}`);
        return;
    }
    try {
        await pool.query(`
      CREATE TABLE IF NOT EXISTS kids_lessons (
        id           SERIAL PRIMARY KEY,
        title        TEXT NOT NULL,
        description  TEXT NOT NULL,
        age_min      INTEGER NOT NULL,
        age_max      INTEGER NOT NULL,
        language     TEXT NOT NULL CHECK (language IN ('ru','en','kz')),
        category     TEXT NOT NULL,
        content_md   TEXT NOT NULL,
        ai_prompt    TEXT,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
        await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_kids_lessons_lang
        ON kids_lessons(language);
    `);
        await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_kids_lessons_category
        ON kids_lessons(category);
    `);
        await pool.query(`
      CREATE TABLE IF NOT EXISTS kids_progress (
        id           SERIAL PRIMARY KEY,
        child_alias  TEXT NOT NULL,
        lesson_id    INTEGER NOT NULL REFERENCES kids_lessons(id) ON DELETE CASCADE,
        completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        score        INTEGER CHECK (score >= 0 AND score <= 100)
      );
    `);
        await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_kids_progress_alias
        ON kids_progress(child_alias);
    `);
        // Seed if empty. We don't UPSERT — once seeded, leave the table alone
        // so admin edits aren't clobbered on restart.
        const countRes = await pool.query("SELECT COUNT(*)::text AS count FROM kids_lessons");
        const existing = Number(countRes.rows[0]?.count ?? 0);
        if (existing === 0) {
            for (const seed of kidsAiSeed_1.KIDS_AI_SEED_LESSONS) {
                await pool.query(`INSERT INTO kids_lessons
             (title, description, age_min, age_max, language, category, content_md, ai_prompt)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [
                    seed.title,
                    seed.description,
                    seed.ageMin,
                    seed.ageMax,
                    seed.language,
                    seed.category,
                    seed.contentMd,
                    seed.aiPrompt,
                ]);
            }
            console.log(`[KidsAI] Seeded ${kidsAiSeed_1.KIDS_AI_SEED_LESSONS.length} lessons into kids_lessons`);
        }
        dbReady = true;
        console.log("[KidsAI] Tables ready");
    }
    catch (e) {
        dbReady = false;
        dbError = e instanceof Error ? e.message : "table creation failed";
        console.warn(`[KidsAI] Could not create tables — falling back to in-memory: ${dbError}`);
    }
    finally {
        ensured = true;
    }
}
