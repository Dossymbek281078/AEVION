/**
 * CyberChess Achievement catalog.
 *
 * Сохраняем стабильные ID, чтобы они совпадали с existing unlockAch() calls
 * в page.tsx — иначе AchievementPanel покажет "locked" для уже разблокированных.
 *
 * Existing IDs (не менять!):
 *   first_win, wins_10, wins_50, beat_master, beat_expert,
 *   puzzles_10, puzzles_50, puzzles_100,
 *   rush_10, rush_25, endgame_master,
 *   variant_<id>_{first,five,twentyfive}  (динамические, не в каталоге)
 *
 * New IDs (триггерятся через useEffect ниже):
 *   first_game, games_10, games_50, games_100,
 *   rating_1000, rating_1500, rating_2000,
 *   login_streak_7, variants_5, ecosystem_5, repertoire_5, coach_10, chessy_1000
 */

export type AchievementCategory = "games" | "puzzles" | "rating" | "streak" | "explore" | "skill";

export type Achievement = {
  id: string;
  title: string;
  desc: string;
  icon: string;
  category: AchievementCategory;
  reward: number;
  target?: number;
};

export type AchievementContext = {
  totalGames?: number;
  totalWins?: number;
  pzSolvedCount?: number;
  pzBestStreak?: number;
  rushBestScore?: number;
  rating?: number;
  variantsTried?: number;
  coachUsed?: number;
  repertoireBranches?: number;
  ecosystemVisits?: number;
  loginStreak?: number;
  lifetimeChessy?: number;
};

export const ACHIEVEMENTS: Achievement[] = [
  // ───────── Games (новые) ─────────
  { id: "first_game",     title: "Первый ход",        desc: "Сыграй первую партию",         icon: "♟",  category: "games", reward: 10, target: 1 },
  { id: "games_10",       title: "Любитель",          desc: "Сыграй 10 партий",             icon: "🎯", category: "games", reward: 25, target: 10 },
  { id: "games_50",       title: "Завсегдатай",       desc: "Сыграй 50 партий",             icon: "♚",  category: "games", reward: 75, target: 50 },
  { id: "games_100",      title: "Сотня",             desc: "Сыграй 100 партий",            icon: "💯", category: "games", reward: 150, target: 100 },

  // ───────── Games (existing IDs!) ─────────
  { id: "first_win",      title: "Первая победа",     desc: "Победи в первой партии",       icon: "🥇", category: "games", reward: 50, target: 1 },
  { id: "wins_10",        title: "Победитель",        desc: "Победи 10 раз",                icon: "🏆", category: "games", reward: 100, target: 10 },
  { id: "wins_50",        title: "Чемпион",           desc: "Победи 50 раз",                icon: "👑", category: "games", reward: 300, target: 50 },
  { id: "beat_expert",    title: "Победил Expert",    desc: "Победи AI уровня Expert",      icon: "🎖", category: "games", reward: 100 },
  { id: "beat_master",    title: "Победил Master",    desc: "Победи AI уровня Master",      icon: "🏅", category: "games", reward: 200 },
  { id: "endgame_master", title: "Мастер эндшпилей",  desc: "Выиграй эндшпиль из тренажёра", icon: "🏰", category: "games", reward: 80 },

  // ───────── Puzzles (existing IDs!) ─────────
  { id: "puzzles_10",     title: "Решатель",          desc: "Реши 10 пазлов",               icon: "🧩", category: "puzzles", reward: 30, target: 10 },
  { id: "puzzles_50",     title: "Тактик",            desc: "Реши 50 пазлов",               icon: "⚔",  category: "puzzles", reward: 150, target: 50 },
  { id: "puzzles_100",    title: "Мастер тактики",    desc: "Реши 100 пазлов",              icon: "🗡", category: "puzzles", reward: 400, target: 100 },
  { id: "rush_10",        title: "Rush 10",           desc: "Набери 10 в Puzzle Rush",      icon: "⚡", category: "puzzles", reward: 50, target: 10 },
  { id: "rush_25",        title: "Rush 25",           desc: "Набери 25 в Puzzle Rush",      icon: "🔥", category: "puzzles", reward: 200, target: 25 },

  // ───────── Rating (новые) ─────────
  { id: "rating_1000",    title: "Тысяча",            desc: "Достигни рейтинга 1000",       icon: "📈", category: "rating", reward: 30, target: 1000 },
  { id: "rating_1500",    title: "Полторашка",        desc: "Достигни рейтинга 1500",       icon: "📊", category: "rating", reward: 75, target: 1500 },
  { id: "rating_2000",    title: "Эксперт",           desc: "Достигни рейтинга 2000",       icon: "🎓", category: "rating", reward: 200, target: 2000 },

  // ───────── Streak (новые) ─────────
  { id: "login_streak_7", title: "Неделя",            desc: "Заходи 7 дней подряд",         icon: "📅", category: "streak", reward: 50, target: 7 },

  // ───────── Explore (новые) ─────────
  { id: "variants_5",     title: "Экспериментатор",   desc: "Попробуй 5 вариантов шахмат",  icon: "🎲", category: "explore", reward: 50, target: 5 },
  { id: "ecosystem_5",    title: "Исследователь",     desc: "Перейди в 5 продуктов AEVION", icon: "🌐", category: "explore", reward: 30, target: 5 },
  { id: "repertoire_5",   title: "Дебютная книга",    desc: "Добавь 5 веток в репертуар",   icon: "📖", category: "explore", reward: 40, target: 5 },

  // ───────── Skill (новые) ─────────
  { id: "coach_10",       title: "Ученик",            desc: "Спроси коуча 10 раз",          icon: "🎓", category: "skill", reward: 30, target: 10 },
  { id: "chessy_1000",    title: "Богач",             desc: "Заработай 1000 Chessy всего",  icon: "💰", category: "skill", reward: 100, target: 1000 },
];

export const CATEGORIES: { id: AchievementCategory | "all"; label: string }[] = [
  { id: "all",      label: "Все" },
  { id: "games",    label: "Партии" },
  { id: "puzzles",  label: "Пазлы" },
  { id: "rating",   label: "Рейтинг" },
  { id: "streak",   label: "Серии" },
  { id: "explore",  label: "Открытия" },
  { id: "skill",    label: "Мастерство" },
];

export function progressOf(ach: Achievement, ctx: AchievementContext): number {
  switch (ach.id) {
    case "first_game":
    case "games_10":
    case "games_50":
    case "games_100":      return ctx.totalGames ?? 0;
    case "first_win":
    case "wins_10":
    case "wins_50":        return ctx.totalWins ?? 0;
    case "puzzles_10":
    case "puzzles_50":
    case "puzzles_100":    return ctx.pzSolvedCount ?? 0;
    case "rush_10":
    case "rush_25":        return ctx.rushBestScore ?? 0;
    case "rating_1000":
    case "rating_1500":
    case "rating_2000":    return ctx.rating ?? 0;
    case "login_streak_7": return ctx.loginStreak ?? 0;
    case "variants_5":     return ctx.variantsTried ?? 0;
    case "ecosystem_5":    return ctx.ecosystemVisits ?? 0;
    case "repertoire_5":   return ctx.repertoireBranches ?? 0;
    case "coach_10":       return ctx.coachUsed ?? 0;
    case "chessy_1000":    return ctx.lifetimeChessy ?? 0;
    default: return 0;
  }
}

export function isComplete(ach: Achievement, ctx: AchievementContext): boolean {
  if (!ach.target) return false;
  return progressOf(ach, ctx) >= ach.target;
}

export function findNewlyUnlocked(
  ach: Record<string, number>,
  ctx: AchievementContext,
): Achievement[] {
  return ACHIEVEMENTS.filter(a => !ach[a.id] && isComplete(a, ctx));
}
