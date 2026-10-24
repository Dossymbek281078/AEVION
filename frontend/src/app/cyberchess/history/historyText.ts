/**
 * Перевод страницы /cyberchess/history (24.10.2026: на /en 6 русских строк из 7 на первом экране).
 * Ключ — строка из кода, значения — недостающие языки. tt(lang, src): есть перевод — он, нет — исходник.
 * ⚠️ kk — черновой перевод, нужна вычитка носителя.
 */
type Tr = Partial<Record<"en" | "ru" | "kk", string>>;

export const HISTORY_TEXT: Record<string, Tr> = {
  "Пуля": { en: "Bullet", kk: "Буллет" },
  "Блиц": { en: "Blitz", kk: "Блиц" },
  "Рапид": { en: "Rapid", kk: "Рапид" },
  "Классика": { en: "Classical", kk: "Классика" },
  "Не удалось загрузить историю. Попробуйте позже.": { en: "Could not load the history. Please try later.", kk: "Тарихты жүктеу мүмкін болмады. Кейінірек көріңіз." },
  "Онлайн-матчи": { en: "Online matches", kk: "Онлайн матчтар" },
  "История матчей": { en: "Match history", kk: "Матчтар тарихы" },
  "партий": { en: "games", kk: "ойын" },
  "побед": { en: "wins", kk: "жеңіс" },
  "поражений": { en: "losses", kk: "жеңіліс" },
  "ничьих": { en: "draws", kk: "тең ойын" },
  "Таблица лидеров": { en: "Leaderboard", kk: "Көшбасшылар кестесі" },
  "← к шахматам": { en: "← to chess", kk: "← шахматқа" },
  "Загрузка…": { en: "Loading…", kk: "Жүктелуде…" },
  "Пока нет сыгранных онлайн-матчей.": { en: "No online matches played yet.", kk: "Әзірге ойналған онлайн матч жоқ." },
  "Найти соперника →": { en: "Find an opponent →", kk: "Қарсылас табу →" },
  "пик": { en: "peak", kk: "шың" },
  "Соперник": { en: "Opponent", kk: "Қарсылас" },
  "Победа": { en: "Win", kk: "Жеңіс" },
  "Поражение": { en: "Loss", kk: "Жеңіліс" },
  "Ничья": { en: "Draw", kk: "Тең ойын" },
  "пол-ходов": { en: "plies", kk: "жарты жүріс" },
  "Реванш": { en: "Rematch", kk: "Реванш" },
};

export function tt(lang: string | undefined, src: string): string {
  const e = HISTORY_TEXT[src];
  return (lang && e?.[lang as "en" | "ru" | "kk"]) || src;
}
