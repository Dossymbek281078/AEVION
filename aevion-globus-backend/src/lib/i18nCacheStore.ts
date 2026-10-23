/**
 * Кэш переводов, переживающий выкатку.
 *
 * 23.10.2026 (Продукт): кэш /api/i18n/translate жил только в памяти процесса (Map, до 60 000 записей). После
 * выкатки 14:25 он обнулился (cacheSize 6564 → 540), и каждая страница на en/kk снова шла в Claude партиями
 * по 12 строк — сводка «платные вызовы БЕЗ учёта» выросла до 659 за 4 часа. Здесь — зеркало Map в Postgres:
 * при первом запросе перевода память греется из базы, каждая новая запись дописывается в базу (пакетом,
 * не блокируя ответ), очистка чистит обе стороны. База недоступна → работаем как раньше, в памяти, и
 * пишем об этом в журнал ОДИН раз (не молчим — §16).
 *
 * Запрос к базе инжектируется (queryFn), чтобы сторож проверял поведение без Postgres.
 */
export type QueryFn = (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
export type CacheRow = { key: string; target: string; source: string; translated: string; engine?: string };

export const I18N_CACHE_TABLE = "i18n_translation_cache";

export function createI18nCacheStore(queryFn: QueryFn, log: (msg: string) => void = (m) => console.warn(m)) {
  let tableReady = false;
  let available: boolean | null = null; // null — ещё не пробовали
  let warned = false;
  const fail = (what: string, e: unknown) => {
    available = false;
    if (!warned) { warned = true; log(`[i18n] кэш переводов в базе недоступен (${what}): ${String((e as Error)?.message ?? e).slice(0, 160)} — работаем в памяти, после выкатки кэш снова будет холодным`); }
  };
  async function ensureTable(): Promise<boolean> {
    if (tableReady) return available === true;
    try {
      await queryFn(`CREATE TABLE IF NOT EXISTS ${I18N_CACHE_TABLE} (
        "key" TEXT PRIMARY KEY,
        "target" TEXT NOT NULL,
        "source" TEXT NOT NULL,
        "translated" TEXT NOT NULL,
        "engine" TEXT,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      await queryFn(`CREATE INDEX IF NOT EXISTS ${I18N_CACHE_TABLE}_target_idx ON ${I18N_CACHE_TABLE} ("target")`);
      available = true;
    } catch (e) { fail("создание таблицы", e); }
    tableReady = true;
    return available === true;
  }
  return {
    /** Прогреть Map из базы (самые свежие записи, не больше max). Возвращает число загруженных. */
    async warm(map: Map<string, string>, max: number): Promise<number> {
      if (!(await ensureTable())) return 0;
      try {
        const r = await queryFn(`SELECT "key", "translated" FROM ${I18N_CACHE_TABLE} ORDER BY "created_at" DESC LIMIT $1`, [max]);
        let n = 0;
        for (const row of r.rows) { const k = String(row.key), v = String(row.translated); if (!map.has(k)) { map.set(k, v); n++; } }
        return n;
      } catch (e) { fail("чтение", e); return 0; }
    },
    /** Дописать новые переводы (upsert по key). Ошибка — в журнал, не в ответ. */
    async persist(rows: CacheRow[]): Promise<number> {
      if (!rows.length || !(await ensureTable())) return 0;
      try {
        const values: unknown[] = []; const tuples: string[] = [];
        rows.forEach((r, i) => { const b = i * 5; tuples.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5})`); values.push(r.key, r.target, r.source, r.translated, r.engine ?? null); });
        await queryFn(`INSERT INTO ${I18N_CACHE_TABLE} ("key","target","source","translated","engine") VALUES ${tuples.join(",")}
          ON CONFLICT ("key") DO UPDATE SET "translated" = EXCLUDED."translated", "engine" = EXCLUDED."engine", "created_at" = now()`, values);
        return rows.length;
      } catch (e) { fail("запись", e); return 0; }
    },
    /** Очистить базу (по языку или всю). Возвращает число удалённых или -1 при недоступности. */
    async clear(target?: string): Promise<number> {
      if (!(await ensureTable())) return -1;
      try {
        const r = target
          ? await queryFn(`DELETE FROM ${I18N_CACHE_TABLE} WHERE "target" = $1 RETURNING 1`, [target])
          : await queryFn(`DELETE FROM ${I18N_CACHE_TABLE} RETURNING 1`);
        return r.rows.length;
      } catch (e) { fail("очистка", e); return -1; }
    },
    get available(): boolean | null { return available; },
    /** Для тестов. */
    __reset(): void { tableReady = false; available = null; warned = false; },
  };
}
export type I18nCacheStore = ReturnType<typeof createI18nCacheStore>;
