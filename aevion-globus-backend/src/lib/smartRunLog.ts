/**
 * Cross-module smartComplete run log — Postgres persistence for the platform
 * savings tally, so the "AI spent rationally" number survives restarts and can
 * be broken down per module over all time.
 *
 * Best-effort + DB-optional, matching the QCoreAI store philosophy: if there is
 * no reachable database, every function here quietly no-ops (writes) or returns
 * null (reads), and the caller falls back to the in-memory session tally. Writes
 * are fire-and-forget — logging a run must never slow or fail a user request.
 */
import { getPool } from "./dbPool";

const EST_COUNCIL_COST_USD = 0.077;

let ensured = false;
let dbUsable: boolean | null = null;

async function ensureTable(): Promise<boolean> {
  if (ensured) return dbUsable === true;
  ensured = true;
  try {
    const pool = getPool();
    await pool.query("SELECT 1");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "smart_run_log" (
        "id"        BIGSERIAL PRIMARY KEY,
        "ts"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "module"    TEXT NOT NULL DEFAULT 'qcoreai',
        "resolved"  TEXT NOT NULL,
        "depth"     TEXT,
        "costUsd"   DOUBLE PRECISION NOT NULL DEFAULT 0,
        "savedUsd"  DOUBLE PRECISION NOT NULL DEFAULT 0,
        "userId"    TEXT
      );
    `);
      // Для УЖЕ созданной таблицы CREATE TABLE IF NOT EXISTS колонку не добавит,
      // поэтому отдельным шагом. Колонка обнуляемая: старые записи и записи
      // модулей, которые пользователя не знают, останутся без неё — это честно,
      // а не дефект. Заведена 03.09.2026 ради прямой задачи основателя:
      // покупатель должен видеть СВОЙ расход на экране, а не только админ.
      await pool.query(`ALTER TABLE "smart_run_log" ADD COLUMN IF NOT EXISTS "userId" TEXT;`);
      await pool.query(`CREATE INDEX IF NOT EXISTS "smart_run_log_user_ts_idx" ON "smart_run_log" ("userId","ts");`);
    await pool.query(`CREATE INDEX IF NOT EXISTS "smart_run_log_module_ts_idx" ON "smart_run_log" ("module", "ts");`);
    dbUsable = true;
  } catch (e: any) {
    dbUsable = false;
    console.warn(`[smartRunLog] DB unavailable — savings persistence off: ${e?.message || e}`);
  }
  return dbUsable === true;
}

export type SmartRunRow = {
  module: string;
  resolved: "single" | "council";
  depth?: "light" | "deep";
  costUsd: number;
  savedUsd: number;
  /**
   * Кто потратил. Необязательное: модули, которые пользователя не знают,
   * пишут без него, и это честнее, чем подставлять «anonymous» — пустое
   * поле видно как незнание, а выдуманное значение неотличимо от факта.
   */
  userId?: string | null;
};

/** Fire-and-forget: persist one routed run. Never throws. */
/**
 * Сколько записей расхода НЕ сохранилось.
 *
 * Прежде отказ проглатывался полностью, с пометкой best-effort. Направление
 * выбрано верно — учёт не должен ронять операцию, ради которой его зовут, —
 * но МОЛЧАНИЕ было недосмотром, а не выбором: решение о деньгах принимали бы
 * по числу, которое не знает, что оно неполное.
 *
 * Признак едет В САМИХ ДАННЫХ, как storage у conceptBoardStore: поле
 * droppedRuns в сводке. Читатель видит её неполноту, не заглядывая в журнал.
 */
let droppedRuns = 0;

/** Сколько записей расхода потеряно с момента запуска процесса. */
export function droppedSmartRuns(): number {
  return droppedRuns;
}

export function insertSmartRun(row: SmartRunRow): void {
  void (async () => {
    try {
      // Хранилище недоступно — это ТОЖЕ потерянная запись, и она самая
      // вероятная. Первая редакция счётчика ловила только сбой запроса, а
      // сюда управление до запроса не доходит вовсе: отказ оставался
      // невидимым ровно в том случае, ради которого счётчик и заводился.
      // Нашёл собственный сторож, не глаз.
      if (!(await ensureTable())) {
        droppedRuns++;
        console.warn(
          `[SmartRunLog] запись расхода потеряна (всего ${droppedRuns}), модуль ${row.module}: хранилище недоступно`,
        );
        return;
      }
      await getPool().query(
        `INSERT INTO "smart_run_log" ("module","resolved","depth","costUsd","savedUsd","userId") VALUES ($1,$2,$3,$4,$5,$6)`,
        [row.module, row.resolved, row.depth ?? null, row.costUsd, row.savedUsd, row.userId ?? null]
      );
      } catch (e) {
        // Не роняем: учёт не должен ломать операцию, ради которой его зовут.
        // Но и не молчим — иначе сводка врёт правдоподобно: при сломанной
        // записи она выглядит как при исправной, просто чисел меньше.
        droppedRuns++;
        console.warn(
          `[SmartRunLog] запись расхода потеряна (всего ${droppedRuns}), модуль ${row.module}: ${String(e)}`,
        );
      }
  })();
}

export type SmartModuleAgg = {
  module: string;
  runs: number;
  facts: number;
  light: number;
  deep: number;
  totalCostUsd: number;
  savedUsd: number;
};

export type SmartAllTime = {
  runs: number;
  facts: number;
  light: number;
  deep: number;
  totalCostUsd: number;
  estAlwaysCouncilUsd: number;
  savedUsd: number;
  savedPct: number;
  perModule: SmartModuleAgg[];
  /** Записей расхода потеряно с запуска процесса. Больше нуля = сводка НЕПОЛНА. */
  droppedRuns: number;
};

/** All-time aggregate from the DB, or null when persistence is unavailable. */
/**
 * Расход ОДНОГО человека — то, что он вправе увидеть у себя на экране.
 *
 * Заведено 03.09.2026 по прямой задаче основателя: «открою кабинет как
 * покупатель и увижу, сколько потратили мои запуски». До этого расход
 * существовал только в разрезе модулей, то есть был виден админу и не был
 * виден тому, чьи это деньги.
 *
 * Возвращает null, если хранилище недоступно — НЕ ноль. Ноль означал бы
 * «вы ничего не потратили», а это другое утверждение, и оно успокаивает
 * ложно.
 */
export async function aggregateSmartRunsForUser(
  userId: string,
): Promise<{ runs: number; costUsd: number; unpricedRuns: number } | null> {
  if (!(await ensureTable())) return null;
  try {
    const r = await getPool().query(
      `SELECT
         COUNT(*)                                        AS runs,
         COALESCE(SUM("costUsd"), 0)                     AS cost,
         COUNT(*) FILTER (WHERE "module" LIKE '%БЕЗ-ЦЕНЫ') AS unpriced
       FROM "smart_run_log"
       WHERE "userId" = $1`,
      [userId],
    );
    const row = r.rows[0] || {};
    return {
      runs: Number(row.runs || 0),
      costUsd: Number(row.cost || 0),
      // Сколько из них — вызовы, цену которых посчитать нечем. Без этого числа
      // сумма читается как полная, а она неполна: у восьми поверхностей
      // поставщика нет в нашей таблице цен.
      unpricedRuns: Number(row.unpriced || 0),
    };
  } catch (e: any) {
    console.warn(`[smartRunLog] расход пользователя не прочитан: ${e?.message || e}`);
    return null;
  }
}

export async function aggregateSmartRuns(): Promise<SmartAllTime | null> {
  if (!(await ensureTable())) return null;
  try {
    type Row = { module: string; runs: string; facts: string; light: string; deep: string; cost: string; saved: string };
    const result = await getPool().query(`
      SELECT
        "module",
        COUNT(*)                                             AS runs,
        COUNT(*) FILTER (WHERE "resolved" = 'single')        AS facts,
        COUNT(*) FILTER (WHERE "resolved" = 'council' AND "depth" = 'light') AS light,
        COUNT(*) FILTER (WHERE "resolved" = 'council' AND "depth" = 'deep')  AS deep,
        COALESCE(SUM("costUsd"), 0)                          AS cost,
        COALESCE(SUM("savedUsd"), 0)                         AS saved
      FROM "smart_run_log"
      GROUP BY "module"
      ORDER BY runs DESC
    `);
    const rows = result.rows as Row[];
    const perModule: SmartModuleAgg[] = rows.map((r) => ({
      module: r.module,
      runs: Number(r.runs),
      facts: Number(r.facts),
      light: Number(r.light),
      deep: Number(r.deep),
      totalCostUsd: Number(r.cost),
      savedUsd: Number(r.saved),
    }));
    const total = perModule.reduce(
      (a, m) => {
        a.runs += m.runs; a.facts += m.facts; a.light += m.light; a.deep += m.deep;
        a.totalCostUsd += m.totalCostUsd; a.savedUsd += m.savedUsd;
        return a;
      },
      { runs: 0, facts: 0, light: 0, deep: 0, totalCostUsd: 0, savedUsd: 0 }
    );
    const estAlwaysCouncilUsd = total.runs * EST_COUNCIL_COST_USD;
    const savedPct = estAlwaysCouncilUsd > 0 ? (100 * total.savedUsd) / estAlwaysCouncilUsd : 0;
    // droppedRuns едет ВМЕСТЕ со сводкой: читатель узнаёт о её неполноте из
    // самой сводки, а не из журнала сервера, куда никто не смотрит.
    return { ...total, estAlwaysCouncilUsd, savedPct, perModule, droppedRuns };
  } catch {
    return null;
  }
}

export type SmartDay = { date: string; runs: number; savedUsd: number; costUsd: number };

/** Per-day savings for the last `days` days (UTC), oldest→newest. Missing days
 *  are zero-filled so a sparkline has a fixed-width series. Null if no DB. */
export async function dailySmartRuns(days = 7): Promise<SmartDay[] | null> {
  const n = Math.max(1, Math.min(90, Math.floor(days)));
  if (!(await ensureTable())) return null;
  try {
    type DRow = { day: string; runs: string; saved: string; cost: string };
    const result = await getPool().query(
      `
      SELECT to_char(date_trunc('day', "ts"), 'YYYY-MM-DD') AS day,
             COUNT(*) AS runs,
             COALESCE(SUM("savedUsd"), 0) AS saved,
             COALESCE(SUM("costUsd"), 0) AS cost
      FROM "smart_run_log"
      WHERE "ts" >= NOW() - ($1::int * INTERVAL '1 day')
      GROUP BY 1
      ORDER BY 1
      `,
      [n]
    );
    const rows = result.rows as DRow[];
    const byDay = new Map(rows.map((r) => [r.day, r]));
    // Zero-fill from n-1 days ago → today, using pure arithmetic on ms (no
    // Date.now(): derive "today" from the newest row, else fall back to rows).
    const out: SmartDay[] = [];
    // Build the date list from the max present day backwards; if empty, return [].
    if (rows.length === 0) return [];
    const last = rows[rows.length - 1].day;
    const lastMs = Date.parse(last + "T00:00:00Z");
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(lastMs - i * 86_400_000).toISOString().slice(0, 10);
      const hit = byDay.get(d);
      out.push({
        date: d,
        runs: hit ? Number(hit.runs) : 0,
        savedUsd: hit ? Number(hit.saved) : 0,
        costUsd: hit ? Number(hit.cost) : 0,
      });
    }
    return out;
  } catch {
    return null;
  }
}
