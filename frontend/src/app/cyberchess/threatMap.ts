/* ═══ Threat Heatmap ═══
   Считает, сколько раз каждая клетка контролируется/атакована
   белыми и чёрными. В отличие от chess.com / lichess, мы рисуем
   полный градиент контроля — вся доска видна как поле боя.
   Чисто статически, без chess.js, по board()-snapshot. */

import type { PieceSymbol, Color } from "chess.js";

export type ThreatCell = { w: number; b: number };
export type ThreatMap = ThreatCell[][]; // [rank 0..7][file 0..7] — rank 0 = 8

type Sq = { type: PieceSymbol; color: Color } | null;
export type BoardLike = Sq[][];

const inBounds = (r: number, f: number) => r >= 0 && r < 8 && f >= 0 && f < 8;

// Knight L-jumps
const KN_DELTAS: [number, number][] = [
  [-2, -1], [-2, 1], [-1, -2], [-1, 2],
  [1, -2], [1, 2], [2, -1], [2, 1],
];

// Bishop / Rook / Queen rays
const BISHOP_RAYS: [number, number][] = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const ROOK_RAYS: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const QUEEN_RAYS: [number, number][] = [...BISHOP_RAYS, ...ROOK_RAYS];

// King single-step
const KING_DELTAS: [number, number][] = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1],
];

function emptyMap(): ThreatMap {
  return Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => ({ w: 0, b: 0 } as ThreatCell)),
  );
}

function bump(m: ThreatMap, r: number, f: number, c: Color) {
  if (!inBounds(r, f)) return;
  if (c === "w") m[r][f].w++;
  else m[r][f].b++;
}

function castRay(
  m: ThreatMap,
  board: BoardLike,
  r: number,
  f: number,
  dr: number,
  df: number,
  c: Color,
) {
  let rr = r + dr;
  let ff = f + df;
  while (inBounds(rr, ff)) {
    bump(m, rr, ff, c);
    if (board[rr][ff]) break; // blocker stops attack ray
    rr += dr;
    ff += df;
  }
}

export function computeThreatMap(board: BoardLike): ThreatMap {
  const m = emptyMap();
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const piece = board[r][f];
      if (!piece) continue;
      const c = piece.color;
      switch (piece.type) {
        case "p": {
          // Pawn attacks diagonally forward — white moves up the board (rank index decreases)
          const dir = c === "w" ? -1 : 1;
          bump(m, r + dir, f - 1, c);
          bump(m, r + dir, f + 1, c);
          break;
        }
        case "n":
          for (const [dr, df] of KN_DELTAS) bump(m, r + dr, f + df, c);
          break;
        case "b":
          for (const [dr, df] of BISHOP_RAYS) castRay(m, board, r, f, dr, df, c);
          break;
        case "r":
          for (const [dr, df] of ROOK_RAYS) castRay(m, board, r, f, dr, df, c);
          break;
        case "q":
          for (const [dr, df] of QUEEN_RAYS) castRay(m, board, r, f, dr, df, c);
          break;
        case "k":
          for (const [dr, df] of KING_DELTAS) bump(m, r + dr, f + df, c);
          break;
      }
    }
  }
  return m;
}

export type CellSummary = {
  w: number;
  b: number;
  net: number; // w - b
  dominance: "white" | "black" | "contested" | "neutral";
};

export function summarizeCell(c: ThreatCell): CellSummary {
  const net = c.w - c.b;
  let dominance: CellSummary["dominance"] = "neutral";
  if (c.w === 0 && c.b === 0) dominance = "neutral";
  else if (c.w > 0 && c.b > 0) dominance = "contested";
  else if (c.w > c.b) dominance = "white";
  else if (c.b > c.w) dominance = "black";
  return { w: c.w, b: c.b, net, dominance };
}

// rgba для overlay'я. Мягкий зелёный = белые, мягкий красный = чёрные, серый = спорные.
export function cellColor(c: ThreatCell): string {
  if (c.w === 0 && c.b === 0) return "transparent";
  const net = c.w - c.b;
  const intensity = Math.min(1, Math.abs(net) / 3);
  if (c.w > 0 && c.b > 0 && net === 0) {
    // Contested — янтарный
    const mag = Math.min(1, Math.max(c.w, c.b) / 3);
    return `rgba(245, 158, 11, ${0.18 + mag * 0.22})`;
  }
  if (net > 0) return `rgba(16, 185, 129, ${0.15 + intensity * 0.35})`;
  if (net < 0) return `rgba(239, 68, 68, ${0.15 + intensity * 0.35})`;
  return "transparent";
}

// Краткий отчёт: сколько клеток доминирует каждая сторона + спорных + ничейных + центр-контроль.
export type ThreatReport = {
  whiteDom: number;
  blackDom: number;
  contested: number;
  neutral: number;
  centerWhite: number; // attacks on d4/d5/e4/e5 by white
  centerBlack: number;
  edgeWhite: number;
  edgeBlack: number;
};

export function reportThreatMap(m: ThreatMap): ThreatReport {
  let whiteDom = 0, blackDom = 0, contested = 0, neutral = 0;
  let centerWhite = 0, centerBlack = 0, edgeWhite = 0, edgeBlack = 0;
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const cell = m[r][f];
      const isCenter = (r === 3 || r === 4) && (f === 3 || f === 4);
      const isEdge = r === 0 || r === 7 || f === 0 || f === 7;
      if (cell.w === 0 && cell.b === 0) neutral++;
      else if (cell.w > 0 && cell.b > 0 && cell.w === cell.b) contested++;
      else if (cell.w > cell.b) whiteDom++;
      else if (cell.b > cell.w) blackDom++;
      else contested++;
      if (isCenter) {
        centerWhite += cell.w;
        centerBlack += cell.b;
      }
      if (isEdge) {
        edgeWhite += cell.w;
        edgeBlack += cell.b;
      }
    }
  }
  return { whiteDom, blackDom, contested, neutral, centerWhite, centerBlack, edgeWhite, edgeBlack };
}
