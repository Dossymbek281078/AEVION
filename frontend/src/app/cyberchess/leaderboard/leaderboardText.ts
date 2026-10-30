/**
 * Перевод страницы /cyberchess/leaderboard (24.10.2026: на /en 7 русских строк из 13 на первом экране).
 * Ключ — строка из кода, значения — недостающие языки. tt(lang, src): есть перевод — он, нет — исходник.
 * ⚠️ kk — черновой перевод, нужна вычитка носителя.
 */
type Tr = Partial<Record<"en" | "ru" | "kk", string>>;

export const LEADERBOARD_TEXT: Record<string, Tr> = {
  "Пуля": { en: "Bullet", kk: "Буллет" },
  "Блиц": { en: "Blitz", kk: "Блиц" },
  "Рапид": { en: "Rapid", kk: "Рапид" },
  "Классика": { en: "Classical", kk: "Классика" },
  "Не удалось загрузить таблицу лидеров. Попробуйте позже.": { en: "Could not load the leaderboard. Please try later.", kk: "Көшбасшылар кестесін жүктеу мүмкін болмады. Кейінірек көріңіз." },
  "Рейтинг · онлайн-матчи": { en: "Rating · online matches", kk: "Рейтинг · онлайн матчтар" },
  "Монеты за онлайн-матчи": { en: "Coins for online matches", kk: "Онлайн матчтар үшін монеталар" },
  "Таблица лидеров по рейтингу": { en: "Rating leaderboard", kk: "Рейтинг бойынша көшбасшылар" },
  "Таблица лидеров по монетам": { en: "Coin leaderboard", kk: "Монеталар бойынша көшбасшылар" },
  "Топ игроков онлайн-матчей. Рейтинг считается по системе Glicko-2. Неточные рейтинги (сыграно мало партий) помечены «?».": { en: "Top players of online matches. Rating is calculated with Glicko-2. Provisional ratings (few games played) are marked «?».", kk: "Онлайн матчтардың үздік ойыншылары. Рейтинг Glicko-2 жүйесімен есептеледі. Нақты емес рейтингтер (ойын аз) «?» белгісімен." },
  "Топ игроков по заработанным в реальных матчах Chessy — не подделываемый через devtools.": { en: "Top players by Chessy earned in real matches — cannot be faked through devtools.", kk: "Нақты матчтарда тапқан Chessy бойынша үздік ойыншылар — devtools арқылы жасанды жасауға болмайды." },
  "← к шахматам": { en: "← to chess", kk: "← шахматқа" },
  "Рейтинг": { en: "Rating", kk: "Рейтинг" },
  "Загрузка…": { en: "Loading…", kk: "Жүктелуде…" },
  "Пока нет рейтинговых партий в этой скорости.": { en: "No rated games at this speed yet.", kk: "Бұл жылдамдықта әзірге рейтингтік ойын жоқ." },
  "Сыграть первым →": { en: "Be the first to play →", kk: "Бірінші болып ойнау →" },
  "Игрок": { en: "Player", kk: "Ойыншы" },
  "Партий": { en: "Games", kk: "Ойындар" },
  "В/П/Н": { en: "W/L/D", kk: "Ж/Ұ/Т" },
  "Пик": { en: "Peak", kk: "Шың" },
  "(вы)": { en: "(you)", kk: "(сіз)" },
  "Неточный рейтинг: сыграно мало партий": { en: "Provisional rating: few games played", kk: "Нақты емес рейтинг: ойын аз" },
  "Только с реальных онлайн-матчей (не с задач, уроков и косметики) — серверный кошелёк, честный по конструкции.": { en: "Only from real online matches (not puzzles, lessons or cosmetics) — a server-side wallet, honest by design.", kk: "Тек нақты онлайн матчтардан (есептерден, сабақтардан және косметикадан емес) — сервердегі әмиян, құрылымы бойынша адал." },
  "Пока никто не заработал Chessy в реальных матчах.": { en: "Nobody has earned Chessy in real matches yet.", kk: "Әзірге ешкім нақты матчтарда Chessy таппады." },
  "Баланс": { en: "Balance", kk: "Баланс" },
  "Заработано всего": { en: "Total earned", kk: "Барлығы табылды" },
};

export function tt(lang: string | undefined, src: string): string {
  const e = LEADERBOARD_TEXT[src];
  return (lang && e?.[lang as "en" | "ru" | "kk"]) || src;
}
