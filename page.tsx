"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { useToast } from "@/components/ToastProvider";
import { Wave1Nav } from "@/components/Wave1Nav";

/* ─────────────── TYPES ─────────────── */
type Color = "w" | "b";
type PieceType = "K" | "Q" | "R" | "B" | "N" | "P";
type Piece = { type: PieceType; color: Color } | null;
type Board = Piece[][];
type Square = [number, number]; // [row, col]
type MoveRecord = { from: Square; to: Square; piece: PieceType; captured?: PieceType; san: string; promotion?: PieceType };

type CastleRights = { K: boolean; Q: boolean; k: boolean; q: boolean };
type GameState = {
  board: Board;
  turn: Color;
  castle: CastleRights;
  ep: Square | null; // en passant target
  halfmove: number;
  fullmove: number;
};

type AILevel = { name: string; elo: number; depth: number; skill: number; title: string; color: string };

/* ─────────────── CONSTANTS ─────────────── */
const FILES = "abcdefgh";
const PIECE_UNICODE: Record<string, string> = {
  wK: "♔", wQ: "♕", wR: "♖", wB: "♗", wN: "♘", wP: "♙",
  bK: "♚", bQ: "♛", bR: "♜", bB: "♝", bN: "♞", bP: "♟",
};

const AI_LEVELS: AILevel[] = [
  { name: "Beginner", elo: 400, depth: 1, skill: 0, title: "Новичок", color: "#94a3b8" },
  { name: "Casual", elo: 800, depth: 3, skill: 3, title: "Любитель", color: "#0d9488" },
  { name: "Club", elo: 1200, depth: 6, skill: 8, title: "Клубный", color: "#2563eb" },
  { name: "Advanced", elo: 1600, depth: 10, skill: 13, title: "Продвинутый", color: "#7c3aed" },
  { name: "Expert", elo: 2000, depth: 14, skill: 17, title: "Эксперт", color: "#dc2626" },
  { name: "Master", elo: 2400, depth: 18, skill: 20, title: "Мастер", color: "#b45309" },
  { name: "Stockfish Max", elo: 3500, depth: 22, skill: 20, title: "Stockfish", color: "#0f172a" },
];

const RANK_TITLES: { min: number; title: string; icon: string }[] = [
  { min: 0, title: "Beginner", icon: "●" },
  { min: 600, title: "Novice", icon: "◆" },
  { min: 900, title: "Amateur", icon: "■" },
  { min: 1200, title: "Club Player", icon: "▲" },
  { min: 1500, title: "Tournament Player", icon: "★" },
  { min: 1800, title: "Candidate Master", icon: "✦" },
  { min: 2000, title: "FIDE Master", icon: "✧" },
  { min: 2200, title: "International Master", icon: "✪" },
  { min: 2400, title: "Grandmaster", icon: "♛" },
];

const PUZZLES = [
  { fen: "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4", solution: ["h5f7"], name: "Scholar's Mate", rating: 400 },
  { fen: "r1b1k2r/ppppqppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 4 5", solution: ["c4f7"], name: "Fork Trick", rating: 800 },
  { fen: "6k1/pp4pp/2p5/4p3/2P1n1q1/1PB3P1/P3rp1P/2R1QRK1 b - - 0 1", solution: ["g4g3"], name: "Back Rank Threat", rating: 1200 },
  { fen: "r2qk2r/ppp2ppp/2n1bn2/2b1p3/4P3/1BP2N2/PP1P1PPP/RNBQK2R w KQkq - 6 6", solution: ["d1a4"], name: "Pin Attack", rating: 1000 },
  { fen: "r1bqkbnr/pppppppp/2n5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 1 2", solution: ["d2d4"], name: "Center Control", rating: 600 },
];

/* ─────────────── CHESS ENGINE HELPERS ─────────────── */
function initBoard(): Board {
  const b: Board = Array.from({ length: 8 }, () => Array(8).fill(null));
  const back: PieceType[] = ["R", "N", "B", "Q", "K", "B", "N", "R"];
  for (let c = 0; c < 8; c++) {
    b[0][c] = { type: back[c], color: "b" };
    b[1][c] = { type: "P", color: "b" };
    b[6][c] = { type: "P", color: "w" };
    b[7][c] = { type: back[c], color: "w" };
  }
  return b;
}

function cloneBoard(b: Board): Board {
  return b.map((row) => row.map((p) => (p ? { ...p } : null)));
}

function inBounds(r: number, c: number) { return r >= 0 && r < 8 && c >= 0 && c < 8; }

function boardToFen(state: GameState): string {
  let fen = "";
  for (let r = 0; r < 8; r++) {
    let empty = 0;
    for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (!p) { empty++; continue; }
      if (empty) { fen += empty; empty = 0; }
      const ch = p.type === "N" ? "N" : p.type === "K" ? "K" : p.type === "Q" ? "Q" : p.type === "R" ? "R" : p.type === "B" ? "B" : "P";
      fen += p.color === "w" ? ch : ch.toLowerCase();
    }
    if (empty) fen += empty;
    if (r < 7) fen += "/";
  }
  fen += ` ${state.turn} `;
  let castleStr = "";
  if (state.castle.K) castleStr += "K";
  if (state.castle.Q) castleStr += "Q";
  if (state.castle.k) castleStr += "k";
  if (state.castle.q) castleStr += "q";
  fen += castleStr || "-";
  fen += " ";
  fen += state.ep ? `${FILES[state.ep[1]]}${8 - state.ep[0]}` : "-";
  fen += ` ${state.halfmove} ${state.fullmove}`;
  return fen;
}

function fenToState(fen: string): GameState {
  const parts = fen.split(" ");
  const rows = parts[0].split("/");
  const board: Board = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let r = 0; r < 8; r++) {
    let c = 0;
    for (const ch of rows[r]) {
      if (ch >= "1" && ch <= "8") { c += parseInt(ch); continue; }
      const color: Color = ch === ch.toUpperCase() ? "w" : "b";
      const upper = ch.toUpperCase();
      const type: PieceType = upper === "N" ? "N" : upper === "K" ? "K" : upper === "Q" ? "Q" : upper === "R" ? "R" : upper === "B" ? "B" : "P";
      board[r][c] = { type, color };
      c++;
    }
  }
  const castle: CastleRights = { K: false, Q: false, k: false, q: false };
  const cs = parts[2] || "-";
  if (cs.includes("K")) castle.K = true;
  if (cs.includes("Q")) castle.Q = true;
  if (cs.includes("k")) castle.k = true;
  if (cs.includes("q")) castle.q = true;
  let ep: Square | null = null;
  if (parts[3] && parts[3] !== "-") {
    const ec = FILES.indexOf(parts[3][0]);
    const er = 8 - parseInt(parts[3][1]);
    ep = [er, ec];
  }
  return {
    board,
    turn: (parts[1] || "w") as Color,
    castle,
    ep,
    halfmove: parseInt(parts[4] || "0"),
    fullmove: parseInt(parts[5] || "1"),
  };
}

function getPseudoMoves(board: Board, r: number, c: number, castle: CastleRights, ep: Square | null): Square[] {
  const p = board[r][c];
  if (!p) return [];
  const moves: Square[] = [];
  const enemy = p.color === "w" ? "b" : "w";
  const addIf = (nr: number, nc: number): boolean => {
    if (!inBounds(nr, nc)) return false;
    const t = board[nr][nc];
    if (t && t.color === p.color) return false;
    moves.push([nr, nc]);
    return !t;
  };
  const slide = (dr: number, dc: number) => {
    for (let i = 1; i < 8; i++) if (!addIf(r + dr * i, c + dc * i)) break;
  };

  switch (p.type) {
    case "P": {
      const dir = p.color === "w" ? -1 : 1;
      const start = p.color === "w" ? 6 : 1;
      if (inBounds(r + dir, c) && !board[r + dir][c]) {
        moves.push([r + dir, c]);
        if (r === start && !board[r + dir * 2][c]) moves.push([r + dir * 2, c]);
      }
      for (const dc of [-1, 1]) {
        const nr = r + dir, nc = c + dc;
        if (inBounds(nr, nc) && board[nr][nc]?.color === enemy) moves.push([nr, nc]);
        if (ep && ep[0] === nr && ep[1] === nc) moves.push([nr, nc]);
      }
      break;
    }
    case "N":
      for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) addIf(r + dr, c + dc);
      break;
    case "B": slide(-1,-1); slide(-1,1); slide(1,-1); slide(1,1); break;
    case "R": slide(-1,0); slide(1,0); slide(0,-1); slide(0,1); break;
    case "Q": slide(-1,-1); slide(-1,1); slide(1,-1); slide(1,1); slide(-1,0); slide(1,0); slide(0,-1); slide(0,1); break;
    case "K": {
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (dr || dc) addIf(r + dr, c + dc);
      // Castling
      if (p.color === "w" && r === 7 && c === 4) {
        if (castle.K && !board[7][5] && !board[7][6] && board[7][7]?.type === "R") moves.push([7, 6]);
        if (castle.Q && !board[7][3] && !board[7][2] && !board[7][1] && board[7][0]?.type === "R") moves.push([7, 2]);
      }
      if (p.color === "b" && r === 0 && c === 4) {
        if (castle.k && !board[0][5] && !board[0][6] && board[0][7]?.type === "R") moves.push([0, 6]);
        if (castle.q && !board[0][3] && !board[0][2] && !board[0][1] && board[0][0]?.type === "R") moves.push([0, 2]);
      }
      break;
    }
  }
  return moves;
}

function findKing(board: Board, color: Color): Square {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c]?.type === "K" && board[r][c]?.color === color) return [r, c];
  return [0, 0];
}

function isSquareAttacked(board: Board, sq: Square, by: Color): boolean {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c]?.color === by) {
        const moves = getPseudoMoves(board, r, c, { K: false, Q: false, k: false, q: false }, null);
        if (moves.some(([mr, mc]) => mr === sq[0] && mc === sq[1])) return true;
      }
  return false;
}

function isInCheck(board: Board, color: Color): boolean {
  const king = findKing(board, color);
  return isSquareAttacked(board, king, color === "w" ? "b" : "w");
}

function applyMove(state: GameState, from: Square, to: Square, promo?: PieceType): GameState {
  const nb = cloneBoard(state.board);
  const piece = nb[from[0]][from[1]]!;
  const captured = nb[to[0]][to[1]];
  const newCastle = { ...state.castle };
  let newEp: Square | null = null;

  // En passant capture
  if (piece.type === "P" && state.ep && to[0] === state.ep[0] && to[1] === state.ep[1]) {
    nb[from[0]][to[1]] = null;
  }

  // Move piece
  nb[to[0]][to[1]] = piece;
  nb[from[0]][from[1]] = null;

  // Pawn promotion
  if (piece.type === "P" && (to[0] === 0 || to[0] === 7)) {
    nb[to[0]][to[1]] = { type: promo || "Q", color: piece.color };
  }

  // Double pawn push → set ep
  if (piece.type === "P" && Math.abs(to[0] - from[0]) === 2) {
    newEp = [(from[0] + to[0]) / 2, from[1]];
  }

  // Castling move rook
  if (piece.type === "K" && Math.abs(to[1] - from[1]) === 2) {
    if (to[1] === 6) { nb[to[0]][5] = nb[to[0]][7]; nb[to[0]][7] = null; }
    if (to[1] === 2) { nb[to[0]][3] = nb[to[0]][0]; nb[to[0]][0] = null; }
  }

  // Update castle rights
  if (piece.type === "K") {
    if (piece.color === "w") { newCastle.K = false; newCastle.Q = false; }
    else { newCastle.k = false; newCastle.q = false; }
  }
  if (piece.type === "R") {
    if (from[0] === 7 && from[1] === 7) newCastle.K = false;
    if (from[0] === 7 && from[1] === 0) newCastle.Q = false;
    if (from[0] === 0 && from[1] === 7) newCastle.k = false;
    if (from[0] === 0 && from[1] === 0) newCastle.q = false;
  }

  return {
    board: nb,
    turn: state.turn === "w" ? "b" : "w",
    castle: newCastle,
    ep: newEp,
    halfmove: piece.type === "P" || captured ? 0 : state.halfmove + 1,
    fullmove: state.turn === "b" ? state.fullmove + 1 : state.fullmove,
  };
}

function getLegalMoves(state: GameState, r: number, c: number): Square[] {
  const piece = state.board[r][c];
  if (!piece || piece.color !== state.turn) return [];
  const pseudo = getPseudoMoves(state.board, r, c, state.castle, state.ep);
  return pseudo.filter(([tr, tc]) => {
    const ns = applyMove(state, [r, c], [tr, tc]);
    return !isInCheck(ns.board, state.turn);
  });
}

function hasAnyLegalMoves(state: GameState): boolean {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (state.board[r][c]?.color === state.turn && getLegalMoves(state, r, c).length > 0) return true;
  return false;
}

function toSAN(state: GameState, from: Square, to: Square, promo?: PieceType): string {
  const p = state.board[from[0]][from[1]]!;
  const cap = state.board[to[0]][to[1]] || (p.type === "P" && state.ep && to[0] === state.ep[0] && to[1] === state.ep[1]);
  const destSq = `${FILES[to[1]]}${8 - to[0]}`;
  if (p.type === "K" && to[1] - from[1] === 2) return "O-O";
  if (p.type === "K" && from[1] - to[1] === 2) return "O-O-O";
  let san = "";
  if (p.type !== "P") san += p.type;
  else if (cap) san += FILES[from[1]];
  if (cap) san += "x";
  san += destSq;
  if (promo) san += `=${promo}`;
  const ns = applyMove(state, from, to, promo);
  if (isInCheck(ns.board, ns.turn)) san += hasAnyLegalMoves(ns) ? "+" : "#";
  return san;
}

function toUCI(from: Square, to: Square, promo?: PieceType): string {
  return `${FILES[from[1]]}${8 - from[0]}${FILES[to[1]]}${8 - to[0]}${promo ? promo.toLowerCase() : ""}`;
}

function parseUCI(uci: string): { from: Square; to: Square; promo?: PieceType } {
  const fc = FILES.indexOf(uci[0]), fr = 8 - parseInt(uci[1]);
  const tc = FILES.indexOf(uci[2]), tr = 8 - parseInt(uci[3]);
  const promo = uci[4] ? uci[4].toUpperCase() as PieceType : undefined;
  return { from: [fr, fc], to: [tr, tc], promo };
}

/* ─────────────── STOCKFISH WORKER ─────────────── */
function useStockfish() {
  const workerRef = useRef<Worker | null>(null);
  const resolveRef = useRef<((bestmove: string) => void) | null>(null);

  useEffect(() => {
    try {
      const w = new Worker("/stockfish/stockfish-nnue-16-single.js");
      workerRef.current = w;
      w.postMessage("uci");
      w.onmessage = (e: MessageEvent) => {
        const msg = e.data as string;
        if (msg.startsWith("bestmove") && resolveRef.current) {
          resolveRef.current(msg.split(" ")[1]);
          resolveRef.current = null;
        }
      };
      return () => w.terminate();
    } catch {
      // Stockfish not available — fallback to built-in
    }
  }, []);

  const getBestMove = useCallback(
    (fen: string, depth: number, skill: number): Promise<string> => {
      return new Promise((resolve) => {
        if (!workerRef.current) {
          resolve("fallback");
          return;
        }
        resolveRef.current = resolve;
        workerRef.current.postMessage(`setoption name Skill Level value ${skill}`);
        workerRef.current.postMessage(`position fen ${fen}`);
        workerRef.current.postMessage(`go depth ${depth}`);
        // Timeout fallback
        setTimeout(() => { if (resolveRef.current) { resolveRef.current("fallback"); resolveRef.current = null; } }, 10000);
      });
    },
    [],
  );

  return { getBestMove, available: !!workerRef.current };
}

/* ─────────────── Built-in AI (fallback when Stockfish not loaded) ─────────────── */
function builtinAI(state: GameState, depth: number): { from: Square; to: Square } | null {
  const vals: Record<PieceType, number> = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 };
  const pst: Record<PieceType, number[]> = {
    P: [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
    N: [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
    B: [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
    R: [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
    Q: [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
    K: [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10, 20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20],
  };

  function evaluate(board: Board): number {
    let score = 0;
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (!p) continue;
        const idx = p.color === "w" ? r * 8 + c : (7 - r) * 8 + c;
        const val = vals[p.type] + (pst[p.type]?.[idx] || 0);
        score += p.color === "w" ? val : -val;
      }
    return score;
  }

  function minimax(s: GameState, d: number, alpha: number, beta: number, maximizing: boolean): number {
    if (d === 0) return evaluate(s.board);
    const moves: { from: Square; to: Square }[] = [];
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if (s.board[r][c]?.color === s.turn)
          for (const to of getLegalMoves(s, r, c))
            moves.push({ from: [r, c], to });
    if (!moves.length) return isInCheck(s.board, s.turn) ? (maximizing ? -100000 : 100000) : 0;
    if (maximizing) {
      let best = -Infinity;
      for (const m of moves) {
        const ns = applyMove(s, m.from, m.to);
        best = Math.max(best, minimax(ns, d - 1, alpha, beta, false));
        alpha = Math.max(alpha, best);
        if (beta <= alpha) break;
      }
      return best;
    } else {
      let best = Infinity;
      for (const m of moves) {
        const ns = applyMove(s, m.from, m.to);
        best = Math.min(best, minimax(ns, d - 1, alpha, beta, true));
        beta = Math.min(beta, best);
        if (beta <= alpha) break;
      }
      return best;
    }
  }

  const allMoves: { from: Square; to: Square; score: number }[] = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (state.board[r][c]?.color === state.turn)
        for (const to of getLegalMoves(state, r, c)) {
          const ns = applyMove(state, [r, c], to);
          const score = minimax(ns, Math.min(depth, 3) - 1, -Infinity, Infinity, state.turn === "b");
          allMoves.push({ from: [r, c], to, score });
        }
  if (!allMoves.length) return null;
  allMoves.sort((a, b) => state.turn === "b" ? a.score - b.score : b.score - a.score);
  // Add randomness for lower levels
  const topN = Math.max(1, Math.min(allMoves.length, depth <= 1 ? 5 : depth <= 3 ? 3 : 1));
  const pick = allMoves[Math.floor(Math.random() * topN)];
  return { from: pick.from, to: pick.to };
}

/* ─────────────── SOUND ─────────────── */
function playSound(type: "move" | "capture" | "check" | "castle") {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.value = 0.08;
    const freqs = { move: 600, capture: 300, check: 800, castle: 500 };
    osc.frequency.value = freqs[type];
    osc.type = type === "capture" ? "sawtooth" : "sine";
    osc.start();
    osc.stop(ctx.currentTime + (type === "capture" ? 0.15 : 0.08));
  } catch {}
}

/* ─────────────── RATING STORAGE ─────────────── */
const RATING_KEY = "aevion_chess_rating_v1";
const STATS_KEY = "aevion_chess_stats_v1";
function loadRating(): number { try { return parseInt(localStorage.getItem(RATING_KEY) || "800"); } catch { return 800; } }
function saveRating(r: number) { try { localStorage.setItem(RATING_KEY, String(Math.round(r))); } catch {} }
function loadStats(): { wins: number; losses: number; draws: number } {
  try { return JSON.parse(localStorage.getItem(STATS_KEY) || '{"wins":0,"losses":0,"draws":0}'); } catch { return { wins: 0, losses: 0, draws: 0 }; }
}
function saveStats(s: { wins: number; losses: number; draws: number }) { try { localStorage.setItem(STATS_KEY, JSON.stringify(s)); } catch {} }
function getRankTitle(elo: number) { return [...RANK_TITLES].reverse().find((t) => elo >= t.min) || RANK_TITLES[0]; }

/* ─────────────── MAIN COMPONENT ─────────────── */
export default function CyberChessPage() {
  const { showToast } = useToast();
  const stockfish = useStockfish();

  const [gameState, setGameState] = useState<GameState>(() => ({
    board: initBoard(),
    turn: "w",
    castle: { K: true, Q: true, k: true, q: true },
    ep: null,
    halfmove: 0,
    fullmove: 1,
  }));

  const [selected, setSelected] = useState<Square | null>(null);
  const [validMoves, setValidMoves] = useState<Set<string>>(new Set());
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [gameOver, setGameOver] = useState<string | null>(null);
  const [moveHistory, setMoveHistory] = useState<MoveRecord[]>([]);
  const [thinking, setThinking] = useState(false);
  const [capturedW, setCapturedW] = useState<string[]>([]);
  const [capturedB, setCapturedB] = useState<string[]>([]);
  const [aiLevel, setAiLevel] = useState<number>(2);
  const [promoModal, setPromoModal] = useState<{ from: Square; to: Square } | null>(null);
  const [playerRating, setPlayerRating] = useState(800);
  const [stats, setStats] = useState({ wins: 0, losses: 0, draws: 0 });
  const [tab, setTab] = useState<"play" | "puzzles">("play");
  const [puzzleIdx, setPuzzleIdx] = useState(0);
  const [puzzleSolved, setPuzzleSolved] = useState(false);
  const [boardFlipped, setBoardFlipped] = useState(false);
  const [kbInput, setKbInput] = useState("");

  const boardRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setPlayerRating(loadRating()); setStats(loadStats()); }, []);
  useEffect(() => { historyRef.current?.scrollTo({ top: historyRef.current.scrollHeight, behavior: "smooth" }); }, [moveHistory]);

  const level = AI_LEVELS[aiLevel];
  const rank = getRankTitle(playerRating);
  const check = isInCheck(gameState.board, gameState.turn);

  /* ── Execute move ── */
  const executeMove = useCallback(
    (from: Square, to: Square, promo?: PieceType) => {
      const piece = gameState.board[from[0]][from[1]];
      if (!piece) return;
      const captured = gameState.board[to[0]][to[1]];
      const isEpCapture = piece.type === "P" && gameState.ep && to[0] === gameState.ep[0] && to[1] === gameState.ep[1];
      const san = toSAN(gameState, from, to, promo);
      const ns = applyMove(gameState, from, to, promo);

      if (captured) {
        if (piece.color === "w") setCapturedB((p) => [...p, PIECE_UNICODE[`${captured.color}${captured.type}`]]);
        else setCapturedW((p) => [...p, PIECE_UNICODE[`${captured.color}${captured.type}`]]);
        playSound("capture");
      } else if (piece.type === "K" && Math.abs(to[1] - from[1]) === 2) {
        playSound("castle");
      } else if (isInCheck(ns.board, ns.turn)) {
        playSound("check");
      } else {
        playSound("move");
      }
      if (isEpCapture) {
        const epPiece = gameState.board[from[0]][to[1]];
        if (epPiece) {
          if (piece.color === "w") setCapturedB((p) => [...p, PIECE_UNICODE[`${epPiece.color}${epPiece.type}`]]);
          else setCapturedW((p) => [...p, PIECE_UNICODE[`${epPiece.color}${epPiece.type}`]]);
        }
      }

      setMoveHistory((h) => [...h, { from, to, piece: piece.type, captured: captured?.type, san, promotion: promo }]);
      setLastMove({ from, to });
      setGameState(ns);
      setSelected(null);
      setValidMoves(new Set());

      // Check game end
      if (!hasAnyLegalMoves(ns)) {
        if (isInCheck(ns.board, ns.turn)) {
          const winner = ns.turn === "w" ? "Black" : "White";
          setGameOver(`Checkmate! ${winner} wins.`);
          const isPlayerWin = ns.turn === "b";
          if (isPlayerWin) {
            const newR = Math.min(3000, playerRating + Math.max(5, Math.round((level.elo - playerRating) * 0.1 + 15)));
            setPlayerRating(newR); saveRating(newR);
            setStats((s) => { const n = { ...s, wins: s.wins + 1 }; saveStats(n); return n; });
            showToast(`Checkmate! +${newR - playerRating} rating`, "success");
          } else {
            const newR = Math.max(100, playerRating - Math.max(5, Math.round((playerRating - level.elo) * 0.1 + 10)));
            setPlayerRating(newR); saveRating(newR);
            setStats((s) => { const n = { ...s, losses: s.losses + 1 }; saveStats(n); return n; });
            showToast("Checkmate. AI wins.", "error");
          }
        } else {
          setGameOver("Stalemate — draw.");
          setStats((s) => { const n = { ...s, draws: s.draws + 1 }; saveStats(n); return n; });
          showToast("Stalemate — draw", "info");
        }
      }
    },
    [gameState, playerRating, level.elo, showToast],
  );

  /* ── AI move ── */
  useEffect(() => {
    if (gameState.turn !== "b" || gameOver || tab !== "play") return;
    setThinking(true);
    const fen = boardToFen(gameState);

    (async () => {
      let bestUci = await stockfish.getBestMove(fen, level.depth, level.skill);
      if (bestUci === "fallback" || !bestUci) {
        const fallback = builtinAI(gameState, level.depth);
        if (!fallback) { setThinking(false); return; }
        bestUci = toUCI(fallback.from, fallback.to);
      }
      const { from, to, promo } = parseUCI(bestUci);
      setTimeout(() => {
        executeMove(from, to, promo);
        setThinking(false);
      }, 300);
    })();
  }, [gameState.turn, gameOver, tab]);

  /* ── Click handler ── */
  const handleSquareClick = useCallback(
    (r: number, c: number) => {
      if (gameOver || thinking || gameState.turn !== "w") return;
      const piece = gameState.board[r][c];

      if (selected) {
        const key = `${r},${c}`;
        if (validMoves.has(key)) {
          const movingPiece = gameState.board[selected[0]][selected[1]];
          if (movingPiece?.type === "P" && (r === 0 || r === 7)) {
            setPromoModal({ from: selected, to: [r, c] });
            return;
          }
          executeMove(selected, [r, c]);
          return;
        }
        if (piece?.color === "w") {
          setSelected([r, c]);
          setValidMoves(new Set(getLegalMoves(gameState, r, c).map(([mr, mc]) => `${mr},${mc}`)));
          return;
        }
        setSelected(null);
        setValidMoves(new Set());
        return;
      }

      if (piece?.color === "w") {
        setSelected([r, c]);
        setValidMoves(new Set(getLegalMoves(gameState, r, c).map(([mr, mc]) => `${mr},${mc}`)));
      }
    },
    [gameState, selected, validMoves, gameOver, thinking, executeMove],
  );

  /* ── Keyboard input (e.g. "e2e4") ── */
  const handleKeyInput = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") { setKbInput(""); setSelected(null); setValidMoves(new Set()); return; }
      if (e.key === "Backspace") { setKbInput((p) => p.slice(0, -1)); return; }
      if (e.key.length !== 1) return;
      const next = kbInput + e.key.toLowerCase();
      setKbInput(next);
      if (next.length === 4 && /^[a-h][1-8][a-h][1-8]$/.test(next)) {
        const fc = FILES.indexOf(next[0]), fr = 8 - parseInt(next[1]);
        const tc = FILES.indexOf(next[2]), tr = 8 - parseInt(next[3]);
        const lm = getLegalMoves(gameState, fr, fc);
        if (lm.some(([mr, mc]) => mr === tr && mc === tc)) {
          const piece = gameState.board[fr][fc];
          if (piece?.type === "P" && (tr === 0 || tr === 7)) {
            setPromoModal({ from: [fr, fc], to: [tr, tc] });
          } else {
            executeMove([fr, fc], [tr, tc]);
          }
        }
        setKbInput("");
      }
    },
    [kbInput, gameState, executeMove],
  );

  /* ── Drag & drop ── */
  const dragPiece = useRef<{ r: number; c: number } | null>(null);
  const handleDragStart = (r: number, c: number) => {
    if (gameState.board[r][c]?.color === "w" && gameState.turn === "w" && !gameOver && !thinking) {
      dragPiece.current = { r, c };
      setSelected([r, c]);
      setValidMoves(new Set(getLegalMoves(gameState, r, c).map(([mr, mc]) => `${mr},${mc}`)));
    }
  };
  const handleDrop = (r: number, c: number) => {
    if (!dragPiece.current) return;
    const from: Square = [dragPiece.current.r, dragPiece.current.c];
    const key = `${r},${c}`;
    if (validMoves.has(key)) {
      const piece = gameState.board[from[0]][from[1]];
      if (piece?.type === "P" && (r === 0 || r === 7)) {
        setPromoModal({ from, to: [r, c] });
      } else {
        executeMove(from, [r, c]);
      }
    } else {
      setSelected(null);
      setValidMoves(new Set());
    }
    dragPiece.current = null;
  };

  /* ── New game ── */
  const newGame = () => {
    setGameState({ board: initBoard(), turn: "w", castle: { K: true, Q: true, k: true, q: true }, ep: null, halfmove: 0, fullmove: 1 });
    setSelected(null); setValidMoves(new Set()); setLastMove(null); setGameOver(null);
    setMoveHistory([]); setCapturedW([]); setCapturedB([]); setPromoModal(null);
    setThinking(false); setKbInput("");
    showToast("New game started", "info");
  };

  /* ── Puzzle mode ── */
  const loadPuzzle = (idx: number) => {
    const pz = PUZZLES[idx];
    setGameState(fenToState(pz.fen));
    setSelected(null); setValidMoves(new Set()); setLastMove(null); setGameOver(null);
    setMoveHistory([]); setCapturedW([]); setCapturedB([]); setPromoModal(null);
    setPuzzleSolved(false); setThinking(false);
    showToast(`Puzzle: ${pz.name} (${pz.rating})`, "info");
  };

  /* ── Board rendering ── */
  const rows = boardFlipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const cols = boardFlipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];

  return (
    <main>
      <ProductPageShell maxWidth={1040}>
        <Wave1Nav />
        <div style={{ borderRadius: 20, overflow: "hidden", marginBottom: 20 }}>
          <div style={{ background: "linear-gradient(135deg, #1c1917, #292524, #44403c)", padding: "24px 24px 18px", color: "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ display: "inline-block", padding: "3px 10px", borderRadius: 999, fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" as const, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)", marginBottom: 8 }}>
                  CyberChess by AEVION
                </div>
                <h1 style={{ fontSize: 22, fontWeight: 900, margin: "0 0 4px", letterSpacing: "-0.03em" }}>Next-gen chess platform</h1>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>Your rating</div>
                <div style={{ fontSize: 28, fontWeight: 900 }}>{playerRating}</div>
                <div style={{ fontSize: 12, color: level.color }}>{rank.icon} {rank.title}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab switcher */}
        <div style={{ display: "inline-flex", borderRadius: 10, border: "1px solid rgba(15,23,42,0.12)", overflow: "hidden", marginBottom: 16 }}>
          {(["play", "puzzles"] as const).map((t) => (
            <button key={t} onClick={() => { setTab(t); if (t === "play") newGame(); else loadPuzzle(puzzleIdx); }}
              style={{ padding: "8px 18px", border: "none", background: tab === t ? "#0f172a" : "#fff", color: tab === t ? "#fff" : "#64748b", fontWeight: tab === t ? 800 : 600, fontSize: 13, cursor: "pointer" }}>
              {t === "play" ? "Play vs AI" : "Puzzles"}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start", outline: "none" }}
        >
          {/* Board */}
          <div style={{ flexShrink: 0, outline: "none" }} ref={boardRef} tabIndex={0} onKeyDown={handleKeyInput}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(8, 1fr)",
                width: "min(460px, calc(100vw - 48px))",
                aspectRatio: "1",
                borderRadius: 10,
                overflow: "hidden",
                border: "2px solid #292524",
                touchAction: "none",
              }}
            >
              {rows.flatMap((r) =>
                cols.map((c) => {
                  const piece = gameState.board[r][c];
                  const isLight = (r + c) % 2 === 0;
                  const isSel = selected?.[0] === r && selected?.[1] === c;
                  const isValid = validMoves.has(`${r},${c}`);
                  const isCapture = isValid && piece !== null;
                  const isLast = lastMove && ((lastMove.from[0] === r && lastMove.from[1] === c) || (lastMove.to[0] === r && lastMove.to[1] === c));
                  const isCheck = check && piece?.type === "K" && piece.color === gameState.turn;

                  let bg = isLight ? "#e8dcc8" : "#a38b6e";
                  if (isCheck) bg = "rgba(220,38,38,0.5)";
                  else if (isSel) bg = "rgba(59,130,246,0.45)";
                  else if (isCapture) bg = "rgba(220,38,38,0.3)";
                  else if (isValid) bg = isLight ? "rgba(16,185,129,0.3)" : "rgba(16,185,129,0.35)";
                  else if (isLast) bg = isLight ? "rgba(245,158,11,0.25)" : "rgba(245,158,11,0.3)";

                  return (
                    <div
                      key={`${r}-${c}`}
                      onClick={() => handleSquareClick(r, c)}
                      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; handleDragStart(r, c); }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleDrop(r, c)}
                      onTouchStart={() => handleSquareClick(r, c)}
                      draggable={!!piece && piece.color === "w" && gameState.turn === "w" && !gameOver && !thinking}
                      style={{
                        aspectRatio: "1",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "clamp(26px, 5vw, 44px)",
                        background: bg,
                        cursor: gameState.turn === "w" && !gameOver && !thinking && piece?.color === "w" ? "grab" : "pointer",
                        userSelect: "none",
                        position: "relative",
                        lineHeight: 1,
                      }}
                    >
                      {isValid && !piece ? (
                        <div style={{ width: "24%", height: "24%", borderRadius: "50%", background: "rgba(16,185,129,0.5)", position: "absolute" }} />
                      ) : null}
                      {piece ? PIECE_UNICODE[`${piece.color}${piece.type}`] : ""}
                    </div>
                  );
                }),
              )}
            </div>
            {/* File labels */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", width: "min(460px, calc(100vw - 48px))", marginTop: 3 }}>
              {cols.map((c) => (
                <div key={c} style={{ textAlign: "center", fontSize: 11, color: "#94a3b8", fontWeight: 700 }}>{FILES[c]}</div>
              ))}
            </div>
            {/* Keyboard input display */}
            {kbInput ? (
              <div style={{ marginTop: 6, fontSize: 13, fontFamily: "monospace", color: "#64748b", textAlign: "center" }}>
                Keyboard: <strong>{kbInput}</strong>_
              </div>
            ) : null}
            {/* Board controls */}
            <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              <button onClick={() => setBoardFlipped(!boardFlipped)} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.15)", background: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                Flip board
              </button>
              <button onClick={newGame} style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: "#0f172a", color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                New game
              </button>
            </div>
          </div>

          {/* Side panel */}
          <div style={{ flex: "1 1 260px", minWidth: 220 }}>
            {/* Status */}
            <div style={{ padding: "10px 14px", borderRadius: 10, marginBottom: 12, border: `1px solid ${gameOver ? "rgba(220,38,38,0.25)" : check ? "rgba(220,38,38,0.35)" : thinking ? "rgba(245,158,11,0.3)" : "rgba(16,185,129,0.25)"}`, background: gameOver ? "rgba(220,38,38,0.06)" : check ? "rgba(220,38,38,0.06)" : thinking ? "rgba(245,158,11,0.06)" : "rgba(16,185,129,0.06)" }}>
              <div style={{ fontWeight: 800, fontSize: 14 }}>
                {gameOver ? gameOver : check ? "Check!" : thinking ? "AI thinking..." : "Your move (white)"}
              </div>
            </div>

            {/* AI level selector */}
            {tab === "play" ? (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700, marginBottom: 6 }}>AI opponent</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {AI_LEVELS.map((lv, i) => (
                    <button key={i} onClick={() => { setAiLevel(i); newGame(); }}
                      style={{ padding: "5px 10px", borderRadius: 8, border: aiLevel === i ? `2px solid ${lv.color}` : "1px solid rgba(15,23,42,0.12)", background: aiLevel === i ? `${lv.color}15` : "#fff", fontSize: 11, fontWeight: aiLevel === i ? 800 : 600, cursor: "pointer", color: aiLevel === i ? lv.color : "#64748b" }}>
                      {lv.name}
                    </button>
                  ))}
                </div>
                <div style={{ marginTop: 6, fontSize: 12, color: level.color, fontWeight: 700 }}>
                  {level.title} · ~{level.elo} ELO · depth {level.depth}
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700, marginBottom: 6 }}>Puzzles</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {PUZZLES.map((pz, i) => (
                    <button key={i} onClick={() => { setPuzzleIdx(i); loadPuzzle(i); }}
                      style={{ padding: "5px 10px", borderRadius: 8, border: puzzleIdx === i ? "2px solid #7c3aed" : "1px solid rgba(15,23,42,0.12)", background: puzzleIdx === i ? "rgba(124,58,237,0.08)" : "#fff", fontSize: 11, fontWeight: puzzleIdx === i ? 800 : 600, cursor: "pointer", color: puzzleIdx === i ? "#7c3aed" : "#64748b" }}>
                      {pz.name} ({pz.rating})
                    </button>
                  ))}
                </div>
                {puzzleSolved ? <div style={{ marginTop: 6, color: "#059669", fontWeight: 800, fontSize: 13 }}>Solved!</div> : null}
              </div>
            )}

            {/* Captured */}
            {capturedB.length > 0 ? (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>Captured by you</div>
                <div style={{ fontSize: 20, letterSpacing: 1 }}>{capturedB.join("")}</div>
              </div>
            ) : null}
            {capturedW.length > 0 ? (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>Captured by AI</div>
                <div style={{ fontSize: 20, letterSpacing: 1 }}>{capturedW.join("")}</div>
              </div>
            ) : null}

            {/* Move history */}
            <div ref={historyRef} style={{ border: "1px solid rgba(15,23,42,0.1)", borderRadius: 10, padding: 10, maxHeight: 200, overflowY: "auto", marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, marginBottom: 4 }}>Moves ({moveHistory.length})</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                {moveHistory.map((m, i) => (
                  <span key={i} style={{ padding: "2px 6px", borderRadius: 5, fontSize: 11, fontFamily: "monospace", background: i % 2 === 0 ? "rgba(15,23,42,0.05)" : "rgba(124,58,237,0.07)", color: i % 2 === 0 ? "#334155" : "#4c1d95", fontWeight: 600 }}>
                    {i % 2 === 0 ? `${Math.floor(i / 2) + 1}.` : ""}{m.san}
                  </span>
                ))}
              </div>
            </div>

            {/* Player stats */}
            <div style={{ border: "1px solid rgba(15,23,42,0.1)", borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>Your stats</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, fontSize: 12, textAlign: "center" }}>
                <div><div style={{ fontWeight: 900, fontSize: 18, color: "#059669" }}>{stats.wins}</div><div style={{ color: "#94a3b8" }}>Wins</div></div>
                <div><div style={{ fontWeight: 900, fontSize: 18, color: "#dc2626" }}>{stats.losses}</div><div style={{ color: "#94a3b8" }}>Losses</div></div>
                <div><div style={{ fontWeight: 900, fontSize: 18, color: "#64748b" }}>{stats.draws}</div><div style={{ color: "#94a3b8" }}>Draws</div></div>
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: "#64748b", textAlign: "center" }}>
                Rating: <strong style={{ color: "#0f172a" }}>{playerRating}</strong> · {rank.icon} {rank.title}
              </div>
            </div>

            {/* Tips */}
            <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.08)", background: "rgba(15,23,42,0.02)", fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
              <strong>Controls:</strong> Click squares, drag pieces, or type moves (e.g. e2e4). Works offline. Press Escape to cancel.
            </div>
          </div>
        </div>

        {/* Promotion modal */}
        {promoModal ? (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}
            onClick={() => setPromoModal(null)}>
            <div style={{ background: "#fff", borderRadius: 16, padding: 20, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
              <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>Promote to:</div>
              <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              {(["Q", "R", "B", "N"] as PieceType[]).map((pt) => (
                <button key={pt} onClick={() => { executeMove(promoModal.from, promoModal.to, pt); setPromoModal(null); }}
                  style={{ fontSize: 36, padding: "8px 14px", borderRadius: 12, border: "1px solid rgba(15,23,42,0.15)", background: "#fff", cursor: "pointer" }}>
                  {PIECE_UNICODE[`w${pt}`]}
                </button>
              ))}
              </div>
            </div>
          </div>
        ) : null}
      </ProductPageShell>
    </main>
  );
}
