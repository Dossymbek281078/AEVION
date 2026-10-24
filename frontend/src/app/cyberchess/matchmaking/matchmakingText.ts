/**
 * Перевод страницы /cyberchess/matchmaking (24.10.2026: на /en 15 русских строк из 29 на первом экране).
 * Ключ — строка из кода, значения — недостающие языки. tt(lang, src): есть перевод — он, нет — исходник.
 * ⚠️ kk — черновой перевод, нужна вычитка носителя.
 */
type Tr = Partial<Record<"en" | "ru" | "kk", string>>;

export const MATCHMAKING_TEXT: Record<string, Tr> = {
  "Пуля · 1 мин": { en: "Bullet · 1 min", kk: "Буллет · 1 мин" },
  "Блиц · 3 мин": { en: "Blitz · 3 min", kk: "Блиц · 3 мин" },
  "Блиц · 5 мин + 5 сек": { en: "Blitz · 5 min + 5 sec", kk: "Блиц · 5 мин + 5 сек" },
  "Рапид · 10 мин + 10 сек": { en: "Rapid · 10 min + 10 sec", kk: "Рапид · 10 мин + 10 сек" },
  "Классика · 30 мин": { en: "Classical · 30 min", kk: "Классика · 30 мин" },
  "Время ожидания истекло. Попробуй ещё раз — возможно, нет соперников с похожим рейтингом.": { en: "The wait timed out. Try again — there may be no opponents with a similar rating right now.", kk: "Күту уақыты бітті. Қайталап көріңіз — ұқсас рейтингті қарсылас болмауы мүмкін." },
  "Слишком много попыток. Подожди минуту.": { en: "Too many attempts. Wait a minute.", kk: "Тым көп әрекет. Бір минут күтіңіз." },
  "Не удалось встать в очередь. Попробуй ещё раз через минуту.": { en: "Could not join the queue. Try again in a minute.", kk: "Кезекке тұру мүмкін болмады. Бір минуттан кейін қайталаңыз." },
  "Сеть недоступна:": { en: "Network unavailable:", kk: "Желі қолжетімсіз:" },
  "← Назад в CyberChess": { en: "← Back to CyberChess", kk: "← CyberChess-ке оралу" },
  "Поиск соперника": { en: "Find an opponent", kk: "Қарсылас іздеу" },
  "Подберём живого игрока с похожим рейтингом": { en: "We will match you with a live player with a similar rating", kk: "Ұқсас рейтингті тірі ойыншыны табамыз" },
  "и тем же контролем времени.": { en: "and the same time control.", kk: "және уақыт бақылауы бірдей." },
  "Таблица лидеров": { en: "Leaderboard", kk: "Көшбасшылар кестесі" },
  "История матчей": { en: "Match history", kk: "Матчтар тарихы" },
  "Параметры партии": { en: "Game settings", kk: "Ойын параметрлері" },
  "Ник": { en: "Nickname", kk: "Лақап ат" },
  "Игрок": { en: "Player", kk: "Ойыншы" },
  "Контроль времени": { en: "Time control", kk: "Уақыт бақылауы" },
  "Твой рейтинг": { en: "Your rating", kk: "Сіздің рейтингіңіз" },
  "Рейтинг": { en: "Rating", kk: "Рейтинг" },
  "партий": { en: "games", kk: "ойын" },
  "· неточный (мало партий)": { en: "· provisional (few games)", kk: "· нақты емес (ойын аз)" },
  "диапазон": { en: "range", kk: "ауқым" },
  "Рейтинг автоматически определён по твоим партиям": { en: "Your rating was estimated automatically from your games", kk: "Рейтинг ойындарыңыз бойынша автоматты анықталды" },
  "Можно скорректировать вручную.": { en: "You can adjust it manually.", kk: "Қолмен түзетуге болады." },
  "Кликни — встанешь в живую очередь. Найдём пару за 5–60 секунд.": { en: "Click to join the live queue. We find a match in 5–60 seconds.", kk: "Басыңыз — тірі кезекке тұрасыз. Жұпты 5–60 секундта табамыз." },
  "Встаём в очередь…": { en: "Joining the queue…", kk: "Кезекке тұрып жатырмыз…" },
  "Прошло:": { en: "Elapsed:", kk: "Өтті:" },
  "Ожидание ≈": { en: "Wait ≈", kk: "Күту ≈" },
  "Сервер не отвечает — поиск продолжается, но очередь сейчас не обновляется.": { en: "The server is not responding — the search continues, but the queue is not updating right now.", kk: "Сервер жауап бермейді — іздеу жалғасуда, бірақ кезек қазір жаңармайды." },
  "Прогресс ожидания": { en: "Wait progress", kk: "Күту барысы" },
  "ты играешь": { en: "you play", kk: "сіз ойнайсыз" },
  "белыми": { en: "white", kk: "ақтармен" },
  "чёрными": { en: "black", kk: "қаралармен" },
  "Переходим к доске…": { en: "Going to the board…", kk: "Тақтаға өтудеміз…" },
  "Ошибка": { en: "Error", kk: "Қате" },
  "Попробовать снова": { en: "Try again", kk: "Қайталау" },
  "Соперника нет? Сыграть с движком прямо сейчас →": { en: "No opponent? Play the engine right now →", kk: "Қарсылас жоқ па? Қазір қозғалтқышпен ойнаңыз →" },
  "Очередь не сохраняется: если перезагрузить страницу, поиск начнётся заново. Через 5 минут без действий мы выведем вас из очереди.": { en: "The queue is not saved: if you reload the page, the search starts over. After 5 minutes of inactivity we will remove you from the queue.", kk: "Кезек сақталмайды: бетті жаңартсаңыз, іздеу басынан басталады. 5 минут әрекетсіз болсаңыз, сізді кезектен шығарамыз." },
};

export function tt(lang: string | undefined, src: string): string {
  const e = MATCHMAKING_TEXT[src];
  return (lang && e?.[lang as "en" | "ru" | "kk"]) || src;
}
