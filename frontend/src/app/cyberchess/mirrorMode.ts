/**
 * Mirror Mode — AI that plays like the user based on game history.
 * Pure TypeScript, no React dependencies.
 */

export type PlayerProfile = {
  avgCpl: number;           // average centipawn loss
  estimatedElo: number;     // ~800-2400
  stockfishDepth: number;   // 4-18, mapped from estimatedElo
  favoriteOpenings: string[]; // first 4 UCI moves as strings, most frequent first
  avgMoveTimeMs: number;    // average thinking time (currently 0 — not tracked in SavedGame)
  blunderRate: number;      // fraction of moves that were blunders
};

export type SavedGameForMirror = {
  moves: string[];           // SAN moves array
  result: string;
  playerColor: "w" | "b";
};

/**
 * Build a PlayerProfile from a list of saved games.
 * Uses last 20 games for recency weighting.
 */
export function buildPlayerProfile(games: SavedGameForMirror[]): PlayerProfile {
  const recent = games.slice(0, 20);

  // 1. Win rate → estimated ELO
  let wins = 0;
  for (const g of recent) {
    const r = (g.result || "").toLowerCase();
    const isWhiteWin = r.includes("1-0") || r === "win" || r === "you win" || r.includes("white wins");
    const isBlackWin = r.includes("0-1") || r.includes("black wins");
    if (g.playerColor === "w" && isWhiteWin) wins++;
    else if (g.playerColor === "b" && isBlackWin) wins++;
  }
  const winRate = recent.length > 0 ? wins / recent.length : 0.3;
  const estimatedElo = Math.round(Math.min(2400, Math.max(800, 800 + winRate * 1200)));

  // 2. Map ELO → Stockfish depth (clamped 4–18)
  const stockfishDepth = Math.min(18, Math.max(4, Math.round(4 + (estimatedElo - 800) / 150)));

  // 3. Extract opening sequences — for each game take player's first 4 moves (as SAN)
  //    then find most frequent sequences
  const openingCounts: Record<string, number> = {};
  for (const g of recent) {
    if (!g.moves || g.moves.length < 4) continue;
    // Player moves: if white → moves[0], [2], [4], [6]; if black → moves[1], [3], [5], [7]
    const start = g.playerColor === "w" ? 0 : 1;
    const playerMoves: string[] = [];
    for (let i = start; i < g.moves.length && playerMoves.length < 4; i += 2) {
      playerMoves.push(g.moves[i]);
    }
    if (playerMoves.length >= 2) {
      const key = playerMoves.join(" ");
      openingCounts[key] = (openingCounts[key] || 0) + 1;
    }
  }
  const favoriteOpenings = Object.entries(openingCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([seq]) => seq);

  // 4. avgCpl and blunderRate — not available without engine analysis;
  //    use defaults (future: hook into stockfishMetrics).
  const avgCpl = 0;
  const avgMoveTimeMs = 0;
  const blunderRate = 0;

  return {
    avgCpl,
    estimatedElo,
    stockfishDepth,
    favoriteOpenings,
    avgMoveTimeMs,
    blunderRate,
  };
}

/** Return the Stockfish search depth for mirror mode. */
export function mirrorDepth(profile: PlayerProfile): number {
  return profile.stockfishDepth;
}

/**
 * Returns true when the current game moves start with one of the player's
 * favourite opening sequences — meaning the AI "knows" this line and can
 * play along naturally.
 *
 * @param profile       The player's profile built from history.
 * @param currentMoves  The SAN moves played so far (full game, not just one color).
 */
export function shouldPlayMirrorBook(profile: PlayerProfile, currentMoves: string[]): boolean {
  if (!profile.favoriteOpenings.length || !currentMoves.length) return false;
  // Build a string from current moves to prefix-match against stored openings
  const currentStr = currentMoves.join(" ");
  return profile.favoriteOpenings.some(opening => {
    // opening is e.g. "e4 e5 Nf3 Nc6" — check if current moves contain this as a subsequence prefix
    return currentStr.startsWith(opening) || opening.startsWith(currentStr.split(" ").slice(0, 4).join(" "));
  });
}
