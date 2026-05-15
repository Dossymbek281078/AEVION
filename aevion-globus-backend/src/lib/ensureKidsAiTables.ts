/**
 * Kids AI Content — table bootstrap + seed.
 *
 * Creates `kids_lessons` and `kids_progress` if they don't exist, then
 * populates `kids_lessons` from `kidsAiSeed.ts` when it's empty. Patterned
 * on `ensureQLearnTables.ts` — silent fallback to in-memory if the DB
 * can't be reached. We never throw from this module: callers depend on
 * `isKidsAiDbReady()` to branch.
 */

import type pg from "pg";
import { KIDS_AI_SEED_LESSONS } from "../data/kidsAiSeed";

type PgPoolInstance = InstanceType<typeof pg.Pool>;

let ensured = false;
let dbReady: boolean | null = null;
let dbError: string | null = null;

export function isKidsAiDbReady(): boolean {
  return dbReady === true;
}

export function getKidsAiDbError(): string | null {
  return dbError;
}

export async function ensureKidsAiTables(pool: PgPoolInstance): Promise<void> {
  if (ensured) return;
  try {
    await pool.query("SELECT 1");
  } catch (e: unknown) {
    dbReady = false;
    ensured = true;
    dbError = e instanceof Error ? e.message : "database unavailable";
    console.warn(
      `[KidsAI] Database unavailable — falling back to in-memory store: ${dbError}`,
    );
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
    const countRes = await pool.query(
      "SELECT COUNT(*)::text AS count FROM kids_lessons",
    );
    const existing = Number((countRes.rows[0] as { count?: string } | undefined)?.count ?? 0);
    if (existing === 0) {
      for (const seed of KIDS_AI_SEED_LESSONS) {
        await pool.query(
          `INSERT INTO kids_lessons
             (title, description, age_min, age_max, language, category, content_md, ai_prompt)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            seed.title,
            seed.description,
            seed.ageMin,
            seed.ageMax,
            seed.language,
            seed.category,
            seed.contentMd,
            seed.aiPrompt,
          ],
        );
      }
      console.log(
        `[KidsAI] Seeded ${KIDS_AI_SEED_LESSONS.length} lessons into kids_lessons`,
      );
    }

    dbReady = true;
    console.log("[KidsAI] Tables ready");
  } catch (e: unknown) {
    dbReady = false;
    dbError = e instanceof Error ? e.message : "table creation failed";
    console.warn(
      `[KidsAI] Could not create tables — falling back to in-memory: ${dbError}`,
    );
  } finally {
    ensured = true;
  }
}
