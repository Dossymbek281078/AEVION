"use strict";
/**
 * cyberchessVoiceCoach.ts
 *
 * Express router for CyberChess AI Voice Coach v3 (LLM-backed) + Spectator broadcast.
 *
 * Endpoints:
 *   POST /comment            — build a Russian, 1-2 sentence comment.
 *                              Tries QCoreAI LLM first; on timeout/error
 *                              falls back to deterministic rule-based template.
 *   POST /ask                — multi-turn Q&A. Body: { question, fen, lastMove,
 *                              history, sessionId? }. Persists turns in
 *                              in-memory session history for context-aware follow-ups.
 *   GET  /sessions/:id       — read in-memory chat history for a session.
 *   POST /sessions/:id/clear — clear the in-memory history for a session.
 *   POST /tts                — proxy TTS request to ElevenLabs, returns audio/mpeg.
 *                              Cache key now uses sha1(text) (short, stable).
 *   POST /broadcast          — NEW. Build a comment (LLM → fallback) for a live
 *                              spectator game and broadcast it via the spectator
 *                              SSE "voice" event. Optionally generates a TTS
 *                              audio data URL (when ELEVENLABS_API_KEY is set)
 *                              so spectators auto-play AI commentary.
 *   GET  /voices             — static voice catalogue used by the client dropdown.
 *
 * Required env vars:
 *   ELEVENLABS_API_KEY  — secret key from elevenlabs.io (only for /tts + /broadcast TTS).
 *   QCOREAI_BASE        — optional. Fully-qualified base URL of QCoreAI if this
 *                         service runs outside the monorepo. Defaults to
 *                         '/api/qcoreai' (same-origin via the AEVION gateway).
 *
 * Mount example (in app entrypoint):
 *   import cyberchessVoiceCoachRouter from './routes/cyberchessVoiceCoach';
 *   app.use('/api/cyberchess-voice-coach', cyberchessVoiceCoachRouter);
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCommentText = generateCommentText;
const express_1 = require("express");
const inMemoryWindow_1 = require("../lib/rateLimit/inMemoryWindow");
const rateLimit_1 = require("../lib/rateLimit");
const aiInputBudget_1 = require("../lib/aiInputBudget");
const freeActionQuota_1 = require("../lib/freeActionQuota");
const providerSpendCheck_1 = require("../lib/providerSpendCheck");
const providerHealth_1 = require("../lib/providerHealth");
const crypto_1 = require("crypto");
const platform_1 = require("../lib/sentry/platform");
const capture = (0, platform_1.makeServiceCapture)('cyberchessVoiceCoach');
const voiceCoachPrompt_1 = __importStar(require("../lib/voiceCoachPrompt"));
const cyberchessSpectator_1 = require("./cyberchessSpectator");
const router = (0, express_1.Router)();
// ─── QCoreAI base URL ────────────────────────────────────────────────────
// The backend calls its OWN /api/qcoreai route in-process. Node's fetch cannot
// resolve a relative URL ('/api/qcoreai'), so a relative default silently made
// EVERY LLM call throw → the coach was always stuck on rule-based fallback.
// Default to an absolute loopback URL (same pattern as /broadcast → spectator);
// override via QCOREAI_BASE when this service runs standalone.
function qcoreaiBase() {
    const explicit = process.env.QCOREAI_BASE;
    if (explicit && explicit.trim())
        return explicit.replace(/\/+$/, '');
    const port = process.env.PORT ?? '4001';
    return `http://127.0.0.1:${port}/api/qcoreai`;
}
// ─── In-memory TTS cache ─────────────────────────────────────────────────
// Keyed by `${voiceId}::${sha1(text).slice(0,16)}` — short, stable, no PII leak.
const ttsCache = new Map();
const MAX_CACHE_ENTRIES = 200;
function sha1Short(text) {
    return (0, crypto_1.createHash)('sha1').update(text, 'utf8').digest('hex').slice(0, 16);
}
function ttsCacheKey(voiceId, text) {
    return `${voiceId}::${sha1Short(text)}`;
}
function cacheGet(key) {
    return ttsCache.get(key);
}
function cacheSet(key, buf) {
    if (ttsCache.size >= MAX_CACHE_ENTRIES) {
        const firstKey = ttsCache.keys().next().value;
        if (firstKey !== undefined)
            ttsCache.delete(firstKey);
    }
    ttsCache.set(key, buf);
}
const sessions = new Map();
const MAX_SESSIONS = 500;
const MAX_MESSAGES_PER_SESSION = 40;
const SESSION_TTL_MS = 1000 * 60 * 60 * 4; // 4 hours
function pruneSessions() {
    const now = Date.now();
    for (const [id, s] of sessions) {
        if (now - s.updatedAt > SESSION_TTL_MS)
            sessions.delete(id);
    }
    if (sessions.size > MAX_SESSIONS) {
        // drop oldest
        const sorted = Array.from(sessions.entries()).sort((a, b) => a[1].updatedAt - b[1].updatedAt);
        const drop = sorted.slice(0, sessions.size - MAX_SESSIONS);
        for (const [id] of drop)
            sessions.delete(id);
    }
}
function getOrCreateSession(id) {
    pruneSessions();
    const existing = sessions.get(id);
    if (existing)
        return existing;
    const s = {
        id,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
    sessions.set(id, s);
    return s;
}
function appendSession(s, role, content) {
    s.messages.push({ role, content });
    if (s.messages.length > MAX_MESSAGES_PER_SESSION) {
        // drop oldest, keep a sliding window
        s.messages.splice(0, s.messages.length - MAX_MESSAGES_PER_SESSION);
    }
    s.updatedAt = Date.now();
}
// ─── Default voice (Rachel — calm female, multilingual) ────────────────
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel
const MOCK_VOICES = [
    {
        id: '21m00Tcm4TlvDq8ikWAM',
        name: 'Rachel',
        language: 'multilingual',
        gender: 'female',
    },
    {
        id: 'AZnzlk1XvdvUeBnXmlld',
        name: 'Domi',
        language: 'multilingual',
        gender: 'female',
    },
    {
        id: 'EXAVITQu4vr4xnSDxMaL',
        name: 'Bella',
        language: 'multilingual',
        gender: 'female',
    },
    {
        id: 'ErXwobaYiN019PkySvjV',
        name: 'Antoni',
        language: 'multilingual',
        gender: 'male',
    },
];
// ─── Static model catalogue exposed to the client. ────────────────────
// QCoreAI passes `model` through to the upstream provider, so this list is
// informational; the upstream may accept or ignore values.
const MOCK_MODELS = [
    { id: 'default', name: 'QCoreAI (default)' },
    { id: 'gpt-4o-mini', name: 'GPT-4o mini' },
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet' },
];
// ────────────────────────────────────────────────────────────────────────
// Re-export of the deterministic builder (kept for back-compat with callers
// that already import `generateCommentText` from this module).
// ────────────────────────────────────────────────────────────────────────
function generateCommentText(input) {
    return (0, voiceCoachPrompt_1.default)(input);
}
// ─── Per-gameId throttle for /broadcast (defence in depth) ───────────────
// Spectator router enforces a hard 6/min cap on outbound "voice" events; we
// add a soft 4-second min-gap here so accidental client double-fire doesn't
// burn the bucket within a single move.
const broadcastLastAt = new Map();
const BROADCAST_MIN_GAP_MS = 4000;
const BROADCAST_GC_INTERVAL_MS = 5 * 60 * 1000;
const broadcastGc = setInterval(() => {
    try {
        const now = Date.now();
        for (const [gid, t] of broadcastLastAt) {
            if (now - t > 10 * 60 * 1000)
                broadcastLastAt.delete(gid);
        }
    }
    catch (e) {
        // A throw here bypasses Express and would crash the whole backend.
        console.error("[cyberchess voiceCoach] broadcastGc tick failed", e);
    }
}, BROADCAST_GC_INTERVAL_MS);
if (typeof broadcastGc.unref === 'function')
    broadcastGc.unref();
/**
 * Ошибка внешнего сервиса, сведённая к КАТЕГОРИИ.
 *
 * Эти ручки ходят в языковую модель и синтез речи, а их сообщения содержат
 * чужое устройство: адрес апстрима, имя провайдера, подробности запроса, иногда
 * кусок ключа в тексте отказа. Отдавать это вызывающему незачем: ведущему нужно
 * знать, что чинить, а не как устроен наш бэкенд. Полное сообщение уходит в
 * capture() и в лог. Тот же разбор, что у `_persistence` в хранилищах (13.08).
 */
function upstreamErrorKind(err) {
    const m = err?.message?.toLowerCase() ?? '';
    if (!m)
        return 'unknown';
    if (m.includes('timeout') || m.includes('aborted'))
        return 'timeout';
    if (m.includes('econnrefused') || m.includes('enotfound') || m.includes('fetch failed'))
        return 'upstream_unreachable';
    if (m.includes('401') || m.includes('403') || m.includes('unauthor') || m.includes('api key'))
        return 'upstream_auth';
    if (m.includes('429') || m.includes('rate'))
        return 'upstream_rate_limited';
    if (m.includes('quota') || m.includes('billing') || m.includes('credit'))
        return 'upstream_quota';
    return 'upstream_error';
}
// ─── POST /comment ──────────────────────────────────────────────────────
// Body: BuildCommentInput + optional { model?, temperature?, llm?: boolean }
// Tries LLM via QCoreAI first; on any failure → rule-based fallback.
// Returns: { text: string, source: 'llm' | 'fallback' }
/**
 * Ограничители на ручки, которые ТРАТЯТ ДЕНЬГИ.
 *
 * Замер 19.08.2026: у этого файла не было ни одного ограничителя, ни квоты, ни
 * проверки доступа — при том что `/comment` и `/ask` идут в платную модель, а
 * `/tts` и `/broadcast` в платный синтез речи. Каждый вызов это счёт от
 * провайдера, и утекает он тихо: ни падения, ни следа.
 *
 * Почему это не поймал общий сторож дорогих ручек: его шаблон требует ДВОЙНЫХ
 * кавычек вокруг пути (`\.post\(\s*"`), а здесь пути в одинарных. Замер по
 * репозиторию: 506 объявлений с двойными кавычками сторож видит, 7 с
 * одинарными — нет, и пять из этих семи именно здесь. Слепое пятно легло ровно
 * на незащищённое.
 *
 * Берётся тот же ограничитель, что в соседнем cyberchessDaily.ts, а не третий
 * способ делать одно и то же.
 *
 * Пределы разные по цене вызова: текстовая модель дешевле синтеза речи.
 */
const coachLimiter = (0, inMemoryWindow_1.createInMemoryRateLimiter)({ max: 20, windowMs: 60000 });
const ttsLimiter = (0, inMemoryWindow_1.createInMemoryRateLimiter)({ max: 10, windowMs: 60000 });
// 🔴 08.09.2026: ПЛАТФОРМЕННЫЙ потолок расхода на анонимов — как anonCoachCeiling
// в coach.ts. Лимитеры выше по clientIp настоящего потолка НЕ дают: на Railway
// clientIp схлопывается в ~7 внутренних адресов («ИТОГ ЗАМЕРА 28.08» в
// lib/rateLimit.ts — «считать посетителя по адресу НЕЧЕМ»), поэтому один человек
// получает семь корзин, а расход платформы ничем не ограничен. Текстовый коуч это
// усвоил (anonCoachCeiling), голосовой — нет. Он зовёт Anthropic (/ask,/comment)
// и ДОРОГОЙ ElevenLabs TTS (/tts,/broadcast), значит потолок нужен ему не меньше.
// Авторизованные считаются по своему id и в общую корзину не попадают.
// Числа: /ask как у текстового коуча (та же модель); /tts туже (TTS дороже) —
// это число под ревью основателя по толерантности к расходу.
const anonVoiceAskCeiling = (0, rateLimit_1.rateLimit)({
    windowMs: 60000,
    max: 120,
    keyPrefix: "voicecoach:anon-ask",
    keyFn: (req) => ((0, aiInputBudget_1.isAnonymousRequest)(req) ? "anon" : `u:${String(req.auth?.sub || "user")}`),
    message: "rate_limit_exceeded: too many anonymous voice-coach requests platform-wide, sign in to continue",
});
const anonVoiceTtsCeiling = (0, rateLimit_1.rateLimit)({
    windowMs: 60000,
    max: 40,
    keyPrefix: "voicecoach:anon-tts",
    keyFn: (req) => ((0, aiInputBudget_1.isAnonymousRequest)(req) ? "anon" : `u:${String(req.auth?.sub || "user")}`),
    message: "rate_limit_exceeded: too many anonymous voice-coach TTS requests platform-wide, sign in to continue",
});
/** Общий отказ: 429 с честным «когда можно снова», а не молчаливый провал. */
function tooMany(res, retryAfterMs) {
    const sec = Math.max(1, Math.ceil(retryAfterMs / 1000));
    res.setHeader('Retry-After', String(sec));
    res.status(429).json({ ok: false, error: 'rate_limited', retryAfterSec: sec });
}
router.post('/comment', anonVoiceAskCeiling, async (req, res) => {
    const gate = coachLimiter.check((0, rateLimit_1.clientIp)(req));
    if (!gate.allowed)
        return tooMany(res, gate.retryAfterMs);
    try {
        const body = (req.body ?? {});
        const input = {
            fen: body.fen,
            lastMove: (body.lastMove ?? null),
            eval: (body.eval ?? null),
            prevEval: (body.prevEval ?? null),
            depth: body.depth,
            isCheck: !!body.isCheck,
            isCapture: !!body.isCapture,
            isCastling: !!body.isCastling,
            isPromotion: !!body.isPromotion,
            phase: body.phase,
            moveNumber: body.moveNumber,
        };
        // Explicit opt-out: client sets `llm: false` → use rule-based directly.
        if (body.llm === false) {
            return res.json({ text: generateCommentText(input), source: 'fallback' });
        }
        const fallback = generateCommentText(input);
        let source = 'fallback';
        let text = fallback;
        try {
            const llmText = await (0, voiceCoachPrompt_1.buildCommentLLM)(input, {
                qcoreaiBase: qcoreaiBase(),
                model: body.model,
                temperature: body.temperature,
                timeoutMs: 6500, // opus-4-8 isn't instant; give the GM разбор room before fallback
            });
            // Провайдер не настроен — QCoreAI не бросает, а возвращает 200 с
            // текстом «[QCoreAI — no AI provider configured] Your question: "…"»,
            // куда подставлен весь наш промпт. Без этой проверки он уходил в
            // комментарий и ПРОИЗНОСИЛСЯ вслух. Замер 02.09.2026 на локальном
            // бэкенде без ключа. Здесь, в отличие от /ask, есть хороший запасной
            // путь — правиловый комментарий, поэтому падаем в него, а не в отказ.
            const otkazProvaydera = typeof llmText === 'string' && /no ai provider configured/i.test(llmText);
            if (llmText && llmText !== fallback && !otkazProvaydera) {
                text = llmText;
                source = 'llm';
            }
        }
        catch {
            // buildCommentLLM swallows errors internally, but be defensive.
            source = 'fallback';
            text = fallback;
        }
        res.json({ text, source });
    }
    catch (err) {
        capture(err);
        res.status(500).json({
            error: 'comment_generation_failed',
            reason: upstreamErrorKind(err),
        });
    }
});
// ─── POST /ask ──────────────────────────────────────────────────────────
// Body: { question, fen?, lastMove?, history?, sessionId?, eval?, userSide?,
//         legalMoves?, bestMove?, model?, temperature? }
// Returns: { text: string, sessionId: string }
router.post('/ask', anonVoiceAskCeiling, async (req, res) => {
    const gate = coachLimiter.check((0, rateLimit_1.clientIp)(req));
    if (!gate.allowed)
        return tooMany(res, gate.retryAfterMs);
    // Бесплатная норма вопросов тренеру, дальше платно.
    //
    // ПОЧЕМУ ИМЕННО ТРЕНЕР, а не партия. Решение оркестратора 28.09 и здравый
    // смысл совпадают: шахматы — бесплатный магнит, партией делятся, и она
    // обязана идти без входа и без стены на КАЖДОМ шаге. Закрывать можно то,
    // что премиально И стоит нам живых денег: вопрос тренеру — это вызов ИИ и
    // озвучка, то есть наш счёт у поставщика.
    //
    // Потолок расхода (anonVoiceAskCeiling) и эта норма — РАЗНОЕ и не заменяют
    // друг друга: потолок защищает нас от злоупотребления, норма превращает
    // ценность в оплату. Порядок важен: сперва защита, потом деньги.
    //
    // Спит, пока "cyberchess_coach" не назван в PAID_ACTIONS.
    const норма = await (0, freeActionQuota_1.учестьДействие)(req, "cyberchess_coach");
    if (норма.заблокировано) {
        (0, freeActionQuota_1.отказПоНорме)(res, "cyberchess", норма);
        return;
    }
    try {
        const body = (req.body ?? {});
        const question = typeof body.question === 'string' ? body.question.trim() : '';
        if (!question) {
            return res.status(400).json({ error: 'missing_question' });
        }
        if (question.length > 1500) {
            return res
                .status(400)
                .json({ error: 'question_too_long', message: 'Max 1500 chars.' });
        }
        const sid = typeof body.sessionId === 'string' && body.sessionId.trim().length > 0
            ? body.sessionId.trim().slice(0, 64)
            : `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
        const session = getOrCreateSession(sid);
        let text;
        try {
            text = await (0, voiceCoachPrompt_1.answerQuestion)(question, {
                fen: body.fen,
                lastMove: body.lastMove ?? null,
                history: Array.isArray(body.history) ? body.history : undefined,
                priorMessages: session.messages,
                eval: body.eval ?? null,
                userSide: body.userSide,
                legalMoves: Array.isArray(body.legalMoves)
                    ? body.legalMoves.filter((m) => typeof m === 'string').slice(0, 128).map((m) => m.slice(0, 12))
                    : undefined,
                bestMove: typeof body.bestMove === 'string' ? body.bestMove.slice(0, 12) : undefined,
            }, {
                qcoreaiBase: qcoreaiBase(),
                model: body.model,
                temperature: body.temperature,
                // opus-4-8 отдаёт полноценный разбор (2-4 предложения + контекст) за
                // ~8-13с; 8000мс резал его на полуслове (abort) → GM-разбор/чат тренера
                // почти всегда падали в fallback на проде. 14с укладывается в клиентский
                // бюджет кнопки (15с).
                timeoutMs: 14000,
            });
        }
        catch (err) {
            capture(err);
            return res.status(502).json({
                error: 'llm_unavailable',
                reason: upstreamErrorKind(err),
                sessionId: sid,
            });
        }
        // Провайдер ИИ не настроен — это ОТКАЗ, а не ответ тренера.
        //
        // QCoreAI в таком случае не бросает, а возвращает 200 с текстом
        // «[QCoreAI — no AI provider configured] Your question: "…"» и ЭХОМ всего
        // внутреннего промпта. Раньше эта строка уходила человеку как ответ
        // тренера: английская служебная метка и наша же инженерия промпта на
        // экране. Замер 02.09.2026 на локальном бэкенде без ключа — ответ 200.
        //
        // Соседний модуль (psyappDeps) этот случай уже различает и отвечает 503
        // по-человечески; делаем так же.
        if (/no ai provider configured/i.test(text)) {
            return res.status(503).json({
                error: 'llm_not_configured',
                text: 'Тренер сейчас недоступен — разбор позиции не подключён. Партия и задачи работают как обычно.',
                sessionId: sid,
            });
        }
        appendSession(session, 'user', question);
        appendSession(session, 'assistant', text);
        res.json({ text, sessionId: sid, messageCount: session.messages.length });
    }
    catch (err) {
        capture(err);
        res.status(500).json({
            error: 'ask_failed',
            reason: upstreamErrorKind(err),
        });
    }
});
// ─── GET /sessions/:id ──────────────────────────────────────────────────
router.get('/sessions/:id', (req, res) => {
    const id = String(req.params.id ?? '').trim().slice(0, 64);
    if (!id)
        return res.status(400).json({ error: 'missing_id' });
    const s = sessions.get(id);
    if (!s) {
        return res.status(404).json({ error: 'session_not_found', sessionId: id });
    }
    res.json({
        sessionId: s.id,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        messages: s.messages,
    });
});
// ─── POST /sessions/:id/clear ───────────────────────────────────────────
router.post('/sessions/:id/clear', (req, res) => {
    const id = String(req.params.id ?? '').trim().slice(0, 64);
    if (!id)
        return res.status(400).json({ error: 'missing_id' });
    const had = sessions.delete(id);
    res.json({ sessionId: id, cleared: had });
});
// ─── POST /tts ──────────────────────────────────────────────────────────
// Body: { text: string, voiceId?: string }
// Returns: audio/mpeg stream (mp3)
router.post('/tts', anonVoiceTtsCeiling, async (req, res) => {
    const gate = ttsLimiter.check((0, rateLimit_1.clientIp)(req));
    if (!gate.allowed)
        return tooMany(res, gate.retryAfterMs);
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
        return res.status(503).json({
            error: 'elevenlabs_not_configured',
            message: 'ElevenLabs not configured — set ELEVENLABS_API_KEY environment variable.',
        });
    }
    /*
     * 🔴 06.10.2026: СПРАШИВАЕМ ДЕНЬГИ ДО ПЛАТНОГО ВЫЗОВА.
     *
     * Прежде коуч звал ElevenLabs слепо, а при отказе отвечал
     * `elevenlabs_error` с кодом поставщика и `reason: upstream_error`. Снаружи это
     * неотличимо от нашей поломки, и главное — мы платили за вызов, который заведомо
     * не выполнится. У ElevenLabs остаток знаков виден в БЕСПЛАТНОЙ ручке подписки,
     * и исчерпанный пакет приходит с HTTP 200: именно поэтому разбор там свой.
     *
     * Отказ даём 503 намеренно: кончившиеся знаки — НАША беда, а не ошибка запроса
     * (§15: 4xx отвечает про запрос). И отмечаем в providerHealth, иначе возможность
     * продолжала бы числиться живой, пока о неё не обожжётся человек.
     */
    const деньгиГолоса = await (0, providerSpendCheck_1.проверитьElevenLabs)();
    if (!(0, providerSpendCheck_1.этоОк)(деньгиГолоса.состояние)) {
        (0, providerHealth_1.noteProviderFailure)('audio_tts', деньгиГолоса.detail);
        return res.status(503).json({
            error: 'voice_unavailable',
            state: деньгиГолоса.состояние,
            reason: деньгиГолоса.detail,
            message: 'Голос сейчас недоступен — это на нашей стороне, а не ошибка запроса. ' +
                'Текст ответа тренера приходит обычным путём и без озвучки.',
        });
    }
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (!text) {
        return res.status(400).json({ error: 'missing_text' });
    }
    if (text.length > 1000) {
        return res
            .status(400)
            .json({ error: 'text_too_long', message: 'Max 1000 chars per request.' });
    }
    const voiceId = typeof req.body?.voiceId === 'string' && req.body.voiceId.trim().length > 0
        ? req.body.voiceId.trim()
        : DEFAULT_VOICE_ID;
    const cacheKey = ttsCacheKey(voiceId, text);
    const cached = cacheGet(cacheKey);
    if (cached) {
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-Key', cacheKey);
        return res.send(cached);
    }
    try {
        const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
            method: 'POST',
            headers: {
                'xi-api-key': apiKey,
                'Content-Type': 'application/json',
                Accept: 'audio/mpeg',
            },
            body: JSON.stringify({
                text,
                model_id: 'eleven_multilingual_v2',
                voice_settings: {
                    stability: 0.45,
                    similarity_boost: 0.75,
                    style: 0.25,
                    use_speaker_boost: true,
                },
            }),
        });
        if (!upstream.ok) {
            const errText = await upstream.text().catch(() => '');
            (0, providerHealth_1.noteProviderFailure)('audio_tts', `HTTP ${upstream.status} от поставщика голоса`);
            return res.status(upstream.status).json({
                error: 'elevenlabs_error',
                status: upstream.status,
                reason: 'upstream_error', // подробности — в логе, не в ответе
            });
        }
        const arrayBuf = await upstream.arrayBuffer();
        const buf = Buffer.from(arrayBuf);
        cacheSet(cacheKey, buf);
        // Замыкаем петлю в обе стороны: успех снимает отметку отказа, иначе одна
        // осечка держала бы возможность «подпорченной» до перезапуска.
        (0, providerHealth_1.noteProviderSuccess)('audio_tts');
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('X-Cache', 'MISS');
        res.setHeader('X-Cache-Key', cacheKey);
        return res.send(buf);
    }
    catch (err) {
        capture(err);
        return res.status(502).json({
            error: 'elevenlabs_proxy_failed',
            reason: upstreamErrorKind(err),
        });
    }
});
// ─── Internal helper: generate TTS as a data URL (for /broadcast inline audio) ──
async function generateTtsDataUrl(text, voiceId) {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey)
        return null;
    if (!text)
        return null;
    // Второе место, где мы платим за голос. Молчаливый null здесь законен (трансляция
    // идёт и без озвучки), но ПЛАТИТЬ впустую нельзя, а отметка обязана остаться.
    const деньги = await (0, providerSpendCheck_1.проверитьElevenLabs)();
    if (!(0, providerSpendCheck_1.этоОк)(деньги.состояние)) {
        (0, providerHealth_1.noteProviderFailure)('audio_tts', деньги.detail);
        return null;
    }
    // Hard cap so we don't burn quota on giant comments — broadcasts are short anyway.
    const trimmed = text.length > 300 ? text.slice(0, 300) : text;
    const cacheKey = ttsCacheKey(voiceId, trimmed);
    const cached = cacheGet(cacheKey);
    if (cached) {
        return `data:audio/mpeg;base64,${cached.toString('base64')}`;
    }
    try {
        const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
            method: 'POST',
            headers: {
                'xi-api-key': apiKey,
                'Content-Type': 'application/json',
                Accept: 'audio/mpeg',
            },
            body: JSON.stringify({
                text: trimmed,
                model_id: 'eleven_multilingual_v2',
                voice_settings: {
                    stability: 0.45,
                    similarity_boost: 0.75,
                    style: 0.25,
                    use_speaker_boost: true,
                },
            }),
        });
        if (!upstream.ok)
            return null;
        const arrayBuf = await upstream.arrayBuffer();
        const buf = Buffer.from(arrayBuf);
        cacheSet(cacheKey, buf);
        return `data:audio/mpeg;base64,${buf.toString('base64')}`;
    }
    catch {
        return null;
    }
}
// ─── POST /broadcast ────────────────────────────────────────────────────
// Body: { gameId, fen, lastMove?, eval?, hostName?, llm?: boolean, tts?: boolean,
//         voiceId?, model?, temperature?, depth?, isCheck?, isCapture?, ... }
//
// Generates an AI comment for the current move/position (LLM → fallback),
// optionally synthesises TTS (data URL), then pushes a "voice" event to the
// spectator SSE stream of the given gameId via the local spectator router.
//
// Auth (MVP): we don't yet have host tokens; instead we verify the gameId
// refers to a currently-live published game using isLiveGame() — that means
// only games actually being streamed can receive commentary, which is the
// invariant the feature needs.
//
// Returns: { ok, text, source, audioUrl?, viewers? }
router.post('/broadcast', anonVoiceTtsCeiling, async (req, res) => {
    const gate = ttsLimiter.check((0, rateLimit_1.clientIp)(req));
    if (!gate.allowed)
        return tooMany(res, gate.retryAfterMs);
    try {
        const body = (req.body ?? {});
        const gameId = typeof body.gameId === 'string' ? body.gameId.trim() : '';
        if (!gameId) {
            return res.status(400).json({ ok: false, error: 'missing_game_id' });
        }
        // Комментарий уходит зрителям чужого эфира и стоит настоящих денег: этот
        // путь дёргает LLM и синтез речи. Без доказательства владения стримом любой,
        // кто открыл ссылку зрителя, мог и говорить от лица ведущего, и тратить на
        // это чужой бюджет.
        const hostToken = (typeof req.headers['x-host-token'] === 'string' ? req.headers['x-host-token'] : '') ||
            (typeof body.hostToken === 'string'
                ? body.hostToken
                : '');
        if ((0, cyberchessSpectator_1.isLiveGame)(gameId) && !(0, cyberchessSpectator_1.isStreamHostToken)(gameId, hostToken)) {
            return res.status(403).json({ ok: false, error: 'not_the_host' });
        }
        if (!(0, cyberchessSpectator_1.isLiveGame)(gameId)) {
            return res
                .status(404)
                .json({ ok: false, error: 'game_not_live', gameId });
        }
        // Soft per-game min-gap to absorb client double-fire.
        const lastAt = broadcastLastAt.get(gameId) ?? 0;
        const now = Date.now();
        if (now - lastAt < BROADCAST_MIN_GAP_MS) {
            return res
                .status(429)
                .json({ ok: false, error: 'throttled', retryAfterMs: BROADCAST_MIN_GAP_MS - (now - lastAt) });
        }
        broadcastLastAt.set(gameId, now);
        if (typeof body.fen !== 'string' || !body.fen.trim()) {
            return res.status(400).json({ ok: false, error: 'missing_fen' });
        }
        // Normalise lastMove: spectator publish stream sends `lastSan` as a string,
        // but BuildCommentInput expects a MoveInfo-ish object. Accept both.
        let lastMove = null;
        if (body.lastMove && typeof body.lastMove === 'object') {
            lastMove = body.lastMove;
        }
        else if (typeof body.lastMove === 'string' && body.lastMove.trim()) {
            lastMove = { san: body.lastMove.trim() };
        }
        const input = {
            fen: body.fen,
            lastMove,
            eval: (body.eval ?? null),
            prevEval: (body.prevEval ?? null),
            depth: body.depth,
            isCheck: !!body.isCheck,
            isCapture: !!body.isCapture,
            isCastling: !!body.isCastling,
            isPromotion: !!body.isPromotion,
            phase: body.phase,
            moveNumber: body.moveNumber,
        };
        // 1. Build the comment text — LLM preferred, rule-based fallback.
        const fallback = generateCommentText(input);
        let source = 'fallback';
        let text = fallback;
        if (body.llm !== false) {
            try {
                const llmText = await (0, voiceCoachPrompt_1.buildCommentLLM)(input, {
                    qcoreaiBase: qcoreaiBase(),
                    model: body.model,
                    temperature: body.temperature,
                    timeoutMs: 3500, // broadcasts must not stall the move stream
                });
                if (llmText && llmText !== fallback) {
                    text = llmText;
                    source = 'llm';
                }
            }
            catch {
                // keep fallback
            }
        }
        // Hard cap to spectator voice text length.
        if (text.length > 300)
            text = text.slice(0, 300);
        // 2. Optionally synthesise TTS as a data URL — best-effort, never blocks.
        let audioUrl;
        if (body.tts !== false && process.env.ELEVENLABS_API_KEY) {
            const voiceId = typeof body.voiceId === 'string' && body.voiceId.trim().length > 0
                ? body.voiceId.trim()
                : DEFAULT_VOICE_ID;
            const url = await generateTtsDataUrl(text, voiceId);
            if (url)
                audioUrl = url;
        }
        // 3. Push to the spectator SSE stream via the in-process broadcast endpoint.
        //    We call our own /api/cyberchess-spectator/voice/:gameId so the spectator
        //    router stays the single source of truth for SSE fan-out + rate limiting.
        //    PORT comes from index.ts (defaults to 4001); we fall back to 4001.
        const port = process.env.PORT ?? '4001';
        const internalUrl = `http://127.0.0.1:${port}/api/cyberchess-spectator/voice/${encodeURIComponent(gameId)}`;
        let viewers;
        try {
            const upstream = await fetch(internalUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, audioUrl, fromHost: true }),
            });
            if (upstream.ok) {
                const j = (await upstream.json().catch(() => null));
                viewers = j?.viewers;
            }
            else if (upstream.status === 429) {
                return res.status(429).json({
                    ok: false,
                    error: 'spectator_rate_limited',
                    text,
                    source,
                });
            }
            else if (upstream.status === 404) {
                return res
                    .status(404)
                    .json({ ok: false, error: 'game_not_live', text, source });
            }
        }
        catch (err) {
            // Internal SSE push failed — return text anyway so the client knows the
            // commentary was generated; it just won't be visible to spectators.
            return res.status(502).json({
                ok: false,
                error: 'spectator_unreachable',
                reason: upstreamErrorKind(err),
                text,
                source,
                audioUrl,
            });
        }
        res.json({ ok: true, text, source, audioUrl, viewers });
    }
    catch (err) {
        capture(err);
        res.status(500).json({
            ok: false,
            error: 'broadcast_failed',
            reason: upstreamErrorKind(err),
        });
    }
});
// ─── GET /voices ────────────────────────────────────────────────────────
router.get('/voices', (_req, res) => {
    res.json({
        voices: MOCK_VOICES,
        defaultVoiceId: DEFAULT_VOICE_ID,
        models: MOCK_MODELS,
    });
});
exports.default = router;
