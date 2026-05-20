/**
 * AI Personalities — catalog of named playing-style profiles for CyberChess.
 *
 * Каждая personality описывает «характер» AI: что любит, как играет,
 * какие открытия предпочитает. Helpers ниже позволяют выбрать ход из
 * списка кандидатов от Stockfish с учётом этих весов.
 *
 * ВАЖНО: реальная привязка к move-execution делается в page.tsx /
 * существующем ghost-AI loop — этот модуль только экспортирует данные
 * и helper-функции. Никаких side-effects на import.
 */

export type PersonalityStyle = {
  /** 0..1 — атакующий vs позиционный. 1 = sacrifice-everything-for-king. */
  aggressiveness: number;
  /** 0..1 — любит тактические комбинации, форсированные варианты. */
  tacticalBias: number;
  /** 0..1 — любит pawn structure, slow squeeze, prophylaxis. */
  positionalBias: number;
  /** 0..1 — техника эндшпиля, конвертация преимущества. */
  endgameStrength: number;
  /** 0..1 — частота жертв материала ради инициативы. */
  sacrificeRate: number;
  /** 0..1 — медленный (думает) vs быстрый (интуиция). */
  timeUsage: number;
  /** ECO коды или имена openings которые personality предпочитает. */
  preferredOpenings: string[];
};

export type AiPersonality = {
  id: string;
  name: string;
  realName?: string;
  emoji: string;
  description: string;
  /** Approx playing-strength range. */
  eloRange: [number, number];
  style: PersonalityStyle;
  /** Короткие особенности — отображаются в picker'е bullet'ами. */
  quirks: string[];
};

/* ------------------------------------------------------------------ */
/* Catalog                                                             */
/* ------------------------------------------------------------------ */

export const AI_PERSONALITIES: AiPersonality[] = [
  {
    id: "magnus",
    name: "Magnus-style",
    realName: "Magnus Carlsen",
    emoji: "👑",
    description:
      "Позиционный универсал. Душит соперника в эндшпиле и редко проигрывает из равной позиции.",
    eloRange: [2700, 2900],
    style: {
      aggressiveness: 0.45,
      tacticalBias: 0.55,
      positionalBias: 0.92,
      endgameStrength: 0.98,
      sacrificeRate: 0.18,
      timeUsage: 0.55,
      preferredOpenings: ["English (A10-A39)", "Catalan (E00-E09)", "Italian (C50)"],
    },
    quirks: [
      "Любит выжимать ничейные эндшпили",
      "Часто переходит в endgame через ранний размен ферзей",
      "Редко жертвует, но идеально считает технику",
    ],
  },
  {
    id: "hikaru",
    name: "Hikaru-style",
    realName: "Hikaru Nakamura",
    emoji: "⚡",
    description:
      "Агрессивный тактик, мастер блица. Считает варианты на скорости и провоцирует осложнения.",
    eloRange: [2650, 2850],
    style: {
      aggressiveness: 0.82,
      tacticalBias: 0.95,
      positionalBias: 0.5,
      endgameStrength: 0.75,
      sacrificeRate: 0.5,
      timeUsage: 0.18,
      preferredOpenings: ["Italian (C50-C54)", "King's Indian (E60-E99)", "Sicilian Najdorf (B90)"],
    },
    quirks: [
      "Резко ускоряется в цейтноте",
      "Любит h-pawn-pushes в королевской атаке",
      "Часто провоцирует противника на ошибку в осложнениях",
    ],
  },
  {
    id: "tal",
    name: "Tal-style",
    realName: "Mikhail Tal",
    emoji: "🔥",
    description:
      "Романтическая школа. Жертвует фигуры за инициативу и матовую атаку. Слепые жертвы — норма.",
    eloRange: [2500, 2750],
    style: {
      aggressiveness: 0.97,
      tacticalBias: 0.98,
      positionalBias: 0.3,
      endgameStrength: 0.65,
      sacrificeRate: 0.85,
      timeUsage: 0.4,
      preferredOpenings: ["King's Gambit (C30-C39)", "Sicilian (B20-B99)", "Modern Benoni (A60-A79)"],
    },
    quirks: [
      "Жертвует фигуру за атаку даже на нечётком расчёте",
      "Идёт в осложнения с открытым королём",
      "Принципиально не отказывается от жертвы",
    ],
  },
  {
    id: "karpov",
    name: "Karpov-style",
    realName: "Anatoly Karpov",
    emoji: "🕸",
    description:
      "Ультра-позиционная игра. Душит соперника медленно, лишая контригры. Профилактика всему голова.",
    eloRange: [2600, 2780],
    style: {
      aggressiveness: 0.25,
      tacticalBias: 0.4,
      positionalBias: 0.98,
      endgameStrength: 0.92,
      sacrificeRate: 0.1,
      timeUsage: 0.7,
      preferredOpenings: ["Caro-Kann (B10-B19)", "Ruy Lopez (C60-C99)", "Queen's Gambit Declined (D30-D69)"],
    },
    quirks: [
      "Никогда не идёт на осложнения без необходимости",
      "Лишает соперника любой контригры",
      "Профилактика → давление → выигрыш в эндшпиле",
    ],
  },
  {
    id: "kasparov",
    name: "Kasparov-style",
    realName: "Garry Kasparov",
    emoji: "🦁",
    description:
      "Универсальный агрессор. Глубокая подготовка + матовый натиск. Хочет инициативу в любой позиции.",
    eloRange: [2700, 2900],
    style: {
      aggressiveness: 0.88,
      tacticalBias: 0.9,
      positionalBias: 0.78,
      endgameStrength: 0.85,
      sacrificeRate: 0.55,
      timeUsage: 0.5,
      preferredOpenings: ["Sicilian Najdorf (B90-B99)", "King's Indian (E60-E99)", "Grünfeld (D80-D99)"],
    },
    quirks: [
      "Готовится дома на 25 ходов вперёд",
      "Любит pawn-storm на королевском фланге",
      "Жертвует материал за инициативу, если позиция требует",
    ],
  },
  {
    id: "capablanca",
    name: "Capablanca-style",
    realName: "José Raúl Capablanca",
    emoji: "♟",
    description:
      "Машина простоты. Чистый эндшпиль, минимум вариантов, максимум техники. Никаких лишних движений.",
    eloRange: [2550, 2750],
    style: {
      aggressiveness: 0.3,
      tacticalBias: 0.45,
      positionalBias: 0.95,
      endgameStrength: 1.0,
      sacrificeRate: 0.08,
      timeUsage: 0.35,
      preferredOpenings: ["Queen's Gambit (D06-D69)", "Ruy Lopez Exchange (C68)", "Slav (D10-D19)"],
    },
    quirks: [
      "Стремится к простой позиции с лёгким преимуществом",
      "Идеальная техника rook endgames",
      "Не тратит время на ненужный расчёт — играет «по позиции»",
    ],
  },
  {
    id: "fischer",
    name: "Fischer-style",
    realName: "Bobby Fischer",
    emoji: "⚔",
    description:
      "Энергичная игра, глубокая дебютная подготовка. Любит ясные планы и exchange-варианты.",
    eloRange: [2650, 2850],
    style: {
      aggressiveness: 0.7,
      tacticalBias: 0.78,
      positionalBias: 0.82,
      endgameStrength: 0.95,
      sacrificeRate: 0.35,
      timeUsage: 0.45,
      preferredOpenings: ["Ruy Lopez Exchange (C68)", "Najdorf (B90-B99)", "King's Indian Attack (A07)"],
    },
    quirks: [
      "Прибит к 1.e4 как символу веры",
      "Любит exchange variation в Испанской",
      "Доводит малейшее преимущество до победы",
    ],
  },
  {
    id: "aronian",
    name: "Aronian-style",
    realName: "Levon Aronian",
    emoji: "✨",
    description:
      "Креатив, неожиданные ходы, sharp openings. Любит оригинальные планы, не боится риска.",
    eloRange: [2700, 2820],
    style: {
      aggressiveness: 0.72,
      tacticalBias: 0.85,
      positionalBias: 0.7,
      endgameStrength: 0.8,
      sacrificeRate: 0.45,
      timeUsage: 0.5,
      preferredOpenings: ["Marshall Attack (C89)", "Anti-Marshall", "Catalan (E00-E09)"],
    },
    quirks: [
      "Любит парадоксальные ходы конём в дебюте",
      "Идёт в редкие варианты, чтобы выйти из теории",
      "Жертвует пешки за позиционную компенсацию",
    ],
  },
  {
    id: "caruana",
    name: "Caruana-style",
    realName: "Fabiano Caruana",
    emoji: "📚",
    description:
      "Глубокая теория, точные mainline-варианты. Корректность во всём, без авантюр.",
    eloRange: [2700, 2850],
    style: {
      aggressiveness: 0.55,
      tacticalBias: 0.75,
      positionalBias: 0.88,
      endgameStrength: 0.88,
      sacrificeRate: 0.25,
      timeUsage: 0.65,
      preferredOpenings: ["Petroff (C42-C43)", "Najdorf (B90-B99)", "Berlin (C65-C67)"],
    },
    quirks: [
      "Помнит mainline на 30 ходов",
      "Не отступает от теории, пока теория не отступит от него",
      "Долго думает в ключевых моментах, экономит время в типовых",
    ],
  },
  {
    id: "nepo",
    name: "Nepo-style",
    realName: "Ian Nepomniachtchi",
    emoji: "💨",
    description:
      "Скорость и интуиция. Играет быстро, тактически опасен, но иногда зевает в цейтноте.",
    eloRange: [2680, 2800],
    style: {
      aggressiveness: 0.78,
      tacticalBias: 0.92,
      positionalBias: 0.6,
      endgameStrength: 0.7,
      sacrificeRate: 0.4,
      timeUsage: 0.15,
      preferredOpenings: ["Sicilian (B20-B99)", "Grünfeld (D80-D99)", "Petroff (C42-C43)"],
    },
    quirks: [
      "Играет быстрее всех соперников по часам",
      "Доверяет интуиции в острых позициях",
      "Иногда зевает в простых эндшпилях",
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Lookup                                                              */
/* ------------------------------------------------------------------ */

export const DEFAULT_PERSONALITY_ID = "standard";

export function findPersonality(id: string | null | undefined): AiPersonality | null {
  if (!id) return null;
  return AI_PERSONALITIES.find(p => p.id === id) ?? null;
}

/* ------------------------------------------------------------------ */
/* Move selection                                                      */
/* ------------------------------------------------------------------ */

/**
 * Минимальная сигнатура хода-кандидата. Реальный код, скорее всего,
 * использует более богатый объект (chess.js Move) — parent code
 * передаёт его прозрачно, мы только читаем поля из MoveSignals.
 */
export type CandidateMove = {
  /** UCI или SAN — нам всё равно, мы только возвращаем обратно. */
  uci?: string;
  san?: string;
  /** Сигналы хода для weighting. Все поля optional — defaults = 0. */
  signals?: MoveSignals;
};

export type MoveSignals = {
  /** centipawns Stockfish eval (после хода, для side-to-move). */
  cp?: number;
  /** этот ход — взятие фигуры. */
  isCapture?: boolean;
  /** этот ход — взятие с разменом ферзей. */
  trades?: boolean;
  /** этот ход — жертва (отдаём больше, чем берём). */
  isSacrifice?: boolean;
  /** этот ход создаёт угрозу мата / атаку на короля. */
  isAttack?: boolean;
  /** ход меняет pawn structure (push, лом). */
  pawnPush?: boolean;
  /** ход — профилактический (защита, повышение безопасности короля). */
  isProphylactic?: boolean;
  /** ход — эндшпильная техника (king activation, rook lift). */
  isEndgameTechnique?: boolean;
  /** ход относится к одному из preferred openings personality. */
  matchesOpening?: boolean;
};

export type PositionContext = {
  /** Фаза игры — opening / middlegame / endgame. */
  phase?: "opening" | "middlegame" | "endgame";
  /** ECO / opening name текущей позиции, если известен. */
  openingId?: string;
  /** Полуход (для определения, на сколько глубоко в дебюте). */
  ply?: number;
};

/**
 * Возвращает скор для одного хода с точки зрения данной personality.
 * Чем выше — тем «более в стиле» этого player'a. Cp eval входит как
 * базовая ценность, остальные сигналы — модификаторы.
 *
 * Экспортируется отдельно для unit-тестов / debug-tooltip'ов.
 */
export function scoreMoveForPersonality(
  personality: AiPersonality,
  move: CandidateMove,
  ctx: PositionContext = {}
): number {
  const s = move.signals ?? {};
  const st = personality.style;

  // Базовая ценность — eval Stockfish. Нормализуем в pawn units (~0.01).
  // Cp положительный = хорошо для играющей стороны.
  const baseEval = (s.cp ?? 0) * 0.01;

  let bonus = 0;

  // Attack / capture / sacrifice — масштабируется aggressiveness и tacticalBias.
  if (s.isAttack) bonus += 0.6 * st.aggressiveness;
  if (s.isCapture) bonus += 0.15 * st.tacticalBias;
  if (s.isSacrifice) {
    // sacrificeRate доминирует, но требует и aggressiveness.
    bonus += 1.2 * st.sacrificeRate * (0.5 + 0.5 * st.aggressiveness);
  }

  // Размен ферзей / trades — позиционные игроки часто упрощают,
  // атакёры избегают.
  if (s.trades) {
    bonus += 0.25 * st.positionalBias;
    bonus -= 0.35 * st.aggressiveness;
  }

  // Pawn-push — структурные ходы любят positional, push-h любят attackers.
  if (s.pawnPush) {
    bonus += 0.2 * st.positionalBias;
    bonus += 0.1 * st.aggressiveness;
  }

  // Прфилактика — Karpov-style любит.
  if (s.isProphylactic) bonus += 0.5 * st.positionalBias;

  // Endgame technique — масштабируется endgameStrength, особенно в endgame phase.
  if (s.isEndgameTechnique) {
    const phaseMult = ctx.phase === "endgame" ? 1.4 : 0.6;
    bonus += 0.5 * st.endgameStrength * phaseMult;
  }

  // Matching opening — небольшой bias в первые ~12 полуходов.
  if (s.matchesOpening && (ctx.ply ?? 0) < 24) {
    bonus += 0.4;
  }

  return baseEval + bonus;
}

/**
 * Сэмплирует один ход из top-N кандидатов по personality.
 *
 * Алгоритм:
 *  1. Считает personality-score для каждого хода.
 *  2. Преобразует в weights через softmax (temperature зависит
 *     от timeUsage — быстрый игрок более «шумный»).
 *  3. Если `random` не передан — детерминированно возвращает
 *     argmax (для тестов / replay-ов).
 *
 * Если массив пуст — возвращает null. Если содержит один элемент —
 * возвращает его без расчётов.
 */
export function selectMoveByPersonality<T extends CandidateMove>(
  personality: AiPersonality,
  candidateMoves: T[],
  ctx: PositionContext = {},
  random?: () => number
): T | null {
  if (!candidateMoves.length) return null;
  if (candidateMoves.length === 1) return candidateMoves[0];

  const scores = candidateMoves.map(m => scoreMoveForPersonality(personality, m, ctx));

  // Temperature: timeUsage низкий → быстрый/интуитивный → высокая T (больше шума).
  // timeUsage высокий → думает → низкая T (выбирает argmax).
  const T = 0.35 + (1 - personality.style.timeUsage) * 0.9; // ~0.35..1.25

  // Detрминистично без RNG → argmax.
  if (!random) {
    let bestIdx = 0;
    for (let i = 1; i < scores.length; i++) {
      if (scores[i] > scores[bestIdx]) bestIdx = i;
    }
    return candidateMoves[bestIdx];
  }

  // Softmax sampling.
  const maxScore = Math.max(...scores);
  const exps = scores.map(s => Math.exp((s - maxScore) / T));
  const sum = exps.reduce((a, b) => a + b, 0);
  const r = random() * sum;
  let acc = 0;
  for (let i = 0; i < candidateMoves.length; i++) {
    acc += exps[i];
    if (r <= acc) return candidateMoves[i];
  }
  return candidateMoves[candidateMoves.length - 1];
}

/* ------------------------------------------------------------------ */
/* Commentary                                                          */
/* ------------------------------------------------------------------ */

/**
 * Один из 3-5 шаблонных комментариев per personality. Возвращает
 * строку — фразу-комментарий после хода. Если `lastMove` пустой —
 * возвращает generic opening line.
 *
 * Для расширения позже: можно перейти к LLM-генерации через
 * QCoreAI, оставив этот fallback на случай оффлайна.
 */
export function personalityComment(
  personality: AiPersonality,
  lastMove?: { san?: string; isCapture?: boolean; isCheck?: boolean; isSacrifice?: boolean }
): string {
  const lib = COMMENT_LIBRARY[personality.id] ?? COMMENT_LIBRARY.standard;
  const mv = lastMove ?? {};

  if (mv.isSacrifice && lib.sacrifice?.length) return pick(lib.sacrifice);
  if (mv.isCheck && lib.check?.length) return pick(lib.check);
  if (mv.isCapture && lib.capture?.length) return pick(lib.capture);
  return pick(lib.generic);
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

type CommentBank = {
  generic: string[];
  capture?: string[];
  check?: string[];
  sacrifice?: string[];
};

const COMMENT_LIBRARY: Record<string, CommentBank> = {
  standard: {
    generic: ["Хороший ход.", "Продолжаем игру.", "Интересная позиция."],
    capture: ["Беру фигуру."],
    check: ["Шах."],
  },
  magnus: {
    generic: [
      "Я не тороплюсь. Время на моей стороне.",
      "Эндшпиль приближается — там я и заберу очко.",
      "Профилактика прежде всего.",
    ],
    capture: ["Размен мне на руку.", "Упрощаю позицию."],
    check: ["Шах. Технический момент."],
    sacrifice: ["Жертва? Не мой стиль, но позиция требует."],
  },
  hikaru: {
    generic: [
      "Быстрее, быстрее.",
      "На часах ещё много времени, успеем подумать.",
      "Атакуем на королевском фланге.",
    ],
    capture: ["Беру! И ещё подумаю над следующим.", "Material is material."],
    check: ["Шах. Не зевни."],
    sacrifice: ["Жертва! Считай-считай, у тебя минута."],
  },
  tal: {
    generic: [
      "Огонь!",
      "Доска должна гореть.",
      "Принципиально не отступаю.",
    ],
    capture: ["Хочешь — бери обратно. Поглядим."],
    check: ["Шах! И это только начало."],
    sacrifice: ["Жертва! Принимай или прячься.", "Фигура за инициативу — отличная сделка."],
  },
  karpov: {
    generic: [
      "Медленно. Точно.",
      "У вас всё меньше планов.",
      "Профилактика — мать победы.",
    ],
    capture: ["Беру. Без эмоций."],
    check: ["Шах. Технический."],
  },
  kasparov: {
    generic: [
      "Инициатива моя.",
      "Я готовился к этому варианту.",
      "Давление по всей доске.",
    ],
    capture: ["Беру. Атака продолжается."],
    check: ["Шах. И это только разминка."],
    sacrifice: ["Жертва за инициативу — основа моей игры."],
  },
  capablanca: {
    generic: [
      "Простота — высшая форма элегантности.",
      "Эндшпиль уже считается.",
      "Точность важнее красоты.",
    ],
    capture: ["Размен. Иду в эндшпиль."],
    check: ["Шах."],
  },
  fischer: {
    generic: [
      "1.e4 — best by test.",
      "Я знаю эту позицию наизусть.",
      "Доведу до победы.",
    ],
    capture: ["Беру. Точная техника."],
    check: ["Шах."],
    sacrifice: ["Жертва — если посчитано, то можно."],
  },
  aronian: {
    generic: [
      "А вот это вы не ожидали?",
      "Творческий подход.",
      "В теории такого нет — будет в моих партиях.",
    ],
    capture: ["Беру с инициативой."],
    sacrifice: ["Жертва пешки за позицию — старая школа."],
  },
  caruana: {
    generic: [
      "По теории — лучший ход.",
      "Я помню эту партию из 2014 года.",
      "Точность во всём.",
    ],
    capture: ["Размен по теории."],
    check: ["Шах. Mainline."],
  },
  nepo: {
    generic: [
      "Чувствую позицию.",
      "Не считаю — играю интуицией.",
      "Быстро. Быстро. Быстро.",
    ],
    capture: ["Беру не глядя."],
    check: ["Шах! Дальше посчитаю."],
    sacrifice: ["Жертва! Кажется, должно работать."],
  },
};

/* ------------------------------------------------------------------ */
/* LocalStorage helpers                                                */
/* ------------------------------------------------------------------ */

export const PERSONALITY_STORAGE_KEY = "cc_ai_personality_v1";

export function loadStoredPersonalityId(): string {
  if (typeof window === "undefined") return DEFAULT_PERSONALITY_ID;
  try {
    const v = window.localStorage.getItem(PERSONALITY_STORAGE_KEY);
    return v && v.length ? v : DEFAULT_PERSONALITY_ID;
  } catch {
    return DEFAULT_PERSONALITY_ID;
  }
}

export function saveStoredPersonalityId(id: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PERSONALITY_STORAGE_KEY, id);
  } catch {
    /* localStorage blocked → silent fail */
  }
}
