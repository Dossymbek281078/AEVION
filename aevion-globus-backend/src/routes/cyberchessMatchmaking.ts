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
//
// Tournament integration (2026-05-19):
//  - Exported helper `createPreMatchedMatch(...)` lets the tournaments
//    router materialise bracket pairings directly inside MATCHES,
//    skipping the queue. If either player happens to be currently in
//    QUEUE waiting on this same timeControl, they get an immediate SSE
//    "matched" event with the bracket-supplied matchId, redirecting
//    them straight into the game.
//  - Internal HTTP fallback: POST /internal/pre-match (gated by
//    X-Internal-Token header against process.env.INTERNAL_TOKEN when
//    set; otherwise loopback-only).

import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { Chess } from "chess.js";
import {
  ensureDb as ensureMatchDb,
  recordMatchCreated,
  appendMove,
  finalizeMatch,
  getRating,
  getLeaderboard,
  getHistory,
} from "./cyberchessMatchStore";

const router = Router();

// Persistence is write-through and non-blocking: every store call is
// fire-and-forget with its own try/catch inside cyberchessMatchStore, so a DB
// outage (or missing DATABASE_URL locally) NEVER breaks the in-memory flow.
void ensureMatchDb();

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
  // Lazy SSE listeners (opened /queue/stream without actually joining) are
  // parked in the queue only to receive notifications — they must NEVER be
  // paired against a real queuer. Marked passive and excluded from pairing.
  passive?: boolean;
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
  // Set once by settleMatch — lets a second /end call (e.g. the other
  // player's client independently reporting) echo the real outcome
  // idempotently instead of re-running self-award validation against a
  // board that's already final.
  finalResult?: "white" | "black" | "draw";
  // Authoritative server-side board — every /move is played through this
  // before being accepted, so legality (turn order, pins, checks, castling
  // rights, en passant, promotion) is enforced by the server, not trusted
  // from the client. Also the source of truth for /end outcomes (see
  // resolveEndResult). Transient, never serialized.
  chess: Chess;
  // SSE response objects per-side (transient, never serialized)
  subscribers: Map<string, Response>;
  // Tournament linkage (optional)
  tournamentId?: string;
  tournamentRound?: number;
  source?: "queue" | "tournament";
}

// ── storage ────────────────────────────────────────────────────────

const QUEUE = new Map<string, QueueEntry>(); // key: userId
const MATCHES = new Map<string, Match>(); // key: matchId

// Presence: любой открытый таб CyberChess пингует /presence/ping раз в ~20s.
// Держим последний ping по userId; «онлайн» = ping в пределах PRESENCE_TTL_MS.
// Чисто in-memory (как очередь) — сбрасывается на рестарт, это ок для «онлайн сейчас».
const PRESENCE = new Map<string, number>(); // key: userId → lastSeen epoch ms
const PRESENCE_TTL_MS = 45 * 1000; // 45s окно «онлайн»

function onlineCount(): number {
  const now = Date.now();
  let n = 0;
  for (const [id, ts] of PRESENCE) {
    if (now - ts > PRESENCE_TTL_MS) PRESENCE.delete(id);
    else n++;
  }
  return n;
}

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

// ── per-match move flood guard ─────────────────────────────────────
// Hard ceiling on stored moves (longest sensible game << this) and a short
// sliding window so a single authenticated participant can't flood /move.
const MAX_MOVES_PER_MATCH = 700;
const MOVE_RATE_WINDOW_MS = 2000;
const MOVE_RATE_MAX = 12; // ~6 moves/s/player — ample for bullet
const moveHits = new Map<string, number[]>();

function moveRateOk(matchId: string, userId: string): boolean {
  const key = `${matchId}|${userId}`;
  const now = Date.now();
  const arr = moveHits.get(key) ?? [];
  const fresh = arr.filter((t) => now - t < MOVE_RATE_WINDOW_MS);
  if (fresh.length >= MOVE_RATE_MAX) {
    moveHits.set(key, fresh);
    return false;
  }
  fresh.push(now);
  moveHits.set(key, fresh);
  return true;
}

// Evict stale move-rate buckets (bounded with the match lifetime, but sweep
// anyway so ended matches don't linger). Called from the pairing tick.
function sweepMoveHits(): void {
  const now = Date.now();
  for (const [key, arr] of moveHits) {
    if (!arr.some((t) => now - t < MOVE_RATE_WINDOW_MS)) moveHits.delete(key);
  }
}

// ── authoritative result + clock ─────────────────────────────────────
// Everything below closes the "curl the rating up" hole: previously /end
// trusted whatever {result} the caller sent, with zero relation to the
// actual board (m.chess is now the server's own played-through game, see
// /move). A malicious authenticated participant could just POST
// {result:"white"} on an untouched match and have the server hand them a
// Glicko-2 win. Now a self-claimed win is only accepted if the server's
// own board says so (checkmate) or the server's own clock math says the
// opponent's flag actually fell — never on the caller's word alone.

// side to move at ply `idx` (0-based, white moves first)
function colorAtPly(idx: number): Color {
  return idx % 2 === 0 ? "white" : "black";
}

// Checkmate/stalemate/draw as computed by the server's own board — the only
// trustworthy source for "who won". Returns null while the game is still
// legally undecided (resignation/timeout/agreement territory).
function boardResult(chess: Chess): "white" | "black" | "draw" | null {
  if (!chess.isGameOver()) return null;
  if (chess.isCheckmate()) {
    // the side TO MOVE is the one in checkmate, so they lose
    return chess.turn() === "w" ? "black" : "white";
  }
  return "draw"; // stalemate, insufficient material, threefold, 50-move
}

// Remaining clock for `color`, derived purely from move timestamps already
// recorded server-side (m.moves[].at) + the match's own time control — no
// separate timer process needed, and nothing the client can spoof, since
// every timestamp is stamped by this server at the moment /move accepted
// the move, not supplied by the client.
function remainingMs(m: Match, color: Color): number {
  const [baseStr, incStr] = m.timeControl.split("+");
  const baseMs = (Number(baseStr) || 0) * 1000;
  const incMs = (Number(incStr) || 0) * 1000;
  let remaining = baseMs;
  let lastAt = m.createdAt;
  m.moves.forEach((mv, idx) => {
    if (colorAtPly(idx) === color) {
      remaining -= mv.at - lastAt;
      remaining += incMs;
    }
    lastAt = mv.at;
  });
  const sideToMove: Color = m.chess.turn() === "w" ? "white" : "black";
  if (sideToMove === color) remaining -= Date.now() - lastAt;
  return remaining;
}

// Broadcast + persist a match's end exactly once (idempotent on m.status),
// shared by the auto-finalize path (server detects checkmate on its own
// board right after a /move) and the manual /end route.
async function settleMatch(
  m: Match,
  result: "white" | "black" | "draw",
  reason: string,
): Promise<Awaited<ReturnType<typeof finalizeMatch>>> {
  const firstEnd = m.status !== "ended";
  m.status = "ended";
  m.finalResult = result;
  const payload = JSON.stringify({ matchId: m.matchId, result, reason });
  for (const sub of m.subscribers.values()) {
    try {
      sub.write(`event: end\ndata: ${payload}\n\n`);
      sub.end();
    } catch {
      // ignore broken pipe
    }
  }
  m.subscribers.clear();
  if (!firstEnd) return null;
  return finalizeMatch(m.matchId, {
    whiteUserId: m.white.userId,
    whiteName: m.white.displayName,
    blackUserId: m.black.userId,
    blackName: m.black.displayName,
    timeControl: m.timeControl,
    result,
    termination: reason,
  }).catch(() => null);
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
    chess: new Chess(),
    subscribers: new Map(),
    source: "queue",
  };
  MATCHES.set(match.matchId, match);

  // write-through persist (non-blocking; no-op offline)
  void recordMatchCreated({
    id: match.matchId,
    whiteUserId: match.white.userId,
    whiteName: match.white.displayName,
    blackUserId: match.black.userId,
    blackName: match.black.displayName,
    timeControl: match.timeControl,
    whiteRatingBefore: match.white.ratingInternal,
    blackRatingBefore: match.black.ratingInternal,
  }).catch(() => {});

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
    if (other.passive) continue; // notification-only listener, not a real queuer
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

// Evict rate-limit buckets whose hits have all aged out — otherwise rateHits
// grows one entry per unique client IP forever (memory leak behind a proxy).
function sweepRateHits(): void {
  const now = Date.now();
  for (const [ip, arr] of rateHits) {
    if (!arr.some((t) => now - t < RATE_WINDOW_MS)) rateHits.delete(ip);
  }
}

function pairingScan(): void {
  purgeStaleQueue();
  purgeStaleMatches();
  sweepRateHits();
  sweepMoveHits();
  // walk waiting entries in join order and try to pair
  const waiting = [...QUEUE.values()]
    .filter((e) => e.status === "waiting" && !e.passive)
    .sort((a, b) => a.joinedAt - b.joinedAt);
  for (const e of waiting) {
    if (e.status !== "waiting" || e.passive) continue;
    tryPair(e);
  }
}

// Guarded tick: a throw inside a bare setInterval callback bypasses Express and
// would crash the whole backend. Swallow + log so one bad scan can't kill it.
function safePairingScan(): void {
  try {
    pairingScan();
  } catch (e) {
    console.error("[cyberchess matchmaking] pairingScan tick failed", e);
  }
}

// background loop — guarded against double-start in dev hot-reload
const G = global as unknown as { __cc_matchmaking_timer?: NodeJS.Timeout };
if (!G.__cc_matchmaking_timer) {
  G.__cc_matchmaking_timer = setInterval(safePairingScan, PAIRING_INTERVAL_MS);
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

// ── tournament integration ─────────────────────────────────────────

export interface PreMatchedInput {
  whiteUserId: string;
  blackUserId: string;
  whiteName?: string;
  blackName?: string;
  whiteRating?: number;
  blackRating?: number;
  timeControl: TimeControl;
  tournamentId?: string;
  round?: number;
}

export interface PreMatchedResult {
  ok: true;
  matchId: string;
  whiteUserId: string;
  blackUserId: string;
  viewerUrlWhite: string;
  viewerUrlBlack: string;
  tournamentId?: string;
  round?: number;
  notifiedWhite: boolean;
  notifiedBlack: boolean;
}

/**
 * Create a Match immediately in MATCHES, bypassing the queue.
 * Used by the tournaments router to materialise bracket pairings.
 *
 * Side effects:
 *  - If either player is currently in QUEUE waiting, they are marked
 *    "matched" and receive an SSE "matched" event with the new matchId.
 *  - SSE channels for the new match are opened lazily by /match/:id/stream.
 */
export function createPreMatchedMatch(
  input: PreMatchedInput,
): PreMatchedResult {
  const tc = input.timeControl;
  const whiteRating = safeRating(input.whiteRating ?? 1500) ?? 1500;
  const blackRating = safeRating(input.blackRating ?? 1500) ?? 1500;
  const match: Match = {
    matchId: `m_${randomUUID()}`,
    white: {
      userId: input.whiteUserId,
      displayName: input.whiteName || `Player_${input.whiteUserId.slice(-4)}`,
      ratingInternal: whiteRating,
    },
    black: {
      userId: input.blackUserId,
      displayName: input.blackName || `Player_${input.blackUserId.slice(-4)}`,
      ratingInternal: blackRating,
    },
    timeControl: tc,
    createdAt: Date.now(),
    status: "pending",
    moves: [],
    chess: new Chess(),
    subscribers: new Map(),
    tournamentId: input.tournamentId,
    tournamentRound: input.round,
    source: "tournament",
  };
  MATCHES.set(match.matchId, match);

  // viewer URLs (relative — the frontend resolves to its own origin)
  const tParam = input.tournamentId
    ? `&tournamentId=${encodeURIComponent(input.tournamentId)}`
    : "";
  const viewerUrlWhite = `/cyberchess?matchId=${encodeURIComponent(
    match.matchId,
  )}&color=white${tParam}`;
  const viewerUrlBlack = `/cyberchess?matchId=${encodeURIComponent(
    match.matchId,
  )}&color=black${tParam}`;

  // Optionally notify queue subscribers if either player is waiting
  let notifiedWhite = false;
  let notifiedBlack = false;
  const tryNotify = (userId: string, color: Color): boolean => {
    const entry = QUEUE.get(userId);
    if (!entry || entry.status !== "waiting") return false;
    entry.status = "matched";
    entry.matchedTo = match.matchId;
    if (entry.sse) {
      const opp: MatchPlayer = color === "white" ? match.black : match.white;
      try {
        entry.sse.write(
          `event: matched\ndata: ${JSON.stringify({
            matchId: match.matchId,
            color,
            opponent: opp,
            timeControl: match.timeControl,
            tournamentId: input.tournamentId,
            round: input.round,
            source: "tournament",
          })}\n\n`,
        );
        entry.sse.end();
      } catch {
        // ignore
      }
    }
    return true;
  };
  notifiedWhite = tryNotify(input.whiteUserId, "white");
  notifiedBlack = tryNotify(input.blackUserId, "black");

  return {
    ok: true,
    matchId: match.matchId,
    whiteUserId: input.whiteUserId,
    blackUserId: input.blackUserId,
    viewerUrlWhite,
    viewerUrlBlack,
    tournamentId: input.tournamentId,
    round: input.round,
    notifiedWhite,
    notifiedBlack,
  };
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
        tournamentId: match.tournamentId,
        round: match.tournamentRound,
        source: match.source,
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
//
// Tournament mode: callers may register an SSE listener BEFORE joining the
// queue (e.g. tournament registration with realPlayers=true). In that case
// we lazily create a "waiting" queue entry tagged with a synthetic
// timeControl, so that createPreMatchedMatch() can push notifications.
// If a real queue entry exists already, we just attach to it.
router.get("/queue/stream", (req: Request, res: Response): void => {
  const userId = String(req.query.userId || "").trim();
  if (!userId) {
    res.status(400).json({ ok: false, error: "userId_required" });
    return;
  }
  let entry = QUEUE.get(userId);
  if (!entry) {
    // lazy listener entry for tournament notifications (no rating-based pairing)
    entry = {
      userId,
      displayName: `Listener_${userId.slice(-4) || "anon"}`,
      ratingInternal: 1500,
      timeControl: "300+5",
      joinedAt: Date.now(),
      queueId: `q_${randomUUID()}`,
      status: "waiting",
      passive: true, // notification-only listener — never pair this entry
    };
    QUEUE.set(userId, entry);
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
    if (entry && entry.sse === res) entry.sse = undefined;
  });
});

// POST /internal/pre-match — tournament → matchmaking bridge (HTTP form)
//
// Direct in-process callers should use createPreMatchedMatch() instead.
// This endpoint is provided for parity / future cross-process use.
//
// Auth: header X-Internal-Token must match process.env.INTERNAL_TOKEN
// when that env is set; otherwise loopback connections (127.0.0.1 / ::1)
// are accepted.
router.post("/internal/pre-match", (req: Request, res: Response): void => {
  const expected = process.env.INTERNAL_TOKEN || "";
  const provided = String(req.headers["x-internal-token"] || "");
  if (expected) {
    if (provided !== expected) {
      res.status(403).json({ ok: false, error: "forbidden" });
      return;
    }
  } else {
    const ip = req.ip || req.socket?.remoteAddress || "";
    const isLoopback =
      ip === "127.0.0.1" ||
      ip === "::1" ||
      ip === "::ffff:127.0.0.1" ||
      ip.startsWith("127.");
    if (!isLoopback) {
      res
        .status(403)
        .json({ ok: false, error: "forbidden_no_token_and_non_loopback" });
      return;
    }
  }
  const body = (req.body ?? {}) as Partial<PreMatchedInput>;
  if (!body.whiteUserId || !body.blackUserId) {
    res.status(400).json({ ok: false, error: "whiteUserId_and_blackUserId_required" });
    return;
  }
  if (!isTimeControl(body.timeControl)) {
    res.status(400).json({
      ok: false,
      error: "invalid_timeControl",
      allowed: ALLOWED_TIME_CONTROLS,
    });
    return;
  }
  const result = createPreMatchedMatch({
    whiteUserId: String(body.whiteUserId),
    blackUserId: String(body.blackUserId),
    whiteName: body.whiteName ? String(body.whiteName) : undefined,
    blackName: body.blackName ? String(body.blackName) : undefined,
    whiteRating: typeof body.whiteRating === "number" ? body.whiteRating : undefined,
    blackRating: typeof body.blackRating === "number" ? body.blackRating : undefined,
    timeControl: body.timeControl,
    tournamentId: body.tournamentId ? String(body.tournamentId) : undefined,
    round: typeof body.round === "number" ? body.round : undefined,
  });
  res.json(result);
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
      tournamentId: m.tournamentId,
      round: m.tournamentRound,
      source: m.source,
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
  // Hard ceiling: the longest legal game is well under this. Caps in-memory
  // moves[] growth + DB writes so one authenticated player can't DoS by
  // scripting endless /move calls on a live match.
  if (m.moves.length >= MAX_MOVES_PER_MATCH) {
    res.status(409).json({ ok: false, error: "move_limit_reached" });
    return;
  }
  // Per-match move rate limit — a real game never needs more than a few
  // moves/second; this blocks scripted flooding while allowing bullet play.
  if (!moveRateOk(m.matchId, userId)) {
    res.status(429).json({ ok: false, error: "rate_limited" });
    return;
  }
  // Turn order: a participant may only move their OWN side, and only when
  // it's actually their turn — otherwise a client could script both sides
  // of the same game (curl-vs-curl) and force any result it likes.
  const movingColor: Color = userId === m.white.userId ? "white" : "black";
  const sideToMove: Color = m.chess.turn() === "w" ? "white" : "black";
  if (movingColor !== sideToMove) {
    res.status(409).json({ ok: false, error: "not_your_turn" });
    return;
  }
  // Authoritative legality check against the server's own board — this is
  // what actually closes the exploit: pins, checks, castling rights, en
  // passant, promotion piece all enforced here, not trusted from the
  // client's local chess.js instance.
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci.length > 4 ? uci[4].toLowerCase() : undefined;
  let applied: ReturnType<Chess["move"]> | null;
  try {
    applied = m.chess.move({ from, to, promotion });
  } catch {
    applied = null;
  }
  if (!applied) {
    res.status(400).json({ ok: false, error: "illegal_move" });
    return;
  }
  // Canonical uci from what chess.js actually applied (not the raw client
  // string) — e.g. a promotion always carries its piece letter even if the
  // client somehow omitted one that chess.js still accepted.
  const canonicalUci = `${applied.from}${applied.to}${applied.promotion || ""}`;
  const move = { uci: canonicalUci, by: userId, at: Date.now() };
  m.moves.push(move);
  m.status = "active";
  // append move to persisted game (non-blocking; stores real SAN now that
  // we have chess.js applying every move server-side)
  void appendMove(m.matchId, applied.san, m.moves.length).catch(() => {});
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

  // A legal move that itself ends the game (checkmate/stalemate/draw) is
  // settled by the server immediately — it never waits for either client to
  // call /end and "admit" the result, which is exactly the gap that let a
  // losing player just never report the loss.
  const auto = boardResult(m.chess);
  if (auto) {
    void settleMatch(
      m,
      auto,
      m.chess.isCheckmate() ? "checkmate" : "board_draw",
    ).catch(() => {});
  }
});

// POST /match/:matchId/end { userId, result: "white"|"black"|"draw", reason? }
//
// The server never takes {result} on faith. Two sources of truth, checked
// in order:
//  1. The server's own board (m.chess) — if it's objectively game-over
//     (checkmate/stalemate/draw), that outcome wins, full stop, regardless
//     of what the caller sent.
//  2. If the board is still legally undecided, this must be a voluntary end
//     (resign/timeout/agreement). A participant can always end the game in
//     their OPPONENT's favor (resignation) or call it a draw, but can only
//     award themselves the win if the server's own clock math shows the
//     opponent's flag actually fell. Anything else claiming a self-win on
//     an undecided board is rejected — that's the exact "curl /end
//     {result:'white'}" rating-inflation hole this closes.
router.post("/match/:matchId/end", async (req: Request, res: Response): Promise<void> => {
  const m = MATCHES.get(String(req.params.matchId ?? ""));
  if (!m) {
    res.status(404).json({ ok: false, error: "match_not_found", matchId: req.params.matchId });
    return;
  }
  const userId = String(req.body?.userId || "").trim();
  const claimed = String(req.body?.result || "") as "white" | "black" | "draw";
  const reason = String(req.body?.reason || "user_ended");
  if (userId !== m.white.userId && userId !== m.black.userId) {
    res.status(403).json({ ok: false, error: "not_a_participant" });
    return;
  }
  if (!["white", "black", "draw"].includes(claimed)) {
    res.status(400).json({ ok: false, error: "invalid_result" });
    return;
  }

  // Already settled (auto-finalized by /move, or the other client's /end
  // beat us here) — echo the REAL outcome idempotently. Falling through to
  // the self-award check below would be wrong: the board no longer reflects
  // "in progress" once a match is ended, so a legitimate second report from
  // the winner's own client would get incorrectly rejected as an exploit.
  if (m.status === "ended") {
    res.json({
      ok: true,
      matchId: m.matchId,
      status: m.status,
      result: m.finalResult ?? claimed,
      ratingDelta: null,
    });
    return;
  }

  const authoritative = boardResult(m.chess);
  let result: "white" | "black" | "draw";
  let settleReason = reason;
  if (authoritative) {
    result = authoritative;
    settleReason = m.chess.isCheckmate() ? "checkmate" : "board_draw";
  } else {
    const myColor: Color = userId === m.white.userId ? "white" : "black";
    const oppColor: Color = myColor === "white" ? "black" : "white";
    if (claimed === myColor) {
      // Self-claimed win on an undecided board — only legitimate if the
      // opponent's own clock has actually run out.
      if (remainingMs(m, oppColor) > 0) {
        res.status(409).json({
          ok: false,
          error: "cannot_self_award_win",
          hint: "board is not over and opponent's clock hasn't expired — win on the board or have your opponent resign",
        });
        return;
      }
      settleReason = "timeout";
    }
    result = claimed;
  }

  // Finalize + Glicko-2 rating update (awaited so we can return deltas to the
  // UI; finalizeMatch/settleMatch are fully guarded — never throw. Idempotent
  // on m.status, so a duplicate /end from the other client is a no-op here.
  const ratingDelta = await settleMatch(m, result, settleReason);
  res.json({ ok: true, matchId: m.matchId, status: m.status, result, ratingDelta });
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
      tournamentId: m.tournamentId,
      round: m.tournamentRound,
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

// POST /presence/ping { userId } — heartbeat, returns current online count
router.post("/presence/ping", (req: Request, res: Response): void => {
  const userId = String(req.body?.userId || "").trim();
  if (!userId) {
    res.status(400).json({ ok: false, error: "userId_required" });
    return;
  }
  PRESENCE.set(userId, Date.now());
  res.json({
    ok: true,
    online: onlineCount(),
    inQueue: [...QUEUE.values()].filter((e) => e.status === "waiting").length,
    activeMatches: [...MATCHES.values()].filter((m) => m.status === "active").length,
  });
});

// GET /presence — current online / queue / active-match counts (no side effect)
router.get("/presence", (_req: Request, res: Response): void => {
  res.json({
    ok: true,
    online: onlineCount(),
    inQueue: [...QUEUE.values()].filter((e) => e.status === "waiting").length,
    activeMatches: [...MATCHES.values()].filter((m) => m.status === "active").length,
  });
});

// GET /rating?userId=X&speed=blitz — persisted Glicko-2 rating for a player.
// Speed optional: omitted → all four speeds. Degrades to defaults offline.
router.get("/rating", async (req: Request, res: Response): Promise<void> => {
  const userId = String(req.query.userId || "").trim();
  if (!userId) {
    res.status(400).json({ ok: false, error: "userId_required" });
    return;
  }
  const speedQ = String(req.query.speed || "").trim();
  const speeds = speedQ ? [speedQ] : ["bullet", "blitz", "rapid", "classical"];
  const ratings = await Promise.all(speeds.map((s) => getRating(userId, s).catch(() => null)));
  res.json({ ok: true, userId, ratings: ratings.filter(Boolean) });
});

// GET /leaderboard?speed=blitz&limit=50 — top players by rating in a speed.
router.get("/leaderboard", async (req: Request, res: Response): Promise<void> => {
  const speed = String(req.query.speed || "blitz").trim();
  const limit = parseInt(String(req.query.limit || "50"), 10) || 50;
  const rows = await getLeaderboard(speed, limit).catch(() => []);
  res.json({
    ok: true,
    speed,
    count: rows.length,
    leaderboard: rows.map((r, i) => ({
      rank: i + 1,
      userId: r.userId,
      displayName: r.displayName,
      rating: Math.round(r.rating),
      rd: Math.round(r.rd),
      games: r.games,
      wins: r.wins,
      losses: r.losses,
      draws: r.draws,
      peak: Math.round(r.peak),
    })),
  });
});

// GET /history?userId=X&limit=30 — a player's finished online matches.
router.get("/history", async (req: Request, res: Response): Promise<void> => {
  const userId = String(req.query.userId || "").trim();
  if (!userId) {
    res.status(400).json({ ok: false, error: "userId_required" });
    return;
  }
  const limit = parseInt(String(req.query.limit || "30"), 10) || 30;
  const rows = await getHistory(userId, limit).catch(() => []);
  res.json({ ok: true, userId, count: rows.length, matches: rows });
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
      tournamentLinked: [...MATCHES.values()].filter((m) => !!m.tournamentId).length,
    },
  });
});

export default router;
export { QUEUE, MATCHES, pairingScan, tryPair };
