// Ghost Duel — дуэль с прошлым собой.
// Берётся любая сохранённая партия. Призрак автоматически воспроизводит
// её ходы как противник (или как ты сам, если меняемся ролями).
// Игрок может отклониться → DIVERGENCE → дальше призрак играет через Stockfish.
// В конце eval-сравнение: лучше / хуже / так же, чем в той партии.

const GHOST_DUEL_KEY = "aevion_chess_ghost_duel_v1";

export type DuelMode = "rematch" | "swap";

// Lean snapshot of a SavedGame — only fields we need.
export type GhostSourceGame = {
  id: string;
  date: string;
  moves: string[];
  playerColor: "w" | "b";
  result: string;
  rating: number;
  aiLevel: string;
  opening?: string;
};

export type GhostDuelConfig = {
  v: 1;
  ts: number;
  pastGameId: string;
  pastDate: string;
  pastMoves: string[];
  pastPlayerColor: "w" | "b";
  pastResult: string;
  pastRating: number;
  pastAiLevel: string;
  pastOpening?: string;
  userPlaysAs: "w" | "b";
  mode: DuelMode;
};

export type GhostDuelStats = {
  v: 1;
  total: number;
  wins: number;        // wins from current-user perspective
  losses: number;
  draws: number;
  bestBetterCp: number; // best margin over past self in any duel
  lastTs: number;
};

const STATS_DEFAULT: GhostDuelStats = {
  v: 1,
  total: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  bestBetterCp: 0,
  lastTs: 0,
};

export function ldGhostDuelStats(): GhostDuelStats {
  try {
    const s = typeof window !== "undefined" ? localStorage.getItem(GHOST_DUEL_KEY) : null;
    if (!s) return { ...STATS_DEFAULT };
    const r = JSON.parse(s);
    if (!r || r.v !== 1) return { ...STATS_DEFAULT };
    return { ...STATS_DEFAULT, ...r };
  } catch { return { ...STATS_DEFAULT } }
}

export function svGhostDuelStats(s: GhostDuelStats) {
  try { localStorage.setItem(GHOST_DUEL_KEY, JSON.stringify(s)) } catch {}
}

// Build the duel config from a saved game and chosen mode.
// rematch: user plays the SAME side as in the past game → ghost is past opponent
// swap:    user plays the OPPOSITE side → ghost replays past-user's moves
export function makeDuelConfig(g: GhostSourceGame, mode: DuelMode): GhostDuelConfig {
  return {
    v: 1,
    ts: Date.now(),
    pastGameId: g.id,
    pastDate: g.date,
    pastMoves: [...g.moves],
    pastPlayerColor: g.playerColor,
    pastResult: g.result,
    pastRating: g.rating,
    pastAiLevel: g.aiLevel,
    pastOpening: g.opening,
    userPlaysAs: mode === "rematch" ? g.playerColor : (g.playerColor === "w" ? "b" : "w"),
    mode,
  };
}

// Returns the SAN that the ghost should play at given ply (0-indexed),
// or null if past game has ended or it's user's turn (not ghost's).
export function getGhostMoveAt(c: GhostDuelConfig, ply: number): string | null {
  if (ply < 0 || ply >= c.pastMoves.length) return null;
  const ghostSide: "w" | "b" = c.userPlaysAs === "w" ? "b" : "w";
  const sideAtPly: "w" | "b" = ply % 2 === 0 ? "w" : "b";
  if (sideAtPly !== ghostSide) return null;
  return c.pastMoves[ply];
}

// Detect divergence: returns ply index where current diverged from past, or null if same/unknown.
// Compares move-by-move; first mismatch is divergence point.
export function checkDivergence(c: GhostDuelConfig, currentMoves: string[]): number | null {
  const userSide: "w" | "b" = c.userPlaysAs;
  for (let i = 0; i < currentMoves.length; i++) {
    if (i >= c.pastMoves.length) return null;
    if (currentMoves[i] === c.pastMoves[i]) continue;
    // Only count divergence on USER's moves (ghost moves are scripted to match past)
    const sideAtPly: "w" | "b" = i % 2 === 0 ? "w" : "b";
    if (sideAtPly === userSide) return i;
    // If ghost couldn't play the scripted move (illegal post-divergence) — treat as past ended
    return i;
  }
  return null;
}

// EvalSample: { ply, cp } where cp is centipawns from white's perspective.
export type EvalSample = { ply: number; cp: number };

// Compare current vs past eval series. Higher cp = better for white; flip for black.
// Returns average centipawn difference favorable to user (positive = playing better than past).
export function compareEvals(
  current: EvalSample[],
  past: EvalSample[],
  userPlaysAs: "w" | "b",
): { betterCp: number; samples: number } {
  if (!current.length || !past.length) return { betterCp: 0, samples: 0 };
  const pastMap = new Map(past.map(s => [s.ply, s.cp]));
  let total = 0, count = 0;
  for (const cur of current) {
    const p = pastMap.get(cur.ply);
    if (p === undefined) continue;
    const diff = (cur.cp - p) * (userPlaysAs === "w" ? 1 : -1);
    total += diff;
    count++;
  }
  return { betterCp: count > 0 ? total / count : 0, samples: count };
}

// Format the past game date for display (handles ISO and dot-format).
export function formatPastDate(d: string): string {
  if (!d) return "—";
  try {
    if (d.includes("T")) return new Date(d).toLocaleDateString("ru-RU");
    if (d.includes(".")) return d.replace(/\./g, "-");
    return d;
  } catch { return d }
}

export function ghostGreeting(c: GhostDuelConfig): string {
  const date = formatPastDate(c.pastDate);
  const sideLabel = c.userPlaysAs === "w" ? "белыми" : "чёрными";
  if (c.mode === "rematch") {
    return `Партия от ${date} — ты снова играешь ${sideLabel}. Призрак повторит ходы соперника той игры. Сможешь сыграть лучше, чем тогда?`;
  }
  return `Ролями меняемся — играешь ${sideLabel}, а призрак воспроизводит твои ходы из той партии. Найди свои слабости со стороны соперника.`;
}

export function ghostSummary(
  c: GhostDuelConfig,
  divergedAtPly: number | null,
  cmp: { betterCp: number; samples: number },
  currentResult: string,
): string {
  const parts: string[] = [];
  parts.push(`Партия от ${formatPastDate(c.pastDate)} (${c.pastResult}).`);
  if (divergedAtPly === null) {
    parts.push("Ты повторил всю партию ход в ход.");
  } else {
    const moveNum = Math.floor(divergedAtPly / 2) + 1;
    parts.push(`Отклонение на ${moveNum}-м ходу.`);
  }
  if (cmp.samples > 1) {
    const better = Math.round(cmp.betterCp);
    if (better > 40) parts.push(`Сегодня сильнее: +${better} cp в среднем.`);
    else if (better < -40) parts.push(`Прошлый ты играл лучше (${better} cp).`);
    else parts.push(`Игра близка по силе (Δ${better} cp).`);
  }
  parts.push(currentResult);
  return parts.join(" ");
}

export function recordDuelResult(
  prev: GhostDuelStats,
  isWin: boolean,
  isDraw: boolean,
  betterCp: number,
): GhostDuelStats {
  return {
    ...prev,
    total: prev.total + 1,
    wins: prev.wins + (isWin ? 1 : 0),
    losses: prev.losses + (!isWin && !isDraw ? 1 : 0),
    draws: prev.draws + (isDraw ? 1 : 0),
    bestBetterCp: Math.max(prev.bestBetterCp, betterCp),
    lastTs: Date.now(),
  };
}
