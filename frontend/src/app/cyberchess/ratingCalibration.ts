/**
 * AEVION CyberChess — FIDE rating calibration anchors + CPI metric regression.
 *
 * Привязка нашей внутренней рейтинговой шкалы к FIDE для понятного
 * "ваш стиль = FIDE ~X". Не Lichess import — мы оцениваем игрока
 * через собственные CPI метрики (accuracy, opening theory depth,
 * tactical efficiency, endgame strength, blunder rate) и mapping'ом
 * через эти якоря даём FIDE-equivalent оценку.
 *
 * Якоря — hardcoded для MVP, 25 уровней (расширено с 15). Когда наберём
 * калибровочный датасет (партии GM с известным FIDE через PGN dumps
 * Lichess Open DB + собственный CPI), сделаем least-squares fit
 * α/β/γ/δ/ε коэффициентов через `estimateFideFromCPI` regression.
 */

export type RatingAnchor = {
  fide: number;
  internal: number;
  title: string;
  badge: string;
  /** Описание — что значит этот уровень в игре */
  desc: string;
};

/**
 * Якоря — упорядочены по убыванию силы (25 уровней).
 * Internal слегка отличается от FIDE потому что наш AI Master (уровень 5)
 * калиброван на ~2400 ELO Stockfish, а Stockfish d18 на 2400 примерно
 * соответствует FIDE 2400-2500 IM-уровню. Промежуточные якоря добавлены
 * для более гладкой интерполяции в "горячих" диапазонах 1500-2500 и
 * на бординг-новичковых уровнях 600-1100.
 */
export const RATING_ANCHORS: RatingAnchor[] = [
  { fide: 2900, internal: 2980, title: "Beyond Legend",   badge: "💠", desc: "Теоретический потолок — за пределами текущей элиты, перфектная игра" },
  { fide: 2830, internal: 2900, title: "World Champion",  badge: "👑", desc: "Мировая элита — точность 95%+, глубокая теория, идеальный эндшпиль" },
  { fide: 2750, internal: 2830, title: "Elite GM",         badge: "♚", desc: "Топ-20 мира — почти безошибочная игра во всех фазах" },
  { fide: 2700, internal: 2750, title: "Super-GM",         badge: "♛", desc: "Топ-100 мира — стабильная точность 90%+, безошибочная тактика" },
  { fide: 2650, internal: 2680, title: "Strong GM",        badge: "♕", desc: "Сильный гроссмейстер — точность 88%+, владение нюансами" },
  { fide: 2600, internal: 2620, title: "Senior GM",        badge: "♖", desc: "Опытный гроссмейстер — стабильная игра против равных" },
  { fide: 2550, internal: 2570, title: "GM",               badge: "♔", desc: "Гроссмейстер — точность 87%+, владение всеми фазами" },
  { fide: 2500, internal: 2520, title: "Fresh GM",         badge: "♚", desc: "Свежий гроссмейстер — норму выполнил, ещё растёт" },
  { fide: 2480, internal: 2500, title: "GM-Norm",          badge: "✦", desc: "На пути к гроссмейстерству — стабильная мастерская игра" },
  { fide: 2450, internal: 2460, title: "Strong IM",        badge: "★", desc: "Сильный международный мастер — близко к GM" },
  { fide: 2400, internal: 2400, title: "IM",               badge: "♖", desc: "Международный мастер — сильная тактика, единичные неточности" },
  { fide: 2370, internal: 2360, title: "IM-Norm",          badge: "♗", desc: "На пути к IM — мастерская позиционная игра" },
  { fide: 2330, internal: 2310, title: "Strong FM",        badge: "♘", desc: "Сильный ФИДЕ мастер — стабильно бьёт CM" },
  { fide: 2300, internal: 2280, title: "FM",               badge: "♗", desc: "ФИДЕ мастер — крепкая база, видит комбинации" },
  { fide: 2270, internal: 2240, title: "FM-Norm",          badge: "▣", desc: "Близко к FM-норме — серьёзная клубная игра" },
  { fide: 2230, internal: 2200, title: "Strong CM",        badge: "▤", desc: "Сильный кандидат в мастера — глубокая дебютная подготовка" },
  { fide: 2180, internal: 2160, title: "CM+",              badge: "▥", desc: "Уверенный кандидат — тактика и эндшпиль на хорошем уровне" },
  { fide: 2120, internal: 2100, title: "CM",               badge: "♘", desc: "Кандидат в мастера — теория дебюта, минимум блундеров" },
  { fide: 2100, internal: 2080, title: "Candidate Master", badge: "♘", desc: "Опытный клубный — теория дебюта, минимум блундеров" },
  { fide: 2050, internal: 2030, title: "Strong Expert",    badge: "✪", desc: "Сильный эксперт — тактически опасен, считает глубоко" },
  { fide: 2000, internal: 1980, title: "Expert",           badge: "★", desc: "Эксперт — стабильная игра, тактические мотивы быстро" },
  { fide: 1950, internal: 1930, title: "Expert-Norm",      badge: "✯", desc: "Близко к эксперту — крепкая клубная игра" },
  { fide: 1900, internal: 1880, title: "Class A+",         badge: "▲", desc: "Сильный 1-й разряд — уверенно бьёт середняков" },
  { fide: 1800, internal: 1820, title: "Club Strong",      badge: "▲", desc: "Сильный клубник — знание основных дебютов, редкие грубые ошибки" },
  { fide: 1700, internal: 1720, title: "Class B+",         badge: "◇", desc: "Уверенный 2-й разряд — стабильная позиционная игра" },
  { fide: 1650, internal: 1670, title: "Club Above-Avg",   badge: "◈", desc: "Выше среднего клубника — видит большинство тактик" },
  { fide: 1600, internal: 1640, title: "Club Solid",       badge: "◆", desc: "Уверенный клубник — понимает структуру, видит шахи и развилки" },
  { fide: 1500, internal: 1530, title: "Club Average",     badge: "●", desc: "Средний клубник — играет правилам, иногда ошибается под давлением" },
  { fide: 1400, internal: 1430, title: "Class C",          badge: "◐", desc: "3-й разряд — основы тактики, типовые ошибки в эндшпиле" },
  { fide: 1300, internal: 1340, title: "Improving",        badge: "◐", desc: "Развивающийся — изучает теорию, тренируется на пазлах" },
  { fide: 1200, internal: 1240, title: "Casual",           badge: "○", desc: "Любитель — играет в удовольствие, периодические блундеры" },
  { fide: 1100, internal: 1150, title: "Late Beginner",    badge: "◌", desc: "Поздний новичок — освоил планирование на 2-3 хода" },
  { fide: 1000, internal: 1050, title: "Hobbyist",         badge: "◌", desc: "Хобби-уровень — знает правила, ещё учится планировать" },
  { fide: 800,  internal: 850,  title: "Beginner",         badge: "△", desc: "Новичок — освоил правила, фокус на безопасности фигур" },
  { fide: 700,  internal: 730,  title: "Early Beginner",   badge: "▽", desc: "Ранний новичок — путает ходы фигур реже, но ещё бывает" },
  { fide: 600,  internal: 650,  title: "Just Started",     badge: "·", desc: "Только начал — первые партии, каждая — урок" },
];

/**
 * Конвертирует наш internal rating → FIDE-equivalent оценку.
 * Использует линейную интерполяцию между ближайшими якорями.
 */
export function internalToFide(internal: number): number {
  // Clamp
  const top = RATING_ANCHORS[0];
  const bottom = RATING_ANCHORS[RATING_ANCHORS.length - 1];
  if (internal >= top.internal) return top.fide;
  if (internal <= bottom.internal) return bottom.fide;

  // Find bracket
  for (let i = 0; i < RATING_ANCHORS.length - 1; i++) {
    const hi = RATING_ANCHORS[i];
    const lo = RATING_ANCHORS[i + 1];
    if (internal <= hi.internal && internal >= lo.internal) {
      const ratio = (internal - lo.internal) / (hi.internal - lo.internal);
      return Math.round(lo.fide + ratio * (hi.fide - lo.fide));
    }
  }
  return internal;
}

/**
 * Находит ближайший anchor по internal rating — для отображения title/badge.
 */
export function nearestAnchor(internal: number): RatingAnchor {
  let best = RATING_ANCHORS[RATING_ANCHORS.length - 1];
  let bestDiff = Infinity;
  for (const a of RATING_ANCHORS) {
    const diff = Math.abs(internal - a.internal);
    if (diff < bestDiff) { bestDiff = diff; best = a; }
  }
  return best;
}

/**
 * Confidence interval вокруг FIDE-estimate. Чем меньше партий
 * сыграно, тем шире интервал. После 100+ партий стабилизируется на ±50.
 */
export function fideConfidenceInterval(internal: number, gamesPlayed: number): { fide: number; low: number; high: number; samples: number } {
  const fide = internalToFide(internal);
  // Стандартное отклонение: 200 при 0 партий → 50 при 100 партий (asymptote)
  const stddev = Math.max(50, 200 - Math.min(150, gamesPlayed * 1.5));
  return {
    fide,
    low: Math.round(fide - stddev),
    high: Math.round(fide + stddev),
    samples: gamesPlayed,
  };
}

/* ────────────────────────────────────────────────────────────────────
 *  CPI Metrics regression — weighted formula
 * ──────────────────────────────────────────────────────────────────── */

/**
 * Chess Performance Indicators — структурированный набор метрик игрока.
 * Используется для regression-оценки FIDE-equivalent без чистой зависимости
 * от internal rating. Это позволяет видеть "что меня тормозит" и таргетировать
 * тренировки.
 *
 * Все доли — нормализованы [0..1] за исключением avgMoveTime (секунды).
 */
export type CPIMetrics = {
  /** Точность игры в %, 0..100. GM ~92%, IM ~88%, клубник ~75%, новичок ~50% */
  accuracyPct: number;
  /** Глубина теории дебюта в полуходах (plies), 0..20 типично; GM знают 15+ */
  openingTheoryDepth: number;
  /** Доля найденной тактики, 0..1. 1.0 = все комбинации найдены */
  tacticalEfficiency: number;
  /** Сила эндшпиля, 0..1. 1.0 = безошибочная конверсия выигранных позиций */
  endgameStrength: number;
  /** Доля грубых ошибок, 0..1. 0 = без блундеров, 0.3+ = частые блундеры */
  blunderRate: number;
  /** Средне время на ход в секундах. Сладкое пятно ~30 сек */
  avgMoveTime: number;
  /** Кол-во партий в выборке (для confidence interval) */
  gamesPlayed: number;
};

/**
 * Breakdown факторов — для UI отображения "что куда внесло"
 */
export type FideFactorBreakdown = {
  /** Кодовое имя фактора (i18n key) */
  key: string;
  /** Человеческое имя на русском */
  label: string;
  /** Текущее значение метрики */
  value: number;
  /** Единица измерения (для display) */
  unit: string;
  /** ELO-вклад этого фактора (может быть отрицательным) */
  deltaElo: number;
  /** "Хорошо" значение — где этот фактор уже не съедает ELO */
  target: number;
  /** Цвет статуса для UI: 'good' | 'mid' | 'bad' */
  status: "good" | "mid" | "bad";
};

export type FideEstimateResult = {
  /** Итоговый FIDE-equivalent estimate */
  fide: number;
  /** Нижняя граница confidence interval */
  low: number;
  /** Верхняя граница confidence interval */
  high: number;
  /** Кол-во партий (для прозрачности) */
  samples: number;
  /** Разбивка по факторам — для visual breakdown */
  factors: FideFactorBreakdown[];
};

/**
 * Базовый ELO в формуле — точка отсчёта для среднего любителя
 */
const BASE_ELO = 1200;

/**
 * Веса в формуле — настроены по эмпирическим данным.
 * Когда наберём калибровочный датасет, fit'нем least-squares.
 */
const WEIGHT_ACCURACY = 35;      // ELO per % accuracy above baseline 60%
const ACCURACY_BASELINE = 60;
const WEIGHT_OPENING_DEPTH = 30; // ELO per ply of theory known
const WEIGHT_TACTICAL = 250;     // ELO at perfect tactical efficiency
const WEIGHT_ENDGAME = 200;      // ELO at perfect endgame
const WEIGHT_BLUNDER = -500;     // ELO penalty at 100% blunder rate
const WEIGHT_TIME = -2;          // ELO penalty per second deviation from optimal
const OPTIMAL_MOVE_TIME = 30;    // sec

/**
 * Главная regression-функция: CPI metrics → FIDE estimate.
 * Возвращает не только число, но и breakdown по факторам, чтобы UI
 * мог показать "что куда внесло" + slider explorer мог симулировать
 * "что если accuracy +5%".
 */
export function estimateFideFromCPI(metrics: CPIMetrics): FideEstimateResult {
  // 1. Accuracy contribution
  const accDelta = (metrics.accuracyPct - ACCURACY_BASELINE) * WEIGHT_ACCURACY;
  // 2. Opening theory depth
  const openingDelta = Math.min(10, metrics.openingTheoryDepth) * WEIGHT_OPENING_DEPTH;
  // 3. Tactical efficiency
  const tacticalDelta = Math.max(0, Math.min(1, metrics.tacticalEfficiency)) * WEIGHT_TACTICAL;
  // 4. Endgame strength
  const endgameDelta = Math.max(0, Math.min(1, metrics.endgameStrength)) * WEIGHT_ENDGAME;
  // 5. Blunder penalty
  const blunderDelta = Math.max(0, Math.min(1, metrics.blunderRate)) * WEIGHT_BLUNDER;
  // 6. Time penalty — small, symmetric around 30s
  const timeDelta = -Math.abs(metrics.avgMoveTime - OPTIMAL_MOVE_TIME) * Math.abs(WEIGHT_TIME);

  const rawFide = BASE_ELO + accDelta + openingDelta + tacticalDelta + endgameDelta + blunderDelta + timeDelta;
  // Clamp 400..3000 (sanity bounds)
  const fide = Math.max(400, Math.min(3000, Math.round(rawFide)));

  // Confidence interval — тот же closure что в fideConfidenceInterval
  const stddev = Math.max(50, 200 - Math.min(150, metrics.gamesPlayed * 1.5));

  // Status helper
  const status = (val: number, mid: number, good: number, inverted = false): "good" | "mid" | "bad" => {
    if (inverted) {
      if (val <= good) return "good";
      if (val <= mid) return "mid";
      return "bad";
    }
    if (val >= good) return "good";
    if (val >= mid) return "mid";
    return "bad";
  };

  const factors: FideFactorBreakdown[] = [
    {
      key: "accuracy",
      label: "Точность игры",
      value: metrics.accuracyPct,
      unit: "%",
      deltaElo: Math.round(accDelta),
      target: 85,
      status: status(metrics.accuracyPct, 70, 85),
    },
    {
      key: "openingDepth",
      label: "Глубина теории дебюта",
      value: metrics.openingTheoryDepth,
      unit: "ply",
      deltaElo: Math.round(openingDelta),
      target: 8,
      status: status(metrics.openingTheoryDepth, 4, 8),
    },
    {
      key: "tactical",
      label: "Тактическая эффективность",
      value: Math.round(metrics.tacticalEfficiency * 100),
      unit: "%",
      deltaElo: Math.round(tacticalDelta),
      target: 80,
      status: status(metrics.tacticalEfficiency, 0.5, 0.8),
    },
    {
      key: "endgame",
      label: "Сила эндшпиля",
      value: Math.round(metrics.endgameStrength * 100),
      unit: "%",
      deltaElo: Math.round(endgameDelta),
      target: 75,
      status: status(metrics.endgameStrength, 0.5, 0.75),
    },
    {
      key: "blunders",
      label: "Грубые ошибки",
      value: Math.round(metrics.blunderRate * 100),
      unit: "%",
      deltaElo: Math.round(blunderDelta),
      target: 5,
      status: status(metrics.blunderRate, 0.15, 0.05, true),
    },
    {
      key: "timing",
      label: "Тайминг хода",
      value: Math.round(metrics.avgMoveTime),
      unit: "с",
      deltaElo: Math.round(timeDelta),
      target: 30,
      status: Math.abs(metrics.avgMoveTime - OPTIMAL_MOVE_TIME) < 10 ? "good" : Math.abs(metrics.avgMoveTime - OPTIMAL_MOVE_TIME) < 25 ? "mid" : "bad",
    },
  ];

  return {
    fide,
    low: Math.max(400, Math.round(fide - stddev)),
    high: Math.min(3000, Math.round(fide + stddev)),
    samples: metrics.gamesPlayed,
    factors,
  };
}

/* ────────────────────────────────────────────────────────────────────
 *  Derive CPI Metrics from saved games (pure)
 * ──────────────────────────────────────────────────────────────────── */

/**
 * Минимальная structural-typing совместимость с SavedGame из page.tsx /
 * insights.ts / PlayerStatsDashboard.tsx — берём только нужные поля.
 */
export type SavedGameForCPI = {
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
  /** Если впоследствии добавим engine eval — будем использовать */
  analysis?: Array<{ ply: number; quality?: "best" | "good" | "ok" | "inaccuracy" | "mistake" | "blunder" }>;
};

/**
 * Pure derive из массива партий → CPI metrics.
 *
 * Когда analysis[] заполнен (post-game Stockfish eval), используем его.
 * Когда нет — fallback на эвристики по result / moves.length / aiLevel.
 *
 * Это позволяет работать на legacy партиях (без analysis) и улучшать
 * качество по мере накопления свежих партий с engine review.
 */
export function calibrateFromGames(games: SavedGameForCPI[]): CPIMetrics {
  if (!games || games.length === 0) {
    // Sane defaults — средний клубник
    return {
      accuracyPct: 65,
      openingTheoryDepth: 4,
      tacticalEfficiency: 0.45,
      endgameStrength: 0.5,
      blunderRate: 0.2,
      avgMoveTime: 30,
      gamesPlayed: 0,
    };
  }

  let totalMoves = 0;
  let blunderMoves = 0;
  let mistakeMoves = 0;
  let inaccuracyMoves = 0;
  let bestOrGoodMoves = 0;
  let analyzedPlies = 0;

  let openings = new Set<string>();
  let totalOpeningPlies = 0;
  let openingSamples = 0;

  let wins = 0;
  let losses = 0;
  let draws = 0;

  let endgameWins = 0;
  let endgameLosses = 0;

  // Aggregate
  for (const g of games) {
    totalMoves += g.moves.length;

    // Opening: если есть строка `opening`, считаем что игрок знает 6-12 plies
    // (типичная глубина MainLine). Если нет — 2-4 plies (general principles)
    if (g.opening && g.opening.trim().length > 0) {
      openings.add(g.opening);
      // Heuristic: длинное название = глубокий вариант
      const namedDepth = Math.min(12, 4 + Math.floor(g.opening.length / 8));
      totalOpeningPlies += namedDepth;
      openingSamples++;
    } else {
      totalOpeningPlies += 2;
      openingSamples++;
    }

    // Analysis-based blunder/quality stats
    if (g.analysis && g.analysis.length > 0) {
      for (const a of g.analysis) {
        analyzedPlies++;
        if (a.quality === "blunder") blunderMoves++;
        else if (a.quality === "mistake") mistakeMoves++;
        else if (a.quality === "inaccuracy") inaccuracyMoves++;
        else if (a.quality === "best" || a.quality === "good") bestOrGoodMoves++;
      }
    }

    // Result tally
    const r = (g.result || "").toLowerCase();
    if (r.includes("you win") || r.includes("ai timed out") || r.includes("ai resigned")) {
      wins++;
      // Long games that we won → endgame strength
      if (g.moves.length > 60) endgameWins++;
    } else if (r.includes("ai wins") || r.includes("you resigned") || r.includes("time out")) {
      losses++;
      if (g.moves.length > 60) endgameLosses++;
    } else if (r.includes("draw") || r.includes("stalemate") || r.includes("repetition") || r.includes("50-move") || r.includes("insufficient")) {
      draws++;
    }
  }

  // ---- Derive metrics ----

  // 1. accuracyPct
  let accuracyPct: number;
  if (analyzedPlies > 30) {
    // Real analysis — accuracy = (best + good) / total, scaled to 0..100
    accuracyPct = (bestOrGoodMoves / analyzedPlies) * 100;
  } else {
    // Heuristic: derive from win rate against AI level
    const winRate = wins / Math.max(1, wins + losses + draws);
    // Win rate 0.5 → 75% accuracy baseline, ±25 from extremes
    accuracyPct = 50 + winRate * 40;
  }
  accuracyPct = Math.max(20, Math.min(99, accuracyPct));

  // 2. openingTheoryDepth
  const openingTheoryDepth = openingSamples > 0
    ? totalOpeningPlies / openingSamples
    : 3;

  // 3. tacticalEfficiency — доля найденной тактики
  // Heuristic: 1 - (mistake + blunder) / analyzed; fallback по win rate
  let tacticalEfficiency: number;
  if (analyzedPlies > 30) {
    tacticalEfficiency = Math.max(0, 1 - ((mistakeMoves + blunderMoves) / analyzedPlies) * 3);
  } else {
    const winRate = wins / Math.max(1, wins + losses + draws);
    tacticalEfficiency = 0.3 + winRate * 0.5;
  }
  tacticalEfficiency = Math.max(0, Math.min(1, tacticalEfficiency));

  // 4. endgameStrength
  let endgameStrength: number;
  const totalEndgames = endgameWins + endgameLosses;
  if (totalEndgames >= 3) {
    endgameStrength = endgameWins / totalEndgames;
  } else {
    // Fallback: usu draws показывают эндшпильное умение
    const drawRate = draws / Math.max(1, wins + losses + draws);
    endgameStrength = 0.4 + drawRate * 0.4;
  }
  endgameStrength = Math.max(0, Math.min(1, endgameStrength));

  // 5. blunderRate
  let blunderRate: number;
  if (analyzedPlies > 30) {
    blunderRate = blunderMoves / analyzedPlies;
  } else {
    // Heuristic: короткие проигранные партии → много блундеров
    const shortLosses = games.filter(g => {
      const r = (g.result || "").toLowerCase();
      const isLoss = r.includes("ai wins") || r.includes("you resigned");
      return isLoss && g.moves.length < 40;
    }).length;
    blunderRate = Math.min(0.4, shortLosses / Math.max(1, games.length) + 0.05);
  }
  blunderRate = Math.max(0, Math.min(1, blunderRate));

  // 6. avgMoveTime — нет точного измерения; по TC категории
  // Bullet ~3s, Blitz ~10s, Rapid ~30s, Classical ~120s
  let totalTime = 0;
  let timeSamples = 0;
  for (const g of games) {
    const cat = g.category || "Rapid";
    if (cat === "Bullet") totalTime += 3;
    else if (cat === "Blitz") totalTime += 10;
    else if (cat === "Rapid") totalTime += 30;
    else if (cat === "Classical") totalTime += 120;
    else totalTime += 30;
    timeSamples++;
  }
  const avgMoveTime = timeSamples > 0 ? totalTime / timeSamples : 30;

  return {
    accuracyPct,
    openingTheoryDepth,
    tacticalEfficiency,
    endgameStrength,
    blunderRate,
    avgMoveTime,
    gamesPlayed: games.length,
  };
}

/**
 * Удобный one-shot: партии → FIDE estimate с factors.
 */
export function estimateFideFromGames(games: SavedGameForCPI[]): FideEstimateResult {
  const metrics = calibrateFromGames(games);
  return estimateFideFromCPI(metrics);
}

const FIDE_ESTIMATE_KEY = "cc_fide_estimate_v1";

/** Persist calibrated FIDE equivalent so matchmaking can use it. */
export function saveEstimateToStorage(fide: number): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(FIDE_ESTIMATE_KEY, String(Math.round(fide))); } catch {}
}

/** Returns saved FIDE estimate or null if not yet calibrated. */
export function loadEstimateFromStorage(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const v = Number(window.localStorage.getItem(FIDE_ESTIMATE_KEY));
    if (!Number.isFinite(v) || v < 100 || v > 3200) return null;
    return Math.round(v);
  } catch { return null; }
}
