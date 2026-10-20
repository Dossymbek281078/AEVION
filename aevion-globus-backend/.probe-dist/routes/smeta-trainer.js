"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.smetaTrainerRouter = void 0;
const publicUrlOnly_1 = require("../lib/publicUrlOnly");
const internalHost_1 = require("../lib/internalHost");
const express_1 = require("express");
const queryNumber_1 = require("../lib/queryNumber");
const node_crypto_1 = __importDefault(require("node:crypto"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const authJwt_1 = require("../lib/authJwt");
const jsonFileStore_1 = require("../lib/jsonFileStore");
const platform_1 = require("../lib/sentry/platform");
const captureSmetaError = (0, platform_1.makeServiceCapture)("smeta-trainer");
// AI-тренажёр сметного дела РК — backend для прогресса студентов.
// MVP storage через jsonFileStore (как aev/qright). Prisma-схема
// (SmetaStudent / SmetaProgress / SmetaAttempt) готова для миграции
// на Postgres когда DATABASE_URL будет задан.
//
// Endpoints:
//  GET  /api/smeta-trainer/student/:deviceId             — снимок прогресса студента
//  POST /api/smeta-trainer/student/:deviceId/sync        — upsert прогресса уровней (idempotent)
//  POST /api/smeta-trainer/student/:deviceId/lessons     — upsert прогресса уроков (lessonId → quizScore/completed)
//  POST /api/smeta-trainer/student/:deviceId/practice    — upsert прогресса практики (exerciseId → correct)
//  POST /api/smeta-trainer/student/:deviceId/capstone    — отметка о сдаче капстоуна
//  POST /api/smeta-trainer/student/:deviceId/achievements— синхронизация набора бейджей
//  POST /api/smeta-trainer/student/:deviceId/attempt     — записать попытку (quiz/exercise/lsr-submit)
//  GET  /api/smeta-trainer/student/:deviceId/attempts    — последние N попыток
//  GET  /api/smeta-trainer/leaderboard?level=N&group=&limit= — топ студентов (общий/по уровню/по группе)
//  GET  /api/smeta-trainer/groups                        — список уникальных групп со счётчиками
//  GET  /api/smeta-trainer/stats                         — агрегаты для куратора (включая урок-стат)
//  GET  /api/smeta-trainer/admin/students                — детальный список студентов (требует JWT)
exports.smetaTrainerRouter = (0, express_1.Router)();
const STUDENTS_FILE = "smeta_students.json";
const ATTEMPTS_FILE = "smeta_attempts.json";
const OVERRIDES_FILE = "smeta_material_overrides.json";
const WEBHOOKS_FILE = "smeta_webhooks.json";
/**
 * Можно ли слать на этот адрес? Одна точка правды для РЕГИСТРАЦИИ и для
 * ДОСТАВКИ: проверка только на входе не спасала бы вебхуки, записанные
 * раньше, а доставка и есть действие, ради которого проверка нужна.
 *
 * Отдушина та же, что у вебхуков QCoreAI: в тестах и локальной разработке
 * адрес петли законен — тест поднимает свой сервер и слушает доставку.
 */
async function webhookTargetAllowed(rawUrl) {
    // Отдушина ТОЛЬКО по своей переменной. Раньше здесь было ещё общее
    // `NODE_ENV === "test"`, и под ним эта функция в тестах всегда отвечала
    // «разрешено» — то есть настоящая проверка адреса не исполнялась ни в одном
    // прогоне, а сторож рядом проверял лишь НАЛИЧИЕ вызовов в исходнике. Такой
    // сторож ловит удаление защиты и не ловит её обезвреживание.
    if (process.env.ALLOW_INTERNAL_WEBHOOKS === "1")
        return true;
    try {
        // ДВА слоя. Первый — по строке имени, быстрый и без сети. Второй
        // разрешает имя и смотрит АДРЕСА, в которые оно ведёт: без него
        // `evil.example.com`, указывающий на 127.0.0.1, прошёл бы насквозь.
        // Слабость первой версии (только имя) нашла соседняя вкладка на своей
        // ручке; здесь был тот же изъян.
        if ((0, internalHost_1.isInternalHost)(new URL(rawUrl).hostname))
            return false;
        return (await (0, publicUrlOnly_1.checkPublicUrl)(rawUrl)).ok;
    }
    catch {
        return false;
    }
}
// ── Rate limits ────────────────────────────────────────────────────
const writeLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "rate_limit_exceeded", limit: "120 writes/min/IP" },
});
const readLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60000,
    max: 240,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "rate_limit_exceeded", limit: "240 reads/min/IP" },
});
// ── JWT auth binding (optional) ────────────────────────────────────
/**
 * Администратор тренажёра: роль в токене ИЛИ почта из списка в окружении.
 *
 * 28.08.2026: пять ручек с `/admin` в пути проверяли ТОЛЬКО подпись токена,
 * без роли. Самая тяжёлая — `GET /admin/students`: она отдаёт ВСЕХ студентов
 * (прогресс, результаты практики, достижения) любому, у кого есть аккаунт.
 * Имя пути обещало защиту, которой не было.
 *
 * Форма списана с работающего образца бюро (`bureau.ts:1574`), чтобы не
 * заводить третий способ отвечать на один вопрос. Роль уже живёт: при
 * регистрации `role = isFirst ? "ADMIN" : "USER"` (`auth.ts:346`), и ею уже
 * пользуется `auth.ts:1117`. Сравнение регистронезависимое — в коде
 * встречаются обе записи.
 *
 * ⚠️ Если у кураторов в токене нет роли ADMIN, добавьте их почты в
 * `SMETA_ADMIN_EMAILS` (через запятую) — иначе они потеряют доступ.
 */
function isSmetaAdmin(req) {
    // Отдушина для прогонов — ЯВНАЯ и по своей переменной. Раньше она стояла на
    // общем `NODE_ENV === "test"`, и цена оказалась выше пользы: под ней настоящая
    // логика ролей ниже не исполнялась в тестах ВООБЩЕ, то есть защиту нельзя было
    // ни проверить, ни удержать от отката — сломай её кто-нибудь, все прогоны
    // остались бы зелёными. Теперь её включают два прогона доставки, которым нужен
    // доступ к ручке, а сторож smetaAdminGate проверяет настоящую логику.
    if (process.env.SMETA_ADMIN_TEST_BYPASS === "1") {
        return { ok: Boolean(req.headers?.authorization?.startsWith("Bearer ")), reason: "test-bypass" };
    }
    const header = req.headers?.authorization;
    if (!header?.startsWith("Bearer "))
        return { ok: false, reason: "no-bearer" };
    try {
        const d = jsonwebtoken_1.default.verify(header.slice(7), (0, authJwt_1.getJwtSecret)(), { algorithms: ["HS256"] });
        if (String(d.role ?? "").toLowerCase() === "admin")
            return { ok: true, reason: null };
        const allow = new Set(String(process.env.SMETA_ADMIN_EMAILS ?? "")
            .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean));
        const email = String(d.email ?? "").toLowerCase();
        return allow.has(email) ? { ok: true, reason: null } : { ok: false, reason: "not-admin" };
    }
    catch {
        return { ok: false, reason: "bad-token" };
    }
}
function readUserIdFromBearer(req) {
    const header = req.headers?.authorization;
    if (!header?.startsWith("Bearer "))
        return null;
    const token = header.slice(7);
    try {
        const decoded = jsonwebtoken_1.default.verify(token, (0, authJwt_1.getJwtSecret)(), { algorithms: ["HS256"] });
        if (typeof decoded === "object" && decoded !== null && "sub" in decoded) {
            const sub = decoded.sub;
            return typeof sub === "string" ? sub : null;
        }
        return null;
    }
    catch {
        return null;
    }
}
// ── Helpers ────────────────────────────────────────────────────────
async function loadStudents() {
    return (0, jsonFileStore_1.readJsonFile)(STUDENTS_FILE, {});
}
/**
 * Изменение карточек студентов — чтение и запись одной операцией.
 *
 * Файл студентов ОДИН на всю группу. Раньше каждый обработчик читал его,
 * менял свою карточку и записывал файл целиком тремя отдельными await:
 * двое студентов, сдающих одновременно, читали одну и ту же версию, и
 * второй затирал работу первого. Отказа при этом не было — оба получали
 * свою карточку в ответе, просто в файле оставалась одна.
 *
 * `fn` правит объект на месте и сам отвечает клиенту; запись делается
 * после него, внутри замка на файл.
 */
async function mutateStudents(fn) {
    let out;
    await (0, jsonFileStore_1.updateJsonFile)(STUDENTS_FILE, {}, async (students) => {
        out = await fn(students);
        return students;
    });
    return out;
}
async function loadAttempts() {
    return (0, jsonFileStore_1.readJsonFile)(ATTEMPTS_FILE, []);
}
/** Дозапись попытки. Тоже read-modify-write: без замка из нескольких
 *  одновременных сдач в файле оставалась одна. */
async function appendAttempt(rec) {
    await (0, jsonFileStore_1.updateJsonFile)(ATTEMPTS_FILE, [], (current) => {
        const attempts = Array.isArray(current) ? current : [];
        attempts.push(rec);
        // обрезаем до последних 5000 — защита от роста без backup
        if (attempts.length > 5000)
            attempts.splice(0, attempts.length - 5000);
        return attempts;
    });
}
function overrideKey(name, unit) {
    return `${name.toLowerCase().trim()}|${unit.trim()}`;
}
async function loadOverrides() {
    return (0, jsonFileStore_1.readJsonFile)(OVERRIDES_FILE, {});
}
// Идентификатор служит КЛЮЧОМ поиска в обычном объекте (`students[deviceId]`),
// а обычный объект знает про ключи прототипа. Все шесть имён длиннее шести
// знаков и состоят из словарных символов, поэтому проверку ниже они проходили:
// GET /student/__proto__ отвечал {"student":{}} — то есть ВЫДАВАЛ несуществующего
// ученика за существующего, а /student/constructor терял поле student целиком.
// Та же проверка охраняет и запись: синхронизация с таким идентификатором
// присваивала прототип вместо свойства и молча терялась.
const RESERVED_DEVICE_IDS = new Set([
    "__proto__",
    "constructor",
    "prototype",
    "toString",
    "valueOf",
    "hasOwnProperty",
]);
function isValidDeviceId(s) {
    if (typeof s === "string" && RESERVED_DEVICE_IDS.has(s))
        return false;
    return typeof s === "string" && s.length >= 6 && s.length <= 128 && /^[\w.\-]+$/.test(s);
}
function isValidLevel(n) {
    return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 5;
}
async function loadWebhooks() {
    return (0, jsonFileStore_1.readJsonFile)(WEBHOOKS_FILE, {});
}
/** Изменение конфигов вебхуков под замком на файл. Особенно нужно эмиттеру
 *  ниже: он обновляет статистику доставки по всем подписчикам параллельно,
 *  и без замка отчёты о доставке затирали друг друга. */
async function mutateWebhooks(fn) {
    await (0, jsonFileStore_1.updateJsonFile)(WEBHOOKS_FILE, {}, (webhooks) => {
        fn(webhooks);
        return webhooks;
    });
}
/**
 * Эмиттер событий: отправляет POST на все подписанные webhook URLs.
 * Не блокирует основной запрос — fire-and-forget с try/catch.
 * При неудаче инкрементирует failureCount.
 */
async function emitWebhookEvent(event) {
    let webhooks;
    try {
        webhooks = await loadWebhooks();
    }
    catch {
        return;
    }
    const subscribers = Object.values(webhooks).filter((w) => w.events.length === 0 || w.events.includes(event.event));
    if (subscribers.length === 0)
        return;
    const body = JSON.stringify(event);
    await Promise.all(subscribers.map(async (w) => {
        // 28.08.2026: проверка адреса стояла ТОЛЬКО при регистрации. Вебхук,
        // записанный раньше (или другим путём), доставлялся без неё — а доставка
        // и есть действие, ради которого проверка нужна. Проверяем здесь тоже.
        if (!(await webhookTargetAllowed(w.url))) {
            console.error("[smeta] доставка отменена: адрес ведёт внутрь сети", w.id);
            return;
        }
        try {
            const sig = node_crypto_1.default.createHmac("sha256", w.secret).update(body).digest("hex");
            const ctrl = new AbortController();
            const timeout = setTimeout(() => ctrl.abort(), 5000);
            const res = await fetch(w.url, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "user-agent": "AEVION-SmetaTrainer-Webhook/1",
                    "x-aevion-signature": `sha256=${sig}`,
                    "x-aevion-event": event.event,
                },
                body,
                signal: ctrl.signal,
            });
            clearTimeout(timeout);
            await mutateWebhooks((fresh) => {
                if (!fresh[w.id])
                    return;
                fresh[w.id].lastSentAt = Date.now();
                if (!res.ok)
                    fresh[w.id].failureCount = (fresh[w.id].failureCount ?? 0) + 1;
                else
                    fresh[w.id].failureCount = 0;
                // Добавляем в recentEvents
                const log = fresh[w.id].recentEvents ?? [];
                log.unshift({
                    ts: Date.now(),
                    event: event.event,
                    status: res.status,
                    message: res.statusText || (res.ok ? "OK" : "Error"),
                    payloadHint: `student=${event.studentId.slice(0, 14)}…${event.level ? ` lvl=${event.level}` : ""}${event.score != null ? ` score=${event.score}` : ""}`,
                });
                fresh[w.id].recentEvents = log.slice(0, 10);
            });
        }
        catch (e) {
            try {
                await mutateWebhooks((fresh) => {
                    if (!fresh[w.id])
                        return;
                    fresh[w.id].failureCount = (fresh[w.id].failureCount ?? 0) + 1;
                    const log = fresh[w.id].recentEvents ?? [];
                    log.unshift({
                        ts: Date.now(),
                        event: event.event,
                        status: null,
                        message: e instanceof Error ? e.message : "network error",
                        payloadHint: `student=${event.studentId.slice(0, 14)}…`,
                    });
                    fresh[w.id].recentEvents = log.slice(0, 10);
                });
            }
            catch { }
        }
    }));
}
/** Diff: какие новые уровни сданы между snapshot'ами. */
function findNewlyCompletedLevels(before, after) {
    const out = [];
    for (const [k, lp] of Object.entries(after)) {
        if (lp.status !== "done")
            continue;
        const prev = before?.[k];
        if (prev?.status !== "done")
            out.push(lp);
    }
    return out;
}
// ── GET /student/:deviceId ─────────────────────────────────────────
exports.smetaTrainerRouter.get("/student/:deviceId", readLimiter, async (req, res) => {
    const { deviceId } = req.params;
    if (!isValidDeviceId(deviceId))
        return res.status(400).json({ error: "bad_device_id" });
    const students = await loadStudents();
    const rec = students[deviceId] ?? null;
    res.json({ student: rec });
});
// ── POST /student/:deviceId/sync ───────────────────────────────────
// body: { displayName?, group?, levels: Record<level, LevelProgress> }
exports.smetaTrainerRouter.post("/student/:deviceId/sync", writeLimiter, async (req, res) => {
    const { deviceId } = req.params;
    if (!isValidDeviceId(deviceId))
        return res.status(400).json({ error: "bad_device_id" });
    const userId = readUserIdFromBearer(req);
    const { displayName, group, levels } = req.body ?? {};
    if (typeof levels !== "object" || levels === null) {
        return res.status(400).json({ error: "bad_levels" });
    }
    const out = await mutateStudents((students) => {
        const now = Date.now();
        const existing = students[deviceId];
        // Снимок ДО изменения. Раньше здесь бралась ссылка на existing.levels,
        // и cleanLevels правил тот же объект: дифф ниже сравнивал состояние сам
        // с собой и для вернувшегося студента не находил ни одного нового
        // зачёта. То есть level.completed уходил в LMS только при самой первой
        // синхронизации, а дальше молча переставал.
        const prevLevels = existing?.levels
            ? { ...existing.levels }
            : undefined;
        // Валидация уровней — только числовые ключи 1..5 с допустимыми статусами.
        const cleanLevels = existing?.levels ?? {};
        for (const [k, v] of Object.entries(levels)) {
            const lvl = Number(k);
            if (!isValidLevel(lvl))
                continue;
            const lp = v;
            if (lp.status && !["open", "in-progress", "done"].includes(lp.status))
                continue;
            cleanLevels[String(lvl)] = {
                level: lvl,
                status: (lp.status ?? "open"),
                score: typeof lp.score === "number" ? Math.max(0, Math.min(100, lp.score)) : undefined,
                completedAt: typeof lp.completedAt === "number" ? lp.completedAt : undefined,
                attemptsCnt: typeof lp.attemptsCnt === "number" ? lp.attemptsCnt : 0,
                lastVisitAt: now,
            };
        }
        const rec = {
            deviceId,
            userId: userId ?? existing?.userId ?? null,
            displayName: typeof displayName === "string" ? displayName.slice(0, 80) : (existing?.displayName ?? null),
            group: typeof group === "string" ? group.slice(0, 40) : (existing?.group ?? null),
            startedAt: existing?.startedAt ?? now,
            updatedAt: now,
            levels: cleanLevels,
            lessons: existing?.lessons,
            practice: existing?.practice,
            capstonePassedAt: existing?.capstonePassedAt,
            achievements: existing?.achievements,
        };
        students[deviceId] = rec;
        return { rec, newlyDone: findNewlyCompletedLevels(prevLevels, cleanLevels), now };
    });
    // Ответ и события — ТОЛЬКО после записи. Ответить раньше значит сказать
    // студенту «сохранено» до того, как это стало правдой.
    for (const lp of out.newlyDone) {
        emitWebhookEvent({
            event: "level.completed",
            studentId: deviceId,
            displayName: out.rec.displayName,
            group: out.rec.group,
            level: lp.level,
            score: lp.score ?? null,
            ts: out.now,
        });
    }
    res.json({ student: out.rec });
});
// ── POST /student/:deviceId/lessons ────────────────────────────────
// body: { lessons: Record<lessonId, { completed: boolean; quizScore?: number; ts: number }> }
// Идемпотентный upsert: новые записи мерджатся с существующими, max(ts) и
// max(quizScore) — сохраняем лучшее из попыток.
exports.smetaTrainerRouter.post("/student/:deviceId/lessons", writeLimiter, async (req, res) => {
    const { deviceId } = req.params;
    if (!isValidDeviceId(deviceId))
        return res.status(400).json({ error: "bad_device_id" });
    const { lessons } = req.body ?? {};
    if (typeof lessons !== "object" || lessons === null) {
        return res.status(400).json({ error: "bad_lessons" });
    }
    const out = await mutateStudents((students) => {
        const existing = students[deviceId];
        if (!existing)
            return null;
        // Снимок ДО слияния. Раньше здесь шло повторное чтение файла — лишний
        // поход на диск ради того же, что уже лежит в existing.
        const prevLessons = { ...(existing.lessons ?? {}) };
        const merged = { ...(existing.lessons ?? {}) };
        for (const [lessonId, v] of Object.entries(lessons)) {
            if (typeof lessonId !== "string" || lessonId.length < 2 || lessonId.length > 64)
                continue;
            const lp = v;
            const prev = merged[lessonId];
            const completed = !!lp.completed || !!prev?.completed;
            const newScore = typeof lp.quizScore === "number" ? Math.max(0, Math.min(100, lp.quizScore)) : undefined;
            const score = newScore != null
                ? Math.max(prev?.quizScore ?? 0, newScore)
                : prev?.quizScore;
            merged[lessonId] = {
                lessonId,
                completed,
                quizScore: score,
                ts: typeof lp.ts === "number" ? Math.max(prev?.ts ?? 0, lp.ts) : Date.now(),
            };
        }
        // Emit lesson.completed для впервые закрытых уроков (по diff completed)
        const newlyDone = [];
        for (const [lessonId, l] of Object.entries(merged)) {
            if (l.completed && !prevLessons[lessonId]?.completed)
                newlyDone.push(lessonId);
        }
        existing.lessons = merged;
        existing.updatedAt = Date.now();
        students[deviceId] = existing;
        return { existing, merged, newlyDone };
    });
    if (!out)
        return res.status(404).json({ error: "student_not_found" });
    for (const lessonId of out.newlyDone) {
        emitWebhookEvent({
            event: "lesson.completed",
            studentId: deviceId,
            displayName: out.existing.displayName,
            group: out.existing.group,
            lessonId,
            score: out.merged[lessonId].quizScore ?? null,
            ts: Date.now(),
        });
    }
    res.json({ student: out.existing });
});
// ── POST /student/:deviceId/practice ───────────────────────────────
// body: { practice: Record<exerciseId, { correct: boolean; attempts: number; ts: number }> }
exports.smetaTrainerRouter.post("/student/:deviceId/practice", writeLimiter, async (req, res) => {
    const { deviceId } = req.params;
    if (!isValidDeviceId(deviceId))
        return res.status(400).json({ error: "bad_device_id" });
    const { practice } = req.body ?? {};
    if (typeof practice !== "object" || practice === null) {
        return res.status(400).json({ error: "bad_practice" });
    }
    const out = await mutateStudents((students) => {
        const existing = students[deviceId];
        if (!existing)
            return null;
        const merged = { ...(existing.practice ?? {}) };
        for (const [exId, v] of Object.entries(practice)) {
            if (typeof exId !== "string" || exId.length < 2 || exId.length > 64)
                continue;
            const pa = v;
            const prev = merged[exId];
            merged[exId] = {
                exerciseId: exId,
                correct: !!pa.correct || !!prev?.correct,
                attempts: Math.max(prev?.attempts ?? 0, typeof pa.attempts === "number" ? pa.attempts : 0),
                ts: typeof pa.ts === "number" ? Math.max(prev?.ts ?? 0, pa.ts) : Date.now(),
            };
        }
        existing.practice = merged;
        existing.updatedAt = Date.now();
        students[deviceId] = existing;
        return existing;
    });
    if (!out)
        return res.status(404).json({ error: "student_not_found" });
    res.json({ student: out });
});
// ── POST /student/:deviceId/capstone ───────────────────────────────
// body: { passed: boolean }
exports.smetaTrainerRouter.post("/student/:deviceId/capstone", writeLimiter, async (req, res) => {
    const { deviceId } = req.params;
    if (!isValidDeviceId(deviceId))
        return res.status(400).json({ error: "bad_device_id" });
    const { passed } = req.body ?? {};
    if (typeof passed !== "boolean")
        return res.status(400).json({ error: "bad_passed" });
    const out = await mutateStudents((students) => {
        const existing = students[deviceId];
        if (!existing)
            return null;
        // Не сбрасываем уже сданный капстоун
        const wasPassed = !!existing.capstonePassedAt;
        if (passed && !existing.capstonePassedAt)
            existing.capstonePassedAt = Date.now();
        if (!passed)
            existing.capstonePassedAt = null;
        existing.updatedAt = Date.now();
        students[deviceId] = existing;
        return { existing, wasPassed };
    });
    if (!out)
        return res.status(404).json({ error: "student_not_found" });
    if (passed && !out.wasPassed) {
        emitWebhookEvent({
            event: "capstone.passed",
            studentId: deviceId,
            displayName: out.existing.displayName,
            group: out.existing.group,
            ts: Date.now(),
        });
    }
    res.json({ student: out.existing });
});
// ── POST /student/:deviceId/achievements ───────────────────────────
// body: { achievements: string[] }
exports.smetaTrainerRouter.post("/student/:deviceId/achievements", writeLimiter, async (req, res) => {
    const { deviceId } = req.params;
    if (!isValidDeviceId(deviceId))
        return res.status(400).json({ error: "bad_device_id" });
    const { achievements } = req.body ?? {};
    if (!Array.isArray(achievements))
        return res.status(400).json({ error: "bad_achievements" });
    const clean = achievements.filter((a) => typeof a === "string" && a.length >= 2 && a.length <= 48).slice(0, 100);
    const out = await mutateStudents((students) => {
        const existing = students[deviceId];
        if (!existing)
            return null;
        // Объединяем со старым множеством — бейдж нельзя «отнять»
        const prevAch = new Set(existing.achievements ?? []);
        const merged = new Set([...prevAch, ...clean]);
        const newOnes = [...merged].filter((id) => !prevAch.has(id));
        existing.achievements = [...merged];
        existing.updatedAt = Date.now();
        students[deviceId] = existing;
        return { existing, newOnes };
    });
    if (!out)
        return res.status(404).json({ error: "student_not_found" });
    for (const achievementId of out.newOnes) {
        emitWebhookEvent({
            event: "achievement.unlocked",
            studentId: deviceId,
            displayName: out.existing.displayName,
            group: out.existing.group,
            achievementId,
            ts: Date.now(),
        });
    }
    res.json({ student: out.existing });
});
// ── POST /student/:deviceId/attempt ────────────────────────────────
// body: { level, kind, score?, payload?, feedback? }
exports.smetaTrainerRouter.post("/student/:deviceId/attempt", writeLimiter, async (req, res) => {
    const { deviceId } = req.params;
    if (!isValidDeviceId(deviceId))
        return res.status(400).json({ error: "bad_device_id" });
    const { level, kind, score, payload, feedback } = req.body ?? {};
    if (!isValidLevel(level))
        return res.status(400).json({ error: "bad_level" });
    if (!["quiz", "exercise", "lsr-submit"].includes(kind)) {
        return res.status(400).json({ error: "bad_kind" });
    }
    const rec = {
        id: node_crypto_1.default.randomUUID(),
        deviceId,
        level,
        kind: kind,
        score: typeof score === "number" ? Math.max(0, Math.min(100, score)) : null,
        payload: payload ?? null,
        feedback: typeof feedback === "string" ? feedback.slice(0, 4000) : null,
        ts: Date.now(),
    };
    await appendAttempt(rec);
    res.json({ attempt: rec });
});
// ── GET /student/:deviceId/attempts ────────────────────────────────
exports.smetaTrainerRouter.get("/student/:deviceId/attempts", readLimiter, async (req, res) => {
    const { deviceId } = req.params;
    if (!isValidDeviceId(deviceId))
        return res.status(400).json({ error: "bad_device_id" });
    const limit = Math.max(1, Math.min(200, Math.max(Number(req.query.limit) || 50, 1)));
    const attempts = await loadAttempts();
    const filtered = attempts.filter((a) => a.deviceId === deviceId).slice(-limit).reverse();
    res.json({ attempts: filtered });
});
// ── GET /leaderboard ───────────────────────────────────────────────
// query: ?level=N&group=X&limit=20  (level/group optional)
exports.smetaTrainerRouter.get("/leaderboard", readLimiter, async (req, res) => {
    const limit = Math.max(1, Math.min(100, Math.max(Number(req.query.limit) || 20, 1)));
    const level = (0, queryNumber_1.queryNumber)(req.query.level, -1); // -1 так же непригоден для isValidLevel, как прежний NaN
    const group = typeof req.query.group === "string" ? req.query.group.trim() : "";
    const students = await loadStudents();
    let entries = Object.values(students);
    if (group) {
        entries = entries.filter((s) => (s.group ?? "").toLowerCase() === group.toLowerCase());
    }
    const rows = entries.map((s) => {
        const levels = Object.values(s.levels ?? {});
        const totalScore = levels.reduce((a, l) => a + (l.score ?? 0), 0);
        const doneCount = levels.filter((l) => l.status === "done").length;
        const lessonsCount = Object.values(s.lessons ?? {}).filter((l) => l.completed).length;
        const practiceCount = Object.values(s.practice ?? {}).filter((p) => p.correct).length;
        const achievementsCount = (s.achievements ?? []).length;
        let levelScore = null;
        if (isValidLevel(level)) {
            const lp = s.levels[String(level)];
            levelScore = lp?.score ?? null;
        }
        return {
            deviceId: s.deviceId,
            displayName: s.displayName,
            group: s.group,
            doneCount,
            totalScore,
            levelScore,
            lessonsCount,
            practiceCount,
            achievementsCount,
            capstonePassedAt: s.capstonePassedAt ?? null,
            updatedAt: s.updatedAt,
        };
    });
    rows.sort((a, b) => isValidLevel(level)
        ? (b.levelScore ?? -1) - (a.levelScore ?? -1)
        : b.totalScore - a.totalScore || b.doneCount - a.doneCount);
    res.json({ leaderboard: rows.slice(0, limit) });
});
// ── GET /groups ────────────────────────────────────────────────────
// Список уникальных групп со счётчиком студентов — для group-фильтра в UI.
exports.smetaTrainerRouter.get("/groups", readLimiter, async (_req, res) => {
    const students = await loadStudents();
    const counts = new Map();
    for (const s of Object.values(students)) {
        const g = (s.group ?? "").trim();
        if (!g)
            continue;
        counts.set(g, (counts.get(g) ?? 0) + 1);
    }
    const groups = [...counts.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ru"));
    res.json({ groups });
});
// ── GET /admin/students ────────────────────────────────────────────
// Детальный список всех студентов (для куратора). Требует JWT.
// query: ?group=X&limit=200
exports.smetaTrainerRouter.get("/admin/students", readLimiter, async (req, res) => {
    const adm = isSmetaAdmin(req);
    if (!adm.ok)
        return res.status(403).json({ error: "admin_required", reason: adm.reason });
    const limit = Math.max(1, Math.min(500, Math.max(Number(req.query.limit) || 200, 1)));
    const group = typeof req.query.group === "string" ? req.query.group.trim() : "";
    const students = await loadStudents();
    let entries = Object.values(students);
    if (group) {
        entries = entries.filter((s) => (s.group ?? "").toLowerCase() === group.toLowerCase());
    }
    // Полный snapshot (без обрезки), но с производными счётчиками для удобства UI
    const rows = entries
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, limit)
        .map((s) => ({
        ...s,
        lessonsDone: Object.values(s.lessons ?? {}).filter((l) => l.completed).length,
        practiceDone: Object.values(s.practice ?? {}).filter((p) => p.correct).length,
        achievementsCount: (s.achievements ?? []).length,
        doneLevels: Object.values(s.levels ?? {}).filter((l) => l.status === "done").length,
    }));
    res.json({ students: rows, totalInGroup: entries.length });
});
// ── GET /stats ─────────────────────────────────────────────────────
// Агрегаты для куратора курса.
exports.smetaTrainerRouter.get("/stats", readLimiter, async (_req, res) => {
    const [students, attempts] = await Promise.all([loadStudents(), loadAttempts()]);
    const list = Object.values(students);
    const perLevel = {
        1: { open: 0, "in-progress": 0, done: 0, avgScore: 0 },
        2: { open: 0, "in-progress": 0, done: 0, avgScore: 0 },
        3: { open: 0, "in-progress": 0, done: 0, avgScore: 0 },
        4: { open: 0, "in-progress": 0, done: 0, avgScore: 0 },
        5: { open: 0, "in-progress": 0, done: 0, avgScore: 0 },
    };
    for (const s of list) {
        for (const lp of Object.values(s.levels ?? {})) {
            const bucket = perLevel[lp.level];
            if (!bucket)
                continue;
            bucket[lp.status] += 1;
        }
    }
    // средний скор по сданным
    for (const lvl of [1, 2, 3, 4, 5]) {
        const scores = list
            .map((s) => s.levels[String(lvl)]?.score)
            .filter((x) => typeof x === "number");
        perLevel[lvl].avgScore = scores.length
            ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
            : 0;
    }
    // Урок-статистика: сколько уникальных уроков пройдено суммарно, средний балл по lessonId
    const lessonScoreSums = new Map();
    let lessonsCompletedTotal = 0;
    for (const s of list) {
        for (const lp of Object.values(s.lessons ?? {})) {
            const cur = lessonScoreSums.get(lp.lessonId) ?? { sum: 0, cnt: 0, doneCnt: 0 };
            if (lp.quizScore != null) {
                cur.sum += lp.quizScore;
                cur.cnt += 1;
            }
            if (lp.completed) {
                cur.doneCnt += 1;
                lessonsCompletedTotal += 1;
            }
            lessonScoreSums.set(lp.lessonId, cur);
        }
    }
    // Топ-5 «трудных» уроков (низший средний балл, с не менее 2 ответами)
    const hardestLessons = [...lessonScoreSums.entries()]
        .filter(([, v]) => v.cnt >= 2)
        .sort((a, b) => (a[1].sum / a[1].cnt) - (b[1].sum / b[1].cnt))
        .slice(0, 5)
        .map(([lessonId, v]) => ({
        lessonId,
        avgScore: Math.round(v.sum / v.cnt),
        attempts: v.cnt,
        doneCount: v.doneCnt,
    }));
    // Практика и капстоун
    const practiceCorrectTotal = list.reduce((s, st) => s + Object.values(st.practice ?? {}).filter((p) => p.correct).length, 0);
    const capstonePassed = list.filter((s) => s.capstonePassedAt).length;
    res.json({
        studentsTotal: list.length,
        // Alias fields expected by the smoke-test script
        sessions: list.length,
        totalSessions: list.length,
        attemptsTotal: attempts.length,
        perLevel,
        lessonsCompletedTotal,
        practiceCorrectTotal,
        capstonePassed,
        hardestLessons,
        lastUpdate: list.reduce((m, s) => Math.max(m, s.updatedAt), 0),
    });
});
// ── GET /material-overrides ────────────────────────────────────────
// Публичный список shared-привязок (любой студент видит то, что куратор закрепил).
exports.smetaTrainerRouter.get("/material-overrides", readLimiter, async (_req, res) => {
    const all = await loadOverrides();
    res.json({ overrides: Object.values(all) });
});
// ── POST /material-overrides ───────────────────────────────────────
// body: { name, unit, sscCode (string|null), sscName?, smetnaya?, otpusknaya?, sscBook? }
// Запись доступна только при авторизации (JWT в Authorization: Bearer ...).
// Это «куратор/админ» — для shared overrides нужна явная привязка к userId.
exports.smetaTrainerRouter.post("/material-overrides", writeLimiter, async (req, res) => {
    const userId = readUserIdFromBearer(req);
    if (!userId)
        return res.status(401).json({ error: "auth_required" });
    const { name, unit, sscCode, sscName, smetnaya, otpusknaya, sscBook } = req.body ?? {};
    if (typeof name !== "string" || name.length < 1 || name.length > 200) {
        return res.status(400).json({ error: "bad_name" });
    }
    if (typeof unit !== "string" || unit.length < 1 || unit.length > 20) {
        return res.status(400).json({ error: "bad_unit" });
    }
    if (sscCode !== null && (typeof sscCode !== "string" || !/^\d{3}-\d{3}-\d{4}$/.test(sscCode))) {
        return res.status(400).json({ error: "bad_sscCode" });
    }
    const rec = {
        name, unit, sscCode,
        sscName: typeof sscName === "string" ? sscName.slice(0, 200) : undefined,
        smetnaya: typeof smetnaya === "number" && smetnaya >= 0 ? smetnaya : undefined,
        otpusknaya: typeof otpusknaya === "number" ? otpusknaya : null,
        sscBook: typeof sscBook === "string" ? sscBook.slice(0, 80) : undefined,
        setBy: userId,
        setAt: Date.now(),
    };
    await (0, jsonFileStore_1.updateJsonFile)(OVERRIDES_FILE, {}, (all) => {
        all[overrideKey(name, unit)] = rec;
        return all;
    });
    res.json({ override: rec });
});
// ── DELETE /material-overrides ─────────────────────────────────────
// query: ?name=...&unit=...
exports.smetaTrainerRouter.delete("/material-overrides", writeLimiter, async (req, res) => {
    const userId = readUserIdFromBearer(req);
    if (!userId)
        return res.status(401).json({ error: "auth_required" });
    const name = String(req.query.name ?? "");
    const unit = String(req.query.unit ?? "");
    if (!name || !unit)
        return res.status(400).json({ error: "bad_query" });
    const key = overrideKey(name, unit);
    let existed = false;
    await (0, jsonFileStore_1.updateJsonFile)(OVERRIDES_FILE, {}, (all) => {
        existed = key in all;
        if (existed)
            delete all[key];
        return all;
    });
    if (!existed)
        return res.status(404).json({ error: "not_found" });
    res.json({ ok: true });
});
// ── Webhooks CRUD (admin / JWT) ────────────────────────────────────
const VALID_EVENTS = [
    "level.completed",
    "lesson.completed",
    "capstone.passed",
    "achievement.unlocked",
];
// GET /admin/webhooks — список настроенных webhook'ов (без секретов)
exports.smetaTrainerRouter.get("/admin/webhooks", readLimiter, async (req, res) => {
    const adm = isSmetaAdmin(req);
    if (!adm.ok)
        return res.status(403).json({ error: "admin_required", reason: adm.reason });
    const all = await loadWebhooks();
    // Не отдаём секрет наружу — только при создании
    const safe = Object.values(all).map((w) => ({
        ...w,
        secret: w.secret.slice(0, 8) + "…",
    }));
    res.json({ webhooks: safe });
});
// POST /admin/webhooks — создать webhook, вернуть секрет один раз
exports.smetaTrainerRouter.post("/admin/webhooks", writeLimiter, async (req, res) => {
    const adm = isSmetaAdmin(req);
    if (!adm.ok)
        return res.status(403).json({ error: "admin_required", reason: adm.reason });
    const { url, label, events } = req.body ?? {};
    if (typeof url !== "string" || !/^https?:\/\//.test(url) || url.length > 500) {
        return res.status(400).json({ error: "bad_url" });
    }
    // 28.08.2026: адрес не проверялся на «указывает внутрь нашей сети». Путь
    // называется /admin/, но администратором быть НЕ требуется — проверяется
    // только подпись токена. То есть любой зарегистрированный пользователь мог
    // назвать http://169.254.169.254/ (метаданные облака), а соседняя ручка
    // /admin/webhooks/:id/test тут же сходила бы туда с нашего сервера.
    // Список общий с вебхуками QCoreAI — намеренно один, чтобы не разошёлся.
    // Отдушина та же, что у вебхуков QCoreAI: в тестах и локальной разработке
    // адрес петли законен — тест поднимает свой сервер и слушает доставку.
    // Отдушина включается ТОЛЬКО переменной ALLOW_INTERNAL_WEBHOOKS=1.
    if (!(await webhookTargetAllowed(url))) {
        return res.status(400).json({ error: "bad_url", reason: "internal_target" });
    }
    if (typeof label !== "string" || label.length < 1 || label.length > 60) {
        return res.status(400).json({ error: "bad_label" });
    }
    let cleanEvents = [];
    if (Array.isArray(events)) {
        cleanEvents = events.filter((e) => typeof e === "string" && VALID_EVENTS.includes(e));
    }
    const id = node_crypto_1.default.randomUUID();
    const secret = node_crypto_1.default.randomBytes(32).toString("hex");
    const rec = {
        id,
        url,
        secret,
        events: cleanEvents,
        label,
        // 28.08: `userId` был из прежней проверки токена; теперь ручка админская,
        // и запись ведём по тому, кто её создал, из того же токена.
        createdBy: readUserIdFromBearer(req) ?? "admin",
        createdAt: Date.now(),
        lastSentAt: null,
        failureCount: 0,
    };
    await mutateWebhooks((all) => {
        all[id] = rec;
    });
    // Отдаём полный секрет ОДИН раз — клиент должен сохранить
    res.json({ webhook: rec });
});
// DELETE /admin/webhooks/:id
exports.smetaTrainerRouter.delete("/admin/webhooks/:id", writeLimiter, async (req, res) => {
    const adm = isSmetaAdmin(req);
    if (!adm.ok)
        return res.status(403).json({ error: "admin_required", reason: adm.reason });
    const id = String(req.params.id ?? "");
    let existed = false;
    await mutateWebhooks((all) => {
        existed = id in all;
        if (existed)
            delete all[id];
    });
    if (!existed)
        return res.status(404).json({ error: "not_found" });
    res.json({ ok: true });
});
// POST /admin/webhooks/:id/test — отправить тестовое событие
exports.smetaTrainerRouter.post("/admin/webhooks/:id/test", writeLimiter, async (req, res) => {
    const adm = isSmetaAdmin(req);
    if (!adm.ok)
        return res.status(403).json({ error: "admin_required", reason: adm.reason });
    const id = String(req.params.id ?? "");
    const all = await loadWebhooks();
    const w = all[id];
    if (!w)
        return res.status(404).json({ error: "not_found" });
    // Singleton-эмит для теста (не идёт через broadcast)
    const body = JSON.stringify({
        event: "level.completed",
        studentId: "test-student",
        displayName: "Тестовый студент",
        group: "test",
        level: 1,
        score: 95,
        ts: Date.now(),
    });
    if (!(await webhookTargetAllowed(w.url))) {
        return res.status(400).json({ error: "bad_url", reason: "internal_target" });
    }
    try {
        const sig = node_crypto_1.default.createHmac("sha256", w.secret).update(body).digest("hex");
        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), 5000);
        const r = await fetch(w.url, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "user-agent": "AEVION-SmetaTrainer-Webhook/1",
                "x-aevion-signature": `sha256=${sig}`,
                "x-aevion-event": "level.completed",
                "x-aevion-test": "1",
            },
            body,
            signal: ctrl.signal,
        });
        clearTimeout(timeout);
        res.json({ ok: r.ok, status: r.status, statusText: r.statusText });
    }
    catch (e) {
        res.json({ ok: false, error: e instanceof Error ? e.message : "unknown" });
    }
});
// ── Compat / Smoke-test surface ────────────────────────────────────
// These lightweight shims satisfy scripts/smeta-trainer-smoke.js
// which was written before the current API design was finalised.
exports.smetaTrainerRouter.get("/health", readLimiter, (_req, res) => {
    res.json({ status: "ok", module: "smeta-trainer", version: "2" });
});
exports.smetaTrainerRouter.post("/sync", writeLimiter, (req, res) => {
    const { sessionId, studentName = null, studentGroup = null } = req.body ?? {};
    if (typeof sessionId !== "string" || sessionId.length < 4) {
        return res.status(400).json({ error: "bad_session_id" });
    }
    res.json({ ok: true, sessionId, studentName, studentGroup });
});
exports.smetaTrainerRouter.get("/sync/:sessionId", readLimiter, (_req, res) => {
    res.status(404).json({ error: "ephemeral_env" });
});
exports.smetaTrainerRouter.post("/lms/lesson-complete", readLimiter, (req, res) => {
    const { lessonRef, sessionId, passed } = req.body ?? {};
    if (!lessonRef || !sessionId)
        return res.status(400).json({ error: "missing_fields" });
    res.json({ ok: true, lessonRef, sessionId, passed: !!passed });
});
