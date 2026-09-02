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

import { Router, Request, Response } from 'express';
import { createInMemoryRateLimiter } from '../lib/rateLimit/inMemoryWindow';
import { clientIp } from '../lib/rateLimit';
import { createHash } from 'crypto';
import { makeServiceCapture } from '../lib/sentry/platform';

const capture = makeServiceCapture('cyberchessVoiceCoach');
import buildComment, {
  BuildCommentInput,
  MoveInfo,
  EvalInfo,
  ChatMessage,
  buildCommentLLM,
  answerQuestion,
} from '../lib/voiceCoachPrompt';
import { isLiveGame, isStreamHostToken } from './cyberchessSpectator';

const router = Router();

// ─── QCoreAI base URL ────────────────────────────────────────────────────
// The backend calls its OWN /api/qcoreai route in-process. Node's fetch cannot
// resolve a relative URL ('/api/qcoreai'), so a relative default silently made
// EVERY LLM call throw → the coach was always stuck on rule-based fallback.
// Default to an absolute loopback URL (same pattern as /broadcast → spectator);
// override via QCOREAI_BASE when this service runs standalone.
function qcoreaiBase(): string {
  const explicit = process.env.QCOREAI_BASE;
  if (explicit && explicit.trim()) return explicit.replace(/\/+$/, '');
  const port = process.env.PORT ?? '4001';
  return `http://127.0.0.1:${port}/api/qcoreai`;
}

// ─── In-memory TTS cache ─────────────────────────────────────────────────
// Keyed by `${voiceId}::${sha1(text).slice(0,16)}` — short, stable, no PII leak.
const ttsCache = new Map<string, Buffer>();
const MAX_CACHE_ENTRIES = 200;

function sha1Short(text: string): string {
  return createHash('sha1').update(text, 'utf8').digest('hex').slice(0, 16);
}

function ttsCacheKey(voiceId: string, text: string): string {
  return `${voiceId}::${sha1Short(text)}`;
}

function cacheGet(key: string): Buffer | undefined {
  return ttsCache.get(key);
}

function cacheSet(key: string, buf: Buffer): void {
  if (ttsCache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = ttsCache.keys().next().value;
    if (firstKey !== undefined) ttsCache.delete(firstKey);
  }
  ttsCache.set(key, buf);
}

// ─── In-memory Q&A session store ─────────────────────────────────────────
interface Session {
  id: string;
  messages: ChatMessage[]; // chronological, excluding system prompt
  createdAt: number;
  updatedAt: number;
}

const sessions = new Map<string, Session>();
const MAX_SESSIONS = 500;
const MAX_MESSAGES_PER_SESSION = 40;
const SESSION_TTL_MS = 1000 * 60 * 60 * 4; // 4 hours

function pruneSessions(): void {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (now - s.updatedAt > SESSION_TTL_MS) sessions.delete(id);
  }
  if (sessions.size > MAX_SESSIONS) {
    // drop oldest
    const sorted = Array.from(sessions.entries()).sort(
      (a, b) => a[1].updatedAt - b[1].updatedAt,
    );
    const drop = sorted.slice(0, sessions.size - MAX_SESSIONS);
    for (const [id] of drop) sessions.delete(id);
  }
}

function getOrCreateSession(id: string): Session {
  pruneSessions();
  const existing = sessions.get(id);
  if (existing) return existing;
  const s: Session = {
    id,
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  sessions.set(id, s);
  return s;
}

function appendSession(s: Session, role: ChatMessage['role'], content: string): void {
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
export function generateCommentText(input: BuildCommentInput): string {
  return buildComment(input);
}

// ─── Per-gameId throttle for /broadcast (defence in depth) ───────────────
// Spectator router enforces a hard 6/min cap on outbound "voice" events; we
// add a soft 4-second min-gap here so accidental client double-fire doesn't
// burn the bucket within a single move.
const broadcastLastAt = new Map<string, number>();
const BROADCAST_MIN_GAP_MS = 4_000;
const BROADCAST_GC_INTERVAL_MS = 5 * 60 * 1_000;
const broadcastGc = setInterval(() => {
  try {
    const now = Date.now();
    for (const [gid, t] of broadcastLastAt) {
      if (now - t > 10 * 60 * 1_000) broadcastLastAt.delete(gid);
    }
  } catch (e) {
    // A throw here bypasses Express and would crash the whole backend.
    console.error("[cyberchess voiceCoach] broadcastGc tick failed", e);
  }
}, BROADCAST_GC_INTERVAL_MS);
if (typeof broadcastGc.unref === 'function') broadcastGc.unref();

/**
 * Ошибка внешнего сервиса, сведённая к КАТЕГОРИИ.
 *
 * Эти ручки ходят в языковую модель и синтез речи, а их сообщения содержат
 * чужое устройство: адрес апстрима, имя провайдера, подробности запроса, иногда
 * кусок ключа в тексте отказа. Отдавать это вызывающему незачем: ведущему нужно
 * знать, что чинить, а не как устроен наш бэкенд. Полное сообщение уходит в
 * capture() и в лог. Тот же разбор, что у `_persistence` в хранилищах (13.08).
 */
function upstreamErrorKind(err: unknown): string {
  const m = (err as Error)?.message?.toLowerCase() ?? '';
  if (!m) return 'unknown';
  if (m.includes('timeout') || m.includes('aborted')) return 'timeout';
  if (m.includes('econnrefused') || m.includes('enotfound') || m.includes('fetch failed')) return 'upstream_unreachable';
  if (m.includes('401') || m.includes('403') || m.includes('unauthor') || m.includes('api key')) return 'upstream_auth';
  if (m.includes('429') || m.includes('rate')) return 'upstream_rate_limited';
  if (m.includes('quota') || m.includes('billing') || m.includes('credit')) return 'upstream_quota';
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
const coachLimiter = createInMemoryRateLimiter({ max: 20, windowMs: 60_000 });
const ttsLimiter = createInMemoryRateLimiter({ max: 10, windowMs: 60_000 });

/** Общий отказ: 429 с честным «когда можно снова», а не молчаливый провал. */
function tooMany(res: Response, retryAfterMs: number): void {
  const sec = Math.max(1, Math.ceil(retryAfterMs / 1000));
  res.setHeader('Retry-After', String(sec));
  res.status(429).json({ ok: false, error: 'rate_limited', retryAfterSec: sec });
}


router.post('/comment', async (req: Request, res: Response) => {
  const gate = coachLimiter.check(clientIp(req));
  if (!gate.allowed) return tooMany(res, gate.retryAfterMs);
  try {
    const body = (req.body ?? {}) as BuildCommentInput & {
      model?: string;
      temperature?: number;
      llm?: boolean;
    };
    const input: BuildCommentInput = {
      fen: body.fen,
      lastMove: (body.lastMove ?? null) as MoveInfo | null,
      eval: (body.eval ?? null) as EvalInfo | null,
      prevEval: (body.prevEval ?? null) as EvalInfo | null,
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
    let source: 'llm' | 'fallback' = 'fallback';
    let text = fallback;

    try {
      const llmText = await buildCommentLLM(input, {
        qcoreaiBase: qcoreaiBase(),
        model: body.model,
        temperature: body.temperature,
        timeoutMs: 6500, // opus-4-8 isn't instant; give the GM разбор room before fallback
      });
      if (llmText && llmText !== fallback) {
        text = llmText;
        source = 'llm';
      }
    } catch {
      // buildCommentLLM swallows errors internally, but be defensive.
      source = 'fallback';
      text = fallback;
    }

    res.json({ text, source });
  } catch (err) {
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
router.post('/ask', async (req: Request, res: Response) => {
  const gate = coachLimiter.check(clientIp(req));
  if (!gate.allowed) return tooMany(res, gate.retryAfterMs);
  try {
    const body = (req.body ?? {}) as {
      question?: string;
      fen?: string;
      lastMove?: string | MoveInfo | null;
      history?: Array<string | MoveInfo>;
      sessionId?: string;
      eval?: EvalInfo | null;
      userSide?: 'w' | 'b';
      legalMoves?: string[];
      bestMove?: string;
      model?: string;
      temperature?: number;
    };

    const question = typeof body.question === 'string' ? body.question.trim() : '';
    if (!question) {
      return res.status(400).json({ error: 'missing_question' });
    }
    if (question.length > 1500) {
      return res
        .status(400)
        .json({ error: 'question_too_long', message: 'Max 1500 chars.' });
    }

    const sid =
      typeof body.sessionId === 'string' && body.sessionId.trim().length > 0
        ? body.sessionId.trim().slice(0, 64)
        : `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    const session = getOrCreateSession(sid);

    let text: string;
    try {
      text = await answerQuestion(
        question,
        {
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
        },
        {
          qcoreaiBase: qcoreaiBase(),
          model: body.model,
          temperature: body.temperature,
          // opus-4-8 отдаёт полноценный разбор (2-4 предложения + контекст) за
          // ~8-13с; 8000мс резал его на полуслове (abort) → GM-разбор/чат тренера
          // почти всегда падали в fallback на проде. 14с укладывается в клиентский
          // бюджет кнопки (15с).
          timeoutMs: 14000,
        },
      );
    } catch (err) {
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
  } catch (err) {
    capture(err);
    res.status(500).json({
      error: 'ask_failed',
      reason: upstreamErrorKind(err),
    });
  }
});

// ─── GET /sessions/:id ──────────────────────────────────────────────────
router.get('/sessions/:id', (req: Request, res: Response) => {
  const id = String(req.params.id ?? '').trim().slice(0, 64);
  if (!id) return res.status(400).json({ error: 'missing_id' });
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
router.post('/sessions/:id/clear', (req: Request, res: Response) => {
  const id = String(req.params.id ?? '').trim().slice(0, 64);
  if (!id) return res.status(400).json({ error: 'missing_id' });
  const had = sessions.delete(id);
  res.json({ sessionId: id, cleared: had });
});

// ─── POST /tts ──────────────────────────────────────────────────────────
// Body: { text: string, voiceId?: string }
// Returns: audio/mpeg stream (mp3)
router.post('/tts', async (req: Request, res: Response) => {
  const gate = ttsLimiter.check(clientIp(req));
  if (!gate.allowed) return tooMany(res, gate.retryAfterMs);
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: 'elevenlabs_not_configured',
      message:
        'ElevenLabs not configured — set ELEVENLABS_API_KEY environment variable.',
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

  const voiceId =
    typeof req.body?.voiceId === 'string' && req.body.voiceId.trim().length > 0
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
    const upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
      {
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
      },
    );

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => '');
      return res.status(upstream.status).json({
        error: 'elevenlabs_error',
        status: upstream.status,
        reason: 'upstream_error', // подробности — в логе, не в ответе
      });
    }

    const arrayBuf = await upstream.arrayBuffer();
    const buf = Buffer.from(arrayBuf);
    cacheSet(cacheKey, buf);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('X-Cache-Key', cacheKey);
    return res.send(buf);
  } catch (err) {
    capture(err);
    return res.status(502).json({
      error: 'elevenlabs_proxy_failed',
      reason: upstreamErrorKind(err),
    });
  }
});

// ─── Internal helper: generate TTS as a data URL (for /broadcast inline audio) ──
async function generateTtsDataUrl(text: string, voiceId: string): Promise<string | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return null;
  if (!text) return null;

  // Hard cap so we don't burn quota on giant comments — broadcasts are short anyway.
  const trimmed = text.length > 300 ? text.slice(0, 300) : text;

  const cacheKey = ttsCacheKey(voiceId, trimmed);
  const cached = cacheGet(cacheKey);
  if (cached) {
    return `data:audio/mpeg;base64,${cached.toString('base64')}`;
  }

  try {
    const upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
      {
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
      },
    );
    if (!upstream.ok) return null;
    const arrayBuf = await upstream.arrayBuffer();
    const buf = Buffer.from(arrayBuf);
    cacheSet(cacheKey, buf);
    return `data:audio/mpeg;base64,${buf.toString('base64')}`;
  } catch {
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
router.post('/broadcast', async (req: Request, res: Response) => {
  const gate = ttsLimiter.check(clientIp(req));
  if (!gate.allowed) return tooMany(res, gate.retryAfterMs);
  try {
    const body = (req.body ?? {}) as {
      gameId?: string;
      fen?: string;
      lastMove?: MoveInfo | string | null;
      eval?: EvalInfo | null;
      prevEval?: EvalInfo | null;
      depth?: number;
      isCheck?: boolean;
      isCapture?: boolean;
      isCastling?: boolean;
      isPromotion?: boolean;
      phase?: BuildCommentInput['phase'];
      moveNumber?: number;
      hostName?: string;
      llm?: boolean;
      tts?: boolean;
      voiceId?: string;
      model?: string;
      temperature?: number;
    };

    const gameId =
      typeof body.gameId === 'string' ? body.gameId.trim() : '';
    if (!gameId) {
      return res.status(400).json({ ok: false, error: 'missing_game_id' });
    }
    // Комментарий уходит зрителям чужого эфира и стоит настоящих денег: этот
    // путь дёргает LLM и синтез речи. Без доказательства владения стримом любой,
    // кто открыл ссылку зрителя, мог и говорить от лица ведущего, и тратить на
    // это чужой бюджет.
    const hostToken =
      (typeof req.headers['x-host-token'] === 'string' ? req.headers['x-host-token'] : '') ||
      (typeof (body as { hostToken?: unknown }).hostToken === 'string'
        ? ((body as { hostToken?: string }).hostToken as string)
        : '');
    if (isLiveGame(gameId) && !isStreamHostToken(gameId, hostToken)) {
      return res.status(403).json({ ok: false, error: 'not_the_host' });
    }
    if (!isLiveGame(gameId)) {
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
    let lastMove: MoveInfo | null = null;
    if (body.lastMove && typeof body.lastMove === 'object') {
      lastMove = body.lastMove as MoveInfo;
    } else if (typeof body.lastMove === 'string' && body.lastMove.trim()) {
      lastMove = { san: body.lastMove.trim() } as MoveInfo;
    }

    const input: BuildCommentInput = {
      fen: body.fen,
      lastMove,
      eval: (body.eval ?? null) as EvalInfo | null,
      prevEval: (body.prevEval ?? null) as EvalInfo | null,
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
    let source: 'llm' | 'fallback' = 'fallback';
    let text = fallback;

    if (body.llm !== false) {
      try {
        const llmText = await buildCommentLLM(input, {
          qcoreaiBase: qcoreaiBase(),
          model: body.model,
          temperature: body.temperature,
          timeoutMs: 3500, // broadcasts must not stall the move stream
        });
        if (llmText && llmText !== fallback) {
          text = llmText;
          source = 'llm';
        }
      } catch {
        // keep fallback
      }
    }

    // Hard cap to spectator voice text length.
    if (text.length > 300) text = text.slice(0, 300);

    // 2. Optionally synthesise TTS as a data URL — best-effort, never blocks.
    let audioUrl: string | undefined;
    if (body.tts !== false && process.env.ELEVENLABS_API_KEY) {
      const voiceId =
        typeof body.voiceId === 'string' && body.voiceId.trim().length > 0
          ? body.voiceId.trim()
          : DEFAULT_VOICE_ID;
      const url = await generateTtsDataUrl(text, voiceId);
      if (url) audioUrl = url;
    }

    // 3. Push to the spectator SSE stream via the in-process broadcast endpoint.
    //    We call our own /api/cyberchess-spectator/voice/:gameId so the spectator
    //    router stays the single source of truth for SSE fan-out + rate limiting.
    //    PORT comes from index.ts (defaults to 4001); we fall back to 4001.
    const port = process.env.PORT ?? '4001';
    const internalUrl = `http://127.0.0.1:${port}/api/cyberchess-spectator/voice/${encodeURIComponent(gameId)}`;
    let viewers: number | undefined;
    try {
      const upstream = await fetch(internalUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, audioUrl, fromHost: true }),
      });
      if (upstream.ok) {
        const j = (await upstream.json().catch(() => null)) as
          | { ok?: boolean; viewers?: number }
          | null;
        viewers = j?.viewers;
      } else if (upstream.status === 429) {
        return res.status(429).json({
          ok: false,
          error: 'spectator_rate_limited',
          text,
          source,
        });
      } else if (upstream.status === 404) {
        return res
          .status(404)
          .json({ ok: false, error: 'game_not_live', text, source });
      }
    } catch (err) {
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
  } catch (err) {
    capture(err);
    res.status(500).json({
      ok: false,
      error: 'broadcast_failed',
      reason: upstreamErrorKind(err),
    });
  }
});

// ─── GET /voices ────────────────────────────────────────────────────────
router.get('/voices', (_req: Request, res: Response) => {
  res.json({
    voices: MOCK_VOICES,
    defaultVoiceId: DEFAULT_VOICE_ID,
    models: MOCK_MODELS,
  });
});

export default router;
