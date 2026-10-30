// Тексты вкладки «Задачи» CyberChess для en/kk. Грузится лениво из page.tsx (import("./zadachiText")) —
// только когда язык не русский: статически page.tsx этот файл НЕ импортирует (храповик объёма критического пути).
// ⚠️ kk — черновой перевод, нужна вычитка носителя.
// Ключ ZADACHI_TEXT = ТОЧНЫЙ русский исходник строки из page.tsx; на ru текст не подменяется вовсе.
import { Chess, type Square } from "chess.js";
import { temaZadachiRu, fazaRu } from "./puzzleLabels";
import { hodPoRusski } from "./puzzleNormalize";

export type ZtYaz = "ru" | "en" | "kk";

export const ZADACHI_TEXT: Record<string, { en: string; kk: string }> = {
  "Подсказка — лучший ход:": { en: "Hint — best move:", kk: "Кеңес — ең жақсы жүріс:" },
  "Правильный ход:": { en: "Correct move:", kk: "Дұрыс жүріс:" },
  "Следующая": { en: "Next", kk: "Келесі" },
  "Подсказка · 5": { en: "Hint · 5", kk: "Кеңес · 5" },
  "Заново": { en: "Retry", kk: "Қайта" },
  "Решение": { en: "Solution", kk: "Шешімі" },
  "подсказка": { en: "hint", kk: "кеңес" },
  "следующий": { en: "next", kk: "келесі" },
  "заново": { en: "retry", kk: "қайта" },
  "Выбери задачу из списка ниже ↓": { en: "Pick a puzzle from the list below ↓", kk: "Төмендегі тізімнен есеп таңда ↓" },
  "Решено": { en: "Solved", kk: "Шешілді" },
  "Ошибок": { en: "Mistakes", kk: "Қате" },
  "В фильтре": { en: "In filter", kk: "Сүзгіде" },
  "Лучший результат": { en: "Best score", kk: "Үздік нәтиже" },
  "Рекорд серии": { en: "Streak record", kk: "Серия рекорды" },
  "Позиция задачи у тренера — спрашивай": { en: "The puzzle position is with the coach — ask away", kk: "Есеп позициясы жаттықтырушыда — сұра" },
  "Тренируй слабые темы:": { en: "Train your weak themes:", kk: "Әлсіз тақырыптарды жаттықтыр:" },
  "× очистить": { en: "× clear", kk: "× тазалау" },
  "Категория": { en: "Category", kk: "Санат" },
  "Все задачи": { en: "All puzzles", kk: "Барлық есептер" },
  "Тактика": { en: "Tactics", kk: "Тактика" },
  "Мат 4+": { en: "Mate 4+", kk: "Мат 4+" },
  "Дебют": { en: "Opening", kk: "Дебют" },
  "Миттельшпиль": { en: "Middlegame", kk: "Миттельшпиль" },
  "Эндшпиль": { en: "Endgame", kk: "Эндшпиль" },
  "Фильтры": { en: "Filters", kk: "Сүзгілер" },
  "активны": { en: "active", kk: "белсенді" },
  "Цель": { en: "Goal", kk: "Мақсат" },
  "Все": { en: "All", kk: "Барлығы" },
  "Мат": { en: "Mate", kk: "Мат" },
  "Фаза": { en: "Phase", kk: "Кезең" },
  "Сторона": { en: "Side", kk: "Тарап" },
  "Белые": { en: "White", kk: "Ақ" },
  "Чёрные": { en: "Black", kk: "Қара" },
  "Тема": { en: "Theme", kk: "Тақырып" },
  "Все темы": { en: "All themes", kk: "Барлық тақырыптар" },
  "Уровень сложности": { en: "Difficulty level", kk: "Қиындық деңгейі" },
  "Мой уровень": { en: "My level", kk: "Менің деңгейім" },
  "Сбросить": { en: "Reset", kk: "Тастау" },
  "Список задач": { en: "Puzzle list", kk: "Есептер тізімі" },
  "Миттельшп.": { en: "Middlegame", kk: "Миттельшп." },
  "Эндшп.": { en: "Endgame", kk: "Эндшп." },
  "Задачи не загрузились": { en: "Puzzles failed to load", kk: "Есептер жүктелмеді" },
  "Это не фильтр — банк не ответил. Обновите страницу; если повторится, напишите нам.": { en: "It's not the filter — the puzzle bank did not respond. Reload the page; if it happens again, write to us.", kk: "Бұл сүзгі емес — банк жауап бермеді. Бетті жаңартыңыз; қайталанса, бізге жазыңыз." },
  "Нет задач по фильтру": { en: "No puzzles match the filter", kk: "Сүзгі бойынша есеп жоқ" },
  "☀ Задача дня": { en: "☀ Puzzle of the day", kk: "☀ Күн есебі" },
  "Темы": { en: "Themes", kk: "Тақырыптар" },
  "топ": { en: "top", kk: "топ" },
  "из": { en: "of", kk: "/" },
  "задач": { en: "puzzles", kk: "есеп" },
  // 30.10.2026: баннеры и тосты результата решения (видит гость, решивший или ошибшийся)
  "Неверно. Лучший ход:": { en: "Wrong. Best move:", kk: "Қате. Ең жақсы жүріс:" },
  "Неверно. Попробуй ещё или посмотри ответ": { en: "Wrong. Try again or see the answer", kk: "Қате. Қайталап көр немесе жауабын қара" },
  "Серия": { en: "Streak", kk: "Серия" },
  "Верно! 🎯": { en: "Correct! 🎯", kk: "Дұрыс! 🎯" },
  "Отлично!": { en: "Excellent!", kk: "Керемет!" },
  "Верно! Отличный ход": { en: "Correct! Great move", kk: "Дұрыс! Керемет жүріс" },
  "Матовая комбинация": { en: "Mating combination", kk: "Мат комбинациясы" },
  "Король соперника загнан в угол — при точной игре матовый финал неизбежен. Запомни характер позиции!": { en: "The opponent's king is cornered — with accurate play mate is unavoidable. Remember the pattern!", kk: "Қарсыластың королі бұрышқа қамалды — дәл ойында мат сөзсіз. Позицияның сипатын есте сақта!" },
  "Неверно! Стрик сброшен": { en: "Wrong! Streak reset", kk: "Қате! Серия нөлденді" },
  "Неверно. Попробуй ещё": { en: "Wrong. Try again", kk: "Қате. Қайталап көр" },
};

const FAZA_EN: Record<string, string> = { Opening: "Opening", Middlegame: "Middlegame", Endgame: "Endgame" };

/** Русские названия, которые импортёры пишут в theme напрямую, — в английские. */
const TEMA_RU_V_EN: Record<string, string> = {
  "Мат в 1": "Mate in 1", "Мат в 2": "Mate in 2", "Мат в 3": "Mate in 3", "Мат в 4": "Mate in 4", "Мат в 5+": "Mate in 5+",
  "Вилка": "Fork", "Связка": "Pin", "Двойной удар": "Double attack", "Завлечение": "Decoy",
  "Отвлечение": "Deflection", "Открытое нападение": "Discovered attack", "Жертва": "Sacrifice",
  "Эндшпиль": "Endgame", "Дебют": "Opening", "Миттельшпиль": "Middlegame",
  "Промежуточный ход": "Intermezzo", "Твоя ошибка": "Your mistake", "Двойной шах": "Double check",
  "Вскрытое нападение": "Discovered attack", "Дебютная ловушка": "Opening trap",
  "Продвинутая пешка": "Advanced pawn", "Атака на королевском": "Kingside attack",
  "Мат на последней горизонтали": "Back rank mate", "Висящая фигура": "Hanging piece",
  "Расчистка": "Clearance", "Слоновый эндшпиль": "Bishop endgame", "Открытый король": "Exposed king",
  "Перекрытие": "Interference", "Спасение": "Rescue", "Рентген": "Skewer", "Цугцванг": "Zugzwang",
  "Поймана фигура": "Trapped piece",
};

/** Английские названия для идентификаторов из TEMA, где «разобрать camelCase» дало бы не то. */
const TEMA_EN: Record<string, string> = {
  attackingF2F7: "Attacking f2/f7",
  blindSwineMate: "Blind swine mate",
  capturingDefender: "Capturing the defender",
  kingsideAttack: "Kingside attack",
  long: "Long combination",
  master: "Master game",
  advantage: "Gaining an advantage",
  crushing: "Crushing",
  equality: "Equality",
  "collinear move": "Collinear move",
  "defensive move": "Defensive move",
};

/** advancedPawn → «Advanced pawn». */
function razobratCamel(t: string): string {
  const s = t.replace(/([a-z])(\d)/g, "$1 $2").replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/\s+/g, " ").trim().toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Тема задачи на языке читателя. ru — прежний текст (temaZadachiRu); en/kk — английское имя без кириллицы, где оно известно. */
export function temaNaYazyke(t: string | undefined | null, locale: ZtYaz = "ru"): string {
  if (!t) return "";
  if (locale === "ru") return temaZadachiRu(t);
  if (Object.prototype.hasOwnProperty.call(TEMA_EN, t)) return TEMA_EN[t];
  if (Object.prototype.hasOwnProperty.call(TEMA_RU_V_EN, t)) return TEMA_RU_V_EN[t];
  if (/^[A-Za-z0-9 ]+$/.test(t)) return razobratCamel(t);
  return t;
}

/** Фаза партии на языке читателя. ru — прежний текст (fazaRu). */
export function fazaNaYazyke(f: string | undefined | null, locale: ZtYaz = "ru"): string {
  if (!f) return "";
  if (locale === "ru") return fazaRu(f);
  return FAZA_EN[f] ?? f;
}

/** Ход решения на языке читателя: ru — прежняя русская запись (hodPoRusski), en/kk — обычная SAN из chess.js («Qa4+»). */
export function hodNaYazyke(fen: string, uci: string, locale: ZtYaz = "ru"): string {
  if (locale === "ru") return hodPoRusski(fen, uci);
  if (!uci || uci.length < 4) return uci || "";
  try {
    const g = new Chess(fen);
    const mv = g.move({ from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square, promotion: (uci[4] as "q" | "r" | "b" | "n" | undefined) || undefined });
    return mv ? mv.san : uci;
  } catch {
    return uci;
  }
}
