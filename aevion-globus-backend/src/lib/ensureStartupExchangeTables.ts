import type pg from "pg";

type PgPoolInstance = InstanceType<typeof pg.Pool>;

/** Латчится ТОЛЬКО на успехе: неудача — повод попробовать ещё раз, а не приговор. */
let ensuredOk = false;
let lastAttemptAt = 0;
let dbReady: boolean | null = null;
let dbError: string | null = null;
let failedAttempts = 0;

/**
 * Пауза между попытками. Без неё каждый запрос в минуту недоступности базы
 * добавлял бы свой таймаут подключения к времени ответа.
 */
const RETRY_COOLDOWN_MS = 10_000;

export function isStartupExchangeDbReady(): boolean {
  return dbReady === true;
}

export function getStartupExchangeDbError(): string | null {
  return dbError;
}

/** Только для тестов: вернуть модуль в состояние «ещё не пробовали». */
export function __resetStartupExchangeDbState(): void {
  ensuredOk = false;
  lastAttemptAt = 0;
  dbReady = null;
  dbError = null;
  failedAttempts = 0;
}

/**
 * Create the StartupX tables (and indexes).
 *
 * Defensive: if Postgres is unavailable or table creation fails, we flip
 * `dbReady=false` and let the route fall back to its in-memory Map. This
 * keeps `/startup-exchange` functional in local dev / preview deploys
 * without a database — same pattern as ensureQNewsTables / ensureQJobsTables.
 *
 * ВАЖНО (замер 27.07.2026 на живом Postgres 18): раньше функция латчилась после
 * ПЕРВОЙ попытки, а вызывалась она один раз при старте процесса. На загруженной
 * машине первое подключение отвалилось по таймауту в 5 секунд — и модуль ушёл в
 * память НАВСЕГДА при полностью живой базе. В проде это выглядит так: API
 * поднялся раньше, чем проснулся Postgres, заявки пишутся в оперативку и
 * исчезают на ближайшем рестарте, а `/health` — единственное место, где это
 * видно. Теперь латчится только успех, а неудача разрешает повтор не чаще раза
 * в `RETRY_COOLDOWN_MS`; роутер зовёт функцию заново, пока база не поднимется.
 */
export async function ensureStartupExchangeTables(pool: PgPoolInstance): Promise<void> {
  if (ensuredOk) return;
  const now = Date.now();
  if (lastAttemptAt !== 0 && now - lastAttemptAt < RETRY_COOLDOWN_MS) return;
  lastAttemptAt = now;
  try {
    await pool.query("SELECT 1");
  } catch (e: unknown) {
    dbReady = false;
    failedAttempts += 1;
    dbError = e instanceof Error ? e.message : "database unavailable";
    // Кричим только на первой неудаче и дальше редко: иначе лог забьётся тем же
    // сообщением раз в десять секунд и в нём утонет всё остальное.
    if (failedAttempts === 1 || failedAttempts % 30 === 0) {
      console.warn(
        `[StartupX] Database unavailable (попытка ${failedAttempts}) — пока работаем из памяти: ${dbError}`,
      );
    }
    return;
  }
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS startup_ideas (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        stage TEXT NOT NULL CHECK (stage IN ('idea','prototype','mvp','scaling')),
        founder_email TEXT,
        contact_method TEXT,
        qright_object_id TEXT,
        content_hash TEXT,
        visibility TEXT NOT NULL DEFAULT 'public',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_startup_ideas_stage ON startup_ideas(stage);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_startup_ideas_created ON startup_ideas(created_at DESC);`);

    // ── Listing tiers (2026-07) ──────────────────────────────────────────────
    // The exchange used to have one kind of row for everything from a one-line
    // idea to a revenue-earning product, with no deal terms at all. `tier` is
    // now the primary axis and carries its own terms; the original `stage`
    // column stays (it has a CHECK constraint and old rows depend on it) and is
    // written from the tier so the two can never drift apart.
    await pool.query(`ALTER TABLE startup_ideas ADD COLUMN IF NOT EXISTS tier TEXT;`);
    await pool.query(`ALTER TABLE startup_ideas ADD COLUMN IF NOT EXISTS sector TEXT;`);
    await pool.query(`ALTER TABLE startup_ideas ADD COLUMN IF NOT EXISTS geography TEXT;`);
    await pool.query(`ALTER TABLE startup_ideas ADD COLUMN IF NOT EXISTS demo_url TEXT;`);
    await pool.query(`ALTER TABLE startup_ideas ADD COLUMN IF NOT EXISTS repo_url TEXT;`);
    await pool.query(`ALTER TABLE startup_ideas ADD COLUMN IF NOT EXISTS deal JSONB;`);
    await pool.query(`ALTER TABLE startup_ideas ADD COLUMN IF NOT EXISTS metrics JSONB;`);
    // Assessment snapshot: stored so the feed can sort and filter by score
    // without recomputing, and so a score can be traced to the rules that made
    // it (assessment_version) instead of being silently re-graded by new rules.
    await pool.query(`ALTER TABLE startup_ideas ADD COLUMN IF NOT EXISTS assessment JSONB;`);
    await pool.query(`ALTER TABLE startup_ideas ADD COLUMN IF NOT EXISTS assessment_score INTEGER;`);
    await pool.query(`ALTER TABLE startup_ideas ADD COLUMN IF NOT EXISTS assessment_version INTEGER;`);
    // Founder's key to their own listing. Only the SHA-256 of the token is
    // stored — a leaked database row must not hand over the offers. The plain
    // token is shown to the founder exactly once, right after publishing.
    // Without this the offers investors send simply accumulate in a table
    // nobody can read, which is what the first version did.
    await pool.query(`ALTER TABLE startup_ideas ADD COLUMN IF NOT EXISTS manage_token_hash TEXT;`);
    // Сколько раз открывали страницу заявки. Без этого числа основатель не может
    // отличить «меня не видят» от «видят, но условия не устраивают», а лечатся
    // эти два состояния противоположным: первое — охватом, второе — ценой.
    await pool.query(`ALTER TABLE startup_ideas ADD COLUMN IF NOT EXISTS views INTEGER NOT NULL DEFAULT 0;`);
    // Снятие оператором: причина и время. Заявка, исчезнувшая без объяснения, —
    // это то, за что площадки справедливо ругают; основатель должен увидеть, что
    // именно и почему сняли, у себя в кабинете.
    await pool.query(`ALTER TABLE startup_ideas ADD COLUMN IF NOT EXISTS removed_reason TEXT;`);
    await pool.query(`ALTER TABLE startup_ideas ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ;`);

    // Backfill: every pre-tier row gets the tier its legacy stage implies.
    // Runs once — after this, `tier IS NULL` matches nothing.
    await pool.query(`
      UPDATE startup_ideas SET tier = CASE
        WHEN stage = 'idea' THEN 'idea'
        WHEN stage IN ('prototype','mvp') THEN 'mvp'
        WHEN stage = 'scaling' THEN 'product'
        ELSE 'idea' END
      WHERE tier IS NULL;
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_startup_ideas_tier ON startup_ideas(tier);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_startup_ideas_score ON startup_ideas(assessment_score DESC NULLS LAST);`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS startup_interests (
        id SERIAL PRIMARY KEY,
        idea_id INTEGER NOT NULL REFERENCES startup_ideas(id) ON DELETE CASCADE,
        investor_email TEXT NOT NULL,
        message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_startup_interests_idea ON startup_interests(idea_id);`);
    // An "interest" with no terms is a comment. These three columns make it an
    // offer the founder can answer yes or no to.
    await pool.query(`ALTER TABLE startup_interests ADD COLUMN IF NOT EXISTS intent TEXT;`);
    await pool.query(`ALTER TABLE startup_interests ADD COLUMN IF NOT EXISTS ticket_usd BIGINT;`);
    await pool.query(`ALTER TABLE startup_interests ADD COLUMN IF NOT EXISTS equity_pct NUMERIC;`);

    // Жалобы посетителей. Без них модерация слепа: оператор снимает только то,
    // что случайно увидел сам, а видит он ничтожную долю ленты.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS startup_reports (
        id SERIAL PRIMARY KEY,
        idea_id INTEGER NOT NULL REFERENCES startup_ideas(id) ON DELETE CASCADE,
        reason TEXT NOT NULL,
        note TEXT,
        reporter_hash TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_startup_reports_idea ON startup_reports(idea_id);`);
    // Один адрес — одна жалоба на заявку: иначе счётчик жалоб превращается в
    // кнопку «утопить конкурента», нажатую двадцать раз подряд.
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_startup_reports_once ON startup_reports(idea_id, reporter_hash);`);

    dbReady = true;
    ensuredOk = true;
    dbError = null;
    if (failedAttempts > 0) {
      // Переключение на середине жизни процесса: то, что успели написать в
      // память, в ленте из базы не появится. Молча это переживать нельзя —
      // основатель увидит, что его заявка пропала.
      console.warn(
        `[StartupX] База поднялась после ${failedAttempts} неудачных попыток — дальше пишем в Postgres. ` +
        `Всё, что попало в память за это время, в ленте из базы не появится.`,
      );
      failedAttempts = 0;
    }
    console.log("[StartupX] Tables ready");
  } catch (e: unknown) {
    dbReady = false;
    failedAttempts += 1;
    dbError = e instanceof Error ? e.message : "table creation failed";
    console.warn(`[StartupX] Could not create tables — falling back to in-memory: ${dbError}`);
  }
}
