/**
 * CyberChess Spectator — Server-Sent Events live game registry
 *
 * In-memory registry of live games + SSE streams so spectators can watch
 * any published game in real-time. No DB, no external deps.
 *
 * Endpoints:
 *   POST   /publish      — host publishes/updates game state
 *   DELETE /:gameId      — host ends the stream
 *   GET    /list         — directory of live games for the spectator hub
 *   GET    /:gameId      — SSE stream of game updates
 */

import { Router, type Request, type Response } from "express";
import crypto from "crypto";

// ---------- Types ----------

type LiveGame = {
  gameId: string;
  hostName?: string;
  fen: string;
  hist: string[];
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
  evalCp?: number;
  evalMate?: number;
  lastSan?: string;
  result?: string;
  aiLevel?: string;
  rating?: number;
};

// ---------- Storage ----------

const liveGames = new Map<string, LiveGame>();
const subscribers = new Map<string, Set<Response>>();
const rateBucket = new Map<string, { count: number; resetAt: number }>();

const GAME_ID_RE = /^[a-zA-Z0-9-]{6,64}$/;
const MAX_HOST_NAME = 32;
const MAX_HIST_LEN = 1000;
const HEARTBEAT_MS = 25_000;
const STALE_GAME_MS = 60 * 60 * 1_000; // 60 min
const CLEANUP_INTERVAL_MS = 5 * 60 * 1_000; // 5 min
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 60;

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
    }
  }

  // Rate bucket sweep
  for (const [ip, slot] of rateBucket) {
    if (slot.resetAt <= now) rateBucket.delete(ip);
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

  if (!body.fen || typeof body.fen !== "string" || body.fen.length > 128) {
    res.status(400).json({ ok: false, error: "bad_fen" });
    return;
  }

  const hist = sanitizeHist(body.hist);
  if (hist === null) {
    res.status(400).json({ ok: false, error: "bad_hist" });
    return;
  }

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

  // If host marked partita as finished — close subscribers after sending final state
  if (game.result) {
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
    // Keep the game in registry briefly so latecomers see final state via /list?
    // Spec says "host stopped" => remove on DELETE. We remove on result here too,
    // because game is over.
    liveGames.delete(gameId);
  }

  res.json({
    ok: true,
    gameId,
    viewerUrl: `/cyberchess/spectator/${gameId}`,
  });
});

/**
 * DELETE /:gameId
 * Host stops streaming. Notify subscribers and remove from registry.
 */
router.delete("/:gameId", (req: Request, res: Response) => {
  const gameId = String(req.params.gameId ?? "");
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
 * GET /:gameId
 * Server-Sent Events stream of game updates.
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
};
