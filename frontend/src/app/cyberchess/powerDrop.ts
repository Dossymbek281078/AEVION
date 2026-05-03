// Power Drop — Crazyhouse-style ресурс. Захваченные фигуры идут в "пул"
// той стороны, которая взяла. Раз в 5 полуходов сторона, чей ход, может
// дропнуть фигуру из пула на пустую клетку (вместо обычного хода).
// Король не дропается. Пешки не дропаются на 1-ю/8-ю.
//
// chess.js не умеет drops нативно — реализуем через mutate+put, и ход
// заканчивается переключением FEN side-to-move.

import type { PieceSymbol } from "chess.js";

export type DropPool = {
  // Counts of each piece type each side has captured
  w: { p: number; n: number; b: number; r: number; q: number };
  b: { p: number; n: number; b: number; r: number; q: number };
};

export const EMPTY_POOL: DropPool = {
  w: { p: 0, n: 0, b: 0, r: 0, q: 0 },
  b: { p: 0, n: 0, b: 0, r: 0, q: 0 },
};

// On capture: piece taken belongs to opponent → it goes to capturer's pool.
// captured: chess.js's `captured` field (lowercase piece type).
// capturer: color that did the capture ("w" or "b").
export function addToPool(pool: DropPool, captured: PieceSymbol, capturer: "w" | "b"): DropPool {
  const t = captured as keyof DropPool["w"];
  if (t === "k" as any) return pool; // king never goes to pool
  return {
    ...pool,
    [capturer]: { ...pool[capturer], [t]: pool[capturer][t] + 1 },
  };
}

// Remove one piece from a pool (after a successful drop).
export function removeFromPool(pool: DropPool, type: PieceSymbol, side: "w" | "b"): DropPool {
  const t = type as keyof DropPool["w"];
  if (pool[side][t] <= 0) return pool;
  return {
    ...pool,
    [side]: { ...pool[side], [t]: pool[side][t] - 1 },
  };
}

// Total pieces a side has in pool
export function poolSize(pool: DropPool, side: "w" | "b"): number {
  const p = pool[side];
  return p.p + p.n + p.b + p.r + p.q;
}

// Check: is this drop legal?
// - target square must be empty
// - pawn drops not on 1st/8th rank
// - side must have piece in pool
export function isDropLegal(pool: DropPool, type: PieceSymbol, side: "w" | "b", targetSq: string, fen: string): boolean {
  const t = type as keyof DropPool["w"];
  if (pool[side][t] <= 0) return false;
  if (type === "p" && (targetSq[1] === "1" || targetSq[1] === "8")) return false;
  // Check target empty by parsing FEN
  try {
    const placement = fen.split(" ")[0];
    const ranks = placement.split("/");
    const file = targetSq.charCodeAt(0) - 97;
    const rank = 8 - parseInt(targetSq[1]);
    let f = 0;
    for (const c of ranks[rank]) {
      if (/\d/.test(c)) {
        if (file >= f && file < f + parseInt(c)) return true; // empty
        f += parseInt(c);
      } else {
        if (file === f) return false; // occupied
        f++;
      }
    }
    return f === file; // should not reach here normally; treat unknown as legal
  } catch { return false }
}

// Build a new FEN with piece dropped at target. Side-to-move toggles.
export function applyDrop(fen: string, type: PieceSymbol, side: "w" | "b", targetSq: string): string {
  const parts = fen.split(" ");
  const ranks = parts[0].split("/");
  const grid: string[][] = ranks.map(r => {
    const row: string[] = [];
    for (const c of r) {
      if (/\d/.test(c)) for (let k = 0; k < parseInt(c); k++) row.push(".");
      else row.push(c);
    }
    return row;
  });
  const file = targetSq.charCodeAt(0) - 97;
  const rank = 8 - parseInt(targetSq[1]);
  const sym = side === "w" ? type.toUpperCase() : type.toLowerCase();
  grid[rank][file] = sym;
  const newRanks = grid.map(row => {
    let out = "", run = 0;
    for (const c of row) {
      if (c === ".") run++;
      else { if (run > 0) { out += run; run = 0 } out += c }
    }
    if (run > 0) out += run;
    return out;
  });
  parts[0] = newRanks.join("/");
  // Toggle side
  parts[1] = parts[1] === "w" ? "b" : "w";
  // Reset en-passant + halfmove (drop counts as new piece)
  parts[3] = "-";
  parts[4] = "0";
  // Increment fullmove if it's now white's turn
  if (parts[1] === "w") parts[5] = String((parseInt(parts[5] || "1")) + 1);
  return parts.join(" ");
}

// Drops are allowed only every Nth ply (5 by default) for the side to move.
// Returns true if current ply count makes drop available.
export function isDropAvailable(plyCount: number, dropEveryN = 5): boolean {
  if (plyCount === 0) return false;
  return plyCount % dropEveryN === 0;
}

// Helper: piece-type emoji/glyph for UI
export const POOL_GLYPH: Record<string, string> = {
  P: "♙", N: "♘", B: "♗", R: "♖", Q: "♕",
  p: "♟", n: "♞", b: "♝", r: "♜", q: "♛",
};
