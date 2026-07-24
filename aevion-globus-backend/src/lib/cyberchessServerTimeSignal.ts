/**
 * cyberchessServerTimeSignal.ts
 *
 * Server-truth move-time anti-cheat signal for online matchmaking games.
 *
 * The existing anti-cheat pipeline (frontend/src/app/cyberchess/anticheat.ts,
 * cyberchessAnticheat.ts) computes engine-agreement + timing stats entirely
 * client-side and self-reports the verdict — a cheating client can simply
 * report "clean" or skip the call. Move timestamps, however, are already
 * captured server-side and unspoofable: `cyberchessMatchmaking.ts` stamps
 * every accepted move with `at: Date.now()` (server clock, not trusted from
 * the client) purely for clock-remaining math today. This module reuses that
 * same data to compute the timing half of the anti-cheat picture — the half
 * that doesn't require a chess engine — with a trust level the client-side
 * report can never have.
 *
 * Formula mirrors frontend/src/app/cyberchess/anticheat.ts's timeCoV/instantMoves
 * exactly (same thresholds) so client and server signals stay comparable.
 */

export interface ServerMove {
  uci: string;
  by: string;
  at: number;
}

export interface ServerTimeStats {
  diagnosticMoves: number;
  avgMoveTimeMs: number;
  timeCoV: number;
  instantMoves: number;
}

/**
 * `by` matches a player's userId per move (as stored in Match.moves). Ply
 * order alternates white/black starting with white, enforced server-side by
 * the existing turn-order check in POST /move — so `moves[i].by` is already
 * authoritative, no need to re-derive side from index parity.
 */
export function computeServerTimeStats(
  moves: ServerMove[],
  gameStartAt: number,
  side: string,
): ServerTimeStats | null {
  if (moves.length === 0) return null;

  const thinkTimes: { ms: number; ply: number }[] = [];
  let prevAt = gameStartAt;
  for (let i = 0; i < moves.length; i++) {
    const mv = moves[i];
    if (mv.by === side) {
      thinkTimes.push({ ms: mv.at - prevAt, ply: i });
    }
    prevAt = mv.at;
  }

  // Same filter as the client: drop non-positive/near-zero artifacts, and
  // don't score opening "book" moves (ply <= 6) as instant-move evidence —
  // fast, memorized opening moves are normal human behaviour, not a signal.
  const times = thinkTimes.map((t) => t.ms).filter((t) => t > 200);
  if (times.length === 0) return null;

  const avgMoveTimeMs = times.reduce((s, v) => s + v, 0) / times.length;
  const variance =
    times.length > 1
      ? times.reduce((s, v) => s + (v - avgMoveTimeMs) ** 2, 0) / (times.length - 1)
      : 0;
  const timeCoV = avgMoveTimeMs > 0 ? Math.sqrt(variance) / avgMoveTimeMs : 0.8;
  const instantMoves = thinkTimes.filter((t) => t.ms > 0 && t.ms < 800 && t.ply > 6).length;

  return {
    diagnosticMoves: times.length,
    avgMoveTimeMs,
    timeCoV,
    instantMoves,
  };
}

export interface ServerTimeVerdict {
  verdict: "clean" | "unusual" | "suspicious" | "flagged";
  suspicionScore: number;
  confidence: "insufficient" | "low" | "medium" | "high";
}

function logistic(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function sigmoid100(x: number, center: number, steepness: number): number {
  return Math.min(100, Math.max(0, Math.round(logistic((x - center) / steepness) * 100)));
}

/**
 * Same scoring shape as the client's sigTimeAnomaly (anticheat.ts) — sigmoid
 * over CoV-below-normal and instant-move-count-above-normal, blended 60/40 —
 * but this is a SINGLE signal report (timing only, no engine-agreement data
 * available server-side yet), so it's capped at "suspicious", never
 * "flagged": one anomalous signal alone shouldn't reach the same verdict tier
 * the client's multi-signal aggregate reserves for corroborated evidence
 * across engine-agreement, CPL, and behavior together.
 */
export function classifyServerTimeSignal(stats: ServerTimeStats): ServerTimeVerdict {
  if (stats.diagnosticMoves < 8) {
    return { verdict: "clean", suspicionScore: 0, confidence: "insufficient" };
  }
  const covScore = sigmoid100(0.42 - stats.timeCoV, 0, 0.12);
  const instScore = sigmoid100(stats.instantMoves - 3, 3, 2);
  const suspicionScore = Math.round(covScore * 0.6 + instScore * 0.4);
  const verdict =
    suspicionScore < 30 ? "clean" : suspicionScore < 60 ? "unusual" : "suspicious";
  const confidence = stats.diagnosticMoves >= 20 ? "high" : stats.diagnosticMoves >= 12 ? "medium" : "low";
  return { verdict, suspicionScore, confidence };
}
