/* ═══ Insights v2 ═══
   Углублённая аналитика по истории партий пользователя.
   Чем мы лучше chess.com / lichess: считаем «kryptonite-открытие»,
   «лучший / худший AI-уровень», динамику побед и winrate
   отдельно по цвету и формату — всё в одном дашборде. */

import { Chess } from "chess.js";

export type SavedGame = {
  id: string;
  date: string;
  moves: string[];
  result: string;
  playerColor: "w" | "b";
  aiLevel: string;
  rating: number;
  tc: string;
  category: "Bullet" | "Blitz" | "Rapid" | "Classical";
  opening?: string;
};

export type Outcome = "win" | "loss" | "draw";

function outcomeOf(g: SavedGame): Outcome {
  const r = (g.result || "").toLowerCase();
  if (r.includes("won") || r.includes("checkmate") && r.includes("you")) {
    // legacy formats
  }
  // Standardized markers from page.tsx:
  //   "Checkmate — You win!", "Checkmate — AI wins!", "Draw …", "Resigned …", "Time out", etc.
  if (r.includes("you win") || r.includes("ai timed out") || r.includes("ai resigned")) return "win";
  if (r.includes("ai wins") || r.includes("you resigned") || r.includes("time out")) return "loss";
  if (r.includes("draw") || r.includes("stalemate") || r.includes("repetition") || r.includes("50-move") || r.includes("insufficient")) return "draw";
  return "loss"; // unknown → treat as loss (conservative)
}

export type WinrateBreakdown = {
  wins: number;
  losses: number;
  draws: number;
  total: number;
  winPct: number;
  drawPct: number;
  lossPct: number;
};

function emptyWR(): WinrateBreakdown {
  return { wins: 0, losses: 0, draws: 0, total: 0, winPct: 0, drawPct: 0, lossPct: 0 };
}

function tally(arr: SavedGame[]): WinrateBreakdown {
  const wr = emptyWR();
  for (const g of arr) {
    const o = outcomeOf(g);
    if (o === "win") wr.wins++;
    else if (o === "loss") wr.losses++;
    else wr.draws++;
  }
  wr.total = wr.wins + wr.losses + wr.draws;
  if (wr.total > 0) {
    wr.winPct = Math.round((wr.wins / wr.total) * 100);
    wr.drawPct = Math.round((wr.draws / wr.total) * 100);
    wr.lossPct = Math.round((wr.losses / wr.total) * 100);
  }
  return wr;
}

export type OpeningStat = {
  name: string;
  total: number;
  winPct: number;
  wins: number;
  losses: number;
  draws: number;
};

function inferOpening(g: SavedGame): string {
  if (g.opening) return g.opening;
  // Fallback — определим по первым 4 ходам.
  if (!g.moves.length) return "Неизвестное";
  const m = g.moves;
  const first = m[0] || "";
  const second = m[1] || "";
  const third = m[2] || "";
  if (first === "e4") {
    if (second === "e5") return "Открытое начало (1.e4 e5)";
    if (second === "c5") return "Сицилианская защита";
    if (second === "e6") return "Французская защита";
    if (second === "c6") return "Защита Каро-Канн";
    if (second === "d5") return "Скандинавская защита";
    if (second === "d6") return "Защита Пирца";
    if (second === "Nf6") return "Защита Алехина";
    return "1.e4 (прочее)";
  }
  if (first === "d4") {
    if (second === "d5") return "Закрытое начало (1.d4 d5)";
    if (second === "Nf6") {
      if (third === "c4") return "Индийские защиты";
      return "1.d4 Nf6";
    }
    if (second === "f5") return "Голландская защита";
    return "1.d4 (прочее)";
  }
  if (first === "c4") return "Английское начало";
  if (first === "Nf3") return "Дебют Рети";
  if (first === "g3") return "Королевский фианкетто";
  if (first === "b3") return "Дебют Ларсена";
  return `1.${first} ${second}`;
}

export type PhaseAccuracy = {
  opening: number; // % moves we'd consider "good" in opening
  middlegame: number;
  endgame: number;
};

export type TimePressure = {
  pctGamesLostOnTime: number;
  bullet: WinrateBreakdown;
  blitz: WinrateBreakdown;
  rapid: WinrateBreakdown;
  classical: WinrateBreakdown;
};

export type StreakInfo = {
  current: { type: Outcome | "none"; length: number };
  longestWin: number;
  longestLoss: number;
};

export type Insights = {
  total: number;
  overall: WinrateBreakdown;
  asWhite: WinrateBreakdown;
  asBlack: WinrateBreakdown;
  byCategory: Record<"Bullet" | "Blitz" | "Rapid" | "Classical", WinrateBreakdown>;
  byAiLevel: { level: string; wr: WinrateBreakdown }[];
  bestOpening: OpeningStat | null;
  kryptonite: OpeningStat | null;
  openings: OpeningStat[];
  streaks: StreakInfo;
  avgGameLength: number; // полные ходы
  longestWin: { id: string; date: string; opening: string; moves: number } | null;
  shortestLoss: { id: string; date: string; opening: string; moves: number } | null;
  recentForm: ("W" | "L" | "D")[]; // последние 10
  timePressure: TimePressure;
  trend: { date: string; rating: number }[]; // rolling rating per game
  ratingDelta: number; // current - first
};

export function computeInsights(games: SavedGame[]): Insights {
  const total = games.length;
  const overall = tally(games);
  const asWhite = tally(games.filter((g) => g.playerColor === "w"));
  const asBlack = tally(games.filter((g) => g.playerColor === "b"));

  const byCategory = {
    Bullet: tally(games.filter((g) => g.category === "Bullet")),
    Blitz: tally(games.filter((g) => g.category === "Blitz")),
    Rapid: tally(games.filter((g) => g.category === "Rapid")),
    Classical: tally(games.filter((g) => g.category === "Classical")),
  } as Insights["byCategory"];

  const byAi = new Map<string, SavedGame[]>();
  for (const g of games) {
    const key = g.aiLevel || "Unknown";
    if (!byAi.has(key)) byAi.set(key, []);
    byAi.get(key)!.push(g);
  }
  const byAiLevel = [...byAi.entries()]
    .map(([level, list]) => ({ level, wr: tally(list) }))
    .sort((a, b) => b.wr.total - a.wr.total);

  // Openings
  const byOpening = new Map<string, SavedGame[]>();
  for (const g of games) {
    const key = inferOpening(g);
    if (!byOpening.has(key)) byOpening.set(key, []);
    byOpening.get(key)!.push(g);
  }
  const openings: OpeningStat[] = [...byOpening.entries()]
    .map(([name, list]) => {
      const wr = tally(list);
      return {
        name,
        total: wr.total,
        winPct: wr.winPct,
        wins: wr.wins,
        losses: wr.losses,
        draws: wr.draws,
      };
    })
    .sort((a, b) => b.total - a.total);

  // Лучшее: ≥3 партии, max winPct (при равенстве — больше партий)
  const eligible = openings.filter((o) => o.total >= 3);
  const bestOpening =
    eligible
      .slice()
      .sort((a, b) => b.winPct - a.winPct || b.total - a.total)[0] || null;
  const kryptonite =
    eligible
      .slice()
      .sort((a, b) => a.winPct - b.winPct || b.total - a.total)[0] || null;

  // Streaks (in date order — games are stored newest-first, so reverse)
  const chrono = [...games].reverse();
  let longestWin = 0, longestLoss = 0;
  let curType: Outcome | "none" = "none";
  let curLen = 0;
  let runWin = 0, runLoss = 0;
  for (const g of chrono) {
    const o = outcomeOf(g);
    if (o === "win") {
      runWin++; runLoss = 0;
      if (runWin > longestWin) longestWin = runWin;
    } else if (o === "loss") {
      runLoss++; runWin = 0;
      if (runLoss > longestLoss) longestLoss = runLoss;
    } else {
      runWin = 0; runLoss = 0;
    }
    if (curType === o) curLen++;
    else { curType = o; curLen = 1; }
  }
  const streaks: StreakInfo = {
    current: { type: curType, length: curLen },
    longestWin,
    longestLoss,
  };

  // Avg game length (moves)
  const avgGameLength = total
    ? Math.round(games.reduce((a, g) => a + Math.ceil(g.moves.length / 2), 0) / total)
    : 0;

  // Longest win / shortest loss (full moves)
  let longestWinG: SavedGame | null = null;
  let shortestLossG: SavedGame | null = null;
  for (const g of games) {
    const o = outcomeOf(g);
    if (o === "win") {
      if (!longestWinG || g.moves.length > longestWinG.moves.length) longestWinG = g;
    }
    if (o === "loss") {
      if (g.moves.length < 6) continue; // skip insta-resigns
      if (!shortestLossG || g.moves.length < shortestLossG.moves.length) shortestLossG = g;
    }
  }

  // Recent form — последние 10 партий (newest-first storage → берём первые 10)
  const recentForm: Insights["recentForm"] = games.slice(0, 10).map((g) => {
    const o = outcomeOf(g);
    return o === "win" ? "W" : o === "loss" ? "L" : "D";
  });

  // Time pressure
  const timeoutLosses = games.filter((g) =>
    /time out/i.test(g.result || "")
  ).length;
  const timePressure: TimePressure = {
    pctGamesLostOnTime: total ? Math.round((timeoutLosses / total) * 100) : 0,
    bullet: byCategory.Bullet,
    blitz: byCategory.Blitz,
    rapid: byCategory.Rapid,
    classical: byCategory.Classical,
  };

  // Rating trend
  const trend = chrono.map((g) => ({ date: g.date, rating: g.rating }));
  const ratingDelta = trend.length >= 2 ? trend[trend.length - 1].rating - trend[0].rating : 0;

  return {
    total,
    overall,
    asWhite,
    asBlack,
    byCategory,
    byAiLevel,
    bestOpening,
    kryptonite,
    openings,
    streaks,
    avgGameLength,
    longestWin: longestWinG
      ? {
          id: longestWinG.id,
          date: longestWinG.date,
          opening: inferOpening(longestWinG),
          moves: Math.ceil(longestWinG.moves.length / 2),
        }
      : null,
    shortestLoss: shortestLossG
      ? {
          id: shortestLossG.id,
          date: shortestLossG.date,
          opening: inferOpening(shortestLossG),
          moves: Math.ceil(shortestLossG.moves.length / 2),
        }
      : null,
    recentForm,
    timePressure,
    trend,
    ratingDelta,
  };
}

// Validate that a list of moves actually makes a legal chess game — not used at
// runtime, but a useful debug hook for tests.
export function gameIsLegal(g: SavedGame): boolean {
  try {
    const c = new Chess();
    for (const san of g.moves) c.move(san);
    return true;
  } catch {
    return false;
  }
}
