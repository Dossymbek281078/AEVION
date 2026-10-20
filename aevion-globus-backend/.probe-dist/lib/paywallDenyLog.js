"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordDeny = recordDeny;
exports.funnelSummary = funnelSummary;
exports.resetPaywallDenyLog = resetPaywallDenyLog;
/**
 * Paywall deny funnel — records every 402 upgrade_required the module gate
 * emits, so the platform can see DEMAND for paid modules instead of dropping
 * that signal on the floor. Each deny is an anonymous data point: which
 * module, which plan tier hit the wall, when. No user ids by design — the
 * funnel is aggregate-only, same posture as /smart/savings and /qcoreai/opex.
 *
 * DB-optional, best-effort, fire-and-forget — matches providerHealth /
 * smartRunLog store philosophy: no reachable database → writes no-op and
 * reads fall back to the in-process session counters.
 */
const dbPool_1 = require("./dbPool");
const PRUNE_DAYS = 90;
let ensured = false;
let dbUsable = null;
// In-process fallback tally (also the fast path for "since boot" numbers).
const memCounts = new Map();
// Ключ — JSON, а не склейка через двоеточие: склейку разбирали по
// lastIndexOf(":"), и третье поле сломало бы разбор МОЛЧА. Тест про модуль с
// двоеточием в имени существует ровно потому, что на этом уже спотыкались.
function memKey(module, plan, audience) {
    return JSON.stringify([module, plan, audience]);
}
function parseMemKey(k) {
    const [module, plan, audience] = JSON.parse(k);
    return { module, plan, audience };
}
async function ensureTable() {
    if (ensured)
        return dbUsable === true;
    ensured = true;
    try {
        const pool = (0, dbPool_1.getPool)();
        await pool.query("SELECT 1");
        await pool.query(`
      CREATE TABLE IF NOT EXISTS "paywall_deny_log" (
        "id"     BIGSERIAL PRIMARY KEY,
        "ts"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "module" TEXT NOT NULL,
        "plan"   TEXT NOT NULL
      );
    `);
        // Колонка заведена 13.09.2026. ADD COLUMN IF NOT EXISTS идемпотентна: на
        // свежей базе это no-op сразу после CREATE, на живой — добавляет поле, не
        // трогая уже записанные строки (у них останется NULL, читается как
        // "unknown", а не как "anonymous" — см. DenyAudienceRead).
        //
        // Стоит ВНУТРИ общего try намеренно, хотя это новый способ для ensureTable
        // упасть на уже живой базе. Причина: если колонки нет, то и INSERT из трёх
        // полей не пройдёт — а ошибки вставки здесь глотаются молча, и запись
        // отказов пропала бы навсегда и незаметно. Общий try даёт вместо этого
        // предупреждение в журнал и честный откат на счётчики в памяти. Шумный
        // откат лучше тихой потери (§14 «молчаливый отказ выглядит успехом»).
        await pool.query(`ALTER TABLE "paywall_deny_log" ADD COLUMN IF NOT EXISTS "audience" TEXT`);
        await pool.query(`CREATE INDEX IF NOT EXISTS "paywall_deny_log_module_ts_idx" ON "paywall_deny_log" ("module", "ts");`);
        // Boot-time prune — the funnel is a rolling-window signal, not an archive.
        try {
            await pool.query(`DELETE FROM "paywall_deny_log" WHERE "ts" < NOW() - INTERVAL '${PRUNE_DAYS} days'`);
        }
        catch {
            /* best-effort */
        }
        dbUsable = true;
    }
    catch (e) {
        dbUsable = false;
        console.warn(`[paywallDenyLog] DB unavailable — deny funnel persistence off: ${e?.message || e}`);
    }
    return dbUsable === true;
}
/**
 * Record one 402. Never throws, never blocks the response path.
 *
 * `audience` ОБЯЗАТЕЛЕН намеренно: значение по умолчанию молча вернуло бы
 * прежнюю слепоту, а компилятор о нём бы не сказал. Пусть лучше не соберётся.
 */
function recordDeny(module, plan, audience) {
    const k = memKey(module, plan, audience);
    memCounts.set(k, (memCounts.get(k) ?? 0) + 1);
    void (async () => {
        try {
            if (!(await ensureTable()))
                return;
            await (0, dbPool_1.getPool)().query(`INSERT INTO "paywall_deny_log" ("module","plan","audience") VALUES ($1,$2,$3)`, [module, plan, audience]);
        }
        catch {
            /* best-effort — drop silently */
        }
    })();
}
/** Сложить разбивку аудитории в накопитель, не теряя уже посчитанное. */
function addAudience(acc, audience, n) {
    acc[audience] = (acc[audience] ?? 0) + n;
}
/** Aggregate deny funnel over the last `days` days (clamped 1–90). */
async function funnelSummary(days = 30) {
    const n = Math.max(1, Math.min(PRUNE_DAYS, Math.floor(days)));
    if (await ensureTable()) {
        try {
            const result = await (0, dbPool_1.getPool)().query(
            // COALESCE, а не игнорирование NULL: строки до 13.09.2026 поля не
            // имеют, и они обязаны быть ВИДНЫ отдельной категорией. Отбросить их
            // значило бы занизить сумму, слить с анонимом — оболгать её.
            `SELECT "module", "plan",
                COALESCE("audience", 'unknown') AS audience,
                COUNT(*)::int AS denies,
                COUNT(*) FILTER (WHERE "ts" >= NOW() - INTERVAL '24 hours')::int AS last24h
           FROM "paywall_deny_log"
          WHERE "ts" >= NOW() - ($1::int * INTERVAL '1 day')
          GROUP BY "module", "plan", COALESCE("audience", 'unknown')`, [n]);
            const byModuleMap = new Map();
            const byAudience = {};
            let totalDenies = 0;
            let last24h = 0;
            for (const r of result.rows) {
                const row = byModuleMap.get(r.module) ?? { module: r.module, denies: 0, last24h: 0, byPlan: {}, byAudience: {} };
                row.denies += r.denies;
                row.last24h += r.last24h;
                row.byPlan[r.plan] = (row.byPlan[r.plan] ?? 0) + r.denies;
                addAudience(row.byAudience, r.audience, r.denies);
                byModuleMap.set(r.module, row);
                addAudience(byAudience, r.audience, r.denies);
                totalDenies += r.denies;
                last24h += r.last24h;
            }
            return {
                totalDenies,
                last24h,
                byModule: Array.from(byModuleMap.values()).sort((a, b) => b.denies - a.denies),
                windowDays: n,
                source: "db",
                byAudience,
            };
        }
        catch {
            /* fall through to memory */
        }
    }
    // Memory fallback — counts since process boot, no time windows.
    const byModuleMap = new Map();
    const byAudience = {};
    let totalDenies = 0;
    for (const [k, count] of memCounts) {
        const { module, plan, audience } = parseMemKey(k);
        const row = byModuleMap.get(module) ?? { module, denies: 0, last24h: 0, byPlan: {}, byAudience: {} };
        row.denies += count;
        row.byPlan[plan] = (row.byPlan[plan] ?? 0) + count;
        addAudience(row.byAudience, audience, count);
        byModuleMap.set(module, row);
        addAudience(byAudience, audience, count);
        totalDenies += count;
    }
    return {
        totalDenies,
        last24h: 0,
        byModule: Array.from(byModuleMap.values()).sort((a, b) => b.denies - a.denies),
        windowDays: n,
        source: "memory",
        byAudience,
    };
}
/** Reset in-memory tallies (tests only). */
function resetPaywallDenyLog() {
    memCounts.clear();
}
