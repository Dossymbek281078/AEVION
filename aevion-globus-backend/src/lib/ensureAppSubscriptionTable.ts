/**
 * Создание таблицы `AppSubscription` во время работы.
 *
 * Зачем понадобилось. Замер 19.08.2026 зондом по проду:
 *
 *   GET /api/apps/access                       -> 400 "email required"  (верно)
 *   GET /api/apps/access?email=любой@адрес.com -> 500 "db error"        (ВСЕГДА)
 *
 * Причина: `AppSubscription` была объявлена ТОЛЬКО в `prisma/schema.prisma` и
 * не создавалась никем во время работы. В этом репозитории схему ведут кодом —
 * 282 выражения `CREATE TABLE IF NOT EXISTS` против нуля применённых миграций
 * Prisma, — поэтому таблица, которой нет в этом списке, на проде не существует.
 * Из 26 моделей схемы такой оказалась одна ИСПОЛЬЗУЕМАЯ: остальные пять
 * «только в схеме» не читает ни один роутер, а кошелёк AEV живёт на файлах.
 *
 * Почему это дорого: в таблицу пишут оба обработчика покупок, а читает её
 * проверка прав. Цепочка «заплатил -> запись -> доступ открыт» проходила через
 * таблицу, которой нет. Комментарий в `appEntitlements.ts` при этом уверенно
 * утверждал, что «вебхук честно пишет покупку в AppSubscription».
 *
 * Колонки и ограничения повторяют модель Prisma дословно. Уникальность
 * (email, appSlug) обязательна: без неё `ON CONFLICT ("email","appSlug")` в
 * обработчиках покупок падает, и починка чтения сломала бы запись.
 */

import type pg from "pg";

type PgPoolInstance = InstanceType<typeof pg.Pool>;

let ensured = false;

/** Для тестов: повторить создание в следующем вызове. */
export function resetAppSubscriptionEnsured(): void {
  ensured = false;
}

export async function ensureAppSubscriptionTable(pool: PgPoolInstance): Promise<void> {
  if (ensured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "AppSubscription" (
      "id"        TEXT PRIMARY KEY,
      "email"     TEXT NOT NULL,
      "appSlug"   TEXT NOT NULL,
      "lsSubId"   TEXT,
      "status"    TEXT NOT NULL DEFAULT 'active',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "AppSubscription_email_appSlug_key"
      ON "AppSubscription" ("email", "appSlug");
    CREATE INDEX IF NOT EXISTS "AppSubscription_email_idx"
      ON "AppSubscription" ("email");
    CREATE INDEX IF NOT EXISTS "AppSubscription_appSlug_status_idx"
      ON "AppSubscription" ("appSlug", "status");
  `);
  // Отметка ставится ТОЛЬКО после успеха: иначе разовый сбой связи навсегда
  // объявил бы таблицу созданной, и следующий вызов пошёл бы в пустоту.
  ensured = true;
}
