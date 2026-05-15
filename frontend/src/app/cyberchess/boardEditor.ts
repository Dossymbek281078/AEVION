/* ═══ Board Editor ═══
   Установи любую позицию: drag-фигуры, palette, очистка,
   стартовая, валидация, экспорт FEN. */

import { Chess } from "chess.js";
import type { PieceSymbol, Color } from "chess.js";

export type Cell = { type: PieceSymbol; color: Color } | null;
export type EditorBoard = Cell[][]; // [rank 0..7][file 0..7], 0 = ранк 8

export const PIECE_TYPES: PieceSymbol[] = ["p", "n", "b", "r", "q", "k"];
export const PIECE_NAMES: Record<PieceSymbol, string> = {
  p: "Пешка", n: "Конь", b: "Слон", r: "Ладья", q: "Ферзь", k: "Король",
};

export function emptyBoard(): EditorBoard {
  return Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null));
}

export function startingBoard(): EditorBoard {
  return fenToBoard("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
}

export function fenToBoard(fen: string): EditorBoard {
  const board: EditorBoard = emptyBoard();
  const placement = fen.split(" ")[0];
  const ranks = placement.split("/");
  for (let r = 0; r < 8 && r < ranks.length; r++) {
    let f = 0;
    for (const ch of ranks[r]) {
      if (/[1-8]/.test(ch)) {
        f += parseInt(ch);
      } else {
        const lower = ch.toLowerCase();
        if ("pnbrqk".includes(lower) && f < 8) {
          board[r][f] = {
            type: lower as PieceSymbol,
            color: ch === lower ? ("b" as Color) : ("w" as Color),
          };
          f++;
        }
      }
    }
  }
  return board;
}

export function boardToFen(
  board: EditorBoard,
  side: Color,
  castling = "KQkq",
  ep = "-",
): string {
  const rows: string[] = [];
  for (let r = 0; r < 8; r++) {
    let row = "";
    let empty = 0;
    for (let f = 0; f < 8; f++) {
      const cell = board[r][f];
      if (!cell) {
        empty++;
      } else {
        if (empty > 0) {
          row += empty;
          empty = 0;
        }
        const ch = cell.color === "w" ? cell.type.toUpperCase() : cell.type;
        row += ch;
      }
    }
    if (empty > 0) row += empty;
    rows.push(row);
  }
  const placement = rows.join("/");
  const castlingValid = sanitizeCastling(board, castling);
  return `${placement} ${side} ${castlingValid || "-"} ${ep} 0 1`;
}

function sanitizeCastling(board: EditorBoard, raw: string): string {
  // Castling rights are valid only if the corresponding king + rook are on
  // their original squares — otherwise FEN parsers complain.
  const wk = board[7][4]?.type === "k" && board[7][4]?.color === "w";
  const bk = board[0][4]?.type === "k" && board[0][4]?.color === "b";
  const wrk = board[7][7]?.type === "r" && board[7][7]?.color === "w";
  const wrq = board[7][0]?.type === "r" && board[7][0]?.color === "w";
  const brk = board[0][7]?.type === "r" && board[0][7]?.color === "b";
  const brq = board[0][0]?.type === "r" && board[0][0]?.color === "b";
  let res = "";
  if (raw.includes("K") && wk && wrk) res += "K";
  if (raw.includes("Q") && wk && wrq) res += "Q";
  if (raw.includes("k") && bk && brk) res += "k";
  if (raw.includes("q") && bk && brq) res += "q";
  return res;
}

export type Validation =
  | { ok: true; fen: string }
  | { ok: false; errors: string[] };

export function validateBoard(
  board: EditorBoard,
  side: Color,
  castling = "KQkq",
): Validation {
  const errors: string[] = [];
  let wk = 0, bk = 0;
  let wp = 0, bp = 0;
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const cell = board[r][f];
      if (!cell) continue;
      if (cell.type === "k") {
        if (cell.color === "w") wk++;
        else bk++;
      }
      if (cell.type === "p") {
        if (r === 0 || r === 7) {
          errors.push(`Пешка на крайней линии (${"abcdefgh"[f]}${8 - r}) — невалидно.`);
        }
        if (cell.color === "w") wp++;
        else bp++;
      }
    }
  }
  if (wk !== 1) errors.push(`Должен быть 1 белый король (сейчас ${wk}).`);
  if (bk !== 1) errors.push(`Должен быть 1 чёрный король (сейчас ${bk}).`);
  if (wp > 8) errors.push(`Слишком много белых пешек (${wp}).`);
  if (bp > 8) errors.push(`Слишком много чёрных пешек (${bp}).`);
  if (errors.length) return { ok: false, errors };

  const fen = boardToFen(board, side, castling);
  // Проверка через chess.js — он также отлавливает короля под боем у
  // стороны, которой не ходить, и подобные мелочи.
  try {
    const c = new Chess(fen);
    return { ok: true, fen: c.fen() };
  } catch (e: any) {
    return { ok: false, errors: [String(e?.message || e || "Невалидная позиция").trim()] };
  }
}
