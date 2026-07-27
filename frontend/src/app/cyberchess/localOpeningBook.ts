/* AEVION CyberChess — self-contained local opening book.

   Fallback for the Opening Explorer when the live Lichess Masters API is
   unavailable. Since Feb 2026 Lichess gated explorer.lichess.ovh behind login
   (anonymous access disabled over DDoS concerns), so without a Lichess API
   token the master-games endpoint returns 401. Rather than show an empty
   "no master games" panel, we derive real book continuations from the bundled
   /openings.json (~3,800 named ECO lines from the CC0 lichess-org/chess-openings
   dataset → ~5,500 positions) — computed entirely client-side with chess.js.
   No stats (W/D/L) — this is theory/book moves, labelled honestly.
   Regenerate the dataset with scripts/expand-openings.mjs.

   Position key matches page.tsx: "<placement> <turn> <castling>" (ignores the
   en-passant / halfmove / fullmove fields so transpositions collapse). */

import { Chess, type Square, type Move } from "chess.js";

export type BookMove = {
  uci: string;
  san: string;
  eco: string;
  name: string;
  freq: number; // how many book lines pass through this move (popularity proxy)
};

export type BookResult = {
  opening: { eco: string; name: string } | null;
  moves: BookMove[];
};

type OpeningRow = { eco: string; name: string; moves: string; desc?: string };

// position key -> (uci -> continuation)
const contMap = new Map<string, Map<string, BookMove>>();
// position key -> opening identity reached at/after this position
const nameMap = new Map<string, { eco: string; name: string }>();
let loadPromise: Promise<void> | null = null;

/* Placement + side to move + castling. The en-passant and clock fields are
   dropped on purpose so transpositions collapse onto one entry.

   ⚠️ Callers must validate before playing. Because the key ignores the
   en-passant square, a position can match an entry whose continuation is an
   en-passant capture that is NOT legal in the position on the board. Both
   consumers hit this: the bot would have stalled the game outright (its move
   effect only re-runs when the board changes, and exec() drops an illegal move
   silently), and the explorer produced a dead click. Resolve any continuation
   against the real FEN with chess.js before handing it on. */
function keyOf(fen: string): string {
  const p = fen.split(" ");
  return `${p[0]} ${p[1]} ${p[2]}`;
}

function build(rows: OpeningRow[]): void {
  for (const op of rows) {
    try {
      const g = new Chess();
      const uciList = op.moves.trim().split(/\s+/);
      for (const uci of uciList) {
        if (uci.length < 4) continue;
        const beforeKey = keyOf(g.fen());
        let mv;
        try {
          mv = g.move({
            from: uci.slice(0, 2) as Square,
            to: uci.slice(2, 4) as Square,
            promotion: uci.length > 4 ? (uci[4] as "q" | "r" | "b" | "n") : undefined,
          });
        } catch {
          break; // malformed line — stop walking it
        }
        if (!mv) break;
        let bucket = contMap.get(beforeKey);
        if (!bucket) {
          bucket = new Map();
          contMap.set(beforeKey, bucket);
        }
        const existing = bucket.get(uci);
        if (existing) existing.freq++;
        else bucket.set(uci, { uci, san: mv.san, eco: op.eco, name: op.name, freq: 1 });
        // Name the resulting position (first line to reach it wins; longer,
        // more specific lines are appended later and keep their own leaves).
        const afterKey = keyOf(g.fen());
        if (!nameMap.has(afterKey)) nameMap.set(afterKey, { eco: op.eco, name: op.name });
      }
    } catch {
      /* skip a bad row, keep the rest */
    }
  }
}

/* Загрузка книги: провал НЕ кэшируется.
 *
 * Раньше `loadPromise` запоминался в любом случае, а ответ проверялся только тем,
 * что `r.json()` не бросил. Значит одна неудачная загрузка при старте — недоступная
 * сеть, 404 с HTML-страницей ошибки, обрыв — навсегда выключала книгу на всю
 * сессию: повторных попыток не было, а наружу это выглядело не как ошибка, а как
 * «бот слабый и играет 1.h4». Ровно то поведение, ради которого настраивается
 * bookChance, только уже не настраиваемое.
 *
 * Теперь проверяется r.ok, а при любом провале промис сбрасывается — следующий
 * ход попробует снова. Деградация остаётся тихой для игрока (партия не должна
 * падать из-за книги), но в консоль уходит предупреждение: без него отличить
 * «книга не загрузилась» от «бот вышел из книги» невозможно.
 */
function ensureLoaded(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const r = await fetch("/openings.json");
      if (!r.ok) throw new Error(`openings.json: HTTP ${r.status}`);
      const rows = (await r.json()) as OpeningRow[];
      if (!Array.isArray(rows)) throw new Error("openings.json: ожидался массив");
      build(rows);
    } catch (e) {
      loadPromise = null; // не запоминаем провал — следующий вызов попробует снова
      if (typeof console !== "undefined") console.warn("[cyberchess] книга дебютов не загрузилась:", e);
    }
  })();
  return loadPromise;
}

/**
 * Resolve a book continuation against the position actually on the board.
 * Returns null when it does not apply here — see keyOf(): the key ignores the
 * en-passant square, so a transposition can surface a continuation that is
 * illegal on this board. Every caller must go through this before playing a
 * book move; both of them shipped the bug once already.
 *
 * Prefers `uci` (what this book carries) and falls back to `san` (what the
 * deep tree carries, which has no UCI).
 */
export function resolveBookMove(fen: string, uci?: string, san?: string): Move | null {
  try {
    const g = new Chess(fen);
    if (uci && uci.length >= 4) {
      return g.move({
        from: uci.slice(0, 2) as Square,
        to: uci.slice(2, 4) as Square,
        promotion: (uci.length > 4 ? uci[4] : "q") as "q" | "r" | "b" | "n",
      });
    }
    return san ? g.move(san) : null;
  } catch {
    return null; // illegal in this position
  }
}

// Book continuations from `fen`, most-popular first. Empty moves[] = out of book.
export async function getBookContinuations(fen: string): Promise<BookResult> {
  await ensureLoaded();
  const key = keyOf(fen);
  const bucket = contMap.get(key);
  const moves = bucket
    ? [...bucket.values()].sort((a, b) => b.freq - a.freq || a.san.localeCompare(b.san)).slice(0, 12)
    : [];
  return { opening: nameMap.get(key) ?? null, moves };
}
