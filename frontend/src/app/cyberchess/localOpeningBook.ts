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

import { Chess, type Square } from "chess.js";

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

function ensureLoaded(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const r = await fetch("/openings.json");
      const rows = (await r.json()) as OpeningRow[];
      if (Array.isArray(rows)) build(rows);
    } catch {
      /* leave maps empty — caller degrades to "out of book" */
    }
  })();
  return loadPromise;
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
