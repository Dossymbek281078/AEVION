/**
 * Перевод страницы /cyberchess/repertoire (24.10.2026: на /en 16 русских строк из 47).
 * Ключ — строка из кода, значения — недостающие языки. tt(lang, src): есть перевод — он, нет — исходник.
 * ⚠️ kk — черновой перевод, нужна вычитка носителя.
 */
type Tr = Partial<Record<"en" | "ru" | "kk", string>>;

export const REPERTOIRE_TEXT: Record<string, Tr> = {
  "← Вернуться в CyberChess": { en: "← Back to CyberChess", kk: "← CyberChess-ке оралу" },
  "Управление": { en: "Manage", kk: "Басқару" },
  "Поиск": { en: "Search", kk: "Іздеу" },
  "Сравнить": { en: "Compare", kk: "Салыстыру" },
  "Печать": { en: "Print", kk: "Басып шығару" },
  "Не удалось распарсить файл. Ожидается JSON, экспортированный отсюда.": { en: "Could not read the file. Expected a JSON exported from here.", kk: "Файлды оқу мүмкін болмады. Осы жерден экспортталған JSON күтіледі." },
  "Импортировать {n} веток? Текущий репертуар будет ЗАМЕНЁН.": { en: "Import {n} branches? The current repertoire will be REPLACED.", kk: "{n} тармақты импорттау керек пе? Ағымдағы репертуар АУЫСТЫРЫЛАДЫ." },
  "Импортировано: {n}": { en: "Imported: {n}", kk: "Импортталды: {n}" },
  "⬇ Экспорт JSON": { en: "⬇ Export JSON", kk: "⬇ JSON экспорттау" },
  "⬆ Импорт JSON": { en: "⬆ Import JSON", kk: "⬆ JSON импорттау" },
  "🖨 Печать страницы": { en: "🖨 Print page", kk: "🖨 Бетті басып шығару" },
  "Всего веток:": { en: "Total branches:", kk: "Барлық тармақ:" },
  "Поиск по веткам": { en: "Search branches", kk: "Тармақтар бойынша іздеу" },
  "Поиск по репертуару": { en: "Search the repertoire", kk: "Репертуар бойынша іздеу" },
  "ECO, имя, заметки, ходы…": { en: "ECO, name, notes, moves…", kk: "ECO, атау, жазбалар, жүрістер…" },
  "Найдено:": { en: "Found:", kk: "Табылды:" },
  "из": { en: "of", kk: "/" },
  "Ничего не найдено.": { en: "Nothing found.", kk: "Ештеңе табылмады." },
  "успех": { en: "success", kk: "сәттілік" },
  "попыток": { en: "attempts", kk: "әрекет" },
  "Для сравнения нужно минимум 2 ветки. Добавь ещё в режиме «Управление».": { en: "Comparing needs at least 2 branches. Add more in «Manage» mode.", kk: "Салыстыру үшін кемінде 2 тармақ керек. «Басқару» режимінде тағы қосыңыз." },
  "Сравнение веток": { en: "Branch comparison", kk: "Тармақтарды салыстыру" },
  "Ветка A": { en: "Branch A", kk: "A тармағы" },
  "Ветка B": { en: "Branch B", kk: "B тармағы" },
  "Попыток": { en: "Attempts", kk: "Әрекеттер" },
  "Успех": { en: "Success", kk: "Сәттілік" },
  "Грузим Lichess…": { en: "Loading Lichess…", kk: "Lichess жүктелуде…" },
  "игр": { en: "games", kk: "ойын" },
  "Топ ответы:": { en: "Top replies:", kk: "Үздік жауаптар:" },
  "Дебютный репертуар — печать": { en: "Opening repertoire — print", kk: "Дебют репертуары — басып шығару" },
  "Сгенерировано": { en: "Generated", kk: "Жасалды" },
  "Репертуар пуст.": { en: "The repertoire is empty.", kk: "Репертуар бос." },
  "(За белых)": { en: "(As White)", kk: "(Ақтар үшін)" },
  "(За чёрных)": { en: "(As Black)", kk: "(Қаралар үшін)" },
  "Успех:": { en: "Success:", kk: "Сәттілік:" },
};

export function tt(lang: string | undefined, src: string): string {
  const e = REPERTOIRE_TEXT[src];
  return (lang && e?.[lang as "en" | "ru" | "kk"]) || src;
}
