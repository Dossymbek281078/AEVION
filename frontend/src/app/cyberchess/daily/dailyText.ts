/**
 * Перевод страницы /cyberchess/daily (24.10.2026: на /en 9 русских строк из 75 на первом экране, сообщения хода и подсказки — по-русски).
 * Ключ — строка из кода, значения — недостающие языки. tt(lang, src): есть перевод — он, нет — исходник.
 * ⚠️ kk — черновой перевод, нужна вычитка носителя.
 */
type Tr = Partial<Record<"en" | "ru" | "kk", string>>;

export const DAILY_TEXT: Record<string, Tr> = {
  "белый король": { en: "white king", kk: "ақ король" },
  "белый ферзь": { en: "white queen", kk: "ақ ферзь" },
  "белая ладья": { en: "white rook", kk: "ақ ладья" },
  "белый слон": { en: "white bishop", kk: "ақ піл" },
  "белый конь": { en: "white knight", kk: "ақ ат" },
  "белая пешка": { en: "white pawn", kk: "ақ пешка" },
  "чёрный король": { en: "black king", kk: "қара король" },
  "чёрный ферзь": { en: "black queen", kk: "қара ферзь" },
  "чёрная ладья": { en: "black rook", kk: "қара ладья" },
  "чёрный слон": { en: "black bishop", kk: "қара піл" },
  "чёрный конь": { en: "black knight", kk: "қара ат" },
  "чёрная пешка": { en: "black pawn", kk: "қара пешка" },
  "фигура": { en: "piece", kk: "фигура" },
  "пусто": { en: "empty", kk: "бос" },
  "выбрана": { en: "selected", kk: "таңдалды" },
  "возможный ход": { en: "legal move", kk: "мүмкін жүріс" },
  "игрок": { en: "player", kk: "ойыншы" },
  "Уже решено сегодня. Серия: {s}": { en: "Already solved today. Streak: {s}", kk: "Бүгін шешілді. Серия: {s}" },
  "Решено за {t} с подсказками ({h}). Серия не растёт, но и не сбрасывается: {s}.": { en: "Solved in {t} with hints ({h}). The streak does not grow, but it is not reset either: {s}.", kk: "{t} ішінде кеңестермен шешілді ({h}). Серия өспейді, бірақ нөлденбейді де: {s}." },
  "Поздравляем! Решено за {t}. Серия +1 = {s}. Рекорд: {b}": { en: "Congratulations! Solved in {t}. Streak +1 = {s}. Record: {b}", kk: "Құттықтаймыз! {t} ішінде шешілді. Серия +1 = {s}. Рекорд: {b}" },
  "Решено за {t} с подсказками ({h}). Серия не растёт: {s}.": { en: "Solved in {t} with hints ({h}). The streak does not grow: {s}.", kk: "{t} ішінде кеңестермен шешілді ({h}). Серия өспейді: {s}." },
  "Поздравляем! Решено за {t}. Серия: {s}.": { en: "Congratulations! Solved in {t}. Streak: {s}.", kk: "Құттықтаймыз! {t} ішінде шешілді. Серия: {s}." },
  "Сервер не засчитал решение. Попробуйте ещё раз.": { en: "The server did not accept the solution. Please try again.", kk: "Сервер шешімді есептемеді. Қайталап көріңіз." },
  "Невозможный ход. Попробуй другой.": { en: "Illegal move. Try another one.", kk: "Мүмкін емес жүріс. Басқасын көріңіз." },
  "Не тот ход для этой задачи. Ожидался другой. Попробуй ещё раз.": { en: "Not the right move for this puzzle. Another one was expected. Try again.", kk: "Бұл есепке дұрыс жүріс емес. Басқасы күтілген. Қайталап көріңіз." },
  "Верно. Бот отвечает...": { en: "Correct. The bot is replying...", kk: "Дұрыс. Бот жауап беруде..." },
  "Твой ход.": { en: "Your move.", kk: "Сіздің жүрісіңіз." },
  "Верно. Продолжай.": { en: "Correct. Keep going.", kk: "Дұрыс. Жалғастырыңыз." },
  "Подсказка 1/3: ищи ход в районе клетки {c}.": { en: "Hint 1/3: look for a move around square {c}.", kk: "Кеңес 1/3: жүрісті {c} шаршысының маңынан іздеңіз." },
  "Подсказка 2/3: ход начинается с {c}.": { en: "Hint 2/3: the move starts from {c}.", kk: "Кеңес 2/3: жүріс {c} шаршысынан басталады." },
  "Подсказка 3/3: полный ход — {m}.": { en: "Hint 3/3: the full move is {m}.", kk: "Кеңес 3/3: толық жүріс — {m}." },
  "Доска сброшена. Твой ход.": { en: "Board reset. Your move.", kk: "Тақта қалпына келтірілді. Сіздің жүрісіңіз." },
  "Я решил задачу дня на AEVION CyberChess, серия {s}! 🧩 #AEVION": { en: "I solved the puzzle of the day on AEVION CyberChess, streak {s}! 🧩 #AEVION", kk: "AEVION CyberChess-те күн есебін шештім, серия {s}! 🧩 #AEVION" },
  "Не удалось скопировать. Текст:": { en: "Could not copy. Text:", kk: "Көшіру мүмкін болмады. Мәтін:" },
  "🧩 Задача дня": { en: "🧩 Puzzle of the day", kk: "🧩 Күн есебі" },
  "Одна задача в день. Решай каждый день — держи серию. Многоходовые задачи: бот отвечает за противника.": { en: "One puzzle a day. Solve it every day to keep your streak. Multi-move puzzles: the bot plays the opponent's replies.", kk: "Күніне бір есеп. Күн сайын шешіп, серияны сақтаңыз. Көп жүрісті есептер: бот қарсыластың орнына жауап береді." },
  "Тема": { en: "Theme", kk: "Тақырып" },
  "Время": { en: "Time", kk: "Уақыт" },
  "Рейтинг": { en: "Rating", kk: "Рейтинг" },
  "Задача дня из общего банка — одна и та же у всех игроков сегодня": { en: "Puzzle of the day from the shared bank — the same for every player today", kk: "Ортақ банктен күн есебі — бүгін барлық ойыншыда бірдей" },
  "Резервная задача: банк задач не ответил, у других игроков сегодня может быть другая": { en: "Backup puzzle: the puzzle bank did not respond, other players may have a different one today", kk: "Резервтік есеп: есептер банкі жауап бермеді, басқа ойыншыларда бүгін басқасы болуы мүмкін" },
  "Шахматная доска задачи дня": { en: "Puzzle of the day chessboard", kk: "Күн есебінің шахмат тақтасы" },
  "Выбери фигуру для превращения": { en: "Choose a piece to promote to", kk: "Айналдыратын фигураны таңдаңыз" },
  "Отмена": { en: "Cancel", kk: "Болдырмау" },
  "3 уровня подсказки: район → клетка-начало → полный ход. Каждая тратит одну подсказку и снимает прибавку к серии за эту задачу.": { en: "3 hint levels: area → starting square → full move. Each one uses a hint and removes the streak bonus for this puzzle.", kk: "3 кеңес деңгейі: аймақ → бастапқы шаршы → толық жүріс. Әрқайсысы бір кеңесті жұмсап, осы есеп үшін серия қосымшасын алып тастайды." },
  "💡 Подсказка": { en: "💡 Hint", kk: "💡 Кеңес" },
  "↺ Сброс": { en: "↺ Reset", kk: "↺ Қалпына келтіру" },
  "✓ Скопировано!": { en: "✓ Copied!", kk: "✓ Көшірілді!" },
  "📤 Поделиться": { en: "📤 Share", kk: "📤 Бөлісу" },
  "Текущая серия": { en: "Current streak", kk: "Ағымдағы серия" },
  "Лучшая серия": { en: "Best streak", kk: "Үздік серия" },
  "Подсказки": { en: "Hints", kk: "Кеңестер" },
  "🏆 Лучшие серии — топ-100": { en: "🏆 Best streaks — top 100", kk: "🏆 Үздік сериялар — топ-100" },
  "Личный рекорд каждого игрока, а не серия на сегодня.": { en: "Each player's personal record, not today's streak.", kk: "Әр ойыншының жеке рекорды, бүгінгі серия емес." },
  "Загружаем таблицу…": { en: "Loading the table…", kk: "Кесте жүктелуде…" },
  "Таблицу не удалось загрузить. Это не значит, что она пуста — мы просто не смогли спросить сервер.": { en: "Could not load the table. That does not mean it is empty — we simply could not reach the server.", kk: "Кестені жүктеу мүмкін болмады. Бұл оның бос екенін білдірмейді — біз жай ғана серверге сұрау жібере алмадық." },
  "Сегодня задачу ещё никто не решил. Решите — и будете первым.": { en: "Nobody has solved today's puzzle yet. Solve it and be the first.", kk: "Бүгінгі есепті әлі ешкім шешкен жоқ. Шешіңіз — бірінші боласыз." },
};

export function tt(lang: string | undefined, src: string): string {
  const e = DAILY_TEXT[src];
  return (lang && e?.[lang as "en" | "ru" | "kk"]) || src;
}
