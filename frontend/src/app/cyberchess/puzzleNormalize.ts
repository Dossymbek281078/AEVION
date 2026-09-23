/**
 * Банк задач (ChessPuzzle, 500 000 позиций lichess) хранит задачу в СЫРОМ формате lichess:
 * fen — позиция ДО хода соперника, sol[0] — ход соперника, решающий — ДРУГАЯ сторона,
 * sol всегда чётной длины. Страница же ждёт «fen: решающему ходить, sol[0] — его ход».
 *
 * Замер 22.09.2026 по 300 задачам прода: sol чётный у 300 из 300; из 90 матовых задач
 * мат ставит НЕ та сторона, что ходит в fen, — у 90 из 90; сторона fen теряет материал
 * в 159 случаях и выигрывает в 24. То есть человека просили сыграть ход соперника,
 * а «решением» показывали проигрыш — слово основателя: «непонятные задачи с непонятными
 * решениями». Локальный запасной файл /puzzles.json и задачи из PGN/FEN — в формате
 * страницы (нечётный sol), их не трогаем: признак — чётность.
 */
import { Chess, type Square } from "chess.js";

export type PuzzleLike = {
  fen: string; sol: string[]; name: string; r: number; theme: string;
  phase?: "Opening" | "Middlegame" | "Endgame"; side?: "w" | "b"; goal?: "Mate" | "Best move"; mateIn?: number;
  setupMove?: { from: string; to: string; san: string };
};

const uci = (u: string) => ({ from: u.slice(0, 2) as Square, to: u.slice(2, 4) as Square, promotion: (u[4] as "q" | "r" | "b" | "n" | undefined) || undefined });

/** Сырой формат lichess: первый ход — соперника. */
export function isRawLichess(pz: Pick<PuzzleLike, "sol">): boolean {
  return Array.isArray(pz.sol) && pz.sol.length > 0 && pz.sol.length % 2 === 0;
}

/** Сторона, которая РЕШАЕТ задачу. */
export function solverSide(pz: Pick<PuzzleLike, "sol" | "fen" | "side">): "w" | "b" {
  const fenSide: "w" | "b" = (pz.fen.split(" ")[1] === "b" ? "b" : "w");
  if (isRawLichess(pz)) return fenSide === "w" ? "b" : "w";
  return pz.side || fenSide;
}

/** Ход соперника применён, решающему ходить. Неприменимый ход — задача отдаётся как есть. */
export function normalizePuzzle<T extends PuzzleLike>(pz: T): T {
  if (!isRawLichess(pz)) return pz;
  try {
    const g = new Chess(pz.fen);
    const mv = g.move(uci(pz.sol[0]));
    if (!mv) return pz;
    return { ...pz, fen: g.fen(), sol: pz.sol.slice(1), side: g.turn(), setupMove: { from: mv.from, to: mv.to, san: mv.san } };
  } catch {
    return pz;
  }
}

const VAL: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const material = (g: Chess, c: "w" | "b") => g.board().flat().reduce((s, x) => s + (x && x.color === c ? VAL[x.type] : 0), 0);

export type Razbor =
  | { kind: "mate"; moves: number }
  | { kind: "material"; moves: number; gain: number }
  | { kind: "best"; moves: number };

/** Что даёт решение НА САМОМ ДЕЛЕ (по ходам, а не по тегу): мат / выигрыш материала / позиционный ход. */
export function razborZadachi(pz: PuzzleLike): Razbor | null {
  const n = normalizePuzzle(pz);
  try {
    const g = new Chess(n.fen);
    const me = g.turn(); const opp = me === "w" ? "b" : "w";
    const before = material(g, me) - material(g, opp);
    let moves = 0;
    for (let i = 0; i < n.sol.length; i++) { if (!g.move(uci(n.sol[i]))) return null; if (i % 2 === 0) moves++; }
    if (g.isCheckmate()) return { kind: "mate", moves };
    const gain = material(g, me) - material(g, opp) - before;
    if (gain >= 1) return { kind: "material", moves, gain };
    return { kind: "best", moves };
  } catch {
    return null;
  }
}

const хода = (n: number) => (n === 1 ? "ход" : n < 5 ? "хода" : "ходов");
const выигрыш = (gain: number) => (gain >= 9 ? "ферзя" : gain >= 5 ? "ладьи" : gain >= 3 ? "фигуры" : gain >= 2 ? "качества" : "пешки");

/** Понятное имя по решению: «Мат в 2», «Выигрыш фигуры за 3 хода». Позиционная задача — null (пусть подпись останется прежней). */
export function imyaPoResheniyu(pz: PuzzleLike): string | null {
  const r = razborZadachi(pz);
  if (!r) return null;
  if (r.kind === "mate") return `Мат в ${r.moves}`;
  if (r.kind === "material") return `Выигрыш ${выигрыш(r.gain)} за ${r.moves} ${хода(r.moves)}`;
  return null;
}

/**
 * Годится ли задача для Puzzle Rush: мат в 1–3 или выигрыш материала за 1–5 ходов
 * (слово основателя 22.09.2026: «мат в 1, 2 или 3 хода, или материальный выигрыш … максимум 5 ходов»).
 * Дешёвая предварительная отсечка по полям, точный ответ — по ходам.
 */
export function goditsyaDlyaRush(pz: PuzzleLike): boolean {
  const solverMoves = isRawLichess(pz) ? pz.sol.length / 2 : Math.ceil(pz.sol.length / 2);
  if (solverMoves > 5) return false;
  if (pz.goal === "Mate") return (pz.mateIn || solverMoves) <= 3;
  const r = razborZadachi(pz);
  return !!r && (r.kind === "mate" ? r.moves <= 3 : r.kind === "material");
}
