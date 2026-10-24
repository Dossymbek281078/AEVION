/**
 * Перевод страницы /cyberchess/replays (24.10.2026: на /en 6 русских строк из 16 на первом экране).
 * Ключ — строка из кода, значения — недостающие языки. tt(lang, src): есть перевод — он, нет — исходник.
 * ⚠️ kk — черновой перевод, нужна вычитка носителя.
 */
type Tr = Partial<Record<"en" | "ru" | "kk", string>>;

export const REPLAYS_TEXT: Record<string, Tr> = {
  "только что": { en: "just now", kk: "жаңа ғана" },
  "сек назад": { en: "s ago", kk: "сек бұрын" },
  "мин назад": { en: "min ago", kk: "мин бұрын" },
  "ч назад": { en: "h ago", kk: "сағ бұрын" },
  "дн назад": { en: "d ago", kk: "күн бұрын" },
  "Победа": { en: "Win", kk: "Жеңіс" },
  "Поражение": { en: "Loss", kk: "Жеңіліс" },
  "Ничья": { en: "Draw", kk: "Тең ойын" },
  "Не удалось загрузить партии. Попробуйте обновить страницу.": { en: "Could not load the games. Try refreshing the page.", kk: "Ойындарды жүктеу мүмкін болмады. Бетті жаңартып көріңіз." },
  "Завершённые партии, доступные для пересмотра с покадровой навигацией и графиком оценки. Хранится до 50 последних трансляций.": { en: "Finished games you can rewatch move by move with an evaluation graph. Up to the last 50 broadcasts are kept.", kk: "Жүріс бойынша шарлау және бағалау графигімен қайта қарауға болатын аяқталған ойындар. Соңғы 50 трансляцияға дейін сақталады." },
  "Идут сейчас": { en: "Live now", kk: "Қазір жүріп жатыр" },
  "На главную": { en: "Home", kk: "Басты бетке" },
  "Сортировка:": { en: "Sort:", kk: "Сұрыптау:" },
  "Сначала новые": { en: "Newest first", kk: "Алдымен жаңалары" },
  "Самые длинные": { en: "Longest", kk: "Ең ұзақтары" },
  "Самые короткие": { en: "Shortest", kk: "Ең қысқалары" },
  "Обновить": { en: "Refresh", kk: "Жаңарту" },
  "Не удалось загрузить архив трансляций. Проверьте связь и обновите страницу — записи никуда не делись.": { en: "Could not load the broadcast archive. Check your connection and refresh the page — the records are not lost.", kk: "Трансляциялар мұрағатын жүктеу мүмкін болмады. Байланысты тексеріп, бетті жаңартыңыз — жазбалар жоғалған жоқ." },
  "Пока нет завершённых трансляций. Заверши партию — она появится здесь автоматически.": { en: "No finished broadcasts yet. Finish a game and it will appear here automatically.", kk: "Әзірге аяқталған трансляция жоқ. Ойынды аяқтаңыз — ол мұнда автоматты түрде пайда болады." },
  "Под текущий фильтр ничего не подходит.": { en: "Nothing matches the current filter.", kk: "Ағымдағы сүзгіге ештеңе сәйкес келмейді." },
  "Аноним": { en: "Anonymous", kk: "Анонім" },
  "Длительность": { en: "Duration", kk: "Ұзақтығы" },
  "Ходы": { en: "Moves", kk: "Жүрістер" },
  "Смотреть": { en: "Watch", kk: "Көру" },
};

export function tt(lang: string | undefined, src: string): string {
  const e = REPLAYS_TEXT[src];
  return (lang && e?.[lang as "en" | "ru" | "kk"]) || src;
}
