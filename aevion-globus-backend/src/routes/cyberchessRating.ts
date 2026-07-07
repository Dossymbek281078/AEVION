/**
 * cyberchessRating.ts — Glicko-2 рейтинговая система для онлайн-матчей CyberChess.
 *
 * Glicko-2 (Mark Glickman, http://www.glicko.net/glicko/glicko2.pdf) — то же
 * семейство, что использует lichess. В отличие от Elo, учитывает НЕОПРЕДЕЛЁННОСТЬ
 * рейтинга (RD — rating deviation) и волатильность (σ), поэтому новые/редко
 * играющие игроки двигаются быстрее, а стабильные — медленнее и точнее.
 *
 * Чистые функции, без сайд-эффектов и зависимостей — легко тестировать и
 * невозможно уронить live-поток матчмейкинга.
 *
 * Единицы: наружу отдаём привычную «rating»-шкалу (≈1500 старт). Внутри Glicko-2
 * работает в собственной шкале (µ, φ), конвертация — glicko2Scale / ratingScale.
 */

/** Публичный рейтинг игрока в шкале Glicko (то, что видит пользователь). */
export interface GlickoState {
  rating: number; // R — привычная шкала, старт 1500
  rd: number; // RD — rating deviation, старт 350 (макс. неопределённость)
  vol: number; // σ — волатильность, старт 0.06
}

export type GameResult = 0 | 0.5 | 1; // поражение / ничья / победа (с точки зрения игрока)

/** Начальное состояние для нового игрока. */
export const DEFAULT_GLICKO: Readonly<GlickoState> = Object.freeze({
  rating: 1500,
  rd: 350,
  vol: 0.06,
});

// Системная константа τ — ограничивает изменение волатильности. lichess ≈ 0.5–0.75.
const TAU = 0.5;
const SCALE = 173.7178; // 400 / ln(10)
const EPSILON = 0.000001;

function glicko2Scale(s: GlickoState): { mu: number; phi: number } {
  return { mu: (s.rating - 1500) / SCALE, phi: s.rd / SCALE };
}

function ratingScale(mu: number, phi: number, vol: number): GlickoState {
  return { rating: mu * SCALE + 1500, rd: phi * SCALE, vol };
}

function g(phi: number): number {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
}

function expectation(mu: number, muJ: number, phiJ: number): number {
  return 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));
}

/**
 * Пересчёт рейтинга одного игрока по результатам матчей за период.
 * Для 1-на-1 матча передаётся один оппонент и один результат.
 *
 * @param player   текущее состояние игрока
 * @param opponents массив состояний оппонентов
 * @param results  результаты против каждого оппонента (0/0.5/1), той же длины
 */
export function updateGlicko(
  player: GlickoState,
  opponents: GlickoState[],
  results: GameResult[],
): GlickoState {
  if (opponents.length === 0 || opponents.length !== results.length) {
    // Нет игр за период → RD растёт (неопределённость увеличивается со временем).
    const { phi } = glicko2Scale(player);
    const phiStar = Math.sqrt(phi * phi + player.vol * player.vol);
    return ratingScale((player.rating - 1500) / SCALE, phiStar, player.vol);
  }

  const { mu, phi } = glicko2Scale(player);

  // Шаг 3: v — оценочная дисперсия по результатам.
  let vInv = 0;
  const gs: number[] = [];
  const es: number[] = [];
  for (const opp of opponents) {
    const { mu: muJ, phi: phiJ } = glicko2Scale(opp);
    const gj = g(phiJ);
    const ej = expectation(mu, muJ, phiJ);
    gs.push(gj);
    es.push(ej);
    vInv += gj * gj * ej * (1 - ej);
  }
  const v = 1 / vInv;

  // Шаг 4: Δ — оценочное улучшение рейтинга.
  let deltaSum = 0;
  for (let i = 0; i < opponents.length; i++) {
    deltaSum += gs[i] * (results[i] - es[i]);
  }
  const delta = v * deltaSum;

  // Шаг 5: новая волатильность σ' (итерационный алгоритм Illinois).
  const a = Math.log(player.vol * player.vol);
  const f = (x: number): number => {
    const ex = Math.exp(x);
    const num = ex * (delta * delta - phi * phi - v - ex);
    const den = 2 * (phi * phi + v + ex) * (phi * phi + v + ex);
    return num / den - (x - a) / (TAU * TAU);
  };

  let A = a;
  let B: number;
  if (delta * delta > phi * phi + v) {
    B = Math.log(delta * delta - phi * phi - v);
  } else {
    let k = 1;
    while (f(a - k * TAU) < 0) k++;
    B = a - k * TAU;
  }
  let fA = f(A);
  let fB = f(B);
  let guard = 0;
  while (Math.abs(B - A) > EPSILON && guard++ < 100) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA = fA / 2;
    }
    B = C;
    fB = fC;
  }
  const newVol = Math.exp(A / 2);

  // Шаг 6–7: pre-rating period value φ* и новый φ'.
  const phiStar = Math.sqrt(phi * phi + newVol * newVol);
  const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);

  // Шаг 8: новый µ'.
  const newMu = mu + newPhi * newPhi * deltaSum;

  const out = ratingScale(newMu, newPhi, newVol);
  // RD не опускаем ниже 30 (как lichess) — сохраняем немного неопределённости.
  out.rd = Math.max(30, Math.min(350, out.rd));
  out.rating = Math.round(out.rating * 100) / 100;
  return out;
}

/**
 * Удобная обёртка для одиночного матча: возвращает новые состояния ОБОИХ игроков.
 * result — с точки зрения игрока A (1 = A выиграл, 0 = A проиграл, 0.5 = ничья).
 */
export function rateMatch(
  a: GlickoState,
  b: GlickoState,
  resultForA: GameResult,
): { a: GlickoState; b: GlickoState } {
  const resultForB = (1 - resultForA) as GameResult;
  return {
    a: updateGlicko(a, [b], [resultForA]),
    b: updateGlicko(b, [a], [resultForB]),
  };
}

/** «Провизорный» ли рейтинг (высокий RD) — показывать со знаком «?», как lichess. */
export function isProvisional(rd: number): boolean {
  return rd > 110;
}
