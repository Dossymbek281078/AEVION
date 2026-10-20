"use strict";
/**
 * Constitution Pro gate middleware.
 *
 * Call requirePro / requireProOrSigned inside route handlers to enforce
 * tier limits server-side. All gates degrade gracefully — free users get
 * a 402 with { error, plan: "free", upgradeUrl } so the frontend can show
 * the paywall rather than a generic error.
 *
 * Plan resolution: JWT payload.plan === "pro"  OR  email allowlist  OR
 * active paid subscription via getActivePlan(email) (same as /me/plan).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FREE_SAVE_LIMIT = void 0;
exports.resolvePlan = resolvePlan;
exports.requirePro = requirePro;
exports.planMiddleware = planMiddleware;
exports.getPlanFromReq = getPlanFromReq;
exports.__resetAiDailyTableState = __resetAiDailyTableState;
exports.aiRateGate = aiRateGate;
exports.checkSaveLimit = checkSaveLimit;
const denPoMestnomu_1 = require("../lib/denPoMestnomu");
const authJwt_1 = require("./authJwt");
const provisioning_1 = require("../routes/provisioning");
const rateLimit_1 = require("../lib/rateLimit");
const node_crypto_1 = require("node:crypto");
const dbPool_1 = require("./dbPool");
const ALLOWLIST = (process.env.CONSTITUTION_PRO_ALLOWLIST || "")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const PUBLIC_BASE = (process.env.AEVION_PUBLIC_BASE_URL ?? "https://aevion.app").replace(/\/+$/, "");
/**
 * Single source of truth for Constitution plan resolution. Used by both the
 * server-side gates (requirePro / aiRateGate) and the /me/plan endpoint the
 * frontend reads — keep them on this one resolver so the paywall the user
 * sees can never disagree with what the server actually enforces.
 *
 * Priority: JWT plan=pro → email allowlist → active paid subscription → free.
 */
function resolvePlan(req) {
    const payload = (0, authJwt_1.verifyBearerOptional)(req);
    if (!payload)
        return { plan: "free", email: null, reason: "no-token" };
    const p = payload;
    const email = typeof p.email === "string" ? p.email.toLowerCase() : null;
    if (p.plan === "pro")
        return { plan: "pro", email, reason: "jwt-plan" };
    if (email && ALLOWLIST.includes(email))
        return { plan: "pro", email, reason: "allowlist" };
    if (email) {
        const active = (0, provisioning_1.getActivePlan)(email);
        if (active.active && active.tierId !== "free") {
            return { plan: "pro", email, reason: `subscription:${active.tierId}` };
        }
    }
    return { plan: "free", email, reason: "default" };
}
function upgradeResponse(res) {
    res.status(402).json({
        error: "pro_required",
        plan: "free",
        upgradeUrl: `${PUBLIC_BASE}/constitution/pricing`,
        message: "Функция доступна в Constitution Pro ($9/мес). Upgrade: /constitution/pricing",
    });
}
/** Middleware: 402 if not Pro. */
function requirePro(req, res, next) {
    const { plan } = resolvePlan(req);
    if (plan === "pro") {
        next();
        return;
    }
    upgradeResponse(res);
}
/** Returns plan info without blocking — use when you need soft behaviour. */
function planMiddleware(req, _res, next) {
    req._constitutionPlan = resolvePlan(req);
    next();
}
function getPlanFromReq(req) {
    return req._constitutionPlan ?? resolvePlan(req);
}
const aiCounters = new Map();
const AI_FREE_DAILY_LIMIT = Number(process.env.CONSTITUTION_AI_FREE_DAILY || "10");
const DAY_MS = 24 * 60 * 60 * 1000;
function clientKey(req) {
    // Левый элемент X-Forwarded-For пишет сам клиент: по такому ключу дневной
    // предел ИИ снимался сменой одного заголовка. req.ip учитывает доверенные
    // узлы (trust proxy), helper нормализует адрес — иначе обход по IPv6.
    return (0, rateLimit_1.clientIp)(req);
}
/* ───── Постоянный суточный счётчик (переживает выкатку) ─────────── */
/**
 * Счётчик в памяти процесса обнулялся при КАЖДОЙ выкатке: суточный предел в
 * 10 запросов превращался в «10 на промежуток между выкатками». Механизм
 * верный, срок жизни неверный — окно предела длиннее жизни процесса.
 *
 * 🔒 В таблицу кладётся ХЕШ адреса, а не адрес. Образец взят у воронки
 * конституции (столбец fpHash): раз уж данные становятся постоянными, они не
 * должны быть персональными. Соль отделяет наши хеши от чужих радужных таблиц.
 */
const AI_SALT = process.env.CONSTITUTION_ANON_SALT || "aevion-constitution-v1";
let aiTableReady = false;
let aiDbAvailable = false;
function aiKeyHash(raw) {
    return (0, node_crypto_1.createHash)("sha256").update(`${raw}|${AI_SALT}`).digest("hex").slice(0, 32);
}
async function ensureAiDailyTable() {
    if (aiTableReady)
        return;
    try {
        await (0, dbPool_1.getPool)().query(`
      CREATE TABLE IF NOT EXISTS constitution_ai_daily (
        "day"   TEXT NOT NULL,
        "key"   TEXT NOT NULL,
        "count" INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY ("day", "key")
      );
    `);
        aiDbAvailable = true;
    }
    catch {
        aiDbAvailable = false;
    }
    aiTableReady = true;
}
/** Для тестов: следующая проверка снова спросит базу. */
function __resetAiDailyTableState() {
    aiTableReady = false;
    aiDbAvailable = false;
}
async function takeAiQuota(rawKey) {
    await ensureAiDailyTable();
    const limit = AI_FREE_DAILY_LIMIT;
    if (aiDbAvailable) {
        const day = (0, denPoMestnomu_1.denPoMestnomu)();
        const key = aiKeyHash(rawKey);
        try {
            const r = await (0, dbPool_1.getPool)().query(`SELECT "count" FROM constitution_ai_daily WHERE "day"=$1 AND "key"=$2`, [day, key]);
            const used = Number(r.rows[0]?.count ?? 0);
            if (used >= limit)
                return { allowed: false, used, limit };
            await (0, dbPool_1.getPool)().query(`INSERT INTO constitution_ai_daily ("day","key","count") VALUES ($1,$2,1)
         ON CONFLICT ("day","key") DO UPDATE SET "count" = constitution_ai_daily."count" + 1`, [day, key]);
            return { allowed: true, used: used + 1, limit };
        }
        catch (e) {
            // Не роняем ответ из-за учёта, но и не молчим: без этой строки переход на
            // счётчик в памяти был бы неотличим от нормальной работы, а предел при
            // этом снова стал бы «на промежуток между выкатками».
            console.warn(`[constitution/ai] суточный счётчик не прочитан из базы, считаем в памяти ` +
                `(предел обнулится при выкатке): ${e?.message ?? e}`);
        }
    }
    return checkAndIncrementAiUsage(rawKey);
}
/** Returns true when the free user is within daily AI limit and increments. */
function checkAndIncrementAiUsage(key) {
    const now = Date.now();
    let c = aiCounters.get(key);
    if (!c || c.resetAt < now) {
        c = { count: 0, resetAt: now + DAY_MS };
        aiCounters.set(key, c);
    }
    if (c.count >= AI_FREE_DAILY_LIMIT)
        return { allowed: false, used: c.count, limit: AI_FREE_DAILY_LIMIT };
    c.count += 1;
    return { allowed: true, used: c.count, limit: AI_FREE_DAILY_LIMIT };
}
/** Middleware: 429 if free AND over daily AI limit. Pro → pass through. */
/**
 * Ворота стали АСИНХРОННЫМИ: счёт теперь в базе, а она асинхронна. Вызовы уже
 * приведены через `as unknown as (...) => void`, поэтому подпись совпадает.
 * Ошибок наружу не выпускаем — всё поймано внутри takeAiQuota.
 */
async function aiRateGate(req, res, next) {
    const { plan } = resolvePlan(req);
    if (plan === "pro") {
        next();
        return;
    }
    const key = clientKey(req);
    const { allowed, used, limit } = await takeAiQuota(key);
    if (allowed) {
        next();
        return;
    }
    res.status(429).json({
        error: "ai_daily_limit",
        plan: "free",
        used,
        limit,
        resetInHours: 24,
        upgradeUrl: `${PUBLIC_BASE}/constitution/pricing`,
        message: `Free tier: ${limit} AI-запросов в день. Ты использовал ${used}. Upgrade → Pro для безлимита.`,
    });
}
/* ───── Scenario save limit check (free: 5 cloud saves) ─────────── */
exports.FREE_SAVE_LIMIT = Number(process.env.CONSTITUTION_FREE_SAVE_LIMIT || "5");
/** Call this after a save is counted. Returns { allowed, current, limit }. */
function checkSaveLimit(plan, savedTotal) {
    if (plan === "pro")
        return { allowed: true };
    return { allowed: savedTotal < exports.FREE_SAVE_LIMIT };
}
