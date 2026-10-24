/**
 * Перевод страницы /cyberchess/spectator (24.10.2026: на /en 3 русские строки из 8 на пустом экране).
 * Ключ — строка из кода, значения — недостающие языки. tt(lang, src): есть перевод — он, нет — исходник.
 * ⚠️ kk — черновой перевод, нужна вычитка носителя.
 */
type Tr = Partial<Record<"en" | "ru" | "kk", string>>;

export const SPECTATOR_TEXT: Record<string, Tr> = {
  "только что": { en: "just now", kk: "жаңа ғана" },
  "сек назад": { en: "s ago", kk: "сек бұрын" },
  "мин назад": { en: "min ago", kk: "мин бұрын" },
  "ч назад": { en: "h ago", kk: "сағ бұрын" },
  "Не удалось загрузить список трансляций. Попробуйте позже.": { en: "Could not load the list of broadcasts. Please try later.", kk: "Трансляциялар тізімін жүктеу мүмкін болмады. Кейінірек көріңіз." },
  "Прямые трансляции партий CyberChess · обновление каждые 10 сек": { en: "Live broadcasts of CyberChess games · refreshed every 10 s", kk: "CyberChess ойындарының тікелей трансляциялары · әр 10 с сайын жаңарады" },
  "загружаем идущие партии…": { en: "loading live games…", kk: "тікелей ойындар жүктелуде…" },
  "Попросите друга включить трансляцию": { en: "Ask a friend to start a broadcast", kk: "Досыңыздан трансляцияны қосуды сұраңыз" },
  "в приложении": { en: "in the app", kk: "қолданбада" },
  "— значок 📡 в верхней панели.": { en: "— the 📡 icon in the top bar.", kk: "— жоғарғы панельдегі 📡 белгісі." },
  "Аноним": { en: "Anonymous", kk: "Анонім" },
  "рейтинг": { en: "rating", kk: "рейтинг" },
  "Последний ход": { en: "Last move", kk: "Соңғы жүріс" },
  "Ходов": { en: "Moves", kk: "Жүрістер" },
  "👀 Смотреть": { en: "👀 Watch", kk: "👀 Көру" },
};

export function tt(lang: string | undefined, src: string): string {
  const e = SPECTATOR_TEXT[src];
  return (lang && e?.[lang as "en" | "ru" | "kk"]) || src;
}
