/**
 * Логика лёгкой задачи (/cyberchess/p/<id>): позиция, ход игрока, проверка по
 * решению, автоматический ответ соперника. Чистые функции над chess.js — без
 * React, без монолита page.tsx. Повод 13.10.2026: гость из Shorts ждал доску
 * ~7 с на Fast 3G из-за 900 КБ JS; лёгкому маршруту нужен только этот модуль.
 *
 * `sol` — уже НОРМАЛИЗОВАННОЕ решение (puzzleNormalize): первый ход — игрока,
 * дальше чередование соперник/игрок. Сравнение ходов — по UCI; превращение в
 * решении (e7e8q) сравнивается с ходом игрока, которому превращение дописано
 * ферзём по умолчанию.
 */
import { Chess } from "chess.js";

export type Sostoyanie = {
  fen: string;
  sol: string[];
  /** Индекс следующего ОЖИДАЕМОГО хода в sol (всегда чётный — ход игрока). */
  i: number;
  reshena: boolean;
  /** Сторона игрока: берётся из позиции (ходит тот, чей первый ход в sol). */
  storona: "w" | "b";
};

export type IshodShaga =
  | { vid: "wrong"; sostoyanie: Sostoyanie }
  | { vid: "ok"; sostoyanie: Sostoyanie; otvet: string | null; reshena: boolean };

export function sozdatSostoyanie(fen: string, sol: string[]): Sostoyanie {
  const g = new Chess(fen);
  return { fen: g.fen(), sol: sol.slice(), i: 0, reshena: sol.length === 0, storona: g.turn() };
}

export function uciVHod(uci: string): { from: string; to: string; promotion?: string } {
  const u = String(uci).trim().toLowerCase();
  return { from: u.slice(0, 2), to: u.slice(2, 4), promotion: u.length > 4 ? u[4] : undefined };
}

/** Клетки, куда может пойти фигура с `from` в текущей позиции. */
export function tseli(fen: string, from: string): string[] {
  try {
    const g = new Chess(fen);
    return g.moves({ square: from as never, verbose: true }).map((m) => m.to);
  } catch {
    return [];
  }
}

/** Фигура игрока на клетке? */
export function svoyaFigura(sostoyanie: Sostoyanie, sq: string): boolean {
  try {
    const p = new Chess(sostoyanie.fen).get(sq as never);
    return !!p && p.color === sostoyanie.storona;
  } catch {
    return false;
  }
}

/** Ход игрока from→to. Превращение — ферзём, если решение не требует иного. */
export function shag(s: Sostoyanie, from: string, to: string): IshodShaga {
  if (s.reshena || s.i >= s.sol.length) return { vid: "wrong", sostoyanie: s };
  const ozhid = uciVHod(s.sol[s.i]);
  const promo = ozhid.from === from && ozhid.to === to ? (ozhid.promotion ?? "q") : "q";
  const g = new Chess(s.fen);
  let mv: ReturnType<Chess["move"]> | null = null;
  try {
    mv = g.move({ from, to, promotion: promo } as never);
  } catch {
    mv = null;
  }
  if (!mv) return { vid: "wrong", sostoyanie: s };
  const sdelan = `${mv.from}${mv.to}${mv.promotion ?? ""}`;
  const ozhidStr = `${ozhid.from}${ozhid.to}${ozhid.promotion ?? ""}`;
  // мат любым ходом — тоже решение (как в полной версии: цель задачи достигнута)
  const matom = g.isCheckmate();
  if (sdelan !== ozhidStr && !matom) return { vid: "wrong", sostoyanie: s };
  let i = s.i + 1;
  let otvet: string | null = null;
  if (!matom && i < s.sol.length) {
    const o = uciVHod(s.sol[i]);
    try {
      const r = g.move({ from: o.from, to: o.to, promotion: o.promotion } as never);
      if (r) { otvet = s.sol[i]; i += 1; }
    } catch { /* ответ соперника не применился — считаем задачу решённой на этом */ }
  }
  const reshena = matom || i >= s.sol.length;
  return { vid: "ok", sostoyanie: { ...s, fen: g.fen(), i, reshena }, otvet, reshena };
}

/** Клетки с фигурами игрока, у которых есть хотя бы один ход, — подсветка «как ходить». */
export function hodyashchie(fen: string, storona: "w" | "b"): string[] {
  try {
    const g = new Chess(fen);
    if (g.turn() !== storona) return [];
    return [...new Set(g.moves({ verbose: true }).map((m) => m.from as string))].sort();
  } catch {
    return [];
  }
}

/** Доска для отрисовки: 8 рядов сверху вниз с учётом ориентации (игрок снизу). */
export function kletki(fen: string, storona: "w" | "b"): Array<Array<{ sq: string; p: string | null; dark: boolean }>> {
  const g = new Chess(fen);
  const b = g.board(); // [0] — 8-я горизонталь
  const files = "abcdefgh";
  const rows: Array<Array<{ sq: string; p: string | null; dark: boolean }>> = [];
  for (let r = 0; r < 8; r++) {
    const row: Array<{ sq: string; p: string | null; dark: boolean }> = [];
    for (let c = 0; c < 8; c++) {
      const rr = storona === "w" ? r : 7 - r;
      const cc = storona === "w" ? c : 7 - c;
      const cell = b[rr][cc];
      row.push({ sq: `${files[cc]}${8 - rr}`, p: cell ? `${cell.color}${cell.type}` : null, dark: (rr + cc) % 2 === 1 });
    }
    rows.push(row);
  }
  return rows;
}

/** Решение в SAN с номерами ходов («25... Qh1#»): показывается после решения. Пустой массив при любой ошибке. */
export function resheniyeSan(fen: string, sol: string[]): string[] {
  try {
    const g = new Chess(fen);
    const out: string[] = [];
    for (const u of sol) {
      const m = uciVHod(u);
      const num = g.moveNumber();
      const black = g.turn() === "b";
      const r = g.move({ from: m.from, to: m.to, promotion: m.promotion } as never);
      if (!r) break;
      out.push(black ? `${num}... ${r.san}` : `${num}. ${r.san}`);
    }
    return out;
  } catch {
    return [];
  }
}

export const GLIF: Record<string, string> = { wk: "♔", wq: "♕", wr: "♖", wb: "♗", wn: "♘", wp: "♙", bk: "♚", bq: "♛", br: "♜", bb: "♝", bn: "♞", bp: "♟" };
