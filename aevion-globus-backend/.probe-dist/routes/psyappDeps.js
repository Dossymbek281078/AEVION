"use strict";
/**
 * PsyApp-Deps — Addiction Recovery (alcohol / smoking / other).
 *
 * MVP scope: streak-tracker, trigger journal, AI support chat, daily affirmations.
 *
 * Endpoints:
 *   GET  /api/psyapp-deps/health
 *   POST /api/psyapp-deps/users/:alias/start     — start (or upsert) a program
 *   GET  /api/psyapp-deps/users/:alias           — user state + streak in days
 *   POST /api/psyapp-deps/users/:alias/relapse   — reset streak, append relapse row
 *   POST /api/psyapp-deps/triggers               — log a trigger event
 *   GET  /api/psyapp-deps/triggers/:alias        — list user's triggers (paginated)
 *   POST /api/psyapp-deps/support                — AI support chat (callProvider, 5/min)
 *   GET  /api/psyapp-deps/affirmations           — 10 hand-picked RU affirmations
 *   GET  /api/psyapp-deps/stats                  — total users, top trigger_type, avg streak
 *
 * Storage: Postgres via getPool() + in-memory fallback (mirrors qlife / qpersona pattern).
 * AI: callProvider() from services/qcoreai/providers (Anthropic/OpenAI/Gemini/DeepSeek/Grok).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.psyappDepsRouter = void 0;
exports.пробаPsyApp = пробаPsyApp;
const express_1 = require("express");
const dbPool_1 = require("../lib/dbPool");
const conceptBoardStore_1 = require("../lib/conceptBoardStore");
const ensurePsyAppTables_1 = require("../lib/ensurePsyAppTables");
const rateLimit_1 = require("../lib/rateLimit");
const providers_1 = require("../services/qcoreai/providers");
const authJwt_1 = require("../lib/authJwt");
const safeError_1 = require("../lib/safeError");
const planGate_1 = require("../lib/planGate");
exports.psyappDepsRouter = (0, express_1.Router)();
const pool = (0, dbPool_1.getPool)();
(async () => {
    try {
        await (0, ensurePsyAppTables_1.ensurePsyAppTables)(pool);
    }
    catch {
        // in-memory fallback active
    }
})();
// ─── Rate limiters ─────────────────────────────────────────────────────────────
const readLimit = (0, rateLimit_1.rateLimit)({ windowMs: 60000, max: 120, keyPrefix: "psyapp-read" });
const writeLimit = (0, rateLimit_1.rateLimit)({ windowMs: 60000, max: 60, keyPrefix: "psyapp-write" });
const aiLimit = (0, rateLimit_1.rateLimit)({ windowMs: 60000, max: 5, keyPrefix: "psyapp-ai" });
// ─── Types ────────────────────────────────────────────────────────────────────
const ADDICTIONS = ["alcohol", "smoking", "other"];
const TRIGGER_TYPES = ["craving", "stress", "social", "emotion"];
// ─── In-memory fallback ────────────────────────────────────────────────────────
const memUsers = new Map();
const memTriggers = [];
const memRelapses = [];
let _memTriggerSeq = 1;
let _memRelapseSeq = 1;
function aliasValid(alias) {
    return /^[a-z0-9_-]{2,40}$/i.test(alias);
}
// A claimed alias (owner_user_id set) may only be read/mutated by its owner
// (matching JWT sub). Unclaimed aliases (owner null) stay open — preserves the
// anonymous-pseudonym MVP flow for users who never sign in.
function ownerBlocks(existing, sub) {
    return !!(existing && existing.owner_user_id && existing.owner_user_id !== sub);
}
function toIsoString(v) {
    if (v instanceof Date)
        return v.toISOString();
    return String(v);
}
function streakDays(streakStartIso) {
    const start = new Date(streakStartIso).getTime();
    const now = Date.now();
    if (!Number.isFinite(start) || now < start)
        return 0;
    return Math.floor((now - start) / 86400000);
}
// ─── DB helpers ───────────────────────────────────────────────────────────────
async function dbUpsertUser(alias, addiction, startedAtIso, sub) {
    const startedAt = startedAtIso ?? new Date().toISOString();
    // COALESCE claims ownership only when the alias is currently unowned and a
    // sub is provided; an already-owned alias keeps its owner. The endpoint
    // rejects cross-owner access BEFORE calling this, so the upsert is safe.
    const { rows } = await pool.query(`INSERT INTO psyapp_users (alias, addiction, started_at, streak_start_at, owner_user_id)
     VALUES ($1, $2, $3, $3, $4)
     ON CONFLICT (alias) DO UPDATE
       SET addiction = EXCLUDED.addiction,
           owner_user_id = COALESCE(psyapp_users.owner_user_id, EXCLUDED.owner_user_id)
     RETURNING alias, addiction, started_at, streak_start_at, total_relapses, owner_user_id`, [alias, addiction, startedAt, sub]);
    const r = rows[0];
    return {
        alias: r.alias,
        addiction: r.addiction,
        started_at: toIsoString(r.started_at),
        streak_start_at: toIsoString(r.streak_start_at),
        total_relapses: Number(r.total_relapses ?? 0),
        owner_user_id: r.owner_user_id ?? null,
    };
}
async function dbGetUser(alias) {
    const { rows } = await pool.query(`SELECT alias, addiction, started_at, streak_start_at, total_relapses, owner_user_id
     FROM psyapp_users WHERE alias = $1`, [alias]);
    if (rows.length === 0)
        return null;
    const r = rows[0];
    return {
        alias: r.alias,
        addiction: r.addiction,
        started_at: toIsoString(r.started_at),
        streak_start_at: toIsoString(r.streak_start_at),
        total_relapses: Number(r.total_relapses ?? 0),
        owner_user_id: r.owner_user_id ?? null,
    };
}
async function dbRelapse(alias, reason) {
    const exists = await dbGetUser(alias);
    if (!exists)
        return null;
    await pool.query(`INSERT INTO psyapp_relapses (alias, reason) VALUES ($1, $2)`, [alias, reason]);
    const { rows } = await pool.query(`UPDATE psyapp_users
       SET streak_start_at = NOW(),
           total_relapses  = total_relapses + 1
     WHERE alias = $1
     RETURNING alias, addiction, started_at, streak_start_at, total_relapses`, [alias]);
    const r = rows[0];
    return {
        alias: r.alias,
        addiction: r.addiction,
        started_at: toIsoString(r.started_at),
        streak_start_at: toIsoString(r.streak_start_at),
        total_relapses: Number(r.total_relapses ?? 0),
    };
}
async function dbInsertTrigger(fields) {
    const { rows } = await pool.query(`INSERT INTO psyapp_triggers (alias, trigger_type, intensity, note, coped_how)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, alias, trigger_type, intensity, note, coped_how, logged_at`, [fields.alias, fields.trigger_type, fields.intensity, fields.note, fields.coped_how]);
    const r = rows[0];
    return {
        id: Number(r.id),
        alias: r.alias,
        trigger_type: r.trigger_type,
        intensity: Number(r.intensity),
        note: r.note,
        coped_how: r.coped_how,
        logged_at: toIsoString(r.logged_at),
    };
}
async function dbListTriggers(alias, limit, offset) {
    const { rows } = await pool.query(`SELECT id, alias, trigger_type, intensity, note, coped_how, logged_at
     FROM psyapp_triggers
     WHERE alias = $1
     ORDER BY logged_at DESC
     LIMIT $2 OFFSET $3`, [alias, limit, offset]);
    return rows.map((r) => ({
        id: Number(r.id),
        alias: r.alias,
        trigger_type: r.trigger_type,
        intensity: Number(r.intensity),
        note: r.note,
        coped_how: r.coped_how,
        logged_at: toIsoString(r.logged_at),
    }));
}
/**
 * Псевдоним пробы или владелец с нашим адресом — не человек из комьюнити.
 * Признаки — тот же источник, что у /api/stats/users: нашВнутреннийАдрес из planGate
 * для почты владельца и слова пробы в псевдониме. 20.10.2026 (слово Оркестратора):
 * публичное «24 в комьюнити» считало пробы наравне с людьми.
 * Ограничение: гостевую пробу со случайным псевдонимом (user-xxxx) не отличить — приборы
 * обязаны давать псевдоним probe-…
 */
function пробаPsyApp(alias, ownerEmail) {
    if (/^(smoke|probe|test|qa)[-_]/i.test(alias))
        return true;
    return (0, planGate_1.нашВнутреннийАдрес)(ownerEmail);
}
/*
 * «Средний streak» снят со всех поверхностей (20.10.2026, слово Оркестратора): считался как
 * AVG(NOW() − streak_start_at) по ВСЕМ аккаунтам, а серия сбрасывается только кнопкой
 * «Я сорвался» — брошенный аккаунт «удлинял серию» каждый день, и публичные «118d»
 * мерили заброшенность, а не успех. Вернуть — только по активным (поле последней активности).
 */
async function dbStats() {
    const usersR = await pool.query(`SELECT u.alias, a."email" AS owner_email
       FROM psyapp_users u
       LEFT JOIN "AEVIONUser" a ON a."id" = u.owner_user_id`);
    const люди = usersR.rows.filter((r) => !пробаPsyApp(r.alias, r.owner_email));
    const topR = await pool.query(`SELECT trigger_type, COUNT(*)::int AS cnt
     FROM psyapp_triggers
     GROUP BY trigger_type
     ORDER BY cnt DESC
     LIMIT 1`);
    return {
        total_users: люди.length,
        top_trigger_type: topR.rows[0]?.trigger_type ?? null,
    };
}
// ─── In-memory mirrors ────────────────────────────────────────────────────────
function memUpsertUser(alias, addiction, startedAtIso, sub) {
    const existing = memUsers.get(alias);
    if (existing) {
        existing.addiction = addiction;
        // Claim ownership if currently unowned and a sub is provided.
        if (!existing.owner_user_id && sub)
            existing.owner_user_id = sub;
        return existing;
    }
    const startedAt = startedAtIso ?? new Date().toISOString();
    const record = {
        alias,
        addiction,
        started_at: startedAt,
        streak_start_at: startedAt,
        total_relapses: 0,
        owner_user_id: sub ?? null,
    };
    memUsers.set(alias, record);
    return record;
}
function memGetUser(alias) {
    return memUsers.get(alias) ?? null;
}
function memRelapse(alias, reason) {
    const u = memUsers.get(alias);
    if (!u)
        return null;
    memRelapses.push({
        id: _memRelapseSeq++,
        alias,
        relapsed_at: new Date().toISOString(),
        reason,
    });
    u.streak_start_at = new Date().toISOString();
    u.total_relapses += 1;
    return u;
}
function memInsertTrigger(fields) {
    const record = {
        id: _memTriggerSeq++,
        ...fields,
        logged_at: new Date().toISOString(),
    };
    memTriggers.push(record);
    return record;
}
function memListTriggers(alias, limit, offset) {
    return memTriggers
        .filter((t) => t.alias === alias)
        .sort((a, b) => b.logged_at.localeCompare(a.logged_at))
        .slice(offset, offset + limit);
}
function memStats() {
    const counts = {};
    for (const t of memTriggers)
        counts[t.trigger_type] = (counts[t.trigger_type] || 0) + 1;
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
    const users = Array.from(memUsers.values()).filter((u) => !пробаPsyApp(u.alias, null));
    return {
        total_users: users.length,
        top_trigger_type: top ?? null,
    };
}
// ─── Affirmations (RU) ────────────────────────────────────────────────────────
const AFFIRMATIONS_RU = [
    "Ты сильнее, чем твоя зависимость. Один день — это победа.",
    "Каждая трезвая минута — кирпич в фундамент новой жизни.",
    "Тяга — это волна. Она поднимается и проходит. Дыши.",
    "Срыв не делает тебя слабым. Слабым делает отказ начать заново.",
    "Сегодня я выбираю себя. Не вещество, не привычку — себя.",
    "Тело помнит, как быть здоровым. Дай ему шанс.",
    "Я не один. Тысячи людей идут тем же путём прямо сейчас.",
    "Маленькие шаги — это и есть путь. Не геройство, а постоянство.",
    "Я учусь жить с эмоциями, а не убегать от них.",
    "Каждый день без — это подарок будущему мне.",
];
// ─── Routes ───────────────────────────────────────────────────────────────────
/** GET /api/psyapp-deps/health */
exports.psyappDepsRouter.get("/health", readLimit, (_req, res) => {
    res.json({
        ok: true,
        module: "psyapp-deps",
        db: (0, ensurePsyAppTables_1.isPsyAppDbReady)() ? "postgres" : "memory",
        dbError: (0, ensurePsyAppTables_1.getPsyAppDbError)(),
    });
});
/** POST /api/psyapp-deps/users/:alias/start */
exports.psyappDepsRouter.post("/users/:alias/start", writeLimit, async (req, res) => {
    try {
        const alias = String(req.params.alias || "").trim();
        if (!aliasValid(alias)) {
            return res.status(400).json({ ok: false, error: "alias must be 2..40 chars [a-z0-9_-]" });
        }
        const body = req.body ?? {};
        const addiction = String(body.addiction || "").toLowerCase();
        if (!ADDICTIONS.includes(addiction)) {
            return res.status(400).json({
                ok: false,
                error: `addiction must be one of: ${ADDICTIONS.join(", ")}`,
            });
        }
        const startedAtIso = body.startedAt ? new Date(String(body.startedAt)).toISOString() : null;
        const sub = (0, authJwt_1.verifyBearerOptional)(req)?.sub ?? null;
        // Reject if this alias was already claimed by a different signed-in user.
        const existing = (0, ensurePsyAppTables_1.isPsyAppDbReady)() ? await dbGetUser(alias) : memGetUser(alias);
        if (ownerBlocks(existing, sub)) {
            return res.status(403).json({ ok: false, error: "alias_owned_by_another_user" });
        }
        const user = (0, ensurePsyAppTables_1.isPsyAppDbReady)()
            ? await dbUpsertUser(alias, addiction, startedAtIso, sub)
            : memUpsertUser(alias, addiction, startedAtIso, sub);
        // Признак хранилища. До 19.08.2026 ответ был одинаков независимо от того,
        // легла запись в Postgres или в память процесса. Ручка /health при этом
        // честно говорила db: postgres|memory — то есть ПЛАТФОРМА знать могла, а
        // человек нет.
        //
        // Здесь это дороже, чем в других модулях: дневник срывов и триггеров и есть
        // продукт, за который платят $19/мес. Потерянная серия воздержания — не
        // строка в базе, а обесцененный месяц работы над собой.
        //
        // Флаг берём тем же вызовом, что выбирал ветку: посчитанный после записи,
        // он вернул бы "db" на восстановившейся базе и соврал снова.
        return res.status(201).json({
            ok: true,
            user,
            streak_days: streakDays(user.streak_start_at),
            storage: (0, ensurePsyAppTables_1.isPsyAppDbReady)() ? "db" : "memory",
        });
    }
    catch (e) {
        return res.status(500).json({ ok: false, error: (0, safeError_1.safeErrorText)(e, "internal error", "psyappDeps") });
    }
});
/** GET /api/psyapp-deps/users/:alias */
exports.psyappDepsRouter.get("/users/:alias", readLimit, async (req, res) => {
    try {
        const alias = String(req.params.alias || "").trim();
        if (!aliasValid(alias)) {
            return res.status(400).json({ ok: false, error: "alias invalid" });
        }
        const sub = (0, authJwt_1.verifyBearerOptional)(req)?.sub ?? null;
        const user = (0, ensurePsyAppTables_1.isPsyAppDbReady)() ? await dbGetUser(alias) : memGetUser(alias);
        if (!user)
            return res.status(404).json({ ok: false, error: "user_not_found" });
        if (ownerBlocks(user, sub)) {
            return res.status(403).json({ ok: false, error: "alias_owned_by_another_user" });
        }
        return res.json({ ok: true, user, streak_days: streakDays(user.streak_start_at) });
    }
    catch (e) {
        return res.status(500).json({ ok: false, error: (0, safeError_1.safeErrorText)(e, "internal error", "psyappDeps") });
    }
});
/** POST /api/psyapp-deps/users/:alias/relapse */
exports.psyappDepsRouter.post("/users/:alias/relapse", writeLimit, async (req, res) => {
    try {
        const alias = String(req.params.alias || "").trim();
        if (!aliasValid(alias)) {
            return res.status(400).json({ ok: false, error: "alias invalid" });
        }
        const reasonRaw = req.body?.reason;
        const reason = typeof reasonRaw === "string" && reasonRaw.trim().length > 0
            ? reasonRaw.trim().slice(0, 500)
            : null;
        const sub = (0, authJwt_1.verifyBearerOptional)(req)?.sub ?? null;
        const existing = (0, ensurePsyAppTables_1.isPsyAppDbReady)() ? await dbGetUser(alias) : memGetUser(alias);
        if (ownerBlocks(existing, sub)) {
            return res.status(403).json({ ok: false, error: "alias_owned_by_another_user" });
        }
        const user = (0, ensurePsyAppTables_1.isPsyAppDbReady)()
            ? await dbRelapse(alias, reason)
            : memRelapse(alias, reason);
        if (!user)
            return res.status(404).json({ ok: false, error: "user_not_found" });
        // Тот же признак: отметка о срыве при недоступной базе живёт в памяти, а
        // ответ «fresh start» до 19.08.2026 был неотличим от настоящего сохранения.
        return res.json({
            ok: true,
            user,
            streak_days: 0,
            message: "Streak reset. New day, fresh start.",
            storage: (0, ensurePsyAppTables_1.isPsyAppDbReady)() ? "db" : "memory",
        });
    }
    catch (e) {
        return res.status(500).json({ ok: false, error: (0, safeError_1.safeErrorText)(e, "internal error", "psyappDeps") });
    }
});
/** POST /api/psyapp-deps/triggers */
exports.psyappDepsRouter.post("/triggers", writeLimit, async (req, res) => {
    try {
        const body = req.body ?? {};
        const alias = String(body.alias || "").trim();
        if (!aliasValid(alias)) {
            return res.status(400).json({ ok: false, error: "alias invalid (2..40 chars [a-z0-9_-])" });
        }
        const triggerType = String(body.trigger_type || "").toLowerCase();
        if (!TRIGGER_TYPES.includes(triggerType)) {
            return res.status(400).json({
                ok: false,
                error: `trigger_type must be one of: ${TRIGGER_TYPES.join(", ")}`,
            });
        }
        const intensityRaw = body.intensity_1_10 ?? body.intensity;
        const intensity = parseInt(String(intensityRaw ?? ""), 10);
        if (!Number.isFinite(intensity) || intensity < 1 || intensity > 10) {
            return res.status(400).json({ ok: false, error: "intensity_1_10 must be 1..10" });
        }
        const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : null;
        const copedHowRaw = body.copedHow ?? body.coped_how;
        const copedHow = typeof copedHowRaw === "string" ? copedHowRaw.trim().slice(0, 500) : null;
        const sub = (0, authJwt_1.verifyBearerOptional)(req)?.sub ?? null;
        const ownerRow = (0, ensurePsyAppTables_1.isPsyAppDbReady)() ? await dbGetUser(alias) : memGetUser(alias);
        if (ownerBlocks(ownerRow, sub)) {
            return res.status(403).json({ ok: false, error: "alias_owned_by_another_user" });
        }
        const fields = {
            alias,
            trigger_type: triggerType,
            intensity,
            note: note && note.length > 0 ? note : null,
            coped_how: copedHow && copedHow.length > 0 ? copedHow : null,
        };
        const trigger = (0, ensurePsyAppTables_1.isPsyAppDbReady)() ? await dbInsertTrigger(fields) : memInsertTrigger(fields);
        return res.status(201).json({ ok: true, trigger });
    }
    catch (e) {
        return res.status(500).json({ ok: false, error: (0, safeError_1.safeErrorText)(e, "internal error", "psyappDeps") });
    }
});
/** GET /api/psyapp-deps/triggers/:alias */
exports.psyappDepsRouter.get("/triggers/:alias", readLimit, async (req, res) => {
    try {
        const alias = String(req.params.alias || "").trim();
        if (!aliasValid(alias)) {
            return res.status(400).json({ ok: false, error: "alias invalid" });
        }
        const sub = (0, authJwt_1.verifyBearerOptional)(req)?.sub ?? null;
        const ownerRow = (0, ensurePsyAppTables_1.isPsyAppDbReady)() ? await dbGetUser(alias) : memGetUser(alias);
        if (ownerBlocks(ownerRow, sub)) {
            return res.status(403).json({ ok: false, error: "alias_owned_by_another_user" });
        }
        const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "30"), 10) || 30, 1), 200);
        const offset = Math.max(parseInt(String(req.query.offset ?? "0"), 10) || 0, 0);
        const triggers = (0, ensurePsyAppTables_1.isPsyAppDbReady)()
            ? await dbListTriggers(alias, limit, offset)
            : memListTriggers(alias, limit, offset);
        return res.json({ ok: true, triggers, count: triggers.length, limit, offset });
    }
    catch (e) {
        return res.status(500).json({ ok: false, error: (0, safeError_1.safeErrorText)(e, "internal error", "psyappDeps") });
    }
});
/** POST /api/psyapp-deps/support — AI support chat */
exports.psyappDepsRouter.post("/support", aiLimit, async (req, res) => {
    try {
        const body = req.body ?? {};
        const message = typeof body.message === "string" ? body.message.trim().slice(0, 1000) : "";
        if (!message)
            return res.status(400).json({ ok: false, error: "message required" });
        const providerId = (0, providers_1.resolveProvider)();
        const providerDef = (0, providers_1.getProviders)().find((p) => p.id === providerId);
        const modelName = providerDef?.defaultModel ?? "";
        const systemPrompt = "Ты — поддерживающий советник по выходу из зависимостей. " +
            "Не суди, мягко поддержи, предложи 1 конкретный шаг, который человек может сделать прямо сейчас. " +
            "Ответ на русском языке, не более 120 слов. " +
            "Не ставь диагнозы. При признаках кризиса напомни, что есть службы помощи и специалисты.";
        const messages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: message },
        ];
        try {
            const result = await (0, providers_1.callProvider)(providerId, messages, modelName, 0.7, undefined, undefined, { module: "psyapp-support" });
            return res.json({
                ok: true,
                reply: result.reply,
                provider: providerId,
                model: result.model,
            });
        }
        catch (err) {
            const msg = err?.message || String(err);
            if (msg.includes("No AI provider configured") || msg === "not-configured") {
                return res.status(503).json({
                    ok: false,
                    error: "llm-not-configured",
                    reply: "Сейчас я не могу ответить — провайдер AI не настроен. Сделай 1 простой шаг: " +
                        "выпей стакан воды, выйди на воздух на 5 минут, позвони близкому. Тяга пройдёт.",
                });
            }
            console.error("[psyapp-deps] support_failed", msg);
            return res.status(502).json({
                ok: false,
                error: "llm-failed",
                reply: "Сбой при обращении к AI. Попробуй ещё раз. Ты не один.",
            });
        }
    }
    catch (e) {
        return res.status(500).json({ ok: false, error: (0, safeError_1.safeErrorText)(e, "internal error", "psyappDeps") });
    }
});
/** GET /api/psyapp-deps/affirmations */
exports.psyappDepsRouter.get("/affirmations", readLimit, (_req, res) => {
    res.json({ ok: true, affirmations: AFFIRMATIONS_RU, total: AFFIRMATIONS_RU.length });
});
/** GET /api/psyapp-deps/stats */
exports.psyappDepsRouter.get("/stats", readLimit, async (_req, res) => {
    try {
        const stats = (0, ensurePsyAppTables_1.isPsyAppDbReady)() ? await dbStats() : memStats();
        res.json({ ok: true, ...stats });
    }
    catch (e) {
        res.status(500).json({ ok: false, error: (0, safeError_1.safeErrorText)(e, "internal error", "psyappDeps") });
    }
});
// ── MVP concept board surface ───────────────────────────────────────────────
exports.psyappDepsRouter.get("/status", readLimit, (_req, res) => {
    res.json({
        module: "psyapp-deps",
        code: "PSYAPP",
        status: "mvp",
        description: "Dependencies recovery: streak tracker, trigger log, AI support, affirmations + concept board.",
        endpoints: {
            streak: "/api/psyapp-deps/streak",
            triggers: "/api/psyapp-deps/triggers",
            affirmations: "/api/psyapp-deps/affirmations",
            conceptMessages: "/api/psyapp-deps/concept/messages",
            conceptStats: "/api/psyapp-deps/concept-stats",
        },
        timestamp: new Date().toISOString(),
    });
});
(0, conceptBoardStore_1.mountConceptBoard)({ router: exports.psyappDepsRouter, moduleId: "psyapp-deps", defaultTag: "psyapp", readLimit, writeLimit });
