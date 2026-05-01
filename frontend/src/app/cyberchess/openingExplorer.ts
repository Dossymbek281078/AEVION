/* ═══ Opening Explorer ═══
   Тонкая обёртка вокруг Lichess masters API.
   Возвращает топ-ходы из мастерской базы для текущей позиции. */

export type OpeningMove = {
  uci: string; // e.g. "e2e4"
  san: string;
  white: number;
  draws: number;
  black: number;
  averageRating?: number;
};

export type OpeningEntry = {
  white: number;
  draws: number;
  black: number;
  total: number;
  opening?: { eco?: string; name?: string };
  moves: OpeningMove[];
};

const cache = new Map<string, { ts: number; data: OpeningEntry | null }>();
const TTL_MS = 30 * 60 * 1000; // 30 минут

const ENDPOINT = "https://explorer.lichess.ovh/masters";

export async function fetchOpening(fen: string, signal?: AbortSignal): Promise<OpeningEntry | null> {
  const key = fen;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.ts < TTL_MS) return hit.data;
  try {
    const url = `${ENDPOINT}?fen=${encodeURIComponent(fen)}&topGames=0&moves=10`;
    const res = await fetch(url, { signal });
    if (!res.ok) {
      cache.set(key, { ts: now, data: null });
      return null;
    }
    const j = await res.json();
    const data: OpeningEntry = {
      white: j.white || 0,
      draws: j.draws || 0,
      black: j.black || 0,
      total: (j.white || 0) + (j.draws || 0) + (j.black || 0),
      opening: j.opening,
      moves: (j.moves || []).map((m: any) => ({
        uci: m.uci,
        san: m.san,
        white: m.white || 0,
        draws: m.draws || 0,
        black: m.black || 0,
        averageRating: m.averageRating,
      })),
    };
    cache.set(key, { ts: now, data });
    return data;
  } catch {
    return null;
  }
}

// Ratings of moves: probability-weighted from masters DB.
export function moveTotal(m: OpeningMove): number {
  return m.white + m.draws + m.black;
}

export function whitePct(m: OpeningMove | OpeningEntry): number {
  const t = m.white + m.draws + m.black;
  return t > 0 ? Math.round((m.white / t) * 100) : 0;
}
export function blackPct(m: OpeningMove | OpeningEntry): number {
  const t = m.white + m.draws + m.black;
  return t > 0 ? Math.round((m.black / t) * 100) : 0;
}
export function drawPct(m: OpeningMove | OpeningEntry): number {
  const t = m.white + m.draws + m.black;
  return t > 0 ? Math.round((m.draws / t) * 100) : 0;
}

// Format big numbers — 2400 → "2.4k", 1200000 → "1.2M".
export function shortNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}
