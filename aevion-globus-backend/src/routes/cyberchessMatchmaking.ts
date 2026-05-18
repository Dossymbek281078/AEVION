// AEVION CyberChess — Real-player Matchmaking router
// Mount expected at: /api/cyberchess/matchmaking
//
// In-memory queue + match registry for pairing real players by similar
// internal rating and identical time control. SSE per-match channel for
// move/disconnect/end broadcast. No DB — all state lives in Maps with
// TTLs (5 min for queue entries, 1 hour for matches).
//
// Pairing scan runs every 3s on a background interval; can also be
// triggered synchronously inside /queue/join for low-latency match.
//
// Rate limit: 5 queue joins / minute / IP (sliding window).

import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";

const router = Router();

// ── types ──────────────────────────────────────────────────────────

export type Color = "white" | "black";
export type MatchStatus = "pending" | "active" | "ended";
export type QueueStatus = "waiting" | "matched" | "cancelled" | "unknown";

export const ALLOWED_TIME_CONTROLS = [
  "60+0",
  "180+0",
  "300+5",
  "600+10",
  "1800+0",
] as const;
export type TimeControl = (typeof ALLOWED_TIME_CONTROLS)[number];

export interface QueueEntry {
  userId: string;
  displayName: string;
  ratingInternal: number;
  timeControl: TimeControl;
  joinedAt: number; // epoch ms
  queueId: string;
  sse?: Response;
  ws?: unknown;
  status: QueueStatus;
  matchedTo?: string; // matchId once matched
}

export interface MatchPlayer {
  userId: string;
  displayName: string;
  ratingInternal: number;
}

export interface Match {
  matchId: string;
  white: MatchPlayer;
  black: MatchPlayer;
  timeControl: TimeControl;
  createdAt: number;
  status: MatchStatus;
  moves: { uci: string; by: string; at: number }[];
  // SSE response objects per-side (transient, never serialized)
  subscribers: Map<string, Response>;
}

// ── storage ────────────────────────────────────────────────────────

const QUEUE = new Map<string, QueueEntry>(); // key: userId
const MATCHES = new Map<string, Match>(); // key: matchId

const QUEUE_TTL_MS = 5 * 60 * 1000; // 5 min
const MATCH_TTL_MS = 60 * 60 * 1000; // 1 hour
const RATING_TOLERANCE = 150;
const PAIRING_INTERVAL_MS = 3000;

// ── rate limit (5 joins / min / IP) ────────────────────────────────

const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 5;
const rateHits = new Map<string, number[]>();

function rateLimitOk(ip: string): boolean {
  const now = Date.now();
  const arr = rateHits.get(ip) ?? [];
  const fresh = arr.filter((t) => now - t < RATE_WINDOW_MS);
  if (fresh.length >= RATE_MAX) {
    rateHits.set(ip, fresh);
    return false;
  }
  fresh.push(now);
  rateHits.set(ip, fresh);
  return true;
}

// ── helpers ────────────────────────────────────────────────────────

function isTimeControl(x: unknown): x is TimeControl {
  return (
    typeof x === "string" &&
    (ALLOWED_TIME_CONTROLS as readonly string[]).includes(x)
  );
}

function safeRating(n: unknown): number | null {
  const r = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(r)) return null;
  if (r < 100 || r > 3000) return null;
  return Math.round(r);
}

function clientIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) {
    return fwd.split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
}

function purgeStaleQueue(): void {
  const now = Date.now();
  for (const [userId, entry] of QUEUE) {
    if (entry.status === "matched" || entry.status === "cancelled") {
      if (now - entry.joinedAt > 30_000) QUEUE.delete(userId);
      continue;
    }
    if (now - entry.joinedAt > QUEUE_TTL_MS) {
      entry.status = "cancelled";
      try {
        entry.sse?.write(`event: timeout\ndata: ${JSON.stringify({ queueId: entry.queueId })}\n\n`);
        entry.sse?.end();
      } catch {
        // ignore
      }
      QUEUE.delete(userId);
    }
  }
}

function purgeStaleMatches(): void {
  const now = Date.now();
  for (const [id, m] of MATCHES) {
    if (now - m.createdAt > MATCH_TTL_MS) {
      try {
        for (const sub of m.subscribers.values()) {
          sub.write(`event: expired\ndata: ${JSON.stringify({ matchId: id })}\n\n`);
          sub.end();
        }
      } catch {
        // ignore
      }
      MATCHES.delete(id);
    }
  }
}

function makeMatch(
  a: QueueEntry,
  b: QueueEntry,
): { match: Match; aColor: Color; bColor: Color } {
  // Color assignment: random, but slight bias toward lower rated as white
  // gives the underdog a slight first-mover advantage.
  let whiteEntry: QueueEntry;
  let blackEntry: QueueEntry;
  if (a.ratingInternal === b.ratingInternal) {
    if (Math.random() < 0.5) {
      whiteEntry = a;
      blackEntry = b;
    } else {
      whiteEntry = b;
      blackEntry = a;
    }
  } else if (a.ratingInternal < b.ratingInternal) {
    whiteEntry = a;
    blackEntry = b;
  } else {
    whiteEntry = b;
    blackEntry = a;
  }

  const match: Match = {
    matchId: `m_${randomUUID()}`,
    white: {
      userId: whiteEntry.userId,
      displayName: whiteEntry.displayName,
      ratingInternal: whiteEntry.ratingInternal,
    },
    black: {
      userId: blackEntry.userId,
      displayName: blackEntry.displayName,
      ratingInternal: blackEntry.ratingInternal,
    },
    timeControl: a.timeControl,
    createdAt: Date.now(),
    status: "pending",
    moves: [],
    subscribers: new Map(),
  };
  MATCHES.set(match.matchId, match);

  // mark queue entries as matched, notify SSE if any
  a.status = "matched";
  b.status = "matched";
  a.matchedTo = match.matchId;
  b.matchedTo = match.matchId;

  const aColor: Color = a.userId === whiteEntry.userId ? "white" : "black";
  const bColor: Color = aColor === "white" ? "black" : "white";

  const notify = (e: QueueEntry, color: Color, opp: MatchPlayer) => {
    if (!e.sse) return;
    try {
      e.sse.write(
        `event: matched\ndata: ${JSON.stringify({
          matchId: match.matchId,
          color,
          opponent: opp,
          timeControl: match.timeControl,
        })}\n\n`,
      );
      e.sse.end();
    } catch {
      // ignore
    }
  };
  notify(
    a,
    aColor,
    aColor === "white"
      ? match.black
      : match.white,
  );
  notify(
    b,
    bColor,
    bColor === "white"
      ? match.black
      : match.white,
  );

  return { match, aColor, bColor };
}

function tryPair(entry: QueueEntry): Match | null {
  // search for compatible opponent in queue
  let best: QueueEntry | null = null;
  let bestGap = Infinity;
  for (const other of QUEUE.values()) {
    if (other.userId === entry.userId) continue;
    if (other.status !== "waiting") continue;
    if (other.timeControl !== entry.timeControl) continue;
    const gap = Math.abs(other.ratingInternal - entry.ratingInternal);
    if (gap > RATING_TOLERANCE) continue;
    if (gap < bestGap) {
      best = other;
      bestGap = gap;
    }
  }
  if (!best) return null;
  const { match } = makeMatch(entry, best);
  return match;
}

function pairingScan(): void {
  purgeStaleQueue();
  purgeStaleMatches();
  // walk waiting entries in join order and try to pair
  const waiting = [...QUEUE.values()]
    .filter((e) => e.status === "waiting")
    .sort((a, b) => a.joinedAt - b.joinedAt);
  for (const e of waiting) {
    if (e.status !== "waiting") continue;
    tryPair(e);
  }
}

// background loop — guarded against double-start in dev hot-reload
const G = global as unknown as { __cc_matchmaking_timer?: NodeJS.Timeout };
if (!G.__cc_matchmaking_timer) {
  G.__cc_matchmaking_timer = setInterval(pairingScan, PAIRING_INTERVAL_MS);
  // best-effort: don't keep the process alive solely for matchmaking
  if (typeof G.__cc_matchmaking_timer.unref === "function") {
    G.__cc_matchmaking_timer.unref();
  }
}

function estimateWaitMs(timeControl: TimeControl): number {
  // crude heuristic: average wait scales inversely with queue size for tc
  const sameTc = [...QUEUE.values()].filter(
    (e) => e.status === "waiting" && e.timeControl === timeControl,
  ).length;
  if (sameTc <= 1) return 60_000;
  if (sameTc <= 3) return 20_000;
  return 8_000;
}

function queuePositionFor(entry: QueueEntry): number {
  const peers = [...QUEUE.values()]
    .filter((e) => e.status === "waiting" && e.timeControl === entry.timeControl)
    .sort((a, b) => a.joinedAt - b.joinedAt);
  const idx = peers.findIndex((e) => e.userId === entry.userId);
  return idx < 0 ? 0 : idx + 1;
}

// ── routes ─────────────────────────────────────────────────────────

// POST /queue/join { userId, displayName, rating, timeControl }
router.post("/queue/join", (req: Request, res: Response): void => {
  const ip = clientIp(req);
  if (!rateLimitOk(ip)) {
    res.status(429).json({ ok: false, error: "rate_limited", retryAfter: 60 });
    return;
  }

  const userId = String(req.body?.userId || "").trim();
  const displayName =
    String(req.body?.displayName || "").trim() || `Player_${userId.slice(-4) || "anon"}`;
  const rating = safeRating(req.body?.rating);
  const timeControl = req.body?.timeControl;

  if (!userId) {
    res.status(400).json({ ok: false, error: "userId_required" });
    return;
  }
  if (rating === null) {
    res.status(400).json({
      ok: false,
      error: "invalid_rating",
      hint: "rating must be a number in [100, 3000]",
    });
    return;
  }
  if (!isTimeControl(timeControl)) {
    res.status(400).json({
      ok: false,
      error: "invalid_timeControl",
      allowed: ALLOWED_TIME_CONTROLS,
    });
    return;
  }

  // idempotency: same user re-joining with different params updates their entry
  const existing = QUEUE.get(userId);
  if (existing && existing.status === "waiting") {
    existing.ratingInternal = rating;
    existing.timeControl = timeControl;
    existing.displayName = displayName;
  } else {
    const entry: QueueEntry = {
      userId,
      displayName,
      ratingInternal: rating,
      timeControl,
      joinedAt: Date.now(),
      queueId: `q_${randomUUID()}`,
      status: "waiting",
    };
    QUEUE.set(userId, entry);
  }

  const entry = QUEUE.get(userId)!;

  // try immediate pairing
  const match = tryPair(entry);
  if (match) {
    const color: Color = match.white.userId === userId ? "white" : "black";
    const opponent = color === "white" ? match.black : match.white;
    res.json({
      ok: true,
      matched: true,
      matchId: match.matchId,
      opponent,
      color,
      timeControl: match.timeControl,
    });
    return;
  }

  res.json({
    ok: true,
    matched: false,
    queueId: entry.queueId,
    position: queuePositionFor(entry),
    waiting: [...QUEUE.values()].filter(
      (e) => e.status === "waiting" && e.timeControl === entry.timeControl,
    ).length,
    estimatedWaitMs: estimateWaitMs(entry.timeControl),
  });
});

// GET /queue/status?userId=X
router.get("/queue/status", (req: Request, res: Response): void => {
  const userId = String(req.query.userId || "").trim();
  if (!userId) {
    res.status(400).json({ ok: false, error: "userId_required" });
    return;
  }
  const entry = QUEUE.get(userId);
  if (!entry) {
    res.json({ ok: true, status: "unknown" as QueueStatus });
    return;
  }
  if (entry.status === "matched") {
    const match = entry.matchedTo ? MATCHES.get(entry.matchedTo) : null;
    if (match) {
      const color: Color = match.white.userId === userId ? "white" : "black";
      const opponent = color === "white" ? match.black : match.white;
      res.json({
        ok: true,
        status: "matched",
        matchId: match.matchId,
        color,
        opponent,
        timeControl: match.timeControl,
      });
      return;
    }
  }
  res.json({
    ok: true,
    status: entry.status,
    queueId: entry.queueId,
    position: queuePositionFor(entry),
    waiting: [...QUEUE.values()].filter(
      (e) => e.status === "waiting" && e.timeControl === entry.timeControl,
    ).length,
    estimatedWaitMs: estimateWaitMs(entry.timeControl),
    joinedAt: entry.joinedAt,
  });
});

// POST /queue/leave { userId }
router.post("/queue/leave", (req: Request, res: Response): void => {
  const userId = String(req.body?.userId || "").trim();
  if (!userId) {
    res.status(400).json({ ok: false, error: "userId_required" });
    return;
  }
  const entry = QUEUE.get(userId);
  if (!entry) {
    res.json({ ok: true, removed: false });
    return;
  }
  entry.status = "cancelled";
  try {
    entry.sse?.write(`event: cancelled\ndata: ${JSON.stringify({ queueId: entry.queueId })}\n\n`);
    entry.sse?.end();
  } catch {
    // ignore
  }
  QUEUE.delete(userId);
  res.json({ ok: true, removed: true });
});

// GET /queue/stream?userId=X — SSE per-user, fires "matched"/"cancelled"/"timeout"
router.get("/queue/stream", (req: Request, res: Response): void => {
  const userId = String(req.query.userId || "").trim();
  if (!userId) {
    res.status(400).json({ ok: false, error: "userId_required" });
    return;
  }
  const entry = QUEUE.get(userId);
  if (!entry) {
    res.status(404).json({ ok: false, error: "not_in_queue" });
    return;
  }
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
  res.write(
    `event: hello\ndata: ${JSON.stringify({
      queueId: entry.queueId,
      position: queuePositionFor(entry),
    })}\n\n`,
  );
  entry.sse = res;
  // heartbeat
  const hb = setInterval(() => {
    try {
      res.write(`event: ping\ndata: ${Date.now()}\n\n`);
    } catch {
      clearInterval(hb);
    }
  }, 15_000);
  req.on("close", () => {
    clearInterval(hb);
    if (entry.sse === res) entry.sse = undefined;
  });
});

// GET /match/:matchId
router.get("/match/:matchId", (req: Request, res: Response): void => {
  const m = MATCHES.get(String(req.params.matchId ?? ""));
  if (!m) {
    res.status(404).json({ ok: false, error: "match_not_found", matchId: req.params.matchId });
    return;
  }
  res.json({
    ok: true,
    match: {
      matchId: m.matchId,
      white: m.white,
      black: m.black,
      timeControl: m.timeControl,
      createdAt: m.createdAt,
      status: m.status,
      moveCount: m.moves.length,
      lastMove: m.moves[m.moves.length - 1] ?? null,
    },
  });
});

// POST /match/:matchId/move { userId, uci }
router.post("/match/:matchId/move", (req: Request, res: Response): void => {
  const m = MATCHES.get(String(req.params.matchId ?? ""));
  if (!m) {
    res.status(404).json({ ok: false, error: "match_not_found", matchId: req.params.matchId });
    return;
  }
  if (m.status === "ended") {
    res.status(409).json({ ok: false, error: "match_ended" });
    return;
  }
  const userId = String(req.body?.userId || "").trim();
  const uci = String(req.body?.uci || "").trim();
  if (!userId || !uci) {
    res.status(400).json({ ok: false, error: "userId_and_uci_required" });
    return;
  }
  if (userId !== m.white.userId && userId !== m.black.userId) {
    res.status(403).json({ ok: false, error: "not_a_participant" });
    return;
  }
  // very lax uci shape check: 4-5 chars, two squares + optional promo
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/i.test(uci)) {
    res.status(400).json({ ok: false, error: "malformed_uci", hint: "expected e2e4 or e7e8q" });
    return;
  }
  const move = { uci: uci.toLowerCase(), by: userId, at: Date.now() };
  m.moves.push(move);
  m.status = "active";
  // broadcast to all match subscribers (both players)
  const payload = JSON.stringify({
    matchId: m.matchId,
    move,
    moveIndex: m.moves.length - 1,
  });
  for (const sub of m.subscribers.values()) {
    try {
      sub.write(`event: move\ndata: ${payload}\n\n`);
    } catch {
      // ignore broken pipe — cleaned up on req close
    }
  }
  res.json({ ok: true, matchId: m.matchId, moveIndex: m.moves.length - 1, move });
});

// POST /match/:matchId/end { userId, result: "white"|"black"|"draw", reason? }
router.post("/match/:matchId/end", (req: Request, res: Response): void => {
  const m = MATCHES.get(String(req.params.matchId ?? ""));
  if (!m) {
    res.status(404).json({ ok: false, error: "match_not_found", matchId: req.params.matchId });
    return;
  }
  const userId = String(req.body?.userId || "").trim();
  const result = String(req.body?.result || "");
  const reason = String(req.body?.reason || "user_ended");
  if (userId !== m.white.userId && userId !== m.black.userId) {
    res.status(403).json({ ok: false, error: "not_a_participant" });
    return;
  }
  if (!["white", "black", "draw"].includes(result)) {
    res.status(400).json({ ok: false, error: "invalid_result" });
    return;
  }
  m.status = "ended";
  const payload = JSON.stringify({ matchId: m.matchId, result, reason });
  for (const sub of m.subscribers.values()) {
    try {
      sub.write(`event: end\ndata: ${payload}\n\n`);
      sub.end();
    } catch {
      // ignore
    }
  }
  m.subscribers.clear();
  res.json({ ok: true, matchId: m.matchId, status: m.status, result });
});

// GET /match/:matchId/stream?userId=X — SSE per-match
router.get("/match/:matchId/stream", (req: Request, res: Response): void => {
  const m = MATCHES.get(String(req.params.matchId ?? ""));
  if (!m) {
    res.status(404).json({ ok: false, error: "match_not_found", matchId: req.params.matchId });
    return;
  }
  const userId = String(req.query.userId || "").trim();
  if (!userId || (userId !== m.white.userId && userId !== m.black.userId)) {
    res.status(403).json({ ok: false, error: "not_a_participant" });
    return;
  }
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
  res.write(
    `event: hello\ndata: ${JSON.stringify({
      matchId: m.matchId,
      color: m.white.userId === userId ? "white" : "black",
      moves: m.moves,
      timeControl: m.timeControl,
    })}\n\n`,
  );
  m.subscribers.set(userId, res);
  const hb = setInterval(() => {
    try {
      res.write(`event: ping\ndata: ${Date.now()}\n\n`);
    } catch {
      clearInterval(hb);
    }
  }, 15_000);
  req.on("close", () => {
    clearInterval(hb);
    if (m.subscribers.get(userId) === res) {
      m.subscribers.delete(userId);
      // notify peer of disconnect
      const peerId = userId === m.white.userId ? m.black.userId : m.white.userId;
      const peerSub = m.subscribers.get(peerId);
      if (peerSub) {
        try {
          peerSub.write(
            `event: disconnect\ndata: ${JSON.stringify({ userId, matchId: m.matchId })}\n\n`,
          );
        } catch {
          // ignore
        }
      }
    }
  });
});

// GET /debug/stats — diagnostic
router.get("/debug/stats", (_req: Request, res: Response): void => {
  res.json({
    ok: true,
    queue: {
      total: QUEUE.size,
      waiting: [...QUEUE.values()].filter((e) => e.status === "waiting").length,
      byTimeControl: Object.fromEntries(
        ALLOWED_TIME_CONTROLS.map((tc) => [
          tc,
          [...QUEUE.values()].filter(
            (e) => e.status === "waiting" && e.timeControl === tc,
          ).length,
        ]),
      ),
    },
    matches: {
      total: MATCHES.size,
      active: [...MATCHES.values()].filter((m) => m.status === "active").length,
      pending: [...MATCHES.values()].filter((m) => m.status === "pending").length,
      ended: [...MATCHES.values()].filter((m) => m.status === "ended").length,
    },
  });
});

export default router;
export { QUEUE, MATCHES, pairingScan, tryPair };
