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

  recordMove(m: MoveMetric): void {
    this.moves.push(m);
  }

  reset(): void {
    this.moves = [];
    this.startTime = Date.now();
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
