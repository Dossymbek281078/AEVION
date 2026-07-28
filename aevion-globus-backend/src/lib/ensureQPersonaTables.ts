import type pg from "pg";

type PgPoolInstance = InstanceType<typeof pg.Pool>;

let ensured = false;
let _dbReady: boolean | null = null;
let _dbError: string | null = null;

export function isQPersonaDbReady(): boolean {
  return _dbReady === true;
}

export function getQPersonaDbError(): string | null {
  return _dbError;
}

export async function ensureQPersonaTables(pool: PgPoolInstance): Promise<void> {
  if (ensured) return;

  try {
    await pool.query("SELECT 1");
  } catch (e: any) {
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

    // Секрет правки. Добавлен 28.07 отдельным ALTER, а не в CREATE TABLE:
    // таблица уже существует на проде, и CREATE TABLE IF NOT EXISTS её не
    // тронет — колонка появилась бы только на чистой базе.
    //
    // ЗАЧЕМ. До этого `PATCH /personas/:alias` правил персону по псевдониму из
    // АДРЕСА без всякой сверки: кто открыл чужую персону, тот её и перепишет.
    // Псевдоним здесь не может быть ключом — он и есть публичный адрес.
    //
    // NULL допустим намеренно: у персон, созданных ДО этой правки, секрета нет,
    // и требовать его значило бы отобрать доступ у настоящих владельцев. Такие
    // записи остаются с прежним поведением, новые — защищены. Что делать со
    // старыми, решает основатель.
    await pool.query(`
      ALTER TABLE qpersona_profiles
        ADD COLUMN IF NOT EXISTS edit_secret TEXT;
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
  } catch (e: any) {
    _dbReady = false;
    ensured = true;
    _dbError = e?.message || "DDL failed";
    console.warn(`[QPersona] Schema bootstrap failed — falling back to in-memory store: ${_dbError}`);
  }
}
