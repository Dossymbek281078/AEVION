// AEVION CyberChess — opening explorer proxy
// Mount expected at: /api/cyberchess-opening
//
// The frontend must NOT call explorer.lichess.ovh directly from the browser:
// cross-origin browser requests get an HTML rate-limit / Cloudflare challenge
// page back (not JSON), so res.json() throws and the opening panels show "no
// master games" (or silently fall back to mock stats) even for the starting
// position. This server-side proxy fixes that for ALL explorer consumers:
//   - server-to-server request (no CORS / browser challenge)
//   - shared in-memory cache per query (masters/community stats are ~static),
//     which also respects Lichess's ~1 req/s soft limit across all users
//   - outbound requests throttled and de-duplicated per identical query
//
// It is a thin, allowlisted pass-through of the Lichess explorer JSON so both
// the Opening Explorer panel (fen=) and the Repertoire book stats (play=,
// ratings=, speeds=) can share it. Any upstream failure degrades to an empty
// {moves:[]} result, never a crash.

import { Router, type Request, type Response } from "express";

const router = Router();

// db -> upstream base. Only these two explorer DBs are reachable.
const UPSTREAM: Record<string, string> = {
  masters: "https://explorer.lichess.ovh/masters",
  lichess: "https://explorer.lichess.ovh/lichess",
};
// Query params we forward to Lichess. Anything else is dropped.
const ALLOWED = ["fen", "play", "moves", "topGames", "recentGames", "ratings", "speeds", "since", "until"] as const;

const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12h — explorer aggregates barely move
const NEG_TTL_MS = 5 * 60 * 1000; // cache upstream failures briefly to avoid hammering
const MIN_INTERVAL_MS = 1100; // keep under Lichess's ~1 req/s soft limit
const MAX_CACHE = 5000;

const cache = new Map<string, { ts: number; data: unknown | null }>();
// De-dupe concurrent identical requests into a single upstream call.
const inflight = new Map<string, Promise<unknown | null>>();
let lastFetchAt = 0;

function prune(): void {
  if (cache.size <= MAX_CACHE) return;
  const entries = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts);
  const drop = Math.ceil(entries.length * 0.1);
  for (let i = 0; i < drop; i++) cache.delete(entries[i][0]);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Build a canonical upstream URL from allowlisted params + a matching cache key.
function buildQuery(req: Request): { db: string; qs: string; key: string } | null {
  const db = String(req.query.db || "masters").toLowerCase();
  if (!UPSTREAM[db]) return null;
  const sp = new URLSearchParams();
  for (const k of ALLOWED) {
    const v = req.query[k];
    if (v == null || v === "") continue;
    sp.set(k, String(v).slice(0, 400)); // hard length guard
  }
  // must have a position anchor
  if (!sp.has("fen") && !sp.has("play")) return null;
  // sensible defaults
  if (!sp.has("topGames")) sp.set("topGames", "0");
  if (!sp.has("recentGames")) sp.set("recentGames", "0");
  const qs = sp.toString();
  return { db, qs, key: `${db}?${qs}` };
}

async function fetchUpstream(db: string, qs: string): Promise<unknown | null> {
  // Global outbound throttle so bursts of users don't trip the rate limit.
  const wait = MIN_INTERVAL_MS - (Date.now() - lastFetchAt);
  if (wait > 0) await sleep(wait);
  lastFetchAt = Date.now();

  const url = `${UPSTREAM[db]}?${qs}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "AEVION-CyberChess/1.0 (opening explorer proxy)",
      },
    });
    if (!r.ok) return null;
    const ct = r.headers.get("content-type") || "";
    if (!ct.includes("json")) return null; // HTML challenge page → treat as failure
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

const EMPTY = { white: 0, draws: 0, black: 0, opening: null, moves: [] as unknown[] };

// GET / — explorer pass-through.
// Query: db (masters|lichess, default masters), fen | play (one required),
//        moves, topGames, recentGames, ratings, speeds.
router.get("/", async (req: Request, res: Response): Promise<void> => {
  const q = buildQuery(req);
  if (!q) {
    res.json({ ok: true, cached: false, ...EMPTY });
    return;
  }

  const now = Date.now();
  const hit = cache.get(q.key);
  if (hit) {
    const ttl = hit.data ? CACHE_TTL_MS : NEG_TTL_MS;
    if (now - hit.ts < ttl) {
      res.json({ ok: true, cached: true, ...(hit.data ? (hit.data as object) : EMPTY) });
      return;
    }
  }

  try {
    let p = inflight.get(q.key);
    if (!p) {
      p = fetchUpstream(q.db, q.qs).then((data) => {
        cache.set(q.key, { ts: Date.now(), data });
        prune();
        inflight.delete(q.key);
        return data;
      });
      inflight.set(q.key, p);
    }
    const data = await p;
    res.json({ ok: true, cached: false, ...(data ? (data as object) : EMPTY) });
  } catch (e) {
    inflight.delete(q.key);
    console.warn("[cyberchess-opening] proxy failed:", e instanceof Error ? e.message : e);
    res.json({ ok: true, cached: false, ...EMPTY });
  }
});

export default router;
