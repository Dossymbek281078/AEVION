import type pg from "pg";

type PgPoolInstance = InstanceType<typeof pg.Pool>;

let ensured = false;
let dbReady: boolean | null = null;
let dbError: string | null = null;

export function isQLearnDbReady(): boolean {
  return dbReady === true;
}

export function getQLearnDbError(): string | null {
  return dbError;
}

export async function ensureQLearnTables(pool: PgPoolInstance): Promise<void> {
  if (ensured) return;
  try {
    await pool.query("SELECT 1");
  } catch (e: unknown) {
    dbReady = false;
    ensured = true;
    dbError = e instanceof Error ? e.message : "database unavailable";
    console.warn(`[QLearn] Database unavailable — falling back to in-memory store: ${dbError}`);
    return;
  }
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "QLearnCourse" (
        "id"              TEXT PRIMARY KEY,
        "authorId"        TEXT NOT NULL,
        "title"           TEXT NOT NULL,
        "description"     TEXT,
        "category"        TEXT NOT NULL DEFAULT 'tech',
        "level"           TEXT NOT NULL DEFAULT 'beginner',
        "price"           INTEGER NOT NULL DEFAULT 0,
        "isPublic"        BOOLEAN NOT NULL DEFAULT TRUE,
        "enrollmentCount" INTEGER NOT NULL DEFAULT 0,
        "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "QLearnCourse_cat_idx"
        ON "QLearnCourse" ("category", "enrollmentCount" DESC);
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "QLearnLesson" (
        "id"        TEXT PRIMARY KEY,
        "courseId"  TEXT NOT NULL,
        "title"     TEXT NOT NULL,
        "content"   TEXT NOT NULL DEFAULT '',
        "videoUrl"  TEXT,
        "duration"  INTEGER NOT NULL DEFAULT 0,
        "order"     INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "QLearnLesson_course_idx"
        ON "QLearnLesson" ("courseId", "order");
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "QLearnEnrollment" (
        "id"         TEXT PRIMARY KEY,
        "courseId"   TEXT NOT NULL,
        "userId"     TEXT NOT NULL,
        "progress"   INTEGER NOT NULL DEFAULT 0,
        "enrolledAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "QLearnEnrollment_uniq"
        ON "QLearnEnrollment" ("courseId", "userId");
    `);
    // Сертификаты. Таблицы у них НЕ БЫЛО ВОВСЕ — жили в Map в памяти процесса,
    // и после каждой выкатки список сертификатов у человека становился пустым,
    // а запрос конкретного отвечал 404. Выкаток бэкенда за сутки бывает шесть.
    //
    // Хуже потери была подмена: при повторном завершении курса выдавался НОВЫЙ
    // номер, а датой окончания ставился сегодняшний день вместо настоящего.
    // Распечатанный или отправленный работодателю сертификат переставал
    // совпадать, и каждый раз в QRight уходила ещё одна регистрация того же
    // достижения.
    //
    // Уникальность по enrollmentId закрывает и это: повторный вызов возвращает
    // существующий сертификат, а не создаёт второй.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "QLearnCertificate" (
        "id"                TEXT PRIMARY KEY,
        "enrollmentId"      TEXT NOT NULL UNIQUE,
        "courseId"          TEXT NOT NULL,
        "userId"            TEXT NOT NULL,
        "courseTitle"       TEXT NOT NULL DEFAULT '',
        "certificateNumber" TEXT NOT NULL,
        "completedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "QLearnCertificate_user_idx"
        ON "QLearnCertificate" ("userId", "completedAt" DESC);
    `);
    dbReady = true;
    console.log("[QLearn] Tables ready");
  } catch (e: unknown) {
    dbReady = false;
    dbError = e instanceof Error ? e.message : "table creation failed";
    console.warn(`[QLearn] Could not create tables — falling back to in-memory: ${dbError}`);
  } finally {
    ensured = true;
  }
}
