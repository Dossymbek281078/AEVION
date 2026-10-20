"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.razborZadachi = razborZadachi;
exports.zapisatRazbory = zapisatRazbory;
exports.skolkoRazborov = skolkoRazborov;
exports._sbrosDlyaTestov = _sbrosDlyaTestov;
const dbPool_1 = require("./dbPool");
let таблицаГотова = null;
function ensureTable() {
    if (!таблицаГотова) {
        таблицаГотова = (async () => {
            try {
                await (0, dbPool_1.getPool)().query(`CREATE TABLE IF NOT EXISTS "PuzzleRazbor" (
             "puzzleId"  TEXT PRIMARY KEY,
             "ru"        TEXT NOT NULL,
             "en"        TEXT NOT NULL,
             "kk"        TEXT NOT NULL,
             "model"     TEXT NOT NULL DEFAULT '',
             "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
           )`);
            }
            catch (e) {
                таблицаГотова = null; // следующая попытка создаст заново, а не запомнит отказ навсегда
                throw e;
            }
        })();
    }
    return таблицаГотова;
}
/** Небольшой кэш: один и тот же id спрашивают подряд (страница, ход, решение). */
const КЭШ = new Map();
const КЭШ_МС = 10 * 60000;
const КЭШ_МАКС = 5000;
async function razborZadachi(id) {
    const k = КЭШ.get(id);
    if (k && Date.now() - k.t < КЭШ_МС)
        return k.r;
    await ensureTable();
    const q = (await (0, dbPool_1.getPool)().query(`SELECT "ru","en","kk","model" FROM "PuzzleRazbor" WHERE "puzzleId" = $1`, [id]));
    const r = q.rows[0] ? { ru: q.rows[0].ru, en: q.rows[0].en, kk: q.rows[0].kk, model: q.rows[0].model } : null;
    if (КЭШ.size >= КЭШ_МАКС)
        КЭШ.clear();
    КЭШ.set(id, { t: Date.now(), r });
    return r;
}
/** Пакетная запись (upsert) — вызывает импорт из разового прогона; возвращает число записанных строк. */
async function zapisatRazbory(items) {
    if (items.length === 0)
        return 0;
    await ensureTable();
    const values = [];
    const rows = items.map((it, i) => {
        values.push(it.id, it.ru, it.en, it.kk, it.model ?? "");
        const b = i * 5;
        return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5})`;
    });
    const q = await (0, dbPool_1.getPool)().query(`INSERT INTO "PuzzleRazbor" ("puzzleId","ru","en","kk","model") VALUES ${rows.join(",")}
     ON CONFLICT ("puzzleId") DO UPDATE SET "ru"=EXCLUDED."ru","en"=EXCLUDED."en","kk"=EXCLUDED."kk","model"=EXCLUDED."model"`, values);
    for (const it of items)
        КЭШ.delete(it.id);
    return q.rowCount ?? items.length;
}
async function skolkoRazborov() {
    await ensureTable();
    const q = (await (0, dbPool_1.getPool)().query(`SELECT count(*)::text AS n FROM "PuzzleRazbor"`));
    return Number(q.rows[0]?.n ?? 0);
}
/** Для тестов: сбросить кэш и память о таблице. */
function _sbrosDlyaTestov() {
    КЭШ.clear();
    таблицаГотова = null;
}
