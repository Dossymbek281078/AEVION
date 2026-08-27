import { getPool } from "./dbPool";

/**
 * Проверка, что колонки, которые СПРАШИВАЮТ живые ручки, есть в БОЕВОЙ базе.
 *
 * Зачем отдельная проверка, если уже есть сторожа everyQueriedColumnExists
 * и everyQueriedTableIsCreated. Те сверяют запросы с CREATE TABLE, то есть с
 * НАМЕРЕНИЕМ. А `CREATE TABLE IF NOT EXISTS` к уже существующей таблице не
 * добавляет ничего: таблица, заведённая до переименования колонок, новых не
 * получит, и разбором исходника это не видно в принципе.
 *
 * 20.08.2026 ровно так и было: GET /api/build/documents/user/<id> отдавал 500
 * на ЛЮБОЙ запрос (проверено и выдуманным id, и служебным словом), при этом
 * в коде лежала правка с объясняющим комментарием, прод был собран с той же
 * ветки, а оба сторожа схемы — зелёные. Все три утверждения верны, а ручка
 * не работала.
 *
 * Приём: `LIMIT 0` возвращает НОЛЬ строк, но Postgres всё равно разбирает
 * список колонок. То есть стоимость нулевая, а отсутствующая колонка даёт
 * ошибку — ровно то, что нужно.
 */
export type SchemaCheck = { name: string; sql: string };

/**
 * Список намеренно короткий: сюда попадают запросы ручек, которые уже
 * ломались, и запросы к таблицам, чьи колонки переименовывались. Плодить
 * сюда всё подряд не надо — проверка обязана оставаться дешёвой.
 */
export const SCHEMA_CHECKS: SchemaCheck[] = [
  {
    name: "BuildDocument.reviewFields",
    sql: 'SELECT "id","docType","status","reviewedAt" FROM "BuildDocument" LIMIT 0',
  },
  {
    name: "QEvent.calendarFields",
    sql: 'SELECT "id","startAt","isPublic" FROM "QEvent" LIMIT 0',
  },
];

export type SchemaHealth = {
  ok: boolean;
  checked: number;
  /**
   * Сколько таблиц в базе ВСЕГО. Нужен именно знаменатель, а не только
   * число проверок: «проверено 2» звучит как охват, «проверено 2 из 87»
   * честно говорит, что это выборка. Ровно на этом обжигались два наших
   * сторожа — они проверяли жёсткий список и выглядели полными.
   * null означает «спросить не удалось», а НЕ ноль таблиц.
   */
  tablesTotal: number | null;
  failures: { name: string; error: string }[];
};

/**
 * Никогда не бросает: проверка здоровья не имеет права уронить сама себя.
 * Но и молчать не имеет права — отказ возвращается вызвавшему,
 * а не проглатывается.
 */
export async function checkQueriedSchemas(timeoutMs = 3000): Promise<SchemaHealth> {
  const failures: { name: string; error: string }[] = [];
  let pool: ReturnType<typeof getPool>;
  try {
    pool = getPool();
  } catch (e) {
    return {
      ok: false,
      checked: 0,
      tablesTotal: null,
      // «Не смог спросить» — это НЕ «всё хорошо». Отдельный текст, чтобы
      // отказ прибора не читался как отсутствие поломок.
      failures: [{ name: "pool", error: "спросить не удалось: " + String((e as Error)?.message ?? e) }],
    };
  }
  for (const c of SCHEMA_CHECKS) {
    try {
      await Promise.race([
        pool.query(c.sql),
        new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), timeoutMs)),
      ]);
    } catch (e) {
      failures.push({ name: c.name, error: String((e as Error)?.message ?? e).slice(0, 160) });
    }
  }
  // Знаменатель. Отказ этого запроса не делает проверку неуспешной — он лишь
  // оставляет охват неизвестным, и это видно по null.
  let tablesTotal: number | null = null;
  try {
    const r = await pool.query(
      `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'`,
    );
    const n = (r.rows?.[0] as { n?: number } | undefined)?.n;
    tablesTotal = typeof n === "number" ? n : null;
  } catch {
    tablesTotal = null;
  }

  return { ok: failures.length === 0, checked: SCHEMA_CHECKS.length, tablesTotal, failures };
}
