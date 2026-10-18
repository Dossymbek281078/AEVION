import { getPool } from "./dbPool";

/**
 * Разборы задач CyberChess (волна 142, 18.10.2026): короткое объяснение линии решения на ru/en/kk.
 *
 * Откуда текст: разовый прогон scripts/razbory-zadach/generate.cjs — факт о позиции берётся из позиции
 * (chess.js: линия решения, клетки, фигуры), модель только формулирует, сторож отбрасывает любой текст с
 * ходом/клеткой/фигурой не из линии. После 31.10 зависимостей от внешнего API нет: тексты лежат в БД.
 *
 * Хранение — таблица "PuzzleRazbor" в Postgres, создаётся на лету (тот же приём, что у
 * "CyberchessCpiState" в routes/cyberchess.ts: в этом сервисе миграции применяются так). Отсутствие
 * разбора — не ошибка: поле просто не отдаётся, страницы это умеют.
 */
export type Razbor = { ru: string; en: string; kk: string; model?: string };

let таблицаГотова: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!таблицаГотова) {
    таблицаГотова = (async () => {
      try {
        await getPool().query(
          `CREATE TABLE IF NOT EXISTS "PuzzleRazbor" (
             "puzzleId"  TEXT PRIMARY KEY,
             "ru"        TEXT NOT NULL,
             "en"        TEXT NOT NULL,
             "kk"        TEXT NOT NULL,
             "model"     TEXT NOT NULL DEFAULT '',
             "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
           )`,
        );
      } catch (e: unknown) {
        таблицаГотова = null; // следующая попытка создаст заново, а не запомнит отказ навсегда
        throw e;
      }
    })();
  }
  return таблицаГотова;
}
type СтрокаРазбора = { ru: string; en: string; kk: string; model: string };

/** Небольшой кэш: один и тот же id спрашивают подряд (страница, ход, решение). */
const КЭШ = new Map<string, { t: number; r: Razbor | null }>();
const КЭШ_МС = 10 * 60_000;
const КЭШ_МАКС = 5000;

export async function razborZadachi(id: string): Promise<Razbor | null> {
  const k = КЭШ.get(id);
  if (k && Date.now() - k.t < КЭШ_МС) return k.r;
  await ensureTable();
  const q = (await getPool().query(
    `SELECT "ru","en","kk","model" FROM "PuzzleRazbor" WHERE "puzzleId" = $1`,
    [id],
  )) as { rows: СтрокаРазбора[] };
  const r = q.rows[0] ? { ru: q.rows[0].ru, en: q.rows[0].en, kk: q.rows[0].kk, model: q.rows[0].model } : null;
  if (КЭШ.size >= КЭШ_МАКС) КЭШ.clear();
  КЭШ.set(id, { t: Date.now(), r });
  return r;
}

export type RazborDlyaZapisi = { id: string; ru: string; en: string; kk: string; model?: string };

/** Пакетная запись (upsert) — вызывает импорт из разового прогона; возвращает число записанных строк. */
export async function zapisatRazbory(items: readonly RazborDlyaZapisi[]): Promise<number> {
  if (items.length === 0) return 0;
  await ensureTable();
  const values: unknown[] = [];
  const rows = items.map((it, i) => {
    values.push(it.id, it.ru, it.en, it.kk, it.model ?? "");
    const b = i * 5;
    return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5})`;
  });
  const q = await getPool().query(
    `INSERT INTO "PuzzleRazbor" ("puzzleId","ru","en","kk","model") VALUES ${rows.join(",")}
     ON CONFLICT ("puzzleId") DO UPDATE SET "ru"=EXCLUDED."ru","en"=EXCLUDED."en","kk"=EXCLUDED."kk","model"=EXCLUDED."model"`,
    values,
  );
  for (const it of items) КЭШ.delete(it.id);
  return q.rowCount ?? items.length;
}

export async function skolkoRazborov(): Promise<number> {
  await ensureTable();
  const q = (await getPool().query(`SELECT count(*)::text AS n FROM "PuzzleRazbor"`)) as { rows: Array<{ n: string }> };
  return Number(q.rows[0]?.n ?? 0);
}

/** Для тестов: сбросить кэш и память о таблице. */
export function _sbrosDlyaTestov(): void {
  КЭШ.clear();
  таблицаГотова = null;
}
