/**
 * cyberchessVoiceCoach.ts
 *
 * Express router for CyberChess AI Voice Coach v2.
 *
 * Endpoints:
 *   POST /comment      — build a Russian, 1-2 sentence comment from board state
 *   POST /tts          — proxy text-to-speech request to ElevenLabs, return audio/mpeg
 *   GET  /voices       — mock list of available voices
 *
 * Required env vars (only for /tts):
 *   ELEVENLABS_API_KEY — secret key from elevenlabs.io
 *
 * Mount example (in app entrypoint):
 *   import cyberchessVoiceCoachRouter from './routes/cyberchessVoiceCoach';
 *   app.use('/api/cyberchess-voice-coach', cyberchessVoiceCoachRouter);
 */

import { Router, Request, Response } from 'express';
import buildComment, {
  BuildCommentInput,
  MoveInfo,
  EvalInfo,
} from '../lib/voiceCoachPrompt';

const router = Router();

// ─── In-memory TTS cache ─────────────────────────────────────────────────
// Keyed by `${voiceId}::${text}`. Stores raw mp3 buffer.
const ttsCache = new Map<string, Buffer>();
const MAX_CACHE_ENTRIES = 200;

function cacheGet(key: string): Buffer | undefined {
  return ttsCache.get(key);
}

function cacheSet(key: string, buf: Buffer): void {
  if (ttsCache.size >= MAX_CACHE_ENTRIES) {
    // crude FIFO eviction: drop oldest
    const firstKey = ttsCache.keys().next().value;
    if (firstKey !== undefined) ttsCache.delete(firstKey);
  }
  ttsCache.set(key, buf);
}

// ─── Default voice (Rachel — calm female, English/multilingual) ─────────
// Other defaults you can swap in:
//   const DEFAULT_VOICE_ID = 'AZnzlk1XvdvUeBnXmlld'; // Domi — energetic
//   const DEFAULT_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'; // Bella — soft
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel

// ─── Mock voice catalogue (returned from GET /voices) ───────────────────
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

// ────────────────────────────────────────────────────────────────────────
// Prompt-engineering helper. Exposed at module level so callers (tests,
// other routers) can reuse the exact text used for TTS without a roundtrip.
// In the MVP this is a thin wrapper over the rule-based template builder
// in lib/voiceCoachPrompt. Later this can be swapped for an LLM call.
// ────────────────────────────────────────────────────────────────────────
export function generateCommentText(input: BuildCommentInput): string {
  return buildComment(input);
}

// ─── POST /comment ──────────────────────────────────────────────────────
// Body: { fen, lastMove, eval, prevEval, depth, isCheck, isCapture,
//         isCastling, isPromotion, phase, moveNumber }
// Returns: { text: string }
router.post('/comment', (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as BuildCommentInput;
    const text = generateCommentText({
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
    });
    res.json({ text });
  } catch (err) {
    res.status(500).json({
      error: 'comment_generation_failed',
      message: (err as Error)?.message ?? 'unknown error',
    });
  }
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

  const cacheKey = `${voiceId}::${text}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('X-Cache', 'HIT');
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
    return res.send(buf);
  } catch (err) {
    return res.status(502).json({
      error: 'elevenlabs_proxy_failed',
      message: (err as Error)?.message ?? 'unknown error',
    });
  }
});

// ─── GET /voices ────────────────────────────────────────────────────────
// Returns the static, in-memory voice catalogue used by the client dropdown.
router.get('/voices', (_req: Request, res: Response) => {
  res.json({ voices: MOCK_VOICES, defaultVoiceId: DEFAULT_VOICE_ID });
});

export default router;
