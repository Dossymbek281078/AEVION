export type Phase = "opening" | "middlegame" | "endgame";

export type PhaseDetail = {
  phase: Phase;
  reasonKey: string;
  n: number;
  totalPieces: number;
  hasQueens: boolean;
};

export function detectPhase(fen: string, moveCount: number): PhaseDetail {
  const board = fen.split(" ")[0];
  const pieces = board.replace(/[1-8/]/g, "");
  const totalPieces = pieces.length;
  const hasQueens = /[Qq]/.test(pieces);
  const minorPieces = (pieces.match(/[NBnb]/g) || []).length;
  const majorPieces = (pieces.match(/[QRqr]/g) || []).length;
  const mk = (phase: Phase, reasonKey: string, n: number): PhaseDetail => ({ phase, reasonKey, n, totalPieces, hasQueens });
  if (totalPieces <= 12) return mk("endgame", "cpn.reason.endgameN", totalPieces);
  if (!hasQueens && (minorPieces + majorPieces) <= 6) return mk("endgame", "cpn.reason.noQueens", 0);
  if (moveCount < 14 && totalPieces >= 26) return mk("opening", "cpn.reason.openingN", Math.ceil(moveCount / 2) || 1);
  if (moveCount < 8) return mk("opening", "cpn.reason.openingEarly", 0);
  return mk("middlegame", "cpn.reason.middleN", totalPieces);
}

export type PhaseTip = { priority: 1 | 2 | 3 };

export const PHASE_TIPS: Record<Phase, { tips: PhaseTip[] }> = {
  opening: { tips: [{ priority: 1 }, { priority: 1 }, { priority: 1 }, { priority: 2 }, { priority: 2 }, { priority: 3 }] },
  middlegame: { tips: [{ priority: 1 }, { priority: 1 }, { priority: 1 }, { priority: 2 }, { priority: 2 }, { priority: 3 }] },
  endgame: { tips: [{ priority: 1 }, { priority: 1 }, { priority: 1 }, { priority: 2 }, { priority: 2 }, { priority: 3 }] },
};

export function tipsForPhase(p: Phase): PhaseTip[] {
  return PHASE_TIPS[p].tips;
}
