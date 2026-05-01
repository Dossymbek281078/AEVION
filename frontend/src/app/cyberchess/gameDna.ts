// Game DNA — персональная аналитика игрока из savedGames.
// Pure function, no side effects. Works on the SavedGame[] shape
// declared in page.tsx.

export type SavedGameLike = {
  id: string;
  date: string;
  moves: string[];
  result: string;
  playerColor: "w" | "b";
  aiLevel: string;
  rating: number;
  tc: string;
  category?: string;
  opening?: string;
};

export type OpeningStat = { opening: string; wins: number; losses: number; draws: number; total: number; winPct: number };

export type GameDNA = {
  total: number;
  wins: number;
  losses: number;
  draws: number;
  winPct: number;
  preferredColor: "w" | "b" | "balanced";
  whiteGames: number;
  blackGames: number;
  whiteWinPct: number;
  blackWinPct: number;
  avgLengthWin: number;   // in moves (plies)
  avgLengthLoss: number;
  bestOpening: OpeningStat | null;
  worstOpening: OpeningStat | null;
  bestHour: number | null; // 0..23
  bestHourWinPct: number;
  currentStreak: { type: "W" | "L" | "D" | "none"; count: number };
  recentTrend: "up" | "down" | "flat" | "insufficient"; // last 10 vs prev 10
  recentWinPctDelta: number;
  ratingGrowth: number;   // last game rating - first game rating
  tacticalPhaseLoss: "opening" | "middlegame" | "endgame" | "balanced";
  insights: string[];     // natural-language bullet points, ru-RU
};

function isWin(r: string) { return r.includes("You win") || r.includes("timed out") || r.includes("win!") }
function isDraw(r: string) {
  return r.includes("Draw") || r.includes("draw") || r.includes("Stalemate") ||
         r.includes("repetition") || r.includes("Insufficient");
}
function classifyResult(r: string): "W" | "L" | "D" {
  if (isWin(r)) return "W";
  if (isDraw(r)) return "D";
  return "L";
}

export function computeGameDNA(games: SavedGameLike[]): GameDNA {
  if (games.length === 0) {
    return {
      total: 0, wins: 0, losses: 0, draws: 0, winPct: 0,
      preferredColor: "balanced", whiteGames: 0, blackGames: 0,
      whiteWinPct: 0, blackWinPct: 0,
      avgLengthWin: 0, avgLengthLoss: 0,
      bestOpening: null, worstOpening: null,
      bestHour: null, bestHourWinPct: 0,
      currentStreak: { type: "none", count: 0 },
      recentTrend: "insufficient", recentWinPctDelta: 0, ratingGrowth: 0,
      tacticalPhaseLoss: "balanced",
      insights: ["Сыграй 5–10 партий — и тут появится персональная диагностика"],
    };
  }

  const total = games.length;
  let wins = 0, losses = 0, draws = 0;
  let whiteGames = 0, whiteWins = 0, blackGames = 0, blackWins = 0;
  const lenWin: number[] = [], lenLoss: number[] = [];
  const byOpening = new Map<string, { w: number; l: number; d: number }>();
  const byHour = new Map<number, { w: number; total: number }>();

  // games[0] is most recent — iterate in order played (oldest → newest)
  const played = [...games].reverse();

  for (const g of played) {
    const res = classifyResult(g.result);
    if (res === "W") wins++;
    else if (res === "L") losses++;
    else draws++;

    if (g.playerColor === "w") { whiteGames++; if (res === "W") whiteWins++; }
    else { blackGames++; if (res === "W") blackWins++; }

    if (res === "W") lenWin.push(g.moves.length);
    else if (res === "L") lenLoss.push(g.moves.length);

    const op = (g.opening || "Без дебюта").trim();
    const s = byOpening.get(op) || { w: 0, l: 0, d: 0 };
    if (res === "W") s.w++;
    else if (res === "L") s.l++;
    else s.d++;
    byOpening.set(op, s);

    try {
      const d = new Date(g.date);
      const h = d.getHours();
      const hs = byHour.get(h) || { w: 0, total: 0 };
      hs.total++;
      if (res === "W") hs.w++;
      byHour.set(h, hs);
    } catch {}
  }

  const avg = (xs: number[]) => xs.length === 0 ? 0 : Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
  const avgLengthWin = avg(lenWin);
  const avgLengthLoss = avg(lenLoss);

  const whiteWinPct = whiteGames ? Math.round(whiteWins / whiteGames * 100) : 0;
  const blackWinPct = blackGames ? Math.round(blackWins / blackGames * 100) : 0;
  const preferredColor: "w" | "b" | "balanced" =
    whiteGames === blackGames ? "balanced" :
    whiteGames > blackGames ? "w" : "b";

  // Openings — min 3 games
  const openingStats: OpeningStat[] = [];
  for (const [opening, s] of byOpening) {
    const t = s.w + s.l + s.d;
    if (t < 3) continue;
    openingStats.push({
      opening, wins: s.w, losses: s.l, draws: s.d, total: t,
      winPct: Math.round(s.w / t * 100),
    });
  }
  openingStats.sort((a, b) => b.winPct - a.winPct);
  const bestOpening = openingStats[0] || null;
  const worstOpening = openingStats.length > 1 ? openingStats[openingStats.length - 1] : null;

  // Best hour — min 3 games
  let bestHour: number | null = null, bestHourWinPct = 0;
  for (const [h, s] of byHour) {
    if (s.total < 3) continue;
    const pct = Math.round(s.w / s.total * 100);
    if (pct > bestHourWinPct) { bestHourWinPct = pct; bestHour = h; }
  }

  // Current streak (from most recent)
  let streakType: "W" | "L" | "D" | "none" = "none";
  let streakCount = 0;
  for (const g of games) {
    const r = classifyResult(g.result);
    if (streakType === "none") { streakType = r; streakCount = 1; }
    else if (r === streakType) streakCount++;
    else break;
  }

  // Recent trend — last 10 vs previous 10
  let recentTrend: "up" | "down" | "flat" | "insufficient" = "insufficient";
  let recentWinPctDelta = 0;
  if (games.length >= 10) {
    const recent = games.slice(0, Math.min(10, games.length));
    const prev = games.slice(Math.min(10, games.length), Math.min(20, games.length));
    const recentPct = recent.filter(g => classifyResult(g.result) === "W").length / recent.length * 100;
    const prevPct = prev.length ? prev.filter(g => classifyResult(g.result) === "W").length / prev.length * 100 : recentPct;
    recentWinPctDelta = Math.round(recentPct - prevPct);
    if (prev.length < 5) recentTrend = "insufficient";
    else if (recentWinPctDelta >= 8) recentTrend = "up";
    else if (recentWinPctDelta <= -8) recentTrend = "down";
    else recentTrend = "flat";
  }

  // Rating growth
  const firstRating = played[0]?.rating || 0;
  const lastRating = games[0]?.rating || 0;
  const ratingGrowth = lastRating - firstRating;

  // Tactical phase (proxy): infer by average move count in losses
  // short loss = opening trouble; medium = middlegame; long = endgame
  let tacticalPhaseLoss: "opening" | "middlegame" | "endgame" | "balanced" = "balanced";
  if (lenLoss.length >= 3) {
    const avgL = avgLengthLoss;
    if (avgL < 24) tacticalPhaseLoss = "opening";
    else if (avgL < 60) tacticalPhaseLoss = "middlegame";
    else tacticalPhaseLoss = "endgame";
  }

  // Build insights
  const winPct = Math.round(wins / total * 100);
  const insights: string[] = [];

  if (recentTrend === "up") insights.push(`🔥 Последние 10 партий — +${recentWinPctDelta}% к предыдущим. Ты на подъёме.`);
  else if (recentTrend === "down") insights.push(`📉 Последние 10 партий — ${recentWinPctDelta}%. Проверь усталость или смени дебют.`);

  if (streakCount >= 3) {
    insights.push(streakType === "W"
      ? `🏆 Серия ${streakCount} побед подряд — не расслабляйся!`
      : streakType === "L"
      ? `😤 ${streakCount} проигрышей подряд. Сделай паузу или смени уровень AI.`
      : `🤝 ${streakCount} ничьих — попробуй быть острее в дебюте.`);
  }

  if (bestOpening) insights.push(`✨ Твой сильнейший дебют: ${bestOpening.opening} — ${bestOpening.winPct}% побед в ${bestOpening.total} партиях.`);
  if (worstOpening && worstOpening.opening !== bestOpening?.opening && worstOpening.winPct < 40)
    insights.push(`⚠ Слабое место: ${worstOpening.opening} — всего ${worstOpening.winPct}% побед. Разбери в Coach.`);

  if (whiteGames >= 5 && blackGames >= 5) {
    if (Math.abs(whiteWinPct - blackWinPct) >= 15) {
      const better: "w" | "b" = whiteWinPct > blackWinPct ? "w" : "b";
      insights.push(better === "w"
        ? `♔ За белых играешь гораздо увереннее (${whiteWinPct}% vs ${blackWinPct}% за чёрных).`
        : `♚ За чёрных ты сильнее (${blackWinPct}% vs ${whiteWinPct}% за белых).`);
    }
  }

  if (bestHour !== null) insights.push(`⏰ Лучшее время для игры — ${bestHour}:00–${(bestHour + 1) % 24}:00 (${bestHourWinPct}% побед).`);

  if (tacticalPhaseLoss === "opening") insights.push(`🎯 Чаще всего проигрываешь рано — проблемы в дебюте. Попробуй Opening Trainer.`);
  else if (tacticalPhaseLoss === "endgame") insights.push(`🎯 Проигрываешь в долгих партиях — слабый эндшпиль. Тренируй «Эндшпили» в Coach.`);
  else if (tacticalPhaseLoss === "middlegame") insights.push(`🎯 Поражения в середине партии — работай над позиционной игрой.`);

  if (ratingGrowth > 50) insights.push(`📈 Рейтинг вырос на +${ratingGrowth} очков за ${total} партий. Отличный прогресс!`);
  else if (ratingGrowth < -50) insights.push(`📊 Рейтинг упал на ${ratingGrowth}. Возможно, стоит немного снизить уровень AI.`);

  if (avgLengthWin > 0 && avgLengthLoss > 0 && avgLengthWin < avgLengthLoss * 0.7)
    insights.push(`⚡ Твои победы быстрые (${avgLengthWin} полуходов), а проигрыши затянутые (${avgLengthLoss}) — ты агрессивен, но устаёшь.`);

  if (insights.length === 0)
    insights.push(`📊 Винрейт ${winPct}%. Играй ещё — паттерны начнут проявляться после 10+ партий.`);

  return {
    total, wins, losses, draws, winPct,
    preferredColor, whiteGames, blackGames, whiteWinPct, blackWinPct,
    avgLengthWin, avgLengthLoss,
    bestOpening, worstOpening,
    bestHour, bestHourWinPct,
    currentStreak: { type: streakType, count: streakCount },
    recentTrend, recentWinPctDelta, ratingGrowth,
    tacticalPhaseLoss,
    insights,
  };
}
