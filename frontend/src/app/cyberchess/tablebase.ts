/* ═══ Endgame Tablebase ═══
   Lichess Syzygy API wrapper. Для позиций ≤7 фигур возвращает
   идеальный ход с оценкой (win/draw/loss + DTM/DTZ). */

export type TablebaseCategory =
  | "win"
  | "loss"
  | "draw"
  | "cursed-win"
  | "blessed-loss"
  | "maybe-win"
  | "maybe-loss"
  | "unknown";

export type TablebaseMove = {
  uci: string;
  san: string;
  category: TablebaseCategory;
  dtm: number | null; // depth-to-mate (signed)
  dtz: number | null; // depth-to-zeroing (signed)
  zeroing: boolean;
  checkmate: boolean;
  stalemate: boolean;
};

export type TablebaseEntry = {
  category: TablebaseCategory;
  dtm: number | null;
  dtz: number | null;
  checkmate: boolean;
  stalemate: boolean;
  moves: TablebaseMove[];
};

const cache = new Map<string, { ts: number; data: TablebaseEntry | null }>();
const TTL_MS = 60 * 60 * 1000; // 1 час
const ENDPOINT = "https://tablebase.lichess.ovh/standard";

// Count pieces in a FEN's placement field.
export function pieceCount(fen: string): number {
  const placement = fen.split(" ")[0] || "";
  let n = 0;
  for (const ch of placement) if (/[a-zA-Z]/.test(ch)) n++;
  return n;
}

// Tablebase covers ≤7. Anything more = skip the API.
export function isTablebaseEligible(fen: string): boolean {
  return pieceCount(fen) <= 7;
}

export async function fetchTablebase(fen: string, signal?: AbortSignal): Promise<TablebaseEntry | null> {
  if (!isTablebaseEligible(fen)) return null;
  const key = fen;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.ts < TTL_MS) return hit.data;
  try {
    const url = `${ENDPOINT}?fen=${encodeURIComponent(fen)}`;
    const res = await fetch(url, { signal });
    if (!res.ok) {
      cache.set(key, { ts: now, data: null });
      return null;
    }
    const j = await res.json();
    const data: TablebaseEntry = {
      category: (j.category || "unknown") as TablebaseCategory,
      dtm: j.dtm ?? null,
      dtz: j.dtz ?? null,
      checkmate: !!j.checkmate,
      stalemate: !!j.stalemate,
      moves: (j.moves || []).map((m: any) => ({
        uci: m.uci,
        san: m.san,
        category: (m.category || "unknown") as TablebaseCategory,
        dtm: m.dtm ?? null,
        dtz: m.dtz ?? null,
        zeroing: !!m.zeroing,
        checkmate: !!m.checkmate,
        stalemate: !!m.stalemate,
      })),
    };
    cache.set(key, { ts: now, data });
    return data;
  } catch {
    return null;
  }
}

export function categoryLabel(c: TablebaseCategory, side: "w" | "b"): string {
  // category отдаётся с точки зрения «кто ходит». Для ясности добавим знак.
  switch (c) {
    case "win": return side === "w" ? "Белые выигрывают" : "Чёрные выигрывают";
    case "loss": return side === "w" ? "Белые проиграют" : "Чёрные проиграют";
    case "draw": return "Ничья при правильной игре";
    case "cursed-win": return "Выигрыш (50-ход правило мешает)";
    case "blessed-loss": return "Проигрыш (50-ход правило спасает)";
    default: return "Не определено";
  }
}

export function categoryColor(c: TablebaseCategory): string {
  switch (c) {
    case "win": return "#10b981";
    case "loss": return "#ef4444";
    case "draw": return "#94a3b8";
    case "cursed-win": return "#3b82f6";
    case "blessed-loss": return "#a78bfa";
    default: return "#94a3b8";
  }
}
