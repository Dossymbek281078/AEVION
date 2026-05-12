// AEVION CyberChess — F2 phase: per-move metrics collector + Stockfish multiPV parser.
// Pure TypeScript module. No React, no DOM dependencies. Imported by page.tsx during
// the game loop to accumulate MoveMetric per ply, then handed to applyGameToCPI() on
// game-end.
//
// Currently page.tsx feeds a minimal heuristic for engineTop3 (live evalCp scalar);
// the F2-phase-2 follow-up will plug real multiPV=3 output via parseMultiPVLine.

import type { GameMetrics } from "./cpi";

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────

/**
 * One line of Stockfish multiPV output — first move + eval (cp or mate).
 * Used as both the engine response shape AND the "engineTop3" snapshot
 * persisted on each MoveMetric.
 */
export type PVLine = {
  pv: number;          // 1-based rank (1 = best)
  cp: number;          // centipawns from side-to-move perspective; 0 if mate
  mate: number;        // mate-in-N from side-to-move perspective; 0 if cp
  depth: number;
  moves: string[];     // UCI principal variation (firstMove at [0])
};

export type MoveMetric = {
  /** 1-based ply index in the game. */
  ply: number;
  /** FEN of the position BEFORE this move was played. */
  fenBefore: string;
  /** SAN of the played move. */
  san: string;
  /** UCI of the played move (e.g. "e2e4", "e7e8q"). */
  uci: string;
  /** Stockfish multiPV=3 evaluation BEFORE this move (top-3 candidate lines). */
  engineTop3: Array<{ uci: string; eval: number; mateIn: number | null }>;
  /** Centipawn-loss of the played move vs engine #1 (always >= 0). */
  cpl: number;
  /** Matched engine rank: 1 (best), 2, 3, or 4 (off-top-3). */
  rank: 1 | 2 | 3 | 4;
  /** Were there mate-in-N opportunities BEFORE this move? */
  hadMate1: boolean;
  hadMate2: boolean;
  hadMate3: boolean;
  /** Did the played move find a mate-in-N? */
  foundMate1: boolean;
  foundMate2: boolean;
  foundMate3: boolean;
  /** CPL >= 300 → counted as a hang/blunder. */
  isHang: boolean;
  /** Played move ≠ engine #1 BUT eval improved → counted as a brilliancy candidate. */
  isBrilliancy: boolean;
  /** Time spent on this ply (ms). */
  timeMs: number;
};

// ──────────────────────────────────────────────────────────────────────────
// MetricsCollector
// ──────────────────────────────────────────────────────────────────────────

export class MetricsCollector {
  private moves: MoveMetric[] = [];
  private startTime: number = Date.now();
  // Cache of pending multiPV results keyed by FEN. Filled by a background
  // eval pass after each ply; consumed by recordMoveWithMultiPV on the
  // following ply (FEN-before-move). Bounded to ~6 entries to avoid leaks
  // when the user navigates history without playing.
  private pendingTop3 = new Map<string, PVLine[]>();
  private static readonly MAX_PENDING = 6;

  recordMove(m: MoveMetric): void {
    this.moves.push(m);
  }

  /**
   * F2-phase-2 entry point. Combines the heuristic-built MoveMetric base
   * with the real multiPV=3 result observed BEFORE the move, computing:
   *   - rank  (1/2/3 if matched against top-3; 4 otherwise)
   *   - hadMate1/2/3  (any top-3 line is mate-in-N)
   *   - foundMate1/2/3 (played move was a mate-in-N line)
   *   - isBrilliancy (played move not top-1 but eval did NOT drop ≥30cp)
   *
   * `base` is the heuristic-derived MoveMetric (cpl/timeMs/etc.).
   * `top3` is the engine snapshot of the position BEFORE the move; may
   * be empty or null if SF wasn't ready, in which case `base` is recorded
   * as-is (fallback).
   */
  recordMoveWithMultiPV(base: MoveMetric, top3: PVLine[] | null): void {
    if (!top3 || top3.length === 0) {
      this.moves.push(base);
      return;
    }
    // Normalize: top3 first-moves are UCI strings (e.g. "e2e4q" with optional promo).
    const playedUci = base.uci.toLowerCase();
    const engineTop3 = top3.slice(0, 3).map((l) => ({
      uci: (l.moves[0] || "").toLowerCase(),
      eval: l.mate !== 0 ? (l.mate > 0 ? 10000 : -10000) : l.cp,
      mateIn: l.mate !== 0 ? l.mate : null,
    }));
    // Rank: 1/2/3 if uci matches top-N; 4 otherwise.
    let rank: 1 | 2 | 3 | 4 = 4;
    for (let i = 0; i < engineTop3.length; i++) {
      if (engineTop3[i].uci === playedUci) {
        rank = (i + 1) as 1 | 2 | 3;
        break;
      }
    }
    const hadMate1 = engineTop3.some((l) => l.mateIn !== null && Math.abs(l.mateIn) === 1 && l.mateIn > 0);
    const hadMate2 = engineTop3.some((l) => l.mateIn !== null && Math.abs(l.mateIn) <= 2 && l.mateIn > 0);
    const hadMate3 = engineTop3.some((l) => l.mateIn !== null && Math.abs(l.mateIn) <= 3 && l.mateIn > 0);
    const playedLine = engineTop3.find((l) => l.uci === playedUci);
    const foundMate1 = !!playedLine && playedLine.mateIn !== null && Math.abs(playedLine.mateIn) === 1 && playedLine.mateIn > 0;
    const foundMate2 = !!playedLine && playedLine.mateIn !== null && Math.abs(playedLine.mateIn) <= 2 && playedLine.mateIn > 0;
    const foundMate3 = !!playedLine && playedLine.mateIn !== null && Math.abs(playedLine.mateIn) <= 3 && playedLine.mateIn > 0;
    // Brilliancy: played move ≠ engine #1 but CPL is tiny (still a strong move).
    // Heuristic — we don't have post-move eval here, so use cpl from base.
    const isBrilliancy = rank >= 2 && base.cpl < 30;
    this.moves.push({
      ...base,
      engineTop3,
      rank,
      hadMate1, hadMate2, hadMate3,
      foundMate1, foundMate2, foundMate3,
      isBrilliancy,
    });
  }

  /** Store top-3 lines for a FEN (called by background multiPV pass). */
  setPendingTop3(fen: string, lines: PVLine[]): void {
    if (!fen || !lines || lines.length === 0) return;
    // LRU-ish bound: drop the oldest entry first if at capacity.
    if (this.pendingTop3.size >= MetricsCollector.MAX_PENDING) {
      const firstKey = this.pendingTop3.keys().next().value;
      if (firstKey) this.pendingTop3.delete(firstKey);
    }
    this.pendingTop3.set(fen, lines.slice(0, 3));
  }

  /** Consume (read + delete) the stored top-3 for a FEN, or null. */
  consumePendingTop3(fen: string): PVLine[] | null {
    if (!fen) return null;
    const v = this.pendingTop3.get(fen);
    if (!v) return null;
    this.pendingTop3.delete(fen);
    return v;
  }

  reset(): void {
    this.moves = [];
    this.startTime = Date.now();
    this.pendingTop3.clear();
  }

  size(): number {
    return this.moves.length;
  }

  /** Read-only snapshot for debugging. */
  snapshot(): MoveMetric[] {
    return this.moves.slice();
  }

  /**
   * Build GameMetrics for the user's perspective (filter to user moves only).
   * userColor "w" → user plays plies 1, 3, 5, … (1-based ply, odd).
   * userColor "b" → user plays plies 2, 4, 6, … (1-based ply, even).
   */
  toGameMetrics(
    userColor: "w" | "b",
    result: "w" | "l" | "d",
    openingBookHits: number,
    totalTimeMs: number,
  ): GameMetrics {
    const userMoves = this.moves.filter((m) =>
      userColor === "w" ? m.ply % 2 === 1 : m.ply % 2 === 0,
    );
    return {
      cplPerMove: userMoves.map((m) => m.cpl),
      timeMsPerMove: userMoves.map((m) => m.timeMs),
      totalTimeMs,
      openingBookHits,
      movesByEngineRank: userMoves.map((m) => m.rank),
      mateOpportunities: {
        m1: userMoves.filter((m) => m.hadMate1).length,
        m2: userMoves.filter((m) => m.hadMate2).length,
        m3: userMoves.filter((m) => m.hadMate3).length,
      },
      mateFound: {
        m1: userMoves.filter((m) => m.foundMate1).length,
        m2: userMoves.filter((m) => m.foundMate2).length,
        m3: userMoves.filter((m) => m.foundMate3).length,
      },
      hangs: userMoves.filter((m) => m.isHang).length,
      brilliancies: userMoves.filter((m) => m.isBrilliancy).length,
      result,
    };
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Stockfish multiPV line parser
// ──────────────────────────────────────────────────────────────────────────

/**
 * Parse a single `info ... multipv N ... score ... pv FIRSTMOVE ...` line.
 *
 * Example:
 *   "info depth 18 seldepth 24 multipv 2 score cp -45 nodes 12345 pv e7e5 g1f3"
 * Returns:
 *   { rank: 2, evalCp: -45, mateIn: null, firstMoveUci: "e7e5" }
 *
 * Returns null if the line is not a valid multiPV info line (e.g. missing
 * `multipv`, `score`, or `pv`).
 */
export function parseMultiPVLine(
  line: string,
): { rank: number; evalCp: number | null; mateIn: number | null; firstMoveUci: string } | null {
  if (!line || !line.startsWith("info")) return null;
  const tokens = line.split(/\s+/);

  let rank = -1;
  let evalCp: number | null = null;
  let mateIn: number | null = null;
  let firstMoveUci = "";

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === "multipv" && i + 1 < tokens.length) {
      rank = parseInt(tokens[i + 1], 10);
    } else if (t === "score" && i + 2 < tokens.length) {
      const kind = tokens[i + 1];
      const val = parseInt(tokens[i + 2], 10);
      if (Number.isFinite(val)) {
        if (kind === "cp") evalCp = val;
        else if (kind === "mate") mateIn = val;
      }
    } else if (t === "pv" && i + 1 < tokens.length) {
      firstMoveUci = tokens[i + 1];
      break;
    }
  }

  if (rank < 1 || !firstMoveUci) return null;
  if (evalCp === null && mateIn === null) return null;
  return { rank, evalCp, mateIn, firstMoveUci };
}

// ──────────────────────────────────────────────────────────────────────────
// Centipawn-loss helper
// ──────────────────────────────────────────────────────────────────────────

/**
 * Compute centipawn-loss for a move given the evaluation BEFORE and AFTER
 * the move, both expressed as White-relative centipawns. CPL is always >= 0
 * from the moving player's perspective.
 *
 * Example: White plays a move. beforeEval=+50, afterEval=-30 → White lost 80cp.
 * Example: Black plays a move. beforeEval=-50, afterEval=+30 → Black lost 80cp
 * (eval went from -50 favoring Black to +30 favoring White = drop of 80 for Black).
 */
export function computeCPL(
  beforeEval: number,
  afterEval: number,
  playerSide: "w" | "b",
): number {
  const sign = playerSide === "w" ? 1 : -1;
  const fromPlayer = (cp: number) => cp * sign;
  const loss = fromPlayer(beforeEval) - fromPlayer(afterEval);
  return Math.max(0, Math.round(loss));
}
