"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCHEMA_CHECKS = void 0;
exports.checkQueriedSchemas = checkQueriedSchemas;
const dbPool_1 = require("./dbPool");
/**
 * Список намеренно короткий: сюда попадают запросы ручек, которые уже
 * ломались, и запросы к таблицам, чьи колонки переименовывались. Плодить
 * сюда всё подряд не надо — проверка обязана оставаться дешёвой.
 */
exports.SCHEMA_CHECKS = [
    {
        name: "BuildDocument.reviewFields",
        sql: 'SELECT "id","docType","status","reviewedAt" FROM "BuildDocument" LIMIT 0',
    },
    {
        name: "QEvent.calendarFields",
        sql: 'SELECT "id","startAt","isPublic" FROM "QEvent" LIMIT 0',
    },
];
/**
 * Никогда не бросает: проверка здоровья не имеет права уронить сама себя.
 * Но и молчать не имеет права — отказ возвращается вызвавшему,
 * а не проглатывается.
 */
async function checkQueriedSchemas(timeoutMs = 3000) {
    const failures = [];
    let pool;
    try {
        pool = (0, dbPool_1.getPool)();
    }
    catch (e) {
        return {
            ok: false,
            checked: 0,
            tablesTotal: null,
            // «Не смог спросить» — это НЕ «всё хорошо». Отдельный текст, чтобы
            // отказ прибора не читался как отсутствие поломок.
            failures: [{ name: "pool", error: "спросить не удалось: " + String(e?.message ?? e) }],
        };
    }
    for (const c of exports.SCHEMA_CHECKS) {
        try {
            await Promise.race([
                pool.query(c.sql),
                new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), timeoutMs)),
            ]);
        }
        catch (e) {
            failures.push({ name: c.name, error: String(e?.message ?? e).slice(0, 160) });
        }
    }
    // Знаменатель. Отказ этого запроса не делает проверку неуспешной — он лишь
    // оставляет охват неизвестным, и это видно по null.
    let tablesTotal = null;
    try {
        const r = await pool.query(`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'`);
        const n = r.rows?.[0]?.n;
        tablesTotal = typeof n === "number" ? n : null;
    }
    catch {
        tablesTotal = null;
    }
    return { ok: failures.length === 0, checked: exports.SCHEMA_CHECKS.length, tablesTotal, failures };
}
