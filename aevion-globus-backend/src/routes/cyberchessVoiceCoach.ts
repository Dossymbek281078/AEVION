/**
 * cyberchessVoiceCoach.ts
 *
 * Express router for CyberChess AI Voice Coach v3 (LLM-backed).
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
 *   GET  /voices             — static voice catalogue used by the client dropdown.
 *
 * Required env vars:
 *   ELEVENLABS_API_KEY  — secret key from elevenlabs.io (only for /tts).
 *   QCOREAI_BASE        — optional. Fully-qualified base URL of QCoreAI if this
 *                         service runs outside the monorepo. Defaults to
 *                         '/api/qcoreai' (same-origin via the AEVION gateway).
 *
 * Mount example (in app entrypoint):
 *   import cyberchessVoiceCoachRouter from './routes/cyberchessVoiceCoach';
 *   app.use('/api/cyberchess-voice-coach', cyberchessVoiceCoachRouter);
 */

import { Router, Request, Response } from 'express';
import { createHash } from 'crypto';
import buildComment, {
  BuildCommentInput,
  MoveInfo,
  EvalInfo,
  ChatMessage,
  buildCommentLLM,
  answerQuestion,
} from '../lib/voiceCoachPrompt';

const router = Router();

// ─── QCoreAI base URL ────────────────────────────────────────────────────
// Same-origin default. Override via env when running this service standalone.
function qcoreaiBase(): string {
  return (process.env.QCOREAI_BASE ?? '/api/qcoreai').replace(/\/+$/, '');
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

// ─── POST /comment ──────────────────────────────────────────────────────
// Body: BuildCommentInput + optional { model?, temperature?, llm?: boolean }
// Tries LLM via QCoreAI first; on any failure → rule-based fallback.
// Returns: { text: string, source: 'llm' | 'fallback' }
router.post('/comment', async (req: Request, res: Response) => {
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
        timeoutMs: 4000,
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
    res.status(500).json({
      error: 'comment_generation_failed',
      message: (err as Error)?.message ?? 'unknown error',
    });
  }
});

// ─── POST /ask ──────────────────────────────────────────────────────────
// Body: { question, fen?, lastMove?, history?, sessionId?, eval?, userSide?,
//         model?, temperature? }
// Returns: { text: string, sessionId: string }
router.post('/ask', async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as {
      question?: string;
      fen?: string;
      lastMove?: string | MoveInfo | null;
      history?: Array<string | MoveInfo>;
      sessionId?: string;
      eval?: EvalInfo | null;
      userSide?: 'w' | 'b';
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
        },
        {
          qcoreaiBase: qcoreaiBase(),
          model: body.model,
          temperature: body.temperature,
          timeoutMs: 8000,
        },
      );
    } catch (err) {
      return res.status(502).json({
        error: 'llm_unavailable',
        message: (err as Error)?.message ?? 'QCoreAI is not reachable',
        sessionId: sid,
      });
    }

    appendSession(session, 'user', question);
    appendSession(session, 'assistant', text);

    res.json({ text, sessionId: sid, messageCount: session.messages.length });
  } catch (err) {
    res.status(500).json({
      error: 'ask_failed',
      message: (err as Error)?.message ?? 'unknown error',
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
        detail: errText.slice(0, 500),
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
    return res.status(502).json({
      error: 'elevenlabs_proxy_failed',
      message: (err as Error)?.message ?? 'unknown error',
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
