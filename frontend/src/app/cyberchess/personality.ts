/* ═══ Chess Personality Quiz ═══
   10 вопросов про шахматный стиль → подбираем
   великого игрока, чей стиль ближе всего пользователю. */

export type PlayerStyle =
  | "tal" | "karpov" | "carlsen" | "kasparov"
  | "capablanca" | "fischer" | "petrosian" | "botvinnik";

export type PlayerProfile = {
  id: PlayerStyle;
  name: string;
  era: string;
  emoji: string;
  tagline: string;
  bio: string;
  signatureGame: string;
  strengths: string[];
};

export const PLAYERS: Record<PlayerStyle, PlayerProfile> = {
  tal: {
    id: "tal",
    name: "Михаил Таль",
    era: "1936–1992 · 8-й чемпион мира",
    emoji: "⚡",
    tagline: "Магия комбинаций",
    bio: "«Рижский волшебник». Король жертв и хаоса. Любит огонь на доске больше, чем материал.",
    signatureGame: "Таль — Ботвинник 1960, партия 6 — атака с жертвой коня",
    strengths: ["Жертвы", "Тактика", "Атака на короля", "Психология"],
  },
  karpov: {
    id: "karpov",
    name: "Анатолий Карпов",
    era: "1951– · 12-й чемпион мира",
    emoji: "🐍",
    tagline: "Удав-позиционник",
    bio: "Душит соперника медленным накоплением преимуществ. Самый «эффективный» чемпион мира — почти без блестящих ходов, но и без слабых.",
    signatureGame: "Карпов — Каспаров 1984/85, партия 9 — эталонный эндшпиль",
    strengths: ["Позиция", "Эндшпиль", "Профилактика", "Микроманевры"],
  },
  carlsen: {
    id: "carlsen",
    name: "Магнус Карлсен",
    era: "1990– · 16-й чемпион мира",
    emoji: "🦁",
    tagline: "Универсал нашей эпохи",
    bio: "Шахматный король 21-го века. Играет любое — атаку, защиту, эндшпиль; выматывает соперников в простых на вид позициях.",
    signatureGame: "Карлсен — Карякин 2016, партия 10 — переход в выигранный ладейник",
    strengths: ["Универсальность", "Эндшпиль", "Прагматизм", "Выносливость"],
  },
  kasparov: {
    id: "kasparov",
    name: "Гарри Каспаров",
    era: "1963– · 13-й чемпион мира",
    emoji: "🔥",
    tagline: "Динамика в плоти и крови",
    bio: "Ураганная подготовка + дерзкая атака. Принёс в шахматы агрессивную динамическую школу.",
    signatureGame: "Каспаров — Топалов 1999, Уэйк-ан-Зее — «Бессмертная партия №2»",
    strengths: ["Дебют", "Атака", "Расчёт", "Динамика"],
  },
  capablanca: {
    id: "capablanca",
    name: "Хосе Рауль Капабланка",
    era: "1888–1942 · 3-й чемпион мира",
    emoji: "💎",
    tagline: "Шахматная машина",
    bio: "Чистота и простота. Кажется, что ходит без усилий — а доска уже выиграна. Образец классической ясности.",
    signatureGame: "Капабланка — Маршалл 1918 — отражение «атаки Маршалла»",
    strengths: ["Простота", "Эндшпиль", "Точность", "Интуиция"],
  },
  fischer: {
    id: "fischer",
    name: "Бобби Фишер",
    era: "1943–2008 · 11-й чемпион мира",
    emoji: "👑",
    tagline: "Перфекционист",
    bio: "Один против системы. Запредельная точность, агрессия и стремление к идеалу. Изменил шахматы навсегда.",
    signatureGame: "Фишер — Спасский 1972, партия 6 — лекция в защите Тарраша",
    strengths: ["Точность", "Дебют", "Воля", "Концентрация"],
  },
  petrosian: {
    id: "petrosian",
    name: "Тигран Петросян",
    era: "1929–1984 · 9-й чемпион мира",
    emoji: "🛡",
    tagline: "Железная защита",
    bio: "«Тигр», но в обороне. Раньше всех видит угрозу и душит её в зародыше. Жертвы качества — его коронка.",
    signatureGame: "Петросян — Спасский 1966, партия 10 — атака с жертвой качества",
    strengths: ["Защита", "Профилактика", "Жертва качества", "Хладнокровие"],
  },
  botvinnik: {
    id: "botvinnik",
    name: "Михаил Ботвинник",
    era: "1911–1995 · 6-й чемпион мира",
    emoji: "🧠",
    tagline: "Профессор шахмат",
    bio: "Научный подход. Готовился по дебютам как никто до него. Стратег и аналитик в одном лице.",
    signatureGame: "Ботвинник — Капабланка 1938 — знаменитая жертва коня",
    strengths: ["Подготовка", "Стратегия", "Анализ", "Дисциплина"],
  },
};

type Weights = Partial<Record<PlayerStyle, number>>;
export type QuizQuestion = {
  q: string;
  options: { label: string; weights: Weights }[];
};

export const QUESTIONS: QuizQuestion[] = [
  {
    q: "Соперник зевнул фигуру, но даёт компенсацию атакой. Что выберешь?",
    options: [
      { label: "Заберу — материал решает.", weights: { fischer: 3, capablanca: 2, karpov: 2 } },
      { label: "Откажусь — мне нужна красивая партия.", weights: { tal: 4, kasparov: 2 } },
      { label: "Заберу и буду точно защищаться.", weights: { petrosian: 3, karpov: 2, capablanca: 1 } },
      { label: "Подумаю минут 20 — оценю всё точно.", weights: { botvinnik: 3, fischer: 2 } },
    ],
  },
  {
    q: "Любимая стадия партии:",
    options: [
      { label: "Дебют — здесь решается всё.", weights: { kasparov: 3, botvinnik: 3, fischer: 2 } },
      { label: "Миттельшпиль — бой и тактика.", weights: { tal: 4, kasparov: 2 } },
      { label: "Эндшпиль — где раскрывается мастерство.", weights: { capablanca: 3, karpov: 3, carlsen: 3 } },
      { label: "Без разницы — везде.", weights: { carlsen: 4, fischer: 1 } },
    ],
  },
  {
    q: "Жертва ферзя за инициативу. Решаешься?",
    options: [
      { label: "Если расчёт убеждает — да.", weights: { kasparov: 3, fischer: 2, botvinnik: 2 } },
      { label: "Да! Мне всё равно — главное огонь.", weights: { tal: 5 } },
      { label: "Нет — позиция не оправдывает.", weights: { karpov: 3, petrosian: 3, capablanca: 2 } },
      { label: "Только в проигранной позиции.", weights: { petrosian: 2, carlsen: 2 } },
    ],
  },
  {
    q: "Соперник готовит мощную атаку. Твоя реакция?",
    options: [
      { label: "Атаковать в ответ — лучшее, что можно.", weights: { kasparov: 3, tal: 3 } },
      { label: "Заранее закрою опасные линии.", weights: { petrosian: 4, karpov: 2 } },
      { label: "Найду тактику и отыграю обратно.", weights: { tal: 2, fischer: 2 } },
      { label: "Упрощу позицию и переведу в эндшпиль.", weights: { capablanca: 3, carlsen: 3, karpov: 1 } },
    ],
  },
  {
    q: "Сколько часов в день готов готовиться?",
    options: [
      { label: "8+ — это моя жизнь.", weights: { fischer: 3, botvinnik: 3, kasparov: 2 } },
      { label: "2–3 — главное играть.", weights: { tal: 3, capablanca: 2 } },
      { label: "5–6 — баланс.", weights: { carlsen: 3, karpov: 2 } },
      { label: "Час — на эндшпильные техники.", weights: { capablanca: 2, karpov: 2, petrosian: 1 } },
    ],
  },
  {
    q: "Какое у тебя «оружие»?",
    options: [
      { label: "Жертвы и тактика.", weights: { tal: 5 } },
      { label: "Точность и техника.", weights: { capablanca: 3, fischer: 3, karpov: 2 } },
      { label: "Подготовка по дебютам.", weights: { botvinnik: 3, kasparov: 3 } },
      { label: "Терпение и выдержка.", weights: { carlsen: 3, petrosian: 3 } },
    ],
  },
  {
    q: "Любимый ход — это:",
    options: [
      { label: "Жертва качества.", weights: { petrosian: 4, tal: 2 } },
      { label: "Тонкий тихий ход в эндшпиле.", weights: { capablanca: 3, karpov: 3, carlsen: 2 } },
      { label: "Быстрая лобовая атака на короля.", weights: { kasparov: 3, tal: 3 } },
      { label: "Точный расчёт длинного варианта.", weights: { botvinnik: 3, fischer: 3 } },
    ],
  },
  {
    q: "В партии у тебя меньше времени. Как играешь?",
    options: [
      { label: "Создам осложнения — соперник тоже задумается.", weights: { tal: 4, kasparov: 2 } },
      { label: "Перейду на интуицию и быстрые ходы.", weights: { capablanca: 3, carlsen: 3 } },
      { label: "Упрощу до техничной позиции.", weights: { karpov: 3, capablanca: 2 } },
      { label: "Закроюсь и буду играть на ничью.", weights: { petrosian: 3 } },
    ],
  },
  {
    q: "Что для тебя «победа»?",
    options: [
      { label: "Красивая комбинация — даже в проигранной.", weights: { tal: 4 } },
      { label: "Чистый технический эндшпиль.", weights: { capablanca: 3, karpov: 3, carlsen: 2 } },
      { label: "Идеальная партия без единой ошибки.", weights: { fischer: 4, botvinnik: 2 } },
      { label: "Соперник не понял, как проиграл.", weights: { petrosian: 3, karpov: 2 } },
    ],
  },
  {
    q: "Турнирная стратегия:",
    options: [
      { label: "Все партии — на победу.", weights: { kasparov: 3, fischer: 3, tal: 2 } },
      { label: "Не проигрывать — копить очки понемногу.", weights: { carlsen: 3, karpov: 3, petrosian: 2 } },
      { label: "Готовиться по сопернику и бить в его слабость.", weights: { botvinnik: 4 } },
      { label: "Сначала разведка, потом удар.", weights: { capablanca: 2, carlsen: 2, petrosian: 2 } },
    ],
  },
];

export type QuizResult = {
  topId: PlayerStyle;
  scores: Record<PlayerStyle, number>;
  ranked: PlayerStyle[]; // по убыванию очков
};

export function scoreQuiz(answers: number[]): QuizResult {
  const scores: Record<PlayerStyle, number> = {
    tal: 0, karpov: 0, carlsen: 0, kasparov: 0,
    capablanca: 0, fischer: 0, petrosian: 0, botvinnik: 0,
  };
  answers.forEach((ans, i) => {
    const q = QUESTIONS[i];
    if (!q) return;
    const opt = q.options[ans];
    if (!opt) return;
    for (const [k, v] of Object.entries(opt.weights)) {
      scores[k as PlayerStyle] += v ?? 0;
    }
  });
  const ranked = (Object.keys(scores) as PlayerStyle[]).sort((a, b) => scores[b] - scores[a]);
  return { topId: ranked[0], scores, ranked };
}

const QK = "aevion_chess_personality_v1";
export function loadResult(): { ts: number; result: QuizResult } | null {
  try {
    const raw = localStorage.getItem(QK);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
export function saveResult(result: QuizResult) {
  try {
    localStorage.setItem(QK, JSON.stringify({ ts: Date.now(), result }));
  } catch {}
}
