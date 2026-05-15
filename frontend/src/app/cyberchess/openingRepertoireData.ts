// Opening Repertoire — types + storage helpers
// Storage key: cc_opening_repertoire_v1
//
// Integrates with real Lichess Opening Explorer API:
//   https://explorer.lichess.ovh/lichess  — Lichess games DB (community)
//   https://explorer.lichess.ovh/masters  — Masters DB (rated 2200+, OTB)
//
// Rate-limit: ~60 req/min per IP — aggressive caching via Map + TTL.
// Offline fallback: existing mock helpers (mockBookStats / mockStreak).

export type RepertoireColor = "white" | "black";

export type RepertoireBranch = {
  id: string;
  name: string;
  color: RepertoireColor;
  eco: string;
  moves: string[];
  notes?: string;
  attempts: number;
  successes: number;
  created: number;
  lastReview: number;
};

export type EcoPreset = {
  eco: string;
  name: string;
  moves: string[];
  color: RepertoireColor;
};

const STORAGE_KEY = "cc_opening_repertoire_v1";
const CACHE_TTL_KEY = "cc_opening_repertoire_cache_ttl_v1";

// 20 ECO presets — classic openings
export const ECO_PRESETS: EcoPreset[] = [
  { eco: "C50", name: "Italian Game", moves: ["e4", "e5", "Nf3", "Nc6", "Bc4"], color: "white" },
  { eco: "C60", name: "Ruy Lopez", moves: ["e4", "e5", "Nf3", "Nc6", "Bb5"], color: "white" },
  { eco: "C20", name: "King's Pawn Game", moves: ["e4", "e5"], color: "white" },
  { eco: "B20", name: "Sicilian Defense", moves: ["e4", "c5"], color: "black" },
  { eco: "B90", name: "Sicilian Najdorf", moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6"], color: "black" },
  { eco: "B10", name: "Caro-Kann Defense", moves: ["e4", "c6"], color: "black" },
  { eco: "C00", name: "French Defense", moves: ["e4", "e6"], color: "black" },
  { eco: "B07", name: "Pirc Defense", moves: ["e4", "d6", "d4", "Nf6"], color: "black" },
  { eco: "B01", name: "Scandinavian Defense", moves: ["e4", "d5"], color: "black" },
  { eco: "C40", name: "King's Knight Opening", moves: ["e4", "e5", "Nf3"], color: "white" },
  { eco: "D02", name: "Queen's Pawn Game", moves: ["d4", "d5"], color: "white" },
  { eco: "D06", name: "Queen's Gambit", moves: ["d4", "d5", "c4"], color: "white" },
  { eco: "D30", name: "Queen's Gambit Declined", moves: ["d4", "d5", "c4", "e6"], color: "black" },
  { eco: "D80", name: "Grünfeld Defense", moves: ["d4", "Nf6", "c4", "g6", "Nc3", "d5"], color: "black" },
  { eco: "E60", name: "King's Indian Defense", moves: ["d4", "Nf6", "c4", "g6"], color: "black" },
  { eco: "E00", name: "Catalan Opening", moves: ["d4", "Nf6", "c4", "e6", "g3"], color: "white" },
  { eco: "A04", name: "Réti Opening", moves: ["Nf3"], color: "white" },
  { eco: "A10", name: "English Opening", moves: ["c4"], color: "white" },
  { eco: "A45", name: "Trompowsky Attack", moves: ["d4", "Nf6", "Bg5"], color: "white" },
  { eco: "C45", name: "Scotch Game", moves: ["e4", "e5", "Nf3", "Nc6", "d4"], color: "white" },
];

// Book stats — top replies + winrate
export type BookReply = {
  move: string;
  games: number;
  white: number; // % white wins
  draw: number; // %
  black: number; // %
  averageRating?: number;
};

export type EcoInfo = { eco: string; name: string };

export type GMGame = {
  id?: string;
  white: { name: string; rating?: number };
  black: { name: string; rating?: number };
  result: "1-0" | "0-1" | "1/2-1/2" | "*";
  year?: number;
  event?: string;
  url?: string; // open in lichess (when id available)
};

// ===== Cache infra =====

type CacheEntry<T> = { ts: number; data: T };

const bookStatsCache = new Map<string, CacheEntry<BookReply[]>>();
const ecoCache = new Map<string, CacheEntry<EcoInfo>>(); // key = fen
const gmGamesCache = new Map<string, CacheEntry<GMGame[]>>(); // key = eco or moves

// TTL presets (ms)
export const TTL_PRESETS = {
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
} as const;
export type TtlKey = keyof typeof TTL_PRESETS;

export function getCacheTtl(): TtlKey {
  if (typeof window === "undefined") return "day";
  try {
    const raw = window.localStorage.getItem(CACHE_TTL_KEY);
    if (raw === "hour" || raw === "day" || raw === "week") return raw;
  } catch {
    // ignore
  }
  return "day";
}

export function setCacheTtl(ttl: TtlKey): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_TTL_KEY, ttl);
  } catch {
    // ignore
  }
}

function ttlMs(): number {
  return TTL_PRESETS[getCacheTtl()];
}

export function clearRepertoireCaches(): void {
  bookStatsCache.clear();
  ecoCache.clear();
  gmGamesCache.clear();
}

// ===== Lichess Explorer API =====

const LICHESS_GAMES_ENDPOINT = "https://explorer.lichess.ovh/lichess";
const LICHESS_MASTERS_ENDPOINT = "https://explorer.lichess.ovh/masters";

// Use `play` param (UCI list) where possible to skip FEN computation,
// but Lichess explorer requires either `fen` or `play`. We'll use `play`
// (comma-separated UCI) when caller supplies UCI; otherwise SAN moves
// need a chess engine to convert — we fall back to mock when no UCI.

async function lichessExplorerFetch(
  endpoint: string,
  params: Record<string, string>,
  signal?: AbortSignal
): Promise<any | null> {
  try {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`${endpoint}?${qs}`, { signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Real book stats from Lichess Community DB (large sample, modern games).
 *
 * Strategy:
 * - Cache by branchMoves.join("-") key
 * - Try `play=` with SAN list (Lichess actually supports SAN through `play` if
 *   moves are comma-separated SAN — confirmed in their docs as `play` accepts
 *   UCI; for SAN we use `play` with san=true... actually safer: send raw SAN
 *   through the `play` param won't work). We use a different approach:
 *   we don't have UCI here, so try a best-effort lookup. If it fails, return
 *   mock fallback so UI never breaks.
 *
 * If branchMovesUci is provided (UCI list), we send it as `play`.
 */
export async function fetchRealBookStats(
  branchMoves: string[],
  opts?: { uciMoves?: string[]; signal?: AbortSignal; ratings?: number[]; speeds?: string[] }
): Promise<BookReply[]> {
  const key = branchMoves.join("-") || "(root)";
  const now = Date.now();
  const hit = bookStatsCache.get(key);
  if (hit && now - hit.ts < ttlMs()) return hit.data;

  // Need UCI for Lichess `play` param. If not provided, fall back to mock.
  const uci = opts?.uciMoves;
  if (!uci || uci.length === 0) {
    const fallback = mockBookStatsFromMoves(branchMoves);
    bookStatsCache.set(key, { ts: now, data: fallback });
    return fallback;
  }

  const params: Record<string, string> = {
    play: uci.join(","),
    moves: "5",
    topGames: "0",
    recentGames: "0",
  };
  if (opts?.ratings && opts.ratings.length) params.ratings = opts.ratings.join(",");
  if (opts?.speeds && opts.speeds.length) params.speeds = opts.speeds.join(",");

  const json = await lichessExplorerFetch(LICHESS_GAMES_ENDPOINT, params, opts?.signal);
  if (!json) {
    const fallback = mockBookStatsFromMoves(branchMoves);
    bookStatsCache.set(key, { ts: now, data: fallback });
    return fallback;
  }

  const replies: BookReply[] = (json.moves || []).slice(0, 5).map((m: any) => {
    const w = m.white || 0;
    const d = m.draws || 0;
    const b = m.black || 0;
    const total = w + d + b;
    return {
      move: m.san,
      games: total,
      white: total > 0 ? Math.round((w / total) * 100) : 0,
      draw: total > 0 ? Math.round((d / total) * 100) : 0,
      black: total > 0 ? Math.round((b / total) * 100) : 0,
      averageRating: m.averageRating,
    };
  });

  bookStatsCache.set(key, { ts: now, data: replies });
  return replies;
}

/**
 * Aggregate winrate totals (white/draw/black) for the position
 * AFTER playing branchMoves (UCI). Returns null if no UCI / no data.
 */
export type PositionTotals = {
  white: number;
  draws: number;
  black: number;
  total: number;
  opening?: EcoInfo;
};

export async function fetchPositionTotals(
  branchMoves: string[],
  opts?: { uciMoves?: string[]; signal?: AbortSignal }
): Promise<PositionTotals | null> {
  const uci = opts?.uciMoves;
  if (!uci || uci.length === 0) return null;

  const params: Record<string, string> = {
    play: uci.join(","),
    moves: "0",
    topGames: "0",
    recentGames: "0",
  };
  const json = await lichessExplorerFetch(LICHESS_GAMES_ENDPOINT, params, opts?.signal);
  if (!json) return null;
  const white = json.white || 0;
  const draws = json.draws || 0;
  const black = json.black || 0;
  const total = white + draws + black;
  return {
    white,
    draws,
    black,
    total,
    opening: json.opening
      ? { eco: json.opening.eco || "", name: json.opening.name || "" }
      : undefined,
  };
}

/**
 * Detect ECO + name for a given FEN via masters DB.
 */
export async function detectECO(
  fen: string,
  signal?: AbortSignal
): Promise<EcoInfo | null> {
  const now = Date.now();
  const hit = ecoCache.get(fen);
  if (hit && now - hit.ts < ttlMs()) return hit.data;

  const json = await lichessExplorerFetch(
    LICHESS_MASTERS_ENDPOINT,
    { fen, moves: "0", topGames: "0" },
    signal
  );
  if (!json || !json.opening) return null;
  const info: EcoInfo = {
    eco: json.opening.eco || "",
    name: json.opening.name || "",
  };
  ecoCache.set(fen, { ts: now, data: info });
  return info;
}

/**
 * Detect ECO from UCI move list (alternative path when FEN not available).
 */
export async function detectECOFromMoves(
  uciMoves: string[],
  signal?: AbortSignal
): Promise<EcoInfo | null> {
  const key = `uci:${uciMoves.join(",")}`;
  const now = Date.now();
  const hit = ecoCache.get(key);
  if (hit && now - hit.ts < ttlMs()) return hit.data;

  const json = await lichessExplorerFetch(
    LICHESS_MASTERS_ENDPOINT,
    { play: uciMoves.join(","), moves: "0", topGames: "0" },
    signal
  );
  if (!json || !json.opening) return null;
  const info: EcoInfo = {
    eco: json.opening.eco || "",
    name: json.opening.name || "",
  };
  ecoCache.set(key, { ts: now, data: info });
  return info;
}

/**
 * Fetch top GM (master) games for a given position (by UCI move list)
 * filtered conceptually by ECO. Lichess masters endpoint returns topGames
 * for the position — that's the most accurate path. ECO label is used
 * only for cache key when UCI unavailable.
 */
export async function fetchGMGames(
  eco: string,
  opts?: { uciMoves?: string[]; signal?: AbortSignal; limit?: number }
): Promise<GMGame[]> {
  const limit = opts?.limit ?? 10;
  const key = opts?.uciMoves?.length
    ? `uci:${opts.uciMoves.join(",")}`
    : `eco:${eco}`;
  const now = Date.now();
  const hit = gmGamesCache.get(key);
  if (hit && now - hit.ts < ttlMs()) return hit.data.slice(0, limit);

  // If we have UCI, use masters endpoint with `play`
  const params: Record<string, string> = {
    moves: "0",
    topGames: String(limit),
  };
  if (opts?.uciMoves?.length) {
    params.play = opts.uciMoves.join(",");
  } else {
    // No UCI — we can't query by ECO directly. Return empty (mock fallback).
    return [];
  }

  const json = await lichessExplorerFetch(LICHESS_MASTERS_ENDPOINT, params, opts?.signal);
  if (!json) return [];

  const games: GMGame[] = (json.topGames || []).map((g: any) => ({
    id: g.id,
    white: { name: g.white?.name || "?", rating: g.white?.rating },
    black: { name: g.black?.name || "?", rating: g.black?.rating },
    result: (g.winner === "white"
      ? "1-0"
      : g.winner === "black"
      ? "0-1"
      : "1/2-1/2") as GMGame["result"],
    year: g.year,
    event: g.month
      ? `${g.month}`
      : undefined,
    url: g.id ? `https://lichess.org/${g.id}` : undefined,
  }));

  gmGamesCache.set(key, { ts: now, data: games });
  return games.slice(0, limit);
}

// ===== Mock fallbacks (offline / no UCI) =====

/** Deterministic mock derived from move sequence (replaces hash-by-id). */
function mockBookStatsFromMoves(branchMoves: string[]): BookReply[] {
  const seed =
    branchMoves.join("").split("").reduce((a, c) => a + c.charCodeAt(0), 0) || 7;
  const base = (seed % 30) + 20;

  const replyPools: Record<string, string[]> = {
    e4: ["e5", "c5", "e6", "c6", "d5"],
    d4: ["d5", "Nf6", "f5", "e6", "d6"],
    Nf3: ["d5", "Nf6", "c5", "g6"],
    c4: ["e5", "c5", "Nf6", "e6"],
  };
  const lastMove = branchMoves[branchMoves.length - 1] || "e4";
  const candidates = replyPools[lastMove] || ["Nf6", "d5", "e6"];

  return candidates.slice(0, 3).map((m, i) => {
    const games = 12000 - i * 3200 - (seed % 500);
    const white = base + (i === 0 ? 8 : i === 1 ? 2 : -4) + (seed % 5);
    const draw = 28 + i * 3 - (seed % 4);
    const black = Math.max(100 - white - draw, 10);
    return { move: m, games, white, draw, black };
  });
}

// Kept for backward compatibility (used elsewhere in legacy code paths)
export function mockBookStats(branch: RepertoireBranch): BookReply[] {
  return mockBookStatsFromMoves(branch.moves);
}

// ===== Persistence =====

export function loadRepertoire(): RepertoireBranch[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seed = defaultRepertoire();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaultRepertoire();
    return parsed as RepertoireBranch[];
  } catch {
    return defaultRepertoire();
  }
}

export function saveRepertoire(branches: RepertoireBranch[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(branches));
  } catch {
    // ignore quota errors
  }
}

export function defaultRepertoire(): RepertoireBranch[] {
  const now = Date.now();
  return [
    {
      id: "seed-italian",
      name: "Italian Game — main line",
      color: "white",
      eco: "C50",
      moves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5"],
      notes: "Classical Giuoco Piano — solid white setup.",
      attempts: 0,
      successes: 0,
      created: now - 86400000 * 7,
      lastReview: 0,
    },
    {
      id: "seed-caro",
      name: "Caro-Kann — Advance variation",
      color: "black",
      eco: "B10",
      moves: ["e4", "c6", "d4", "d5", "e5", "Bf5"],
      notes: "Solid Black setup vs 1.e4. Develop Bf5 before e6.",
      attempts: 0,
      successes: 0,
      created: now - 86400000 * 5,
      lastReview: 0,
    },
    {
      id: "seed-najdorf",
      name: "Sicilian Najdorf",
      color: "black",
      eco: "B90",
      moves: ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6"],
      notes: "Razor-sharp — needs concrete prep.",
      attempts: 0,
      successes: 0,
      created: now - 86400000 * 3,
      lastReview: 0,
    },
    {
      id: "seed-qgd",
      name: "Queen's Gambit — main",
      color: "white",
      eco: "D06",
      moves: ["d4", "d5", "c4", "e6", "Nc3", "Nf6"],
      notes: "Closed positional play. Aim for minority attack.",
      attempts: 0,
      successes: 0,
      created: now - 86400000,
      lastReview: 0,
    },
  ];
}

export function newBranchFromPreset(preset: EcoPreset, name?: string): RepertoireBranch {
  const now = Date.now();
  return {
    id: `branch-${now}-${Math.random().toString(36).slice(2, 8)}`,
    name: name || preset.name,
    color: preset.color,
    eco: preset.eco,
    moves: [...preset.moves],
    notes: "",
    attempts: 0,
    successes: 0,
    created: now,
    lastReview: 0,
  };
}

export function newBranchFromEco(
  eco: string,
  name: string,
  moves: string[],
  color: RepertoireColor,
  notes?: string
): RepertoireBranch {
  const now = Date.now();
  return {
    id: `branch-${now}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    color,
    eco,
    moves: [...moves],
    notes: notes || "",
    attempts: 0,
    successes: 0,
    created: now,
    lastReview: 0,
  };
}

export function successRate(b: RepertoireBranch): number {
  if (b.attempts === 0) return 0;
  return Math.round((b.successes / b.attempts) * 100);
}

// Mock 7-day streak — derived from id hash + attempts
export function recentStreak(b: RepertoireBranch): boolean[] {
  const hash = b.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return Array.from({ length: 7 }, (_, i) => {
    const v = (hash + i * 31 + b.attempts) % 5;
    return v < 3; // ~60% success days
  });
}

// ===== Export / Import =====

export type RepertoireExport = {
  version: 1;
  exportedAt: number;
  branches: RepertoireBranch[];
};

export function exportRepertoireJson(branches: RepertoireBranch[]): string {
  const payload: RepertoireExport = {
    version: 1,
    exportedAt: Date.now(),
    branches,
  };
  return JSON.stringify(payload, null, 2);
}

export function importRepertoireJson(raw: string): RepertoireBranch[] | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.branches)) {
      return parsed.branches as RepertoireBranch[];
    }
    if (Array.isArray(parsed)) {
      return parsed as RepertoireBranch[];
    }
    return null;
  } catch {
    return null;
  }
}
