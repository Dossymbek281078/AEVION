import type pg from "pg";

type PgPoolInstance = InstanceType<typeof pg.Pool>;

let ensured = false;
let dbReady: boolean | null = null;
let dbError: string | null = null;

export function isDevHubDbReady(): boolean {
  return dbReady === true;
}

export function getDevHubDbError(): string | null {
  return dbError;
}

export async function ensureDevHubTables(pool: PgPoolInstance): Promise<void> {
  if (ensured) return;
  try {
    await pool.query("SELECT 1");
  } catch (e: any) {
    dbReady = false;
    ensured = true;
    dbError = e?.message || "database unavailable";
    console.warn(`[DevHub] Database unavailable — falling back to in-memory store: ${dbError}`);
    return;
  }
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "DevHubProject" (
        "id"           TEXT PRIMARY KEY,
        "userId"       TEXT NOT NULL,
        "name"         TEXT NOT NULL,
        "description"  TEXT,
        "stack"        TEXT NOT NULL DEFAULT 'next',
        "status"       TEXT NOT NULL DEFAULT 'draft',
        "repoUrl"      TEXT,
        "deployUrl"    TEXT,
        "customDomain" TEXT,
        "envVars"      JSONB NOT NULL DEFAULT '{}'::jsonb,
        "collaborators" JSONB NOT NULL DEFAULT '[]'::jsonb,
        "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    // V2 migration: add collaborators column if not present (idempotent)
    await pool.query(`
      ALTER TABLE "DevHubProject"
        ADD COLUMN IF NOT EXISTS "collaborators" JSONB NOT NULL DEFAULT '[]'::jsonb;
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "DevHubProject_user_idx"
        ON "DevHubProject" ("userId", "updatedAt" DESC);
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS "DevHubFile" (
        "id"        TEXT PRIMARY KEY,
        "projectId" TEXT NOT NULL,
        "path"      TEXT NOT NULL,
        "content"   TEXT NOT NULL DEFAULT '',
        "language"  TEXT NOT NULL DEFAULT 'typescript',
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE ("projectId", "path")
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "DevHubFile_project_idx"
        ON "DevHubFile" ("projectId");
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS "DevHubDeployment" (
        "id"          TEXT PRIMARY KEY,
        "projectId"   TEXT NOT NULL,
        "userId"      TEXT NOT NULL,
        "status"      TEXT NOT NULL DEFAULT 'pending',
        "deployUrl"   TEXT,
        "buildLog"    TEXT,
        "triggeredAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "completedAt" TIMESTAMPTZ
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "DevHubDeployment_project_idx"
        ON "DevHubDeployment" ("projectId", "triggeredAt" DESC);
    `);

    // Snippet shelf — publicly shareable code snippets (DEV.to / gist-style)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "DevHubSnippet" (
        "id"        TEXT PRIMARY KEY,
        "userId"    TEXT NOT NULL,
        "title"     TEXT NOT NULL,
        "content"   TEXT NOT NULL DEFAULT '',
        "language"  TEXT NOT NULL DEFAULT 'plaintext',
        "tags"      JSONB NOT NULL DEFAULT '[]'::jsonb,
        "stars"     INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "DevHubSnippet_created_idx"
        ON "DevHubSnippet" ("createdAt" DESC);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "DevHubSnippet_user_idx"
        ON "DevHubSnippet" ("userId", "createdAt" DESC);
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS "DevHubUsage" (
        "id"         TEXT PRIMARY KEY,
        "userId"     TEXT NOT NULL,
        "month"      TEXT NOT NULL,
        "capability" TEXT NOT NULL,
        "used"       INTEGER NOT NULL DEFAULT 0,
        "tier"       TEXT NOT NULL DEFAULT 'free',
        "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE ("userId", "month", "capability")
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "DevHubUsage_user_month_idx"
        ON "DevHubUsage" ("userId", "month");
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS "DevHubTier" (
        "userId"    TEXT PRIMARY KEY,
        "tier"      TEXT NOT NULL DEFAULT 'free',
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Email-keyed tier: stores tier granted via payment webhook before user registers
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "DevHubEmailTier" (
        "email"     TEXT PRIMARY KEY,
        "tier"      TEXT NOT NULL DEFAULT 'free',
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Связь «гость → почта». Модуль намеренно работает БЕЗ аккаунта, а
    // оплата приходит вебхуком с одним лишь адресом почты. Тариф при этом
    // ищется по идентификатору, и у гостя учётной записи нет — значит
    // заплативший видит бесплатный тариф (замер 29.08.2026 на живом проде:
    // /studio/credits с заголовком гостя отдаёт tier free).
    //
    // Эта таблица — недостающее звено, и она нужна при ЛЮБОМ из трёх
    // способов починки (вход перед оплатой / адрес на нашей стороне /
    // подсказка после оплаты). Заполняет её тот способ, который выберет
    // владелец продукта; чтение тарифа одинаково для всех трёх.
    //
    // Записи сюда НЕ создаёт ничто, кроме подтверждённой связи: адрес
    // здесь означает «этот гость доказал, что почта его», иначе любой
    // получил бы чужой оплаченный тариф, назвав чужую почту.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "DevHubGuestEmail" (
        "guestId"   TEXT PRIMARY KEY,
        "email"     TEXT NOT NULL,
        "linkedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "DevHubGuestEmail_email_idx"
        ON "DevHubGuestEmail" ("email");
    `);

  // Токены связывания гостя с покупкой.
  //
  // Строка DevHubGuestEmail создаётся ТОЛЬКО после подтверждения по почте:
  // иначе форма «я оплатил, вот мой адрес» стала бы способом присвоить
  // чужую покупку — адрес покупателя знает кто угодно, кому он его называл.
  //
  // guestId запоминается в момент ЗАПРОСА, а не подтверждения. Иначе ссылку
  // из чужого письма мог бы открыть посторонний и привязать покупку к своему
  // браузеру. Так ссылка работает только там, откуда её попросили.
  //
  // Секрет хранится ХЕШЕМ, как у подтверждения адреса в routes/auth.ts:
  // утечка базы не должна давать возможность войти в чужую покупку.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "DevHubGuestLinkToken" (
      "id"         TEXT PRIMARY KEY,
      "guestId"    TEXT NOT NULL,
      "email"      TEXT NOT NULL,
      "tokenHash"  TEXT NOT NULL,
      "expiresAt"  TIMESTAMPTZ NOT NULL,
      "usedAt"     TIMESTAMPTZ,
      "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS "DevHubGuestLinkToken_guest_idx"
    ON "DevHubGuestLinkToken" ("guestId");
  `);

    // One row per AI-driven multi-file write (generate_code / workflow "code"
    // step) — the prior content of every file it touched, so it can be
    // reverted in one shot ("undo the last AI change") without re-generating.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "DevHubCheckpoint" (
        "id"        TEXT PRIMARY KEY,
        "projectId" TEXT NOT NULL,
        "userId"    TEXT NOT NULL,
        "label"     TEXT NOT NULL,
        "files"     JSONB NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "DevHubCheckpoint_project_idx"
        ON "DevHubCheckpoint" ("projectId", "createdAt" DESC);
    `);

    dbReady = true;
    ensured = true;
  } catch (e: any) {
    dbReady = false;
    ensured = true;
    dbError = e?.message || "database DDL failed";
    console.warn(`[DevHub] Schema bootstrap failed — falling back to in-memory store: ${dbError}`);
  }
}
