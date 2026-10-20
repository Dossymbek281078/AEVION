"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.droppedSmartRuns = droppedSmartRuns;
exports.insertSmartRun = insertSmartRun;
exports.aggregateSmartRunsForUser = aggregateSmartRunsForUser;
exports.aggregateSmartRuns = aggregateSmartRuns;
exports.dailySmartRuns = dailySmartRuns;
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
const dbPool_1 = require("./dbPool");
const denPoMestnomu_1 = require("../lib/denPoMestnomu");
const EST_COUNCIL_COST_USD = 0.077;
let ensured = false;
let dbUsable = null;
async function ensureTable() {
    if (ensured)
        return dbUsable === true;
    ensured = true;
    try {
        const pool = (0, dbPool_1.getPool)();
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
    }
    catch (e) {
        dbUsable = false;
        console.warn(`[smartRunLog] DB unavailable — savings persistence off: ${e?.message || e}`);
    }
    return dbUsable === true;
}
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
function droppedSmartRuns() {
    return droppedRuns;
}
function insertSmartRun(row) {
    void (async () => {
        try {
            // Хранилище недоступно — это ТОЖЕ потерянная запись, и она самая
            // вероятная. Первая редакция счётчика ловила только сбой запроса, а
            // сюда управление до запроса не доходит вовсе: отказ оставался
            // невидимым ровно в том случае, ради которого счётчик и заводился.
            // Нашёл собственный сторож, не глаз.
            if (!(await ensureTable())) {
                droppedRuns++;
                console.warn(`[SmartRunLog] запись расхода потеряна (всего ${droppedRuns}), модуль ${row.module}: хранилище недоступно`);
                return;
            }
            await (0, dbPool_1.getPool)().query(`INSERT INTO "smart_run_log" ("module","resolved","depth","costUsd","savedUsd","userId") VALUES ($1,$2,$3,$4,$5,$6)`, [row.module, row.resolved, row.depth ?? null, row.costUsd, row.savedUsd, row.userId ?? null]);
        }
        catch (e) {
            // Не роняем: учёт не должен ломать операцию, ради которой его зовут.
            // Но и не молчим — иначе сводка врёт правдоподобно: при сломанной
            // записи она выглядит как при исправной, просто чисел меньше.
            droppedRuns++;
            console.warn(`[SmartRunLog] запись расхода потеряна (всего ${droppedRuns}), модуль ${row.module}: ${String(e)}`);
        }
    })();
}
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
async function aggregateSmartRunsForUser(userId) {
    if (!(await ensureTable()))
        return null;
    try {
        const r = await (0, dbPool_1.getPool)().query(`SELECT
         COUNT(*)                                        AS runs,
         COALESCE(SUM("costUsd"), 0)                     AS cost,
         COUNT(*) FILTER (WHERE "module" LIKE '%БЕЗ-ЦЕНЫ') AS unpriced
       FROM "smart_run_log"
       WHERE "userId" = $1`, [userId]);
        const row = r.rows[0] || {};
        // Второй запрос намеренно отдельный: он группирует и стоит дороже, а первый
        // обязан отвечать даже если этот не выполнится.
        const поМодулям = {};
        try {
            const g = await (0, dbPool_1.getPool)().query(`SELECT "module", COUNT(*) AS n
           FROM "smart_run_log"
          WHERE "userId" = $1 AND "module" LIKE '%БЕЗ-ЦЕНЫ'
          GROUP BY "module"
          ORDER BY n DESC`, [userId]);
            for (const строка of g.rows || [])
                поМодулям[String(строка.module)] = Number(строка.n || 0);
        }
        catch (e) {
            console.warn(`[smartRunLog] разбивка не прочитана: ${e?.message || e}`);
        }
        return {
            runs: Number(row.runs || 0),
            costUsd: Number(row.cost || 0),
            // Сколько из них — вызовы, цену которых посчитать нечем. Без этого числа
            // сумма читается как полная, а она неполна: у восьми поверхностей
            // поставщика нет в нашей таблице цен.
            unpricedRuns: Number(row.unpriced || 0),
            /*
             * РАЗБИВКА, а не одно число (29.09.2026).
             *
             * «У 50 прогонов из 73 цены нет» — верно и бесполезно: чинить нечего, пока
             * не видно, КАКИЕ поверхности её теряют. Одно число одинаково выглядит и
             * когда не хватает одного тарифа, и когда восемь ручек считают не в токенах.
             * Поэтому рядом идёт счёт по модулям — он называет виноватого.
             */
            unpricedByModule: поМодулям,
        };
    }
    catch (e) {
        console.warn(`[smartRunLog] расход пользователя не прочитан: ${e?.message || e}`);
        return null;
    }
}
async function aggregateSmartRuns() {
    if (!(await ensureTable()))
        return null;
    try {
        const result = await (0, dbPool_1.getPool)().query(`
      SELECT
        "module",
        COUNT(*)                                             AS runs,
        COUNT(*) FILTER (WHERE "resolved" = 'single')        AS facts,
        COUNT(*) FILTER (WHERE "resolved" = 'council' AND "depth" = 'light') AS light,
        COUNT(*) FILTER (WHERE "resolved" = 'council' AND "depth" = 'deep')  AS deep,
        COALESCE(SUM("costUsd"), 0)                          AS cost,
        COALESCE(SUM("savedUsd"), 0)                         AS saved,
        -- Вызовы, по которым экономия ВООБЩЕ считалась. Без этого числа доля
        -- делила числитель одной совокупности на знаменатель другой.
        COUNT(*) FILTER (WHERE "savedUsd" > 0)               AS compared
      FROM "smart_run_log"
      GROUP BY "module"
      ORDER BY runs DESC
    `);
        const rows = result.rows;
        const perModule = rows.map((r) => ({
            module: r.module,
            runs: Number(r.runs),
            facts: Number(r.facts),
            light: Number(r.light),
            deep: Number(r.deep),
            totalCostUsd: Number(r.cost),
            savedUsd: Number(r.saved),
        }));
        const runsCompared = rows.reduce((s, r) => s + Number(r.compared), 0);
        const total = perModule.reduce((a, m) => {
            a.runs += m.runs;
            a.facts += m.facts;
            a.light += m.light;
            a.deep += m.deep;
            a.totalCostUsd += m.totalCostUsd;
            a.savedUsd += m.savedUsd;
            return a;
        }, { runs: 0, facts: 0, light: 0, deep: 0, totalCostUsd: 0, savedUsd: 0 });
        /*
         * 🔴 Доля считается по ОДНОЙ совокупности — по тем вызовам, где экономия
         * действительно считалась. Прежде знаменатель умножался на ВСЕ вызовы
         * (`total.runs`), а числитель приходил с трёх: замер прода 01.10.2026 дал
         * «$0.23 = 2.05 %» при собственных полях «$9.56 = 85.7 %», расхождение
         * 41.7 раза. Вызовы, у которых альтернативы «совет» не было вовсе
         * (devhub-generate-anon — 80 из 145), в сравнение не входят, и считать их
         * так, будто они могли стоить дороже, значит придумывать себе заслугу.
         *
         * `estAlwaysCouncilUsd` теперь отвечает на вопрос «сколько стоили бы
         * СРАВНИВАЕМЫЕ вызовы, если всегда звать совет» — и только на него.
         */
        const estAlwaysCouncilUsd = runsCompared * EST_COUNCIL_COST_USD;
        const savedPct = estAlwaysCouncilUsd > 0 ? (100 * total.savedUsd) / estAlwaysCouncilUsd : 0;
        // droppedRuns едет ВМЕСТЕ со сводкой: читатель узнаёт о её неполноте из
        // самой сводки, а не из журнала сервера, куда никто не смотрит.
        return { ...total, estAlwaysCouncilUsd, savedPct, runsCompared, perModule, droppedRuns };
    }
    catch {
        return null;
    }
}
/** Per-day savings for the last `days` days (UTC), oldest→newest. Missing days
 *  are zero-filled so a sparkline has a fixed-width series. Null if no DB. */
async function dailySmartRuns(days = 7) {
    const n = Math.max(1, Math.min(90, Math.floor(days)));
    if (!(await ensureTable()))
        return null;
    try {
        const result = await (0, dbPool_1.getPool)().query(`
      SELECT to_char(date_trunc('day', "ts"), 'YYYY-MM-DD') AS day,
             COUNT(*) AS runs,
             COALESCE(SUM("savedUsd"), 0) AS saved,
             COALESCE(SUM("costUsd"), 0) AS cost
      FROM "smart_run_log"
      WHERE "ts" >= NOW() - ($1::int * INTERVAL '1 day')
      GROUP BY 1
      ORDER BY 1
      `, [n]);
        const rows = result.rows;
        const byDay = new Map(rows.map((r) => [r.day, r]));
        // Zero-fill from n-1 days ago → today, using pure arithmetic on ms (no
        // Date.now(): derive "today" from the newest row, else fall back to rows).
        const out = [];
        // Build the date list from the max present day backwards; if empty, return [].
        if (rows.length === 0)
            return [];
        const last = rows[rows.length - 1].day;
        const lastMs = Date.parse(last + "T00:00:00Z");
        for (let i = n - 1; i >= 0; i--) {
            const d = (0, denPoMestnomu_1.denPoMestnomu)(new Date(lastMs - i * 86400000));
            const hit = byDay.get(d);
            out.push({
                date: d,
                runs: hit ? Number(hit.runs) : 0,
                savedUsd: hit ? Number(hit.saved) : 0,
                costUsd: hit ? Number(hit.cost) : 0,
            });
        }
        return out;
    }
    catch {
        return null;
    }
}
