/**
 * chessCoachEngine.ts — база знаний шахматного коуча CyberChess.
 *
 * Содержит:
 * - Принципы и методики (Стейниц, Нимцович, Котов)
 * - База дебютов с характеристиками и планами
 * - Типы позиций и соответствующие стратегии
 * - Эндшпильные техники
 * - Тактические мотивы
 * - Функции анализа позиции по типу
 */

import { Chess, type Square } from "chess.js";

// ══════════════════════════════════════════════════
// ПРИНЦИПЫ ИГРЫ (методики)
// ══════════════════════════════════════════════════

export const CHESS_PRINCIPLES = {
  opening: [
    "Контролируй центр (e4, e5, d4, d5) пешками или фигурами",
    "Развивай коней перед слонами",
    "Рокируй в первые 10 ходов — безопасность короля важна",
    "Не ходи одной фигурой дважды без крайней необходимости",
    "Не выводи ферзя слишком рано — его легко прогнать",
    "Соедини ладьи — уберри всё между ними",
    "Каждый ход должен иметь конкретный смысл",
    "Не создавай слабостей без компенсации",
  ],
  middlegame: [
    "Ищи конкретные тактические удары перед стратегическими планами",
    "Помещай коня на сильный пост (защищённая клетка в лагере соперника)",
    "Открывай линии для ладей",
    "Атакуй на том фланге, где у тебя пространственный перевес",
    "Слабая пешка — цель для атаки, держи её под давлением",
    "Выгодный размен: разменивай активные фигуры соперника на пассивные свои",
    "Профилактика: найди идею соперника и нейтрализуй её",
    "Двухслоновое преимущество важно в открытых позициях",
  ],
  endgame: [
    "Активизируй короля — в эндшпиле он сильная фигура",
    "Проходная пешка должна двигаться вперёд",
    "Ладья за проходной (атакуй её сзади), ладья перед проходной (блокируй)",
    "Правило оппозиции в пешечных эндшпилях",
    "Треугольник — техника потери темпа для передачи очереди хода",
    "Ладья на 7-й горизонтали — мощная позиция",
    "Цугцванг: вынуди соперника делать невыгодные ходы",
    "Техника Люсены: реализация с ладьёй и пешкой",
    "Позиция Филидора: защитная техника с ладьёй без пешки",
  ],
};

// ══════════════════════════════════════════════════
// БАЗА ДЕБЮТОВ
// ══════════════════════════════════════════════════

export interface OpeningTheory {
  eco: string;
  name: string;
  moves: string; // PGN notation
  character: string; // тип позиции
  whiteIdea: string;
  blackIdea: string;
  keySquares: string[];
  commonPlans: string[];
  famousGames: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  style: "tactical" | "positional" | "dynamic" | "universal";
}

export const OPENING_THEORY: OpeningTheory[] = [
  {
    eco: "C20", name: "Итальянская партия", moves: "1.e4 e5 2.Nf3 Nc6 3.Bc4",
    character: "Открытая, атакующая",
    whiteIdea: "Давление на f7, атака через d3-d4 или Ng5. Цель — быстро вскрыть игру в центре.",
    blackIdea: "Уравнение через ...Nf6, ...d5 или ...Bc5 (зеркальная игра). Вариант Джуоко-Пьяно — солидная оборона.",
    keySquares: ["f7", "d4", "e5"],
    commonPlans: [
      "Белые: d3-d4 вскрывает центр; Ng5 атакует f7",
      "Чёрные: ...Nf6 защищает e4, ...d5 контратака в центре",
      "Атака Эванса (3.b4!?) — жертва пешки ради инициативы",
    ],
    famousGames: ["Морфи против Паульсена 1857", "Эванс против Мак-Доннела 1838"],
    difficulty: "beginner",
    style: "tactical",
  },
  {
    eco: "C65", name: "Испанская партия (Ruy Lopez)", moves: "1.e4 e5 2.Nf3 Nc6 3.Bb5",
    character: "Стратегическая, с долгосрочным давлением",
    whiteIdea: "Связать коня c6 (защитника e5), подготовить d4. Долгосрочное давление на центр.",
    blackIdea: "Нейтрализовать давление через ...a6 (Вариант Морфи), ...d6 (Защита Стейница), ...Nf6 (Берлинская стена).",
    keySquares: ["c6", "d4", "e5"],
    commonPlans: [
      "Белые: c3+d4 — классический центральный план; атака Маршалла (жертва e5)",
      "Чёрные: Берлинская защита (2...Nf6) — очень солидная, эндшпиль",
      "Маневр Rb1-b2-d2 или Nd2-f1-g3 — типичная перегруппировка белых",
    ],
    famousGames: ["Карпов против Каспарова 1985", "Магнус Карлсен vs Anand 2016"],
    difficulty: "intermediate",
    style: "positional",
  },
  {
    eco: "D30", name: "Ферзевый гамбит", moves: "1.d4 d5 2.c4",
    character: "Стратегическая, борьба за центр",
    whiteIdea: "Давление на d5 — если принят (...dxc4), вернуть пешку и захватить центр. Если отклонён (...e6) — закрытая стратегическая игра.",
    blackIdea: "Ферзевый гамбит принятый (...dxc4) — пешку трудно удержать. Отклонённый (...e6) — надёжная защита центра.",
    keySquares: ["d5", "c5", "e6"],
    commonPlans: [
      "Белые: e3-e4 — прорыв в центре после развития",
      "Чёрные: ...c5 контратака на ферзевом фланге",
      "Изолированная пешка d5 у чёрных — слабость или динамика?",
    ],
    famousGames: ["Ботвинник против Капабланки 1938", "Карпов против Корчного 1978"],
    difficulty: "intermediate",
    style: "positional",
  },
  {
    eco: "B20", name: "Сицилианская защита", moves: "1.e4 c5",
    character: "Острая, несимметричная",
    whiteIdea: "Атака на королевском фланге через f4-f5 или Ng5. Открытая Сицилия (2.Nf3+3.d4) даёт инициативу.",
    blackIdea: "Контрудар на ферзевом фланге (...d5, ...b5). Несимметрия даёт динамичную игру обеим сторонам.",
    keySquares: ["d4", "d5", "f5"],
    commonPlans: [
      "Вариант Найдорфа (5...a6): ...e5 блокирует; ...b5-b4 атака на ф-фланге",
      "Дракон (5...g6): ...h5 атака или югославская атака h4-h5",
      "Шевенинген (5...e6): гибкая структура, ...d5 контрудар",
    ],
    famousGames: ["Каспаров против Топалова 1999", "Фишер против Найдорфа 1966"],
    difficulty: "advanced",
    style: "dynamic",
  },
  {
    eco: "E60", name: "Защита Нимцо-Индийская", moves: "1.d4 Nf6 2.c4 e6 3.Nc3 Bb4",
    character: "Динамичная, с инициативой у чёрных",
    whiteIdea: "Получить двух слонов после 4.e3 0-0 5.Nge2 или взять центр через a3 bxc3 и захватить e4.",
    blackIdea: "Выиграть время, создать давление на e4. Удвоить пешки белых на с3 и использовать ослабление.",
    keySquares: ["c3", "e4", "d5"],
    commonPlans: [
      "Вариант Самиш (4.a3): белые хотят двух слонов, чёрные получают время",
      "Классика (4.e3): медленнее, но надёжнее для белых",
      "Чёрные: ...d5+...c5 контрудар в центре",
    ],
    famousGames: ["Нимцович против Тарраша 1914", "Каспаров против Карпова 1986"],
    difficulty: "advanced",
    style: "dynamic",
  },
  {
    eco: "A00", name: "Дебют Рети", moves: "1.Nf3 d5 2.c4",
    character: "Гибкая, гипермодерная",
    whiteIdea: "Не занимать центр сразу, а атаковать его фигурами. Давление на d5 через c4, g3+Bg2.",
    blackIdea: "Удержать центр или позволить белым занять его, а потом атаковать.",
    keySquares: ["d5", "e4"],
    commonPlans: [
      "Белые: g3+Bg2 фианкетто, давление на d5",
      "Чёрные: ...c6+...e6 солидная защита",
      "Транспозиция в ферзевый гамбит или каталонское начало",
    ],
    famousGames: ["Рети против Капабланки 1924"],
    difficulty: "intermediate",
    style: "positional",
  },
  {
    eco: "C00", name: "Французская защита", moves: "1.e4 e6 2.d4 d5",
    character: "Закрытая, стратегическая",
    whiteIdea: "Создать давление в центре через e5 (цепь пешек) или разменять на d5 и атаковать.",
    blackIdea: "Контрудар ...c5 против центра белых. Типичный план: ...c5, ...Nc6, ...cxd4.",
    keySquares: ["e5", "d4", "f6"],
    commonPlans: [
      "Вариант Рубинштейна (3.Nc3 dxe4 4.Nxe4): симметричный, равная игра",
      "Вариант Тарраша (3.Nd2): медленнее но надёжнее для белых",
      "Чёрные: слон c8 — 'плохой слон', нужно его активизировать",
    ],
    famousGames: ["Алехин против Нимцовича 1930"],
    difficulty: "intermediate",
    style: "positional",
  },
  {
    eco: "D00", name: "Лондонская система", moves: "1.d4 d5 2.Nf3 Nf6 3.Bf4",
    character: "Солидная, универсальная",
    whiteIdea: "Надёжная система для белых: Bf4, e3, Bd3, Ne5. Минимальный риск, долгосрочное давление.",
    blackIdea: "...c5 или ...Bf5 чтобы разменять слонов. ...Nc6+...e6 классическая защита.",
    keySquares: ["e5", "d4"],
    commonPlans: [
      "Белые: Qe2, Nbd2, e4 прорыв в центре",
      "Чёрные: ...c5 немедленный удар по центру",
      "Популярна на всех уровнях из-за надёжности",
    ],
    famousGames: ["Популярна у Магнуса Карлсена"],
    difficulty: "beginner",
    style: "positional",
  },
];

// ══════════════════════════════════════════════════
// ТИПЫ ПОЗИЦИЙ И СТРАТЕГИИ
// ══════════════════════════════════════════════════

export interface PositionType {
  id: string;
  name: string;
  description: string;
  characteristics: string[];
  whitePlan: string[];
  blackPlan: string[];
  keyPieces: string[];
  avoidMistakes: string[];
}

export const POSITION_TYPES: PositionType[] = [
  {
    id: "open", name: "Открытая позиция",
    description: "Центр открыт (пешки разменяны или отсутствуют в центре). Динамичная игра, быстрое развитие критично.",
    characteristics: ["Открытые диагонали для слонов", "Открытые линии для ладей", "Тактика важнее стратегии"],
    whitePlan: ["Быстро рокировать", "Открыть максимум линий", "Скоординировать ладьи"],
    blackPlan: ["То же самое — кто быстрее?", "Контратака в центре", "Использовать слабые поля соперника"],
    keyPieces: ["Слоны", "Ладьи", "Проходные пешки"],
    avoidMistakes: ["Медленное развитие", "Оставлять короля в центре", "Пассивная игра"],
  },
  {
    id: "closed", name: "Закрытая позиция",
    description: "Центр закрыт пешками. Стратегическая борьба, коти важнее слонов. Планирование на несколько ходов.",
    characteristics: ["Пешечные цепи в центре", "Коти ищут сильные поля (аванпосты)", "Фланговые атаки"],
    whitePlan: ["Найти слабость в лагере чёрных", "Подготовить пешечный прорыв", "Улучшать позицию коней"],
    blackPlan: ["Контрудар на другом фланге", "Подрыв центра противника изнутри"],
    keyPieces: ["Кони (любят сильные поля)", "Пешечные цепи"],
    avoidMistakes: ["Менять своих коней на слонов (если позиция закрыта)", "Раскрывать позицию без перевеса"],
  },
  {
    id: "isolated_pawn", name: "Изолированная пешка d4",
    description: "У белых пешка d4 без соседних пешек. Динамика против слабости — классическая дилемма.",
    characteristics: ["Активные фигуры компенсируют слабость d4", "Поле d5 — сильный пост для чёрных"],
    whitePlan: ["Использовать активность фигур", "Атака на королевском фланге", "d4-d5 прорыв в нужный момент"],
    blackPlan: ["Блокировать пешку d4", "Поставить фигуру на d5", "Переход в эндшпиль где d4 слаба"],
    keyPieces: ["Блокёр на d5 (лучший конь или слон)", "Ладьи на полуоткрытых линиях"],
    avoidMistakes: ["Белые: преждевременный размен d4", "Чёрные: позволить d4-d5 без борьбы"],
  },
  {
    id: "kings_attack", name: "Атака на короля",
    description: "Один из королей находится под атакой. Требует точного расчёта и агрессивных действий.",
    characteristics: ["Жертвы для вскрытия позиции короля", "Координация фигур в атаке", "Каждый темп критичен"],
    whitePlan: ["Открыть линии к королю жертвами", "Ввести всё в атаку", "Не давать защититься"],
    blackPlan: ["Защищаться и искать контрудар", "Вернуть материал для облегчения позиции"],
    keyPieces: ["Ферзь", "Ладьи на открытых линиях", "Слоны по диагоналям"],
    avoidMistakes: ["Атака без достаточных сил", "Позволить опасный контрудар", "Упустить промежуточные ходы"],
  },
  {
    id: "pawn_structure", name: "Пешечная структура — висячие пешки",
    description: "Пара связанных пешек (c5+d5 или c4+d4) в центре без соседей. Сильные если активны, слабые если атакованы.",
    characteristics: ["Динамичная позиция с потенциалом", "Риск — обе пешки могут стать слабостями"],
    whitePlan: ["Атаковать одну из висячих пешек", "Стремиться к эндшпилю"],
    blackPlan: ["Продвигать пешки для расширения пространства", "Использовать активность фигур"],
    keyPieces: ["Ладьи на полуоткрытых линиях"],
    avoidMistakes: ["Позволить атаку на обе пешки одновременно"],
  },
];

// ══════════════════════════════════════════════════
// ТАКТИЧЕСКИЕ МОТИВЫ
// ══════════════════════════════════════════════════

export interface TacticMotive {
  id: string;
  name: string;
  description: string;
  example: string;
  howToSpot: string[];
}

export const TACTIC_MOTIVES: TacticMotive[] = [
  {
    id: "fork", name: "Вилка",
    description: "Одна фигура атакует две или более фигуры одновременно.",
    example: "Конь на e5 атакует короля на e8 и ферзя на d7.",
    howToSpot: ["Ищи коней в центре", "Проверяй все ходы коня с атакой на 2+ фигуры", "Особенно опасна вилка конём с шахом"],
  },
  {
    id: "pin", name: "Связка",
    description: "Фигура не может двигаться не потеряв более ценную фигуру за ней.",
    example: "Слон b5 связывает коня c6 — за ним стоит король.",
    howToSpot: ["Смотри где стоит ферзь или король — их можно связать через фигуру", "Используй слонов и ладей для создания связок"],
  },
  {
    id: "skewer", name: "Рентген (зеркало связки)",
    description: "Более ценная фигура атакована, после отхода — теряется фигура за ней.",
    example: "Ладья атакует короля, после отхода — берёт ферзя.",
    howToSpot: ["Ищи король/ферзь на линии с другой фигурой", "Обратная связка — ценная фигура впереди"],
  },
  {
    id: "discovered_attack", name: "Открытый удар",
    description: "Ход фигуры открывает атаку другой фигуры на ценную цель.",
    example: "Конь уходит — открывается слон, который атакует ферзя.",
    howToSpot: ["Ищи фигуры на одной линии", "Проверяй что открывается после хода каждой фигуры"],
  },
  {
    id: "double_check", name: "Двойной шах",
    description: "Два шаха одновременно — единственная защита отступить королём.",
    example: "Конь дает шах и открывает шах ладьи — оба нельзя перекрыть.",
    howToSpot: ["Конь + линейная фигура за ним", "Ведёт к мату чаще других тактик"],
  },
  {
    id: "back_rank", name: "Слабая 8-я горизонталь",
    description: "Король запат своими же пешками — мат ладьёй или ферзём с 8-й горизонтали.",
    example: "1.Rd8+ Rxd8 2.Rxd8#",
    howToSpot: ["Король на последней линии, пешки не двинуты", "Ладьи могут прорваться"],
  },
  {
    id: "sacrifice", name: "Жертва",
    description: "Отдать материал ради позиционной/атакующей компенсации или форсированного мата.",
    example: "Bxh7+! Kxh7 Qh5+ Kg8 Ng5 — классический греческий дар.",
    howToSpot: ["Пересчёт с захватом h7/g7", "Открытый король + активные фигуры = жертва"],
  },
  {
    id: "zugzwang", name: "Цугцванг",
    description: "Любой ход ухудшает позицию — хотелось бы пропустить.",
    example: "Пешечный эндшпиль где право хода — приговор.",
    howToSpot: ["Эндшпиль с пешками", "Треугольник коня или короля для передачи хода"],
  },
];

// ══════════════════════════════════════════════════
// ФУНКЦИИ АНАЛИЗА ПОЗИЦИИ
// ══════════════════════════════════════════════════

export interface PositionAnalysis {
  phase: "opening" | "middlegame" | "endgame";
  materialBalance: number; // >0 = белые лучше
  positionType: string;
  principles: string[];
  threats: string[];
  recommendations: string[];
  tacticsHint?: string;
}

/** Определяем фазу партии по количеству ходов и материалу */
export function detectPhase(fen: string, plyCount: number): "opening" | "middlegame" | "endgame" {
  if (plyCount < 20) return "opening";
  // Считаем материал
  const pieces = fen.split(" ")[0];
  let total = 0;
  for (const c of pieces) {
    if ("nbrqNBRQ".includes(c)) total++;
  }
  if (total <= 6) return "endgame";
  return "middlegame";
}

/** Считаем материальный баланс в центипешках */
export function calcMaterialBalance(fen: string): number {
  const vals: Record<string, number> = { p:1, n:3, b:3, r:5, q:9 };
  let white = 0, black = 0;
  const board = fen.split(" ")[0];
  for (const c of board) {
    const v = vals[c.toLowerCase()];
    if (!v) continue;
    if (c === c.toUpperCase()) white += v;
    else black += v;
  }
  return white - black;
}

/** Контроль центра по материалу и пешкам */
export function assessCenter(fen: string): string {
  const board = fen.split(" ")[0].split("/");
  const rank4 = board[4]; // ряд 4 (индекс от чёрных)
  const rank5 = board[3]; // ряд 5

  let center = "";
  if (rank4.includes("P") || rank5.includes("P")) center += "белые пешки в центре; ";
  if (rank4.includes("p") || rank5.includes("p")) center += "чёрные пешки в центре; ";
  if (!center) return "открытый центр";
  return center.trim();
}

/** Проверка безопасности короля */
export function assessKingSafety(fen: string): { white: string; black: string } {
  try {
    const chess = new Chess(fen);
    const wKing = chess.board().flat().find(s => s?.type === "k" && s.color === "w");
    const bKing = chess.board().flat().find(s => s?.type === "k" && s.color === "b");

    const wFile = wKing?.square[0];
    const bFile = bKing?.square[0];
    const wRank = wKing?.square[1];
    const bRank = bKing?.square[1];

    const wSafe = (wFile === "g" || wFile === "b" || wFile === "c") && (wRank === "1") ? "рокировал — в безопасности" : "в центре или активен";
    const bSafe = (bFile === "g" || bFile === "b" || bFile === "c") && (bRank === "8") ? "рокировал — в безопасности" : "в центре или активен";

    return { white: wSafe, black: bSafe };
  } catch {
    return { white: "неизвестно", black: "неизвестно" };
  }
}

/** Множественное число для «единица» (1 единицу / 2 единицы / 5 единиц) */
function pluralUnit(n: number): string {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return "единиц";
  if (b === 1) return "единицу";
  if (b >= 2 && b <= 4) return "единицы";
  return "единиц";
}

/** Генерируем текстовый анализ позиции для коуча.
 *  evalCp / evalMate — БЕЛО-ОТНОСИТЕЛЬНАЯ оценка движка (mate>0 = мат за белых).
 *  Если передан реальный eval — коуч говорит правду (мат/решающий перевес),
 *  а не сыпет общими дебютными принципами «как безразрядник». */
export function generatePositionExplanation(fen: string, plyCount: number, evalCp: number, evalMate: number = 0): string {
  const phase = detectPhase(fen, plyCount);
  const matBal = calcMaterialBalance(fen);
  const center = assessCenter(fen);
  const kingSafety = assessKingSafety(fen);
  const turn = fen.split(" ")[1] === "w" ? "белых" : "чёрных";

  const phaseLabel = phase === "opening" ? "в дебюте" : phase === "middlegame" ? "в миттельшпиле" : "в эндшпиле";

  // Форсированный мат перекрывает всё остальное.
  let evalLabel: string;
  const decisive = evalMate !== 0 || Math.abs(evalCp) >= 300;
  if (evalMate !== 0) {
    const side = evalMate > 0 ? "белых" : "чёрных";
    evalLabel = `⚠️ форсированный МАТ за ${side} в ${Math.abs(evalMate)}`;
  } else {
    evalLabel = Math.abs(evalCp) < 40 ? "позиция примерно равна"
      : evalCp >= 500 ? "у белых решающий перевес"
      : evalCp >= 300 ? "белые явно лучше"
      : evalCp >= 80 ? "у белых небольшой перевес"
      : evalCp <= -500 ? "у чёрных решающий перевес"
      : evalCp <= -300 ? "чёрные явно лучше"
      : evalCp <= -80 ? "у чёрных небольшой перевес"
      : "примерное равенство с лёгким дисбалансом";
  }

  const matLabel = matBal === 0 ? "материальное равенство" : matBal > 0 ? `белые опережают на ${matBal} ${pluralUnit(matBal)}` : `чёрные опережают на ${Math.abs(matBal)} ${pluralUnit(matBal)}`;

  const lines = [
    `Сейчас ${phaseLabel}. Ход ${turn}. ${evalLabel}.`,
    `Материал: ${matLabel}. Центр: ${center}.`,
    `Безопасность королей: белые — ${kingSafety.white}; чёрные — ${kingSafety.black}.`,
  ];
  // Общий принцип — только в спокойной позиции; при мате/решающем перевесе он неуместен.
  if (!decisive) {
    const advice = CHESS_PRINCIPLES[phase][Math.floor(Math.random() * CHESS_PRINCIPLES[phase].length)];
    lines.push(``, `💡 Принцип: ${advice}`);
  }
  return lines.join("\n");
}

/** Объяснение конкретного хода */
export function explainMove(
  fenBefore: string,
  san: string,
  evalBefore: number,
  evalAfter: number,
): string {
  const delta = evalAfter - evalBefore;
  const isCapture = san.includes("x");
  const isCheck = san.includes("+");
  const isMate = san.includes("#");
  const isCastle = san.startsWith("O-");
  const isPromotion = san.includes("=");

  if (isMate) return `Мат! Партия завершена — ${san}`;
  if (isCastle) return `${san} — рокировка: король в безопасности, ладья активна.`;
  if (isPromotion) return `${san} — превращение пешки! Обычно лучший выбор — ферзь.`;

  let evalComment = "";
  if (Math.abs(delta) < 20) evalComment = "Нейтральный ход.";
  else if (delta > 150) evalComment = `⭐ Отличный ход! Позиция улучшилась на ${(delta/100).toFixed(1)} пешки.`;
  else if (delta > 50) evalComment = "Хороший ход.";
  else if (delta < -150) evalComment = `?? Зевок! Потеряно ${(-delta/100).toFixed(1)} пешки.`;
  else if (delta < -50) evalComment = "? Неточность — есть лучший ход.";

  let moveComment = "";
  if (isCapture) moveComment = "Взятие — убедись что это выгодный обмен.";
  else if (isCheck) moveComment = "Шах — соперник должен ответить.";

  return [evalComment, moveComment].filter(Boolean).join(" ") || san;
}

/** Поиск тактических мотивов в позиции */
export function spotTactics(fen: string): string[] {
  const hints: string[] = [];
  try {
    const chess = new Chess(fen);
    const turn = chess.turn();
    const moves = chess.moves({ verbose: true });

    // Проверяем вилки конём
    const knightMoves = moves.filter(m => m.piece === "n");
    for (const km of knightMoves) {
      const afterKnight = new Chess(fen);
      afterKnight.move(km);
      // Если после хода коня атакован ферзь или ладья соперника — намёк на вилку
      const afterMoves = afterKnight.moves({ verbose: true });
      const attacks = afterMoves.filter(m => m.captured === "q" || m.captured === "r");
      if (attacks.length >= 1) {
        hints.push(`🐴 Посмотри на ход ${km.san} — конь может создать давление`);
        break;
      }
    }

    // Мат в 1 — высший приоритет, всегда первым.
    const mates = moves.filter(m => m.san.includes("#"));
    if (mates.length > 0) {
      hints.unshift(`🏆 МАТ В 1 ХОД: ${mates.map(m => m.san).join(", ")} — ставь немедленно!`);
    }
    // Проверяем шахи (но не дублируем мат)
    const checks = moves.filter(m => m.san.includes("+"));
    if (checks.length > 0 && hints.length === 0) {
      hints.push(`⚡ Есть возможность дать шах: ${checks.slice(0,3).map(c=>c.san).join(", ")}`);
    }

    // Проверяем взятия без немедленной потери
    const captures = moves.filter(m => m.captured);
    if (captures.length > 0 && hints.length === 0) {
      hints.push(`✂ Доступные взятия: ${captures.slice(0,3).map(c=>c.san).join(", ")}`);
    }
  } catch {}
  return hints;
}

/** Найти дебют по начальным ходам */
export function identifyOpening(pgn: string): OpeningTheory | null {
  const movePrefixes = pgn.replace(/\d+\.\s*/g, "").trim().split(" ").slice(0, 6).join(" ");
  for (const op of OPENING_THEORY) {
    const opMoves = op.moves.replace(/\d+\.\s*/g, "").trim();
    if (movePrefixes.startsWith(opMoves.substring(0, Math.min(opMoves.length, 15)))) {
      return op;
    }
  }
  return null;
}

// ══════════════════════════════════════════════════
// ПЕШЕЧНЫЕ СТРУКТУРЫ МИТТЕЛЬШПИЛЯ (детекция из позиции)
// ══════════════════════════════════════════════════
// POSITION_TYPES выше — общие типы, но их никто не определяет из FEN. Здесь —
// канонические структуры, которые распознаются по пешечному скелету, чтобы коуч
// в миттельшпиле называл структуру по имени и давал типовой план, а не общие слова.

export interface PawnStructure {
  id: string;
  name: string;
  description: string;
  keyIdea: string;      // одна фраза — суть борьбы
  keySquares: string[];
  ownerPlan: string[];  // план стороны, которой "принадлежит" структура (owner)
  opponentPlan: string[];
}

// Планы написаны с точки зрения owner. Детектор возвращает, кто owner ("w"/"b").
export const PAWN_STRUCTURES: Record<string, PawnStructure> = {
  maroczy: {
    id: "maroczy", name: "Мароци (зажим c4+e4)",
    description: "Белые пешки c4 и e4 сковывают освобождающие ...d5 и ...b5 — типично против Сицилианской и защиты Каро/КИД. Игра на пространственном перевесе.",
    keyIdea: "Пространственный зажим против освобождающих подрывов ...b5 / ...d5.",
    keySquares: ["d5", "c4", "e4", "b5"],
    ownerPlan: ["Держать зажим, не форсировать", "Размен чернопольных слонов усиливает контроль над d5", "Медленное наступление b2-b4-b5 на ферзёвом фланге", "Конь на d5 — идеальный форпост"],
    opponentPlan: ["Разменивать фигуры — тесной стороне это облегчает жизнь", "Готовить подрыв ...b5 (или ...d5) в нужный момент", "Давить на пешку c4 и слабость d4-поля", "Конь на c5/e5"],
  },
  stonewall: {
    id: "stonewall", name: "Каменная стена (d4-e3-f4)",
    description: "Жёсткая пешечная стена d4-e3-f4 (или чёрными d5-e6-f5). Владелец получает вечный форпост e5/e4 и атаку на короля ценой «плохого» белопольного слона и дыры на e4/e5.",
    keyIdea: "Форпост e5/e4 и атака на короля против дыры и плохого слона.",
    keySquares: ["e5", "e4", "f5", "c5"],
    ownerPlan: ["Конь на e5 (или e4) — доминирующий форпост", "Тяжёлые фигуры к королю: ладья по 3-й на h3, ферзь на h5", "Пешечный штурм g4", "Активировать «плохого» слона через b1-d3 или разменять его"],
    opponentPlan: ["Захватить дыру e4/e5 конём (Nd7-f6-e4)", "Разменять белопольных слонов — снять атакующий потенциал", "Контригра на ферзёвом фланге подрывом ...c5"],
  },
  hedgehog: {
    id: "hedgehog", name: "Ёж (пешки a6-b6-d6-e6)",
    description: "Пешки на 6-й горизонтали (a6, b6, d6, e6) против c4+e4 — гибкая пружинистая структура. Владелец «ежа» выжидает и бьёт подрывом ...b5 или ...d5.",
    keyIdea: "Стеснённая пружина: копи силы за ширмой и распрямись ударом ...b5/...d5.",
    keySquares: ["b5", "d5", "c4", "e4"],
    ownerPlan: ["Развернуть фигуры за пешечной ширмой: ферзь c7/b8, ладьи c8/e8", "В нужный момент подрыв ...b5 — распрямление ежа", "Держать напряжение — не разменивать без выгоды", "Слон b7 давит на e4"],
    opponentPlan: ["Держать зажим c4+e4, наращивать давление", "Пресекать освобождающие ...b5 и ...d5", "Пространственный перевес — не дать сопернику вздохнуть"],
  },
  closed_chain: {
    id: "closed_chain", name: "Закрытый центр (пешечные цепи)",
    description: "Зафиксированные пешечные цепи в центре (d4-e5 против d5-e6, или e4-d5 против e5-d6). Центр заперт — борьба переносится на фланги.",
    keyIdea: "Атакуй основание вражеской цепи; играй на фланге, куда «смотрит» твоя цепь.",
    keySquares: ["d4", "d5", "e5", "e6"],
    ownerPlan: ["Определить базу цепи соперника и атаковать её пешкой (f4-f5 или c4-c5)", "Играть на фланге, куда направлена своя цепь", "Не вскрывать центр раньше готовности фигур"],
    opponentPlan: ["Свой подрыв против базы вражеской цепи (...c5 или ...f6)", "Контригра на противоположном фланге", "Разменять «плохого» слона, запертого своей же цепью"],
  },
  carlsbad: {
    id: "carlsbad", name: "Карлсбадская структура (миноритарная атака)",
    description: "Из разменного варианта ферзевого гамбита: чёрные c6+e6 против белой d4, линия c полуоткрыта. Классический план белых — миноритарная атака b4-b5.",
    keyIdea: "Белые: миноритарная атака b4-b5xc6 → слабость c6. Чёрные: атака на короля / прорыв ...e4.",
    keySquares: ["c6", "b5", "e4"],
    ownerPlan: ["Миноритарная атака b2-b4-b5: размен на c6 оставляет чёрным слабую пешку", "Давление по полуоткрытой линии c на пешку c6", "Альтернатива — центральный прорыв e3-e4"],
    opponentPlan: ["Контригра на королёвском фланге: ...Ne4, ...f5, ...Bd6/Qf6", "Не допускать b5 без борьбы (...a6, ...b5 сам)", "Фигурная активность против медлительной атаки белых"],
  },
  hanging: {
    id: "hanging", name: "Висячие пешки (c+d)",
    description: "Пара связанных пешек c+d без соседей b/e. Сильны, когда поддержаны фигурами и готовы идти вперёд (d4-d5 / c4-c5); слабы, когда заблокированы и атакованы.",
    keyIdea: "Динамика (прорыв d5/c5) против статики (блокада и атака пешек).",
    keySquares: ["c4", "d4", "d5", "c5"],
    ownerPlan: ["Держать пешки поддержанными фигурами", "Готовить атакующий прорыв d4-d5 (вскрытие на короля) или c4-c5", "Использовать пространство для фигурной игры, пока пешки стоят"],
    opponentPlan: ["Заблокировать пешки фигурами (конь перед d-пешкой)", "Давить на них по полуоткрытым линиям c и d", "Вынудить продвижение, зафиксировать слабость и уйти в эндшпиль"],
  },
  iqp: {
    id: "iqp", name: "Изолированная пешка (изолятор d)",
    description: "Изолированная пешка d без соседних пешек c и e. Даёт активные фигуры и поле для атаки, но в эндшпиле — хроническая слабость; поле перед ней (d5/d4) — вечный форпост соперника.",
    keyIdea: "Динамика и атака владельца против блокады и размена в эндшпиль.",
    keySquares: ["d5", "d4", "e5"],
    ownerPlan: ["Использовать активность фигур, пока они мобильны", "Прорыв d4-d5 (или ...d5-d4) в атакующем ключе", "Атака на короля — фигуры, а не размены", "Конь на e5 при поддержке"],
    opponentPlan: ["Заблокировать пешку фигурой на поле перед ней (d5/d4)", "Разменять активные фигуры соперника", "Стремиться в эндшпиль, где изолятор — чистая слабость"],
  },
  doubled: {
    id: "doubled", name: "Сдвоенные пешки",
    description: "Две пешки на одной вертикали. Минус — не защищают друг друга и создают отсталую слабость; плюс — открывают соседнюю полуоткрытую линию и контроль соседних полей.",
    keyIdea: "Использовать открытую линию и лишний контроль против статической слабости сдвоенной пешки.",
    keySquares: [],
    ownerPlan: ["Использовать полуоткрытую линию рядом со сдвоением для ладей", "Опираться на дополнительный контроль центральных полей", "Не давать зафиксировать и осадить слабую пешку"],
    opponentPlan: ["Заблокировать и осадить сдвоенную пешку фигурами", "Стремиться к разменам и эндшпилю, где слабость скажется", "Создать второй фронт — принцип двух слабостей"],
  },
};

function parsePawns(fen: string): { wp: Set<string>; bp: Set<string> } {
  const board = fen.split(" ")[0];
  const rows = board.split("/");
  const wp = new Set<string>(), bp = new Set<string>();
  for (let r = 0; r < 8 && r < rows.length; r++) {
    let file = 0;
    for (const ch of rows[r]) {
      if (ch >= "1" && ch <= "8") { file += ch.charCodeAt(0) - 48; continue; }
      const sq = `${"abcdefgh"[file]}${8 - r}`;
      if (ch === "P") wp.add(sq);
      else if (ch === "p") bp.add(sq);
      file++;
    }
  }
  return { wp, bp };
}

const fileCount = (s: Set<string>, f: string): number => {
  let n = 0; s.forEach(sq => { if (sq[0] === f) n++; }); return n;
};

export type DetectedStructure = PawnStructure & { owner: "w" | "b" };

/** Распознать пешечную структуру по позиции. null — если ничего характерного нет. */
export function detectPawnStructure(fen: string): DetectedStructure | null {
  const { wp, bp } = parsePawns(fen);
  const has = (s: Set<string>, sq: string) => s.has(sq);
  const mk = (id: string, owner: "w" | "b"): DetectedStructure => ({ ...PAWN_STRUCTURES[id], owner });

  // Порядок: от самых специфичных (точные поля) к общим (по вертикалям).
  // 1. Ёж — тот же каркас, что Мароци (c4+e4), но с 4 пешками на 6-й; более
  //    информативное имя, поэтому проверяем раньше общего мароци-зажима.
  if (has(bp, "a6") && has(bp, "b6") && has(bp, "d6") && has(bp, "e6")) return mk("hedgehog", "b");
  if (has(wp, "a3") && has(wp, "b3") && has(wp, "d3") && has(wp, "e3")) return mk("hedgehog", "w");
  // 2. Мароци — белые c4+e4, без белой пешки d.
  if (has(wp, "c4") && has(wp, "e4") && fileCount(wp, "d") === 0) return mk("maroczy", "w");
  // 3. Каменная стена.
  if (has(wp, "d4") && has(wp, "e3") && has(wp, "f4")) return mk("stonewall", "w");
  if (has(bp, "d5") && has(bp, "e6") && has(bp, "f5")) return mk("stonewall", "b");
  // 4. Закрытые цепи (французская d4-e5 vs d5-e6 или КИД/Бенони e4-d5 vs e5-d6).
  if (has(wp, "d4") && has(wp, "e5") && has(bp, "d5") && has(bp, "e6")) return mk("closed_chain", "w");
  if (has(wp, "e4") && has(wp, "d5") && has(bp, "e5") && has(bp, "d6")) return mk("closed_chain", "w");
  // 5. Карлсбад — чёрные c6+e6 против белой d4, без чёрной пешки d.
  if (has(bp, "c6") && has(bp, "e6") && has(wp, "d4") && fileCount(bp, "d") === 0) return mk("carlsbad", "w");
  // 6. Висячие пешки — c+d есть, b и e нет.
  if (fileCount(wp, "c") >= 1 && fileCount(wp, "d") >= 1 && fileCount(wp, "b") === 0 && fileCount(wp, "e") === 0) return mk("hanging", "w");
  if (fileCount(bp, "c") >= 1 && fileCount(bp, "d") >= 1 && fileCount(bp, "b") === 0 && fileCount(bp, "e") === 0) return mk("hanging", "b");
  // 7. Изолятор d — d есть, c и e нет.
  if (fileCount(wp, "d") >= 1 && fileCount(wp, "c") === 0 && fileCount(wp, "e") === 0) return mk("iqp", "w");
  if (fileCount(bp, "d") >= 1 && fileCount(bp, "c") === 0 && fileCount(bp, "e") === 0) return mk("iqp", "b");
  // 8. Сдвоенные пешки (fallback) — любая вертикаль с 2+ пешками одного цвета.
  for (const f of "abcdefgh") {
    if (fileCount(wp, f) >= 2) return mk("doubled", "w");
    if (fileCount(bp, f) >= 2) return mk("doubled", "b");
  }
  return null;
}

/** Получить совет для текущей фазы */
export function getPhaseAdvice(phase: "opening" | "middlegame" | "endgame", count: number = 3): string[] {
  return CHESS_PRINCIPLES[phase].slice(0, count);
}

/** Методики обучения */
export const TRAINING_METHODOLOGIES = {
  "Метод Котова": {
    description: "Анализировай тихо, считай форсированные варианты. Не пересчитывай дерево вариантов.",
    steps: ["Определи кандидатные ходы", "Посчитай каждый до конца один раз", "Выбери лучший"],
  },
  "Метод Нимцовича": {
    description: "Профилактика — предугадывай угрозы соперника раньше чем они возникнут.",
    steps: ["Найди план соперника", "Нейтрализуй его", "Создай собственный план"],
  },
  "Принципы Стейница": {
    description: "Атакуй только когда есть позиционный перевес. Маленькие преимущества накапливаются.",
    steps: ["Оцени позицию объективно", "Не атакуй преждевременно", "Создавай слабости у соперника"],
  },
  "Метод Дворецкого": {
    description: "Тренировка эндшпилей — фундамент профессиональной игры.",
    steps: ["Заучи теоретические эндшпили", "Решай этюды", "Анализируй свои эндшпили"],
  },
};
