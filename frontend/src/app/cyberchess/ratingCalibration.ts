/**
 * AEVION CyberChess — FIDE rating calibration anchors.
 *
 * Привязка нашей внутренней рейтинговой шкалы к FIDE для понятного
 * "ваш стиль = FIDE ~X". Не Lichess import — мы оцениваем игрока
 * через собственные CPI метрики (accuracy, opening theory depth,
 * tactical efficiency, endgame strength, blunder rate) и mapping'ом
 * через эти якоря даём FIDE-equivalent оценку.
 *
 * Якоря — hardcoded для MVP. Когда наберём калибровочный датасет
 * (партии GM с известным FIDE через PGN dumps Lichess Open DB +
 * собственный CPI), сделаем least-squares fit α/β/γ/δ/ε коэффициентов.
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
 * Якоря — упорядочены по убыванию силы. Internal слегка отличается
 * от FIDE потому что наш AI Master (уровень 5) калиброван на ~2400 ELO
 * Stockfish, а Stockfish d18 на 2400 примерно соответствует FIDE 2400-2500
 * IM-уровню.
 */
export const RATING_ANCHORS: RatingAnchor[] = [
  { fide: 2830, internal: 2900, title: "World Champion", badge: "👑", desc: "Мировая элита — точность 95%+, глубокая теория, идеальный эндшпиль" },
  { fide: 2700, internal: 2750, title: "Super-GM", badge: "♛", desc: "Топ-100 мира — стабильная точность 90%+, безошибочная тактика" },
  { fide: 2500, internal: 2520, title: "GM", badge: "♚", desc: "Гроссмейстер — точность 85%+, владение всеми фазами" },
  { fide: 2400, internal: 2400, title: "IM", badge: "♖", desc: "Международный мастер — сильная тактика, единичные неточности" },
  { fide: 2300, internal: 2280, title: "FM", badge: "♗", desc: "ФИДЕ мастер — крепкая база, видит комбинации" },
  { fide: 2100, internal: 2080, title: "Candidate Master", badge: "♘", desc: "Опытный клубный — теория дебюта, минимум блундеров" },
  { fide: 2000, internal: 1980, title: "Expert", badge: "★", desc: "Эксперт — стабильная игра, тактические мотивы быстро" },
  { fide: 1800, internal: 1820, title: "Club Strong", badge: "▲", desc: "Сильный клубник — знание основных дебютов, редкие грубые ошибки" },
  { fide: 1600, internal: 1640, title: "Club Solid", badge: "◆", desc: "Уверенный клубник — понимает структуру, видит шахи и развилки" },
  { fide: 1500, internal: 1530, title: "Club Average", badge: "●", desc: "Средний клубник — играет правилам, иногда ошибается под давлением" },
  { fide: 1300, internal: 1340, title: "Improving", badge: "◐", desc: "Развивающийся — изучает теорию, тренируется на пазлах" },
  { fide: 1200, internal: 1240, title: "Casual", badge: "○", desc: "Любитель — играет в удовольствие, периодические блундеры" },
  { fide: 1000, internal: 1050, title: "Hobbyist", badge: "◌", desc: "Хобби-уровень — знает правила, ещё учится планировать" },
  { fide: 800,  internal: 850,  title: "Beginner", badge: "△", desc: "Новичок — освоил правила, фокус на безопасности фигур" },
  { fide: 600,  internal: 650,  title: "Just Started", badge: "·", desc: "Только начал — первые партии, каждая — урок" },
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
