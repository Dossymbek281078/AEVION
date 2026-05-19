/**
 * CyberChess Spectator — SSE live game registry + Chat + Replay archive + VoiceCoach broadcast
 *
 * In-memory registry of live games + SSE streams so spectators can watch
 * any published game in real-time. No DB, no external deps.
 *
 * Plus: when host publishes a finished game (with `result`), we snapshot the
 * full game (history, eval-cp series, optional FEN snapshots) into a bounded
 * LRU replay archive so viewers can rewatch finished games via /replays/*.
 *
 * NEW: voice broadcast — `POST /voice/:gameId` sends an SSE "voice" event to
 * all subscribers of the given live game with `{text, audioUrl?, fromHost?}`.
 * Designed for AI VoiceCoach commentary on every move.
 *
 * Endpoints:
 *   POST   /publish           — host publishes/updates game state
 *   DELETE /:gameId           — host ends the stream
 *   GET    /list              — directory of live games for the spectator hub
 *   GET    /:gameId           — SSE stream of game updates (state + chat + voice events)
 *   POST   /chat/:gameId      — post a chat message
 *   GET    /chat/:gameId      — recent chat messages (initial load for joiners)
 *   POST   /voice/:gameId     — broadcast AI VoiceCoach comment (text + optional audio URL)
 *   GET    /replays           — list of finished games (LRU archive)
 *   GET    /replays/:gameId   — full ReplayGame payload
 *   DELETE /replays/:gameId   — soft delete a replay (TODO: gate with admin)
 */

import { Router, type Request, type Response } from "express";
import crypto from "crypto";

// ---------- Types ----------

type LiveGame = {
  gameId: string;
  hostName?: string;
  fen: string;
  hist: string[];
  fenSnapshots?: string[]; // optional per-ply FEN trail if host pushes it
  evalCpHistory?: number[]; // optional per-ply eval cp trail
  evalCp?: number;
  evalMate?: number;
  lastSan?: string;
  whiteToMove: boolean;
  result?: string;
  aiLevel?: string;
  rating?: number;
  startedAt: number;
  updatedAt: number;
};

type PublishBody = {
  gameId?: string;
  hostName?: string;
  fen: string;
  hist: string[];
  fenSnapshots?: string[];
  evalCpHistory?: number[];
  evalCp?: number;
  evalMate?: number;
  lastSan?: string;
  result?: string;
  aiLevel?: string;
  rating?: number;
};

type ChatMessage = {
  id: string;
  author: string;
  text: string;
  ts: number;
  isHost?: boolean;
};

type ChatBody = {
  author?: string;
  text?: string;
  isHost?: boolean;
};

type VoiceBody = {
  text?: string;
  audioUrl?: string;
  fromHost?: boolean;
};

type VoiceMessage = {
  id: string;
  text: string;
  audioUrl?: string;
  fromHost?: boolean;
  ts: number;
};

type ReplayGame = {
  gameId: string;
  hostName?: string;
  hist: string[];
  fenSnapshots: string[];
  evalCpHistory: number[];
  lastSan?: string;
  aiLevel?: string;
  rating?: number;
  result: string;
  startedAt: number;
  endedAt: number;
  duration: number; // ms
  deletedAt?: number; // soft-delete timestamp
};

// ---------- Storage ----------

const liveGames = new Map<string, LiveGame>();
const subscribers = new Map<string, Set<Response>>();
const rateBucket = new Map<string, { count: number; resetAt: number }>();

// Chat storage: per gameId — ring buffer of last MAX_CHAT_PER_GAME messages
const chatMessages = new Map<string, ChatMessage[]>();
// Chat rate limiting: per (ip + gameId) — 10 msgs / minute
const chatRateBucket = new Map<string, { count: number; resetAt: number }>();

// Voice rate limiting: per gameId — VOICE_RATE_MAX broadcasts / minute
const voiceRateBucket = new Map<string, { count: number; resetAt: number }>();

// LRU archive of finished games. Map preserves insertion order, so iterating
// .keys() yields oldest-first; we evict from the front when over capacity.
const replayArchive = new Map<string, ReplayGame>();
const MAX_REPLAYS = 50;

const GAME_ID_RE = /^[a-zA-Z0-9-]{6,64}$/;
const MAX_HOST_NAME = 32;
const MAX_AUTHOR_LEN = 32;
const MAX_CHAT_TEXT_LEN = 200;
const MAX_CHAT_PER_GAME = 100;
const MAX_VOICE_TEXT_LEN = 300;
const MAX_VOICE_AUDIO_URL_LEN = 2048;
const MAX_HIST_LEN = 1000;
const MAX_FEN_LEN = 128;
const HEARTBEAT_MS = 25_000;
const STALE_GAME_MS = 60 * 60 * 1_000; // 60 min
const CLEANUP_INTERVAL_MS = 5 * 60 * 1_000; // 5 min
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 60;
const CHAT_RATE_WINDOW_MS = 60_000;
const CHAT_RATE_MAX = 10;
const VOICE_RATE_WINDOW_MS = 60_000;
const VOICE_RATE_MAX = 6; // 6 broadcasts/min per gameId — enough for blitz commentary + heartbeat

// Simple banned-word filter — replace match with ***
const BANNED_WORDS = ["spam", "scam", "хуй", "пизда"];
const BANNED_RE = new RegExp(
  "\\b(" +
    BANNED_WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") +
    ")\\b",
  "giu",
);

// ---------- Helpers ----------

function deriveWhiteToMove(fen: string): boolean {
  // FEN field 2 = side to move ("w" | "b")
  const parts = fen.trim().split(/\s+/);
  return parts[1] !== "b";
}

function validGameId(id: string): boolean {
  return typeof id === "string" && GAME_ID_RE.test(id);
}

function sanitizeHostName(name: unknown): string | undefined {
  if (typeof name !== "string") return undefined;
  const trimmed = name.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, MAX_HOST_NAME);
}

function sanitizeHist(hist: unknown): string[] | null {
  if (!Array.isArray(hist)) return null;
  if (hist.length > MAX_HIST_LEN) return null;
  const out: string[] = [];
  for (const m of hist) {
    if (typeof m !== "string") return null;
    out.push(m.slice(0, 16));
  }
  return out;
}

function sanitizeFenSnapshots(snaps: unknown): string[] | null {
  if (snaps === undefined) return null;
  if (!Array.isArray(snaps)) return null;
  if (snaps.length > MAX_HIST_LEN + 1) return null;
  const out: string[] = [];
  for (const f of snaps) {
    if (typeof f !== "string") return null;
    if (f.length > MAX_FEN_LEN) return null;
    out.push(f);
  }
  return out;
}

function sanitizeEvalHistory(evals: unknown): number[] | null {
  if (evals === undefined) return null;
  if (!Array.isArray(evals)) return null;
  if (evals.length > MAX_HIST_LEN + 1) return null;
  const out: number[] = [];
  for (const v of evals) {
    if (typeof v !== "number" || !Number.isFinite(v)) {
      // non-numeric => neutral filler to preserve indexing
      out.push(0);
    } else {
      // clamp to sane bounds (centipawns)
      out.push(Math.max(-100_000, Math.min(100_000, v)));
    }
  }
  return out;
}

function stripHtml(s: string): string {
  // Strip HTML tags + collapse whitespace runs to keep things sane.
  return s.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function applyBannedFilter(s: string): string {
  return s.replace(BANNED_RE, (m) => "*".repeat(m.length));
}

function sanitizeChatAuthor(name: unknown): string | null {
  if (typeof name !== "string") return null;
  const trimmed = stripHtml(name).slice(0, MAX_AUTHOR_LEN);
  if (!trimmed) return null;
  return trimmed;
}

function sanitizeChatText(text: unknown): string | null {
  if (typeof text !== "string") return null;
  let t = stripHtml(text);
  if (!t) return null;
  if (t.length > MAX_CHAT_TEXT_LEN) t = t.slice(0, MAX_CHAT_TEXT_LEN);
  t = applyBannedFilter(t);
  return t;
}

function sanitizeVoiceText(text: unknown): string | null {
  if (typeof text !== "string") return null;
  let t = stripHtml(text);
  if (!t) return null;
  if (t.length > MAX_VOICE_TEXT_LEN) t = t.slice(0, MAX_VOICE_TEXT_LEN);
  t = applyBannedFilter(t);
  return t;
}

function sanitizeVoiceAudioUrl(url: unknown): string | undefined {
  if (typeof url !== "string") return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > MAX_VOICE_AUDIO_URL_LEN) return undefined;
  // Allow http(s) URLs and data: URLs (for inline TTS audio).
  if (!/^(https?:\/\/|data:audio\/)/i.test(trimmed)) return undefined;
  return trimmed;
}

function clientIp(req: Request): string {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) {
    return xff.split(",")[0].trim();
  }
  return req.ip || req.socket.remoteAddress || "unknown";
}

function rateLimitOk(ip: string): boolean {
  const now = Date.now();
  const slot = rateBucket.get(ip);
  if (!slot || slot.resetAt <= now) {
    rateBucket.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (slot.count >= RATE_MAX) return false;
  slot.count += 1;
  return true;
}

function chatRateLimitOk(ip: string, gameId: string): boolean {
  const key = `${ip}|${gameId}`;
  const now = Date.now();
  const slot = chatRateBucket.get(key);
  if (!slot || slot.resetAt <= now) {
    chatRateBucket.set(key, { count: 1, resetAt: now + CHAT_RATE_WINDOW_MS });
    return true;
  }
  if (slot.count >= CHAT_RATE_MAX) return false;
  slot.count += 1;
  return true;
}

function voiceRateLimitOk(gameId: string): boolean {
  const now = Date.now();
  const slot = voiceRateBucket.get(gameId);
  if (!slot || slot.resetAt <= now) {
    voiceRateBucket.set(gameId, { count: 1, resetAt: now + VOICE_RATE_WINDOW_MS });
    return true;
  }
  if (slot.count >= VOICE_RATE_MAX) return false;
  slot.count += 1;
  return true;
}

function pushSse(res: Response, payload: unknown, event?: string): void {
  try {
    if (event) res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  } catch {
    // socket dead — handled by close
  }
}

function broadcast(gameId: string, payload: unknown, event?: string): void {
  const subs = subscribers.get(gameId);
  if (!subs || subs.size === 0) return;
  for (const res of subs) {
    pushSse(res, payload, event);
  }
}

function viewerCount(gameId: string): number {
  return subscribers.get(gameId)?.size ?? 0;
}

function appendChatMessage(gameId: string, msg: ChatMessage): void {
  let buf = chatMessages.get(gameId);
  if (!buf) {
    buf = [];
    chatMessages.set(gameId, buf);
  }
  buf.push(msg);
  if (buf.length > MAX_CHAT_PER_GAME) {
    buf.splice(0, buf.length - MAX_CHAT_PER_GAME);
  }
}

function dropChatForGame(gameId: string): void {
  chatMessages.delete(gameId);
  // Sweep matching chat-rate bucket keys for this game
  const suffix = `|${gameId}`;
  for (const key of chatRateBucket.keys()) {
    if (key.endsWith(suffix)) chatRateBucket.delete(key);
  }
  voiceRateBucket.delete(gameId);
}

/**
 * Try to load chess.js (peer-installed, optional). If present, we can rebuild
 * a FEN snapshot trail from a SAN history when the host did not supply one.
 * If not installed, gracefully fall back to a single-FEN-only snapshot.
 */
function tryLoadChessJs(): null | { Chess: new () => unknown } {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    const mod = require("chess.js");
    if (mod && typeof mod.Chess === "function") return mod;
    if (mod && mod.default && typeof mod.default.Chess === "function") return mod.default;
  } catch {
    /* not installed — fine */
  }
  return null;
}

function rebuildFenSnapshots(hist: string[], finalFen: string): string[] {
  // If chess.js is available, replay every SAN move and snapshot per-ply.
  const chessMod = tryLoadChessJs();
  if (chessMod) {
    try {
      const ChessCtor = chessMod.Chess as unknown as new () => {
        fen: () => string;
        move: (san: string, opts?: { sloppy?: boolean }) => unknown;
      };
      const game = new ChessCtor();
      const snaps: string[] = [game.fen()];
      for (const san of hist) {
        const moved = game.move(san, { sloppy: true });
        if (!moved) {
          // bail out — produce best-effort partial trail, then final FEN
          snaps.push(finalFen);
          return snaps;
        }
        snaps.push(game.fen());
      }
      return snaps;
    } catch {
      /* fall through to single-fen fallback */
    }
  }
  // Fallback: we only know the final FEN. Return just the final position;
  // the viewer can treat single-element trails as "no per-ply data".
  return [finalFen];
}

function archiveFinishedGame(g: LiveGame, endedAt: number): void {
  const fenSnapshots: string[] =
    g.fenSnapshots && g.fenSnapshots.length > 0
      ? g.fenSnapshots.slice()
      : rebuildFenSnapshots(g.hist, g.fen);

  const evalCpHistory: number[] =
    g.evalCpHistory && g.evalCpHistory.length > 0
      ? g.evalCpHistory.slice()
      : g.hist.map(() => 0);

  const replay: ReplayGame = {
    gameId: g.gameId,
    hostName: g.hostName,
    hist: g.hist.slice(),
    fenSnapshots,
    evalCpHistory,
    lastSan: g.lastSan,
    aiLevel: g.aiLevel,
    rating: g.rating,
    result: g.result ?? "*",
    startedAt: g.startedAt,
    endedAt,
    duration: Math.max(0, endedAt - g.startedAt),
  };

  // LRU touch: delete-then-set so the entry moves to the tail (most-recent).
  if (replayArchive.has(g.gameId)) replayArchive.delete(g.gameId);
  replayArchive.set(g.gameId, replay);

  // Evict oldest while over capacity.
  while (replayArchive.size > MAX_REPLAYS) {
    const oldestKey = replayArchive.keys().next().value as string | undefined;
    if (!oldestKey) break;
    replayArchive.delete(oldestKey);
  }
}

// ---------- Public getter for cross-router integration ----------
// Used by cyberchessVoiceCoach.ts to validate that a gameId refers to a
// currently-live game before broadcasting AI commentary into its SSE stream.
export function isLiveGame(gameId: string): boolean {
  if (!validGameId(gameId)) return false;
  return liveGames.has(gameId);
}

// ---------- Cleanup loop ----------

const cleanupTimer = setInterval(() => {
  const now = Date.now();

  // Stale games — auto-end + notify subscribers
  for (const [id, g] of liveGames) {
    if (now - g.updatedAt > STALE_GAME_MS) {
      broadcast(id, { gameId: id, reason: "stale" }, "ended");
      const subs = subscribers.get(id);
      if (subs) {
        for (const res of subs) {
          try {
            res.end();
          } catch {
            /* ignore */
          }
        }
        subscribers.delete(id);
      }
      liveGames.delete(id);
      dropChatForGame(id);
    }
  }

  // Rate bucket sweep
  for (const [ip, slot] of rateBucket) {
    if (slot.resetAt <= now) rateBucket.delete(ip);
  }
  for (const [key, slot] of chatRateBucket) {
    if (slot.resetAt <= now) chatRateBucket.delete(key);
  }
  for (const [gid, slot] of voiceRateBucket) {
    if (slot.resetAt <= now) voiceRateBucket.delete(gid);
  }
}, CLEANUP_INTERVAL_MS);

// Don't block Node exit on the cleanup timer in tests/scripts.
if (typeof cleanupTimer.unref === "function") cleanupTimer.unref();

// ---------- Router ----------

const router = Router();

/**
 * POST /publish
 * Host upserts current state of a live game.
 */
router.post("/publish", (req: Request, res: Response) => {
  const ip = clientIp(req);
  if (!rateLimitOk(ip)) {
    res.status(429).json({ ok: false, error: "rate_limited" });
    return;
  }

  const body = (req.body || {}) as PublishBody;

  if (!body.fen || typeof body.fen !== "string" || body.fen.length > MAX_FEN_LEN) {
    res.status(400).json({ ok: false, error: "bad_fen" });
    return;
  }

  const hist = sanitizeHist(body.hist);
  if (hist === null) {
    res.status(400).json({ ok: false, error: "bad_hist" });
    return;
  }

  // Optional series — null = "client didn't send"; keep prior if any.
  const fenSnapshots = sanitizeFenSnapshots(body.fenSnapshots);
  const evalCpHistory = sanitizeEvalHistory(body.evalCpHistory);

  let gameId = body.gameId;
  if (gameId !== undefined) {
    if (!validGameId(gameId)) {
      res.status(400).json({ ok: false, error: "bad_game_id" });
      return;
    }
  } else {
    gameId = crypto.randomUUID();
  }

  const now = Date.now();
  const existing = liveGames.get(gameId);

  const game: LiveGame = {
    gameId,
    hostName: sanitizeHostName(body.hostName) ?? existing?.hostName,
    fen: body.fen,
    hist,
    fenSnapshots: fenSnapshots ?? existing?.fenSnapshots,
    evalCpHistory: evalCpHistory ?? existing?.evalCpHistory,
    evalCp: typeof body.evalCp === "number" ? body.evalCp : undefined,
    evalMate: typeof body.evalMate === "number" ? body.evalMate : undefined,
    lastSan:
      typeof body.lastSan === "string" ? body.lastSan.slice(0, 16) : undefined,
    whiteToMove: deriveWhiteToMove(body.fen),
    result: typeof body.result === "string" ? body.result.slice(0, 32) : undefined,
    aiLevel:
      typeof body.aiLevel === "string" ? body.aiLevel.slice(0, 32) : existing?.aiLevel,
    rating: typeof body.rating === "number" ? body.rating : existing?.rating,
    startedAt: existing?.startedAt ?? now,
    updatedAt: now,
  };

  liveGames.set(gameId, game);

  // Push update to subscribers
  broadcast(gameId, game);

  // If host marked partita as finished — archive into replay, notify, drop.
  if (game.result) {
    archiveFinishedGame(game, now);

    broadcast(gameId, { gameId, reason: "finished", result: game.result }, "ended");
    const subs = subscribers.get(gameId);
    if (subs) {
      for (const r of subs) {
        try {
          r.end();
        } catch {
          /* ignore */
        }
      }
      subscribers.delete(gameId);
    }
    liveGames.delete(gameId);
    dropChatForGame(gameId);
  }

  res.json({
    ok: true,
    gameId,
    viewerUrl: `/cyberchess/spectator/${gameId}`,
    replayUrl: game.result ? `/cyberchess/replays/${gameId}` : undefined,
  });
});

/**
 * DELETE /:gameId
 * Host stops streaming. Notify subscribers and remove from registry.
 * NOTE: must be declared BEFORE the catch-all GET /:gameId AND we register
 * /replays/* routes earlier so the `:gameId` regex won't shadow them.
 */
router.delete("/:gameId", (req: Request, res: Response) => {
  const gameId = String(req.params.gameId ?? "");
  // Special-case: "replays" is a sibling resource, not a game id.
  if (gameId === "replays") {
    res.status(400).json({ ok: false, error: "bad_game_id" });
    return;
  }
  if (!validGameId(gameId)) {
    res.status(400).json({ ok: false, error: "bad_game_id" });
    return;
  }

  const existed = liveGames.delete(gameId);

  broadcast(gameId, { gameId, reason: "host_ended" }, "ended");
  const subs = subscribers.get(gameId);
  if (subs) {
    for (const r of subs) {
      try {
        r.end();
      } catch {
        /* ignore */
      }
    }
    subscribers.delete(gameId);
  }

  dropChatForGame(gameId);

  res.json({ ok: true, removed: existed });
});

/**
 * GET /list
 * Directory of currently live games, sorted by viewers desc, updatedAt desc.
 */
router.get("/list", (_req: Request, res: Response) => {
  const now = Date.now();
  const items = Array.from(liveGames.values()).map((g) => ({
    gameId: g.gameId,
    hostName: g.hostName,
    fen: g.fen,
    histLength: g.hist.length,
    lastSan: g.lastSan,
    aiLevel: g.aiLevel,
    rating: g.rating,
    viewers: viewerCount(g.gameId),
    ageSec: Math.max(0, Math.floor((now - g.startedAt) / 1000)),
    whiteToMove: g.whiteToMove,
  }));

  items.sort((a, b) => {
    if (b.viewers !== a.viewers) return b.viewers - a.viewers;
    const ga = liveGames.get(a.gameId)?.updatedAt ?? 0;
    const gb = liveGames.get(b.gameId)?.updatedAt ?? 0;
    return gb - ga;
  });

  res.json({ ok: true, games: items.slice(0, 50) });
});

/**
 * GET /replays?limit=20
 * List of finished games in the LRU archive, most-recent first.
 * Soft-deleted entries are filtered out.
 *
 * IMPORTANT: must be defined BEFORE /:gameId so Express does not match
 * /:gameId with `gameId = "replays"`.
 */
router.get("/replays", (req: Request, res: Response) => {
  const limitRaw = Number(req.query.limit);
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 100
      ? Math.floor(limitRaw)
      : 20;

  const all: ReplayGame[] = [];
  for (const r of replayArchive.values()) {
    if (r.deletedAt) continue;
    all.push(r);
  }
  // Insertion order is oldest -> newest; reverse for latest-first.
  all.reverse();

  const items = all.slice(0, limit).map((r) => ({
    gameId: r.gameId,
    hostName: r.hostName,
    aiLevel: r.aiLevel,
    rating: r.rating,
    result: r.result,
    duration: r.duration,
    plyCount: r.hist.length,
    endedAt: r.endedAt,
    startedAt: r.startedAt,
  }));

  res.json({ ok: true, replays: items, total: all.length });
});

/**
 * GET /replays/:gameId
 * Full ReplayGame payload for the viewer.
 */
router.get("/replays/:gameId", (req: Request, res: Response) => {
  const gameId = String(req.params.gameId ?? "");
  if (!validGameId(gameId)) {
    res.status(400).json({ ok: false, error: "bad_game_id" });
    return;
  }

  const r = replayArchive.get(gameId);
  if (!r || r.deletedAt) {
    res.status(404).json({ ok: false, error: "not_found" });
    return;
  }

  res.json({ ok: true, replay: r });
});

/**
 * DELETE /replays/:gameId
 * Soft-delete a replay.
 * TODO(auth): currently open — gate with admin role once spectator auth lands.
 * We only mark it deleted; the entry stays in memory for audit/diagnostics.
 */
router.delete("/replays/:gameId", (req: Request, res: Response) => {
  const gameId = String(req.params.gameId ?? "");
  if (!validGameId(gameId)) {
    res.status(400).json({ ok: false, error: "bad_game_id" });
    return;
  }
  const r = replayArchive.get(gameId);
  if (!r) {
    res.status(404).json({ ok: false, error: "not_found" });
    return;
  }
  if (r.deletedAt) {
    res.json({ ok: true, alreadyDeleted: true });
    return;
  }
  r.deletedAt = Date.now();
  res.json({ ok: true, gameId, deletedAt: r.deletedAt });
});

/**
 * POST /chat/:gameId
 * Post a chat message into a live game's chat. Broadcast via SSE "chat" event.
 */
router.post("/chat/:gameId", (req: Request, res: Response) => {
  const gameId = String(req.params.gameId ?? "");
  if (!validGameId(gameId)) {
    res.status(400).json({ ok: false, error: "bad_game_id" });
    return;
  }

  if (!liveGames.has(gameId)) {
    res.status(404).json({ ok: false, error: "not_found" });
    return;
  }

  const ip = clientIp(req);
  if (!chatRateLimitOk(ip, gameId)) {
    res.status(429).json({ ok: false, error: "rate_limited" });
    return;
  }

  const body = (req.body || {}) as ChatBody;

  const author = sanitizeChatAuthor(body.author);
  if (!author) {
    res.status(400).json({ ok: false, error: "bad_author" });
    return;
  }

  const text = sanitizeChatText(body.text);
  if (!text) {
    res.status(400).json({ ok: false, error: "bad_text" });
    return;
  }

  const msg: ChatMessage = {
    id: crypto.randomUUID(),
    author,
    text,
    ts: Date.now(),
    isHost: body.isHost === true ? true : undefined,
  };

  appendChatMessage(gameId, msg);
  broadcast(gameId, msg, "chat");

  res.json({ ok: true, message: msg });
});

/**
 * GET /chat/:gameId?limit=50
 * Recent messages — for initial load when joining the chat.
 */
router.get("/chat/:gameId", (req: Request, res: Response) => {
  const gameId = String(req.params.gameId ?? "");
  if (!validGameId(gameId)) {
    res.status(400).json({ ok: false, error: "bad_game_id" });
    return;
  }

  let limit = 50;
  const raw = req.query.limit;
  if (typeof raw === "string") {
    const parsed = parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      limit = Math.min(parsed, MAX_CHAT_PER_GAME);
    }
  }

  const buf = chatMessages.get(gameId) ?? [];
  const slice = buf.slice(Math.max(0, buf.length - limit));

  res.json({ ok: true, messages: slice });
});

/**
 * POST /voice/:gameId
 * Broadcast an AI VoiceCoach comment to all spectators via SSE "voice" event.
 * Body: { text, audioUrl?, fromHost? }
 *
 * Rate-limited to VOICE_RATE_MAX (6) broadcasts/min per gameId — enough for
 * commentary on every blitz move + heartbeat without flooding viewers.
 *
 * Called internally by /api/cyberchess-voice-coach/broadcast (after the LLM
 * comment + optional TTS audio are produced). Public endpoint is fine for MVP
 * because we validate the gameId is a currently-live published game.
 */
router.post("/voice/:gameId", (req: Request, res: Response) => {
  const gameId = String(req.params.gameId ?? "");
  if (!validGameId(gameId)) {
    res.status(400).json({ ok: false, error: "bad_game_id" });
    return;
  }

  if (!liveGames.has(gameId)) {
    res.status(404).json({ ok: false, error: "not_found" });
    return;
  }

  if (!voiceRateLimitOk(gameId)) {
    res.status(429).json({ ok: false, error: "rate_limited" });
    return;
  }

  const body = (req.body || {}) as VoiceBody;

  const text = sanitizeVoiceText(body.text);
  if (!text) {
    res.status(400).json({ ok: false, error: "bad_text" });
    return;
  }

  const audioUrl = sanitizeVoiceAudioUrl(body.audioUrl);

  const msg: VoiceMessage = {
    id: crypto.randomUUID(),
    text,
    audioUrl,
    fromHost: body.fromHost === true ? true : undefined,
    ts: Date.now(),
  };

  broadcast(gameId, msg, "voice");

  res.json({ ok: true, message: msg, viewers: viewerCount(gameId) });
});

/**
 * GET /:gameId
 * Server-Sent Events stream of game updates (and chat events).
 * NOTE: This catch-all path param must stay AFTER the /list, /replays, /chat
 * routes above so Express does not shadow them.
 */
router.get("/:gameId", (req: Request, res: Response) => {
  const gameId = String(req.params.gameId);
  if (!validGameId(gameId)) {
    res.status(400).json({ ok: false, error: "bad_game_id" });
    return;
  }

  const game = liveGames.get(gameId);
  if (!game) {
    res.status(404).json({ ok: false, error: "not_found" });
    return;
  }

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  // CORS — same-origin (Vercel/Railway). Echo origin if present.
  const origin = req.headers.origin;
  if (typeof origin === "string" && origin.length > 0) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
  }
  res.flushHeaders?.();

  // Register subscriber
  let subs = subscribers.get(gameId);
  if (!subs) {
    subs = new Set();
    subscribers.set(gameId, subs);
  }
  subs.add(res);

  // Initial state
  pushSse(res, game);

  // Heartbeat
  const heartbeat = setInterval(() => {
    try {
      res.write(`event: ping\ndata: {}\n\n`);
    } catch {
      /* ignore */
    }
  }, HEARTBEAT_MS);
  if (typeof heartbeat.unref === "function") heartbeat.unref();

  const cleanup = () => {
    clearInterval(heartbeat);
    const set = subscribers.get(gameId);
    if (set) {
      set.delete(res);
      if (set.size === 0) subscribers.delete(gameId);
    }
  };

  req.on("close", cleanup);
  req.on("aborted", cleanup);
  res.on("close", cleanup);
});

export default router;

// Exported for tests/diagnostics.
export const _internal = {
  liveGames,
  subscribers,
  rateBucket,
  chatMessages,
  chatRateBucket,
  voiceRateBucket,
  replayArchive,
};
