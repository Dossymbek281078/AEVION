"use strict";
/**
 * Kids AI Content — backend MVP.
 *
 * Routes:
 *   GET  /api/kids-ai/health
 *   GET  /api/kids-ai/stats
 *   GET  /api/kids-ai/lessons                — list (filter by lang/age/category)
 *   GET  /api/kids-ai/lessons/:id            — full lesson with content_md
 *   POST /api/kids-ai/ask                    — child question to AI (LLM-backed)
 *   POST /api/kids-ai/progress               — record completion
 *   GET  /api/kids-ai/progress/:childAlias   — list child's completed lessons
 *
 * Storage: Postgres when available, falls back to in-memory (seed-backed).
 * The in-memory map is materialised from `KIDS_AI_SEED_LESSONS` at import
 * time so list/detail endpoints work even if Postgres is offline.
 *
 * Privacy: `childAlias` is a self-chosen pseudonym (e.g. "tiger42"). The
 * API never stores e-mail, parent identity or any other PII. We also
 * clamp every alias to 64 chars and strip control characters.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.kidsAiContentRouter = void 0;
const express_1 = require("express");
const platform_1 = require("../lib/sentry/platform");
const dbPool_1 = require("../lib/dbPool");
const captureKidsAIError = (0, platform_1.makeServiceCapture)("kids-ai");
const conceptBoardStore_1 = require("../lib/conceptBoardStore");
const ensureKidsAiTables_1 = require("../lib/ensureKidsAiTables");
const rateLimit_1 = require("../lib/rateLimit");
const providers_1 = require("../services/qcoreai/providers");
const kidsAiSeed_1 = require("../data/kidsAiSeed");
const kidsSafety_1 = require("../lib/kidsSafety");
const queryNumber_1 = require("../lib/queryNumber");
exports.kidsAiContentRouter = (0, express_1.Router)();
const pool = (0, dbPool_1.getPool)();
// Bootstrap tables (and seed) — fire-and-forget, errors flip dbReady=false.
(async () => {
    try {
        await (0, ensureKidsAiTables_1.ensureKidsAiTables)(pool);
    }
    catch (err) {
        // in-memory fallback active — but log so the failure isn't invisible
        const msg = err instanceof Error ? err.message : "ensureKidsAiTables failed";
        console.error("[KidsAI] ensureKidsAiTables failed:", msg);
    }
})();
// ─── In-memory store (materialise seed once) ────────────────────────────
function seedToLesson(s, idx) {
    return {
        id: idx + 1,
        title: s.title,
        description: s.description,
        age_min: s.ageMin,
        age_max: s.ageMax,
        language: s.language,
        category: s.category,
        content_md: s.contentMd,
        ai_prompt: s.aiPrompt,
        created_at: new Date().toISOString(),
    };
}
const memLessons = kidsAiSeed_1.KIDS_AI_SEED_LESSONS.map(seedToLesson);
const memProgress = [];
let memProgressSeq = 1;
// ─── Helpers ────────────────────────────────────────────────────────────
function sanitizeAlias(raw) {
    if (typeof raw !== "string")
        return null;
    // Strip ASCII control chars (low 32 + DEL). Keep letters, digits,
    // punctuation, spaces, unicode and emoji a kid might pick.
    let cleaned = "";
    for (const ch of raw) {
        const code = ch.charCodeAt(0);
        if (code >= 32 && code !== 127)
            cleaned += ch;
    }
    cleaned = cleaned.trim().slice(0, 64);
    if (!cleaned)
        return null;
    return cleaned;
}
function sanitizeLang(raw) {
    if (typeof raw !== "string")
        return null;
    const v = raw.toLowerCase();
    if (v === "ru" || v === "en" || v === "kz")
        return v;
    return null;
}
function clampNum(raw, min, max, def) {
    const n = Number(raw);
    if (!Number.isFinite(n))
        return def;
    return Math.max(min, Math.min(max, Math.floor(n)));
}
function paramStr(req, key) {
    const v = req.params[key];
    return Array.isArray(v) ? v[0] : String(v ?? "");
}
function fallbackAnswer(lang) {
    if (lang === "en")
        return "I'm thinking — try again in a moment!";
    if (lang === "kz")
        return "Мен ойланып жатырмын, аздан кейін қайта сұра!";
    return "Я пока думаю, попробуй позже";
}
// Apply a moderate global rate limit. POST /ask gets an extra, stricter
// window because LLM calls cost real money.
const globalLimit = (0, rateLimit_1.rateLimit)({
    windowMs: 60000,
    max: 60,
    keyPrefix: "kidsai",
    message: "Too many requests to kids-ai",
});
const askLimit = (0, rateLimit_1.rateLimit)({
    windowMs: 60000,
    max: 10,
    keyPrefix: "kidsai-ask",
    message: "Too many AI questions — wait a moment",
});
exports.kidsAiContentRouter.use(globalLimit);
// ─── GET /health ────────────────────────────────────────────────────────
exports.kidsAiContentRouter.get("/health", async (_req, res) => {
    let lessonsCount = memLessons.length;
    if ((0, ensureKidsAiTables_1.isKidsAiDbReady)()) {
        try {
            const r = await pool.query("SELECT COUNT(*)::text AS count FROM kids_lessons");
            const row = r.rows[0];
            lessonsCount = Number(row?.count ?? lessonsCount);
        }
        catch (err) {
            console.warn("[KidsAI] GET /health count query failed:", err instanceof Error ? err.message : err);
            // fall through to in-memory count
        }
    }
    res.json({
        ok: true,
        module: "kids-ai-content",
        dbReady: (0, ensureKidsAiTables_1.isKidsAiDbReady)(),
        lessonsCount,
        timestamp: new Date().toISOString(),
    });
});
// ─── GET /stats ─────────────────────────────────────────────────────────
exports.kidsAiContentRouter.get("/stats", async (_req, res) => {
    if ((0, ensureKidsAiTables_1.isKidsAiDbReady)()) {
        try {
            const total = await pool.query("SELECT COUNT(*)::text AS count FROM kids_lessons");
            const langs = await pool.query("SELECT COUNT(DISTINCT language)::text AS count FROM kids_lessons");
            const cats = await pool.query("SELECT COUNT(DISTINCT category)::text AS count FROM kids_lessons");
            const totalRow = total.rows[0];
            const langsRow = langs.rows[0];
            const catsRow = cats.rows[0];
            res.json({
                totalLessons: Number(totalRow?.count ?? 0),
                languages: Number(langsRow?.count ?? 0),
                categories: Number(catsRow?.count ?? 0),
                source: "postgres",
            });
            return;
        }
        catch (err) {
            console.warn("[KidsAI] GET /stats query failed:", err instanceof Error ? err.message : err);
            // fall through to in-memory stats
        }
    }
    const langs = new Set(memLessons.map((l) => l.language)).size;
    const cats = new Set(memLessons.map((l) => l.category)).size;
    res.json({
        totalLessons: memLessons.length,
        languages: langs,
        categories: cats,
        source: "memory",
    });
});
// ─── GET /lessons ───────────────────────────────────────────────────────
exports.kidsAiContentRouter.get("/lessons", async (req, res) => {
    const lang = sanitizeLang(req.query.lang);
    const ageMin = req.query.ageMin !== undefined
        ? clampNum(req.query.ageMin, 0, 99, 0)
        : null;
    const ageMax = req.query.ageMax !== undefined
        ? clampNum(req.query.ageMax, 0, 99, 99)
        : null;
    const category = typeof req.query.category === "string" && req.query.category.trim()
        ? req.query.category.trim().slice(0, 40)
        : null;
    const limit = clampNum(req.query.limit, 1, 100, 20);
    if ((0, ensureKidsAiTables_1.isKidsAiDbReady)()) {
        try {
            const conds = [];
            const params = [];
            if (lang) {
                params.push(lang);
                conds.push(`language = $${params.length}`);
            }
            if (category) {
                params.push(category);
                conds.push(`category = $${params.length}`);
            }
            if (ageMin !== null) {
                params.push(ageMin);
                conds.push(`age_max >= $${params.length}`);
            }
            if (ageMax !== null) {
                params.push(ageMax);
                conds.push(`age_min <= $${params.length}`);
            }
            params.push(limit);
            const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
            const rows = await pool.query(`SELECT id, title, description, age_min, age_max, language, category, ai_prompt, created_at
         FROM kids_lessons
         ${where}
         ORDER BY id ASC
         LIMIT $${params.length}`, params);
            // Сколько подходит под фильтр — отдельным запросом, БЕЗ LIMIT.
            //
            // Здесь стояло `rows.rowCount ?? rows.rows.length`, и это тот же обман,
            // что и в ветке в памяти, только незаметнее: rowCount — количество
            // ВЕРНУВШИХСЯ строк, а запрос идёт с LIMIT. Поле называется total, а
            // означает размер страницы.
            const counted = await pool.query(`SELECT COUNT(*)::int AS n FROM kids_lessons ${where}`, params.slice(0, params.length - 1));
            // Withhold content_md from list view (keep payloads small).
            res.json({
                lessons: rows.rows,
                total: Number(counted.rows[0]?.n ?? rows.rows.length) || rows.rows.length,
                source: "postgres",
            });
            return;
        }
        catch (err) {
            console.warn("[KidsAI] GET /lessons query failed:", err instanceof Error ? err.message : err);
            // fall through to in-memory list
        }
    }
    let list = memLessons.slice();
    if (lang)
        list = list.filter((l) => l.language === lang);
    if (category)
        list = list.filter((l) => l.category === category);
    if (ageMin !== null)
        list = list.filter((l) => l.age_max >= ageMin);
    if (ageMax !== null)
        list = list.filter((l) => l.age_min <= ageMax);
    // Считаем ДО среза: `total` отвечает на вопрос «сколько подходит», а не
    // «сколько уместилось». Иначе при сорока уроках и limit=20 ответ говорит
    // «всего 20», клиент рисует «показано 20 из 20» и не показывает кнопку
    // «дальше» — половина каталога недостижима, и признака этого нет.
    const matched = list.length;
    list = list.slice(0, limit);
    res.json({
        lessons: list.map(({ content_md: _drop, ...rest }) => {
            void _drop;
            return rest;
        }),
        total: matched,
        source: "memory",
    });
});
// ─── GET /lessons/:id ───────────────────────────────────────────────────
exports.kidsAiContentRouter.get("/lessons/:id", async (req, res) => {
    const id = (0, queryNumber_1.pgIntId)(paramStr(req, "id"));
    if (id === null) {
        res.status(400).json({ error: "id must be a positive integer" });
        return;
    }
    if ((0, ensureKidsAiTables_1.isKidsAiDbReady)()) {
        try {
            const row = await pool.query(`SELECT * FROM kids_lessons WHERE id = $1`, [id]);
            if (row.rows.length === 0) {
                res.status(404).json({ error: "Lesson not found" });
                return;
            }
            res.json({ lesson: row.rows[0] });
            return;
        }
        catch (err) {
            console.warn("[KidsAI] GET /lessons/:id query failed:", err instanceof Error ? err.message : err);
            // fall through to in-memory lookup
        }
    }
    const lesson = memLessons.find((l) => l.id === id);
    if (!lesson) {
        res.status(404).json({ error: "Lesson not found" });
        return;
    }
    res.json({ lesson });
});
// ─── POST /ask ──────────────────────────────────────────────────────────
exports.kidsAiContentRouter.post("/ask", askLimit, async (req, res) => {
    const body = (req.body ?? {});
    const lessonId = (0, queryNumber_1.pgIntId)(body.lessonId);
    const question = typeof body.question === "string" ? body.question.trim() : "";
    const lang = sanitizeLang(body.lang) ?? "ru";
    if (!question) {
        res.status(400).json({ error: "question is required" });
        return;
    }
    if (question.length > 500) {
        res.status(400).json({ error: "question must be <= 500 chars" });
        return;
    }
    // SAFETY LAYER 1 (input): clear-harm topics never reach the LLM. Return a
    // gentle "ask a grown-up" reply — guaranteed-safe and saves the LLM spend.
    if ((0, kidsSafety_1.containsUnsafe)(question)) {
        res.json({
            answer: (0, kidsSafety_1.gentleRedirect)(lang),
            provider: "safety",
            source: "safety",
            model: null,
        });
        return;
    }
    // Pull lesson context (best-effort — answer is still useful without it).
    let lessonContext = null;
    if (lessonId !== null) {
        if ((0, ensureKidsAiTables_1.isKidsAiDbReady)()) {
            try {
                const r = await pool.query("SELECT * FROM kids_lessons WHERE id = $1", [lessonId]);
                lessonContext = r.rows[0] ?? null;
            }
            catch (err) {
                console.warn("[KidsAI] POST /ask lesson-context query failed:", err instanceof Error ? err.message : err);
                // fall through to in-memory lesson context
            }
        }
        if (!lessonContext) {
            lessonContext = memLessons.find((l) => l.id === lessonId) ?? null;
        }
    }
    const langName = lang === "en" ? "English" : lang === "kz" ? "Kazakh (қазақша)" : "Russian";
    const baseSystem = `Ты — добрый детский учитель. Отвечай ПРОСТО, безопасно, на языке: ${langName}. ` +
        `Никогда не пиши про насилие, оружие, политику, взрослые темы, наркотики, алкоголь. ` +
        `Если вопрос неуместен — мягко предложи спросить у мамы или папы. ` +
        `Используй короткие предложения и эмодзи. Длина ответа — до 150 слов.`;
    const lessonSystem = lessonContext?.ai_prompt
        ? `${baseSystem}\n\nКонтекст урока «${lessonContext.title}»:\n${lessonContext.ai_prompt}`
        : baseSystem;
    const messages = [
        { role: "system", content: lessonSystem },
        { role: "user", content: question },
    ];
    const providers = (0, providers_1.getProviders)().filter((p) => p.configured);
    if (providers.length === 0) {
        res.json({
            answer: fallbackAnswer(lang),
            provider: "fallback",
            source: "fallback",
            model: null,
        });
        return;
    }
    try {
        const provider = providers[0];
        const result = await (0, providers_1.callProvider)(provider.id, messages, provider.defaultModel, 
        // Lower temperature than the default 0.7 — for a kids product we want
        // more deterministic, on-guardrail answers with less creative drift.
        0.4, undefined, undefined, { module: "kids-ai-ask" });
        // An empty reply means we served the canned fallback text, so the
        // client should treat it as a fallback, not a real AI answer.
        const usedReply = Boolean(result.reply);
        // SAFETY LAYER 2 (output): if a model reply slips a blocked term past the
        // system prompt, swap it for the gentle redirect before it reaches the kid.
        if (usedReply && (0, kidsSafety_1.containsUnsafe)(result.reply)) {
            console.warn("[KidsAI] output screen tripped — replacing AI reply");
            res.json({
                answer: (0, kidsSafety_1.gentleRedirect)(lang),
                provider: "safety",
                source: "safety",
                model: null,
            });
            return;
        }
        res.json({
            answer: result.reply || fallbackAnswer(lang),
            provider: usedReply ? provider.id : "fallback",
            source: usedReply ? "ai" : "fallback",
            model: usedReply ? result.model : null,
        });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : "provider failure";
        console.warn("[KidsAI] callProvider failed:", msg);
        res.json({
            answer: fallbackAnswer(lang),
            provider: "fallback",
            source: "fallback",
            model: null,
            note: "Provider unavailable — using fallback.",
        });
    }
});
// ─── POST /progress ─────────────────────────────────────────────────────
exports.kidsAiContentRouter.post("/progress", async (req, res) => {
    const body = (req.body ?? {});
    const alias = sanitizeAlias(body.childAlias);
    const lessonId = (0, queryNumber_1.pgIntId)(body.lessonId);
    const score = body.score === undefined || body.score === null
        ? null
        : clampNum(body.score, 0, 100, 0);
    if (!alias) {
        res.status(400).json({ error: "childAlias is required (1-64 chars)" });
        return;
    }
    if (lessonId === null) {
        res.status(400).json({ error: "lessonId must be a positive integer" });
        return;
    }
    if ((0, ensureKidsAiTables_1.isKidsAiDbReady)()) {
        try {
            // Validate lesson exists before insert (FK would catch it, but
            // a 404 is friendlier than a 500).
            const exists = await pool.query("SELECT 1 FROM kids_lessons WHERE id = $1", [lessonId]);
            if (exists.rows.length === 0) {
                res.status(404).json({ error: "Lesson not found" });
                return;
            }
            const inserted = await pool.query(`INSERT INTO kids_progress (child_alias, lesson_id, score)
         VALUES ($1, $2, $3)
         RETURNING *`, [alias, lessonId, score]);
            res.status(201).json({ progress: inserted.rows[0] });
            return;
        }
        catch (err) {
            // DB is the source of truth here — do NOT silently fall back to the
            // in-memory store, or we'd return 201 while the row is lost. Surface
            // the failure so the client can retry.
            const msg = err instanceof Error ? err.message : "progress insert failed";
            console.error("[KidsAI] POST /progress DB error:", msg);
            captureKidsAIError(err, { route: "kids-ai/POST/progress" });
            res.status(500).json({ error: "Could not save progress — please retry" });
            return;
        }
    }
    if (!memLessons.some((l) => l.id === lessonId)) {
        res.status(404).json({ error: "Lesson not found" });
        return;
    }
    const rec = {
        id: memProgressSeq++,
        child_alias: alias,
        lesson_id: lessonId,
        completed_at: new Date().toISOString(),
        score,
    };
    memProgress.push(rec);
    res.status(201).json({ progress: rec });
});
// ─── GET /progress/:childAlias ──────────────────────────────────────────
exports.kidsAiContentRouter.get("/progress/:childAlias", async (req, res) => {
    const alias = sanitizeAlias(paramStr(req, "childAlias"));
    if (!alias) {
        res.status(400).json({ error: "invalid childAlias" });
        return;
    }
    if ((0, ensureKidsAiTables_1.isKidsAiDbReady)()) {
        try {
            const rows = await pool.query(`SELECT p.id, p.child_alias, p.lesson_id, p.completed_at, p.score,
                  l.title
             FROM kids_progress p
             JOIN kids_lessons l ON l.id = p.lesson_id
            WHERE p.child_alias = $1
            ORDER BY p.completed_at DESC
            LIMIT 100`, [alias]);
            res.json({
                childAlias: alias,
                progress: rows.rows,
                total: rows.rowCount ?? rows.rows.length,
            });
            return;
        }
        catch (err) {
            console.warn("[KidsAI] GET /progress/:childAlias query failed:", err instanceof Error ? err.message : err);
            // fall through to in-memory progress
        }
    }
    const list = memProgress
        .filter((p) => p.child_alias === alias)
        .map((p) => ({
        ...p,
        title: memLessons.find((l) => l.id === p.lesson_id)?.title ?? "",
    }));
    res.json({
        childAlias: alias,
        progress: list,
        total: list.length,
    });
});
// ── MVP concept board surface ───────────────────────────────────────────────
exports.kidsAiContentRouter.get("/status", globalLimit, (_req, res) => {
    res.json({
        module: "kids-ai-content",
        code: "KIDS-AI",
        status: "mvp",
        description: "Safe multi-language content for kids (5-12): lessons, progress, concept board.",
        endpoints: {
            lessons: "/api/kids-ai-content/lessons",
            progress: "/api/kids-ai-content/progress",
            conceptMessages: "/api/kids-ai-content/concept/messages",
            conceptStats: "/api/kids-ai-content/concept-stats",
        },
        timestamp: new Date().toISOString(),
    });
});
(0, conceptBoardStore_1.mountConceptBoard)({ router: exports.kidsAiContentRouter, moduleId: "kids-ai-content", defaultTag: "kids-ai", readLimit: globalLimit, writeLimit: globalLimit });
