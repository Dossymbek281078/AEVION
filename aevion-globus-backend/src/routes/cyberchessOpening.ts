// AEVION CyberChess — opening explorer proxy
// Mount expected at: /api/cyberchess-opening
//
// The frontend must NOT call explorer.lichess.ovh directly from the browser:
// cross-origin browser requests get an HTML rate-limit / Cloudflare challenge
// page back (not JSON), so res.json() throws and the panel shows "no master
// games" even for the starting position. This server-side proxy fixes that:
//   - server-to-server request (no CORS / browser challenge)
//   - shared in-memory cache (masters stats are effectively static per FEN),
//     which also respects Lichess's ~1 req/s soft limit across all users
//   - single outbound request per FEN is throttled and de-duplicated
//
// Defensive: any upstream failure degrades to an empty {moves:[]} result (the
// panel just shows "no master games"), never a crash.

import { Router, type Request, type Response } from "express";

const router = Router();

const UPSTREAM = "https://explorer.lichess.ovh/masters";
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12h — masters aggregate barely moves
const NEG_TTL_MS = 5 * 60 * 1000; // cache upstream failures briefly to avoid hammering
const MIN_INTERVAL_MS = 1100; // keep under Lichess's ~1 req/s soft limit
const MAX_CACHE = 5000;

interface OpeningResult {
  white: number;
  draws: number;
  black: number;
  opening?: { eco?: string; name?: string } | null;
  moves: Array<{
    uci: string;
    san: string;
    white: number;
    draws: number;
    black: number;
    averageRating?: number;
  }>;
}

const cache = new Map<string, { ts: number; data: OpeningResult | null }>();
// De-dupe concurrent identical FEN requests into a single upstream call.
const inflight = new Map<string, Promise<OpeningResult | null>>();
let lastFetchAt = 0;

function prune(): void {
  if (cache.size <= MAX_CACHE) return;
  // drop the oldest ~10%
  const entries = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts);
  const drop = Math.ceil(entries.length * 0.1);
  for (let i = 0; i < drop; i++) cache.delete(entries[i][0]);
}

// Very light FEN sanity: 6 space-separated fields, first has 8 ranks.
function looksLikeFen(fen: string): boolean {
  if (typeof fen !== "string" || fen.length < 10 || fen.length > 100) return false;
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 4) return false;
  return parts[0].split("/").length === 8;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchUpstream(fen: string): Promise<OpeningResult | null> {
  // Global outbound throttle so bursts of users don't trip the rate limit.
  const wait = MIN_INTERVAL_MS - (Date.now() - lastFetchAt);
  if (wait > 0) await sleep(wait);
  lastFetchAt = Date.now();

  const url = `${UPSTREAM}?fen=${encodeURIComponent(fen)}&topGames=0&moves=12`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        Accept: "application/json",
        // A descriptive UA is good etiquette for the CC0 Lichess API.
        "User-Agent": "AEVION-CyberChess/1.0 (opening explorer proxy)",
      },
    });
    if (!r.ok) return null;
    const ct = r.headers.get("content-type") || "";
    if (!ct.includes("json")) return null; // HTML challenge page → treat as failure
    const j = (await r.json()) as {
      white?: number;
      draws?: number;
      black?: number;
      opening?: { eco?: string; name?: string } | null;
      moves?: Array<Record<string, unknown>>;
    };
    return {
      white: Number(j.white) || 0,
      draws: Number(j.draws) || 0,
      black: Number(j.black) || 0,
      opening: j.opening ?? null,
      moves: Array.isArray(j.moves)
        ? j.moves.slice(0, 12).map((m) => ({
            uci: String(m.uci ?? ""),
            san: String(m.san ?? ""),
            white: Number(m.white) || 0,
            draws: Number(m.draws) || 0,
            black: Number(m.black) || 0,
            averageRating:
              m.averageRating != null ? Number(m.averageRating) : undefined,
          }))
        : [],
    };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// GET / — opening explorer for a FEN. Query: fen (required).
router.get("/", async (req: Request, res: Response): Promise<void> => {
  const fen = String(req.query.fen || "").trim();
  if (!looksLikeFen(fen)) {
    res.json({ ok: true, cached: false, white: 0, draws: 0, black: 0, opening: null, moves: [] });
    return;
  }

  const now = Date.now();
  const hit = cache.get(fen);
  if (hit) {
    const ttl = hit.data ? CACHE_TTL_MS : NEG_TTL_MS;
    if (now - hit.ts < ttl) {
      const d = hit.data;
      res.json({ ok: true, cached: true, ...(d ?? { white: 0, draws: 0, black: 0, opening: null, moves: [] }) });
      return;
    }
  }

  try {
    let p = inflight.get(fen);
    if (!p) {
      p = fetchUpstream(fen).then((data) => {
        cache.set(fen, { ts: Date.now(), data });
        prune();
        inflight.delete(fen);
        return data;
      });
      inflight.set(fen, p);
    }
    const data = await p;
    res.json({ ok: true, cached: false, ...(data ?? { white: 0, draws: 0, black: 0, opening: null, moves: [] }) });
  } catch (e) {
    inflight.delete(fen);
    console.warn("[cyberchess-opening] proxy failed:", e instanceof Error ? e.message : e);
    res.json({ ok: true, cached: false, white: 0, draws: 0, black: 0, opening: null, moves: [] });
  }
});

export default router;
