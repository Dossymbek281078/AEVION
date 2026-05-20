/**
 * CyberChess scoped i18n — lightweight без next-intl Provider integration.
 *
 * Causes:
 *   1. Next-intl Provider требует [locale] route prefix, cyberchess работает на /cyberchess
 *   2. Не хочется тянуть Provider context в каждый client component
 *
 * Stack:
 *   - localStorage `aevion_locale` хранит выбор юзера
 *   - inline dictionary RU/EN/KK для CyberChess новых компонентов (Spectator/Replay/
 *     Matchmaking/FidePanel/AiPicker/Achievement/PlayerStats)
 *   - fallback: ru → key (если перевода нет)
 *
 * Use:
 *   const { t, locale } = useCcI18n();
 *   <h1>{t("spectator.hub.title")}</h1>
 */

import { useEffect, useState, useCallback } from "react";

export type CcLocale = "ru" | "en" | "kk";
export const DEFAULT_LOCALE: CcLocale = "ru";
const LOCALE_KEY = "aevion_locale";

export const SUPPORTED_LOCALES: { code: CcLocale; label: string; flag: string }[] = [
  { code: "ru", label: "Русский", flag: "🇷🇺" },
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "kk", label: "Қазақша", flag: "🇰🇿" },
];

const DICTIONARY: Record<CcLocale, Record<string, string>> = {
  ru: {
    // Spectator hub
    "spectator.hub.title":         "Трансляции",
    "spectator.hub.live":          "В эфире",
    "spectator.hub.empty":         "Никто не стримит сейчас",
    "spectator.hub.empty.hint":    "Попроси друга включить 📡 в /cyberchess",
    "spectator.hub.refresh":       "↻ Обновить",
    "spectator.hub.watch":         "Смотреть",
    "spectator.hub.viewers":       "зрителей",
    "spectator.hub.viewer":        "зритель",
    "spectator.hub.viewers_few":   "зрителя",
    "spectator.hub.back":          "← к шахматам",
    "spectator.hub.ago.sec":       "сек назад",
    "spectator.hub.ago.min":       "мин назад",
    "spectator.hub.ago.hr":        "ч назад",
    // Spectator viewer
    "spectator.viewer.connecting": "Подключение...",
    "spectator.viewer.live":       "🔴 LIVE",
    "spectator.viewer.offline":    "OFFLINE",
    "spectator.viewer.finished":   "FINISHED",
    "spectator.viewer.your_turn":  "ход",
    "spectator.viewer.back_all":   "← все трансляции",
    "spectator.viewer.back_main":  "к шахматам",
    "spectator.viewer.notice":     "режим наблюдателя · ходы недоступны",
    "spectator.viewer.result":     "🏁 Игра завершена:",
    // Spectator chat
    "chat.placeholder":            "Сообщение зрителям...",
    "chat.send":                   "Отправить",
    "chat.username.placeholder":   "Твоё имя",
    "chat.username.set":           "Выбрать имя",
    "chat.error.rate_limited":     "Слишком быстро — подожди",
    "chat.error.bad_text":         "Сообщение неверного формата",
    "chat.error.not_found":        "Стрим не найден",
    "chat.host_badge":             "👑 host",
    // Replay hub
    "replay.hub.title":            "Архив трансляций",
    "replay.hub.subtitle":         "Завершённые партии — посмотри как другие играли",
    "replay.hub.watch":            "▶ Смотреть",
    "replay.hub.empty":            "Архив пуст · кто-то должен завершить трансляцию",
    "replay.hub.filter.all":       "Все",
    "replay.hub.filter.wins":      "Победы",
    "replay.hub.filter.losses":    "Поражения",
    "replay.hub.filter.draws":     "Ничьи",
    "replay.hub.sort.latest":      "Свежие",
    "replay.hub.sort.longest":     "Длинные",
    "replay.hub.sort.shortest":    "Короткие",
    "replay.hub.duration":         "Длительность",
    "replay.hub.plies":            "Ходы",
    // Replay viewer
    "replay.viewer.share":         "Поделиться replay",
    "replay.viewer.copied":        "Скопировано ✓",
    "replay.viewer.back":          "← Назад к архиву",
    "replay.viewer.unavailable":   "Replay недоступен",
    "replay.viewer.result.win":    "Победа",
    "replay.viewer.result.loss":   "Поражение",
    "replay.viewer.result.draw":   "Ничья",
    // Matchmaking
    "match.title":                 "Найти соперника",
    "match.subtitle":              "Подбираем по рейтингу ±150 и формату времени",
    "match.username":              "Никнейм",
    "match.time_control":          "Контроль времени",
    "match.rating_range":          "Диапазон рейтинга",
    "match.search":                "🤝 Найти соперника",
    "match.searching":             "Ищем соперника...",
    "match.cancel":                "Покинуть очередь",
    "match.found":                 "Соперник найден!",
    "match.starting":              "Начинаем партию через 1.5с...",
    "match.timeout":               "Соперник не найден за 5 минут",
    "match.position":              "Позиция в очереди",
    "match.estimated":             "Примерное ожидание",
    "match.back":                  "← Назад в CyberChess",
    // FIDE panel
    "fide.title":                  "FIDE-калибровка",
    "fide.subtitle":               "Оценка силы игры по 6 CPI-факторам",
    "fide.current":                "Текущая оценка",
    "fide.range":                  "Диапазон",
    "fide.factors":                "Факторы",
    "fide.factor.accuracy":        "Точность ходов",
    "fide.factor.opening":         "Глубина дебюта",
    "fide.factor.tactical":        "Тактическая эффективность",
    "fide.factor.endgame":         "Техника эндшпиля",
    "fide.factor.blunder":         "Частота блундеров",
    "fide.factor.time":            "Управление временем",
    "fide.whatif":                 "Что если?",
    "fide.whatif.hint":            "Двигай слайдеры — увидь как изменится оценка",
    "fide.reset":                  "Сбросить",
    "fide.before":                 "Сейчас",
    "fide.after":                  "После",
    // AI personality picker
    "ai.title":                    "Стиль AI",
    "ai.subtitle":                 "Выбери личность — каждая играет по-своему",
    "ai.play_with":                "Играть с",
    "ai.selected":                 "ВЫБРАНО",
    "ai.already_selected":         "Уже выбран",
    "ai.style.aggressiveness":    "Атака",
    "ai.style.tactical":           "Тактика",
    "ai.style.positional":         "Позиция",
    "ai.style.endgame":            "Эндшпиль",
    "ai.elo_range":                "Уровень",
    "ai.quirks":                   "Особенности",
    // Achievement panel
    "ach.title":                   "🏆 Достижения",
    "ach.unlocked":                "получено",
    "ach.earned":                  "Chessy заработано",
    "ach.show_locked":             "Показывать закрытые",
    "ach.empty":                   "Нет достижений по этому фильтру",
    "ach.category.all":            "Все",
    "ach.category.games":          "Партии",
    "ach.category.puzzles":        "Пазлы",
    "ach.category.rating":         "Рейтинг",
    "ach.category.streak":         "Серии",
    "ach.category.explore":        "Открытия",
    "ach.category.skill":          "Мастерство",
    "ach.category.social":         "Сообщество",
    // Player stats dashboard
    "stats.title":                 "📊 Статистика игрока",
    "stats.tab.overview":          "Обзор",
    "stats.tab.openings":          "Дебюты",
    "stats.tab.timing":            "Время",
    "stats.tab.trend":             "Тренд",
    "stats.tab.calibration":       "FIDE",
    "stats.card.wins":             "Победы",
    "stats.card.losses":           "Поражения",
    "stats.card.draws":            "Ничьи",
    "stats.card.streak":           "Текущая серия",
    "stats.card.best_streak":      "Лучшая серия побед",
    "stats.card.login_streak":     "Login streak",
    "stats.card.avg_length":       "Средняя длина",
    "stats.card.peak_hour":        "Пиковый час",
  },
  en: {
    "spectator.hub.title":         "Live broadcasts",
    "spectator.hub.live":          "Live",
    "spectator.hub.empty":         "Nobody is streaming right now",
    "spectator.hub.empty.hint":    "Ask a friend to enable 📡 on /cyberchess",
    "spectator.hub.refresh":       "↻ Refresh",
    "spectator.hub.watch":         "Watch",
    "spectator.hub.viewers":       "viewers",
    "spectator.hub.viewer":        "viewer",
    "spectator.hub.viewers_few":   "viewers",
    "spectator.hub.back":          "← to chess",
    "spectator.hub.ago.sec":       "sec ago",
    "spectator.hub.ago.min":       "min ago",
    "spectator.hub.ago.hr":        "h ago",
    "spectator.viewer.connecting": "Connecting...",
    "spectator.viewer.live":       "🔴 LIVE",
    "spectator.viewer.offline":    "OFFLINE",
    "spectator.viewer.finished":   "FINISHED",
    "spectator.viewer.your_turn":  "to move",
    "spectator.viewer.back_all":   "← all broadcasts",
    "spectator.viewer.back_main":  "to chess",
    "spectator.viewer.notice":     "spectator mode · moves disabled",
    "spectator.viewer.result":     "🏁 Game ended:",
    "chat.placeholder":            "Message to viewers...",
    "chat.send":                   "Send",
    "chat.username.placeholder":   "Your name",
    "chat.username.set":           "Set name",
    "chat.error.rate_limited":     "Too fast — slow down",
    "chat.error.bad_text":         "Invalid message format",
    "chat.error.not_found":        "Stream not found",
    "chat.host_badge":             "👑 host",
    "replay.hub.title":            "Replay archive",
    "replay.hub.subtitle":         "Finished games — watch how others play",
    "replay.hub.watch":            "▶ Watch",
    "replay.hub.empty":            "Archive empty · someone needs to finish a stream",
    "replay.hub.filter.all":       "All",
    "replay.hub.filter.wins":      "Wins",
    "replay.hub.filter.losses":    "Losses",
    "replay.hub.filter.draws":     "Draws",
    "replay.hub.sort.latest":      "Latest",
    "replay.hub.sort.longest":     "Longest",
    "replay.hub.sort.shortest":    "Shortest",
    "replay.hub.duration":         "Duration",
    "replay.hub.plies":            "Plies",
    "replay.viewer.share":         "Share replay",
    "replay.viewer.copied":        "Copied ✓",
    "replay.viewer.back":          "← Back to archive",
    "replay.viewer.unavailable":   "Replay unavailable",
    "replay.viewer.result.win":    "Win",
    "replay.viewer.result.loss":   "Loss",
    "replay.viewer.result.draw":   "Draw",
    "match.title":                 "Find opponent",
    "match.subtitle":              "Matched by rating ±150 and time control",
    "match.username":              "Nickname",
    "match.time_control":          "Time control",
    "match.rating_range":          "Rating range",
    "match.search":                "🤝 Find opponent",
    "match.searching":             "Searching for opponent...",
    "match.cancel":                "Leave queue",
    "match.found":                 "Opponent found!",
    "match.starting":              "Starting game in 1.5s...",
    "match.timeout":               "No opponent found in 5 minutes",
    "match.position":              "Queue position",
    "match.estimated":             "Estimated wait",
    "match.back":                  "← Back to CyberChess",
    "fide.title":                  "FIDE calibration",
    "fide.subtitle":               "Strength estimate from 6 CPI factors",
    "fide.current":                "Current estimate",
    "fide.range":                  "Range",
    "fide.factors":                "Factors",
    "fide.factor.accuracy":        "Move accuracy",
    "fide.factor.opening":         "Opening theory depth",
    "fide.factor.tactical":        "Tactical efficiency",
    "fide.factor.endgame":         "Endgame technique",
    "fide.factor.blunder":         "Blunder rate",
    "fide.factor.time":            "Time management",
    "fide.whatif":                 "What if?",
    "fide.whatif.hint":            "Move sliders — see how estimate changes",
    "fide.reset":                  "Reset",
    "fide.before":                 "Now",
    "fide.after":                  "After",
    "ai.title":                    "AI style",
    "ai.subtitle":                 "Pick a personality — each plays differently",
    "ai.play_with":                "Play with",
    "ai.selected":                 "SELECTED",
    "ai.already_selected":         "Already selected",
    "ai.style.aggressiveness":    "Attack",
    "ai.style.tactical":           "Tactics",
    "ai.style.positional":         "Position",
    "ai.style.endgame":            "Endgame",
    "ai.elo_range":                "Level",
    "ai.quirks":                   "Quirks",
    "ach.title":                   "🏆 Achievements",
    "ach.unlocked":                "unlocked",
    "ach.earned":                  "Chessy earned",
    "ach.show_locked":             "Show locked",
    "ach.empty":                   "No achievements match this filter",
    "ach.category.all":            "All",
    "ach.category.games":          "Games",
    "ach.category.puzzles":        "Puzzles",
    "ach.category.rating":         "Rating",
    "ach.category.streak":         "Streaks",
    "ach.category.explore":        "Explore",
    "ach.category.skill":          "Skill",
    "ach.category.social":         "Social",
    "stats.title":                 "📊 Player stats",
    "stats.tab.overview":          "Overview",
    "stats.tab.openings":          "Openings",
    "stats.tab.timing":            "Timing",
    "stats.tab.trend":             "Trend",
    "stats.tab.calibration":       "FIDE",
    "stats.card.wins":             "Wins",
    "stats.card.losses":           "Losses",
    "stats.card.draws":            "Draws",
    "stats.card.streak":           "Current streak",
    "stats.card.best_streak":      "Best win streak",
    "stats.card.login_streak":     "Login streak",
    "stats.card.avg_length":       "Avg length",
    "stats.card.peak_hour":        "Peak hour",
  },
  kk: {
    "spectator.hub.title":         "Тікелей трансляциялар",
    "spectator.hub.live":          "Эфирде",
    "spectator.hub.empty":         "Қазір ешкім тарату жоқ",
    "spectator.hub.empty.hint":    "Досыңнан /cyberchess-те 📡 қосуын сұра",
    "spectator.hub.refresh":       "↻ Жаңарту",
    "spectator.hub.watch":         "Көру",
    "spectator.hub.viewers":       "көрермен",
    "spectator.hub.viewer":        "көрермен",
    "spectator.hub.viewers_few":   "көрермен",
    "spectator.hub.back":          "← шахматқа",
    "spectator.hub.ago.sec":       "с бұрын",
    "spectator.hub.ago.min":       "мин бұрын",
    "spectator.hub.ago.hr":        "сағ бұрын",
    "spectator.viewer.connecting": "Қосылуда...",
    "spectator.viewer.live":       "🔴 LIVE",
    "spectator.viewer.offline":    "OFFLINE",
    "spectator.viewer.finished":   "FINISHED",
    "spectator.viewer.your_turn":  "жүру",
    "spectator.viewer.back_all":   "← барлық трансляциялар",
    "spectator.viewer.back_main":  "шахматқа",
    "spectator.viewer.notice":     "бақылау режимі · жүрістер қол жетімді емес",
    "spectator.viewer.result":     "🏁 Ойын аяқталды:",
    "chat.placeholder":            "Көрермендерге хабар...",
    "chat.send":                   "Жіберу",
    "chat.username.placeholder":   "Атың",
    "chat.username.set":           "Аты қойылсын",
    "chat.error.rate_limited":     "Тым жылдам — баяула",
    "chat.error.bad_text":         "Хабар форматы дұрыс емес",
    "chat.error.not_found":        "Стрим табылмады",
    "chat.host_badge":             "👑 host",
    "replay.hub.title":            "Трансляция мұрағаты",
    "replay.hub.subtitle":         "Аяқталған ойындар — басқалар қалай ойнайды",
    "replay.hub.watch":            "▶ Көру",
    "replay.hub.empty":            "Мұрағат бос · біреу трансляцияны аяқтасын",
    "replay.hub.filter.all":       "Барлығы",
    "replay.hub.filter.wins":      "Жеңістер",
    "replay.hub.filter.losses":    "Жеңілістер",
    "replay.hub.filter.draws":     "Тең",
    "replay.hub.sort.latest":      "Жаңалары",
    "replay.hub.sort.longest":     "Ұзыны",
    "replay.hub.sort.shortest":    "Қысқасы",
    "replay.hub.duration":         "Ұзақтығы",
    "replay.hub.plies":            "Жүрістер",
    "replay.viewer.share":         "Replay-мен бөлісу",
    "replay.viewer.copied":        "Көшірілді ✓",
    "replay.viewer.back":          "← Мұрағатқа",
    "replay.viewer.unavailable":   "Replay қол жетімсіз",
    "replay.viewer.result.win":    "Жеңіс",
    "replay.viewer.result.loss":   "Жеңіліс",
    "replay.viewer.result.draw":   "Тең",
    "match.title":                 "Қарсыласты табу",
    "match.subtitle":              "Рейтинг ±150 және уақыт бойынша",
    "match.username":              "Лақап ат",
    "match.time_control":          "Уақыт бақылауы",
    "match.rating_range":          "Рейтинг диапазоны",
    "match.search":                "🤝 Қарсыласты табу",
    "match.searching":             "Қарсылас іздеуде...",
    "match.cancel":                "Кезектен шығу",
    "match.found":                 "Қарсылас табылды!",
    "match.starting":              "1.5с-та ойын басталады...",
    "match.timeout":               "5 минутта қарсылас табылмады",
    "match.position":              "Кезек орны",
    "match.estimated":             "Шамамен күту",
    "match.back":                  "← CyberChess-ке",
    "fide.title":                  "FIDE-калибрлеу",
    "fide.subtitle":               "6 CPI факторы бойынша күш бағасы",
    "fide.current":                "Ағымдағы баға",
    "fide.range":                  "Диапазон",
    "fide.factors":                "Факторлар",
    "fide.factor.accuracy":        "Жүрістердің дәлдігі",
    "fide.factor.opening":         "Дебют теориясы тереңдігі",
    "fide.factor.tactical":        "Тактикалық тиімділік",
    "fide.factor.endgame":         "Эндшпиль техникасы",
    "fide.factor.blunder":         "Блундер жиілігі",
    "fide.factor.time":            "Уақытты басқару",
    "fide.whatif":                 "Егер...?",
    "fide.whatif.hint":            "Слайдерлерді жылжыт — баға қалай өзгереді",
    "fide.reset":                  "Тастау",
    "fide.before":                 "Қазір",
    "fide.after":                  "Кейін",
    "ai.title":                    "AI стилі",
    "ai.subtitle":                 "Бейнені таңда — әрқайсы өзінше ойнайды",
    "ai.play_with":                "Бейнемен ойнау:",
    "ai.selected":                 "ТАҢДАЛҒАН",
    "ai.already_selected":         "Таңдалған",
    "ai.style.aggressiveness":    "Шабуыл",
    "ai.style.tactical":           "Тактика",
    "ai.style.positional":         "Позиция",
    "ai.style.endgame":            "Эндшпиль",
    "ai.elo_range":                "Деңгей",
    "ai.quirks":                   "Ерекшеліктер",
    "ach.title":                   "🏆 Жетістіктер",
    "ach.unlocked":                "ашылған",
    "ach.earned":                  "Chessy табылды",
    "ach.show_locked":             "Жабылғандарды көрсету",
    "ach.empty":                   "Бұл сүзгіге сай жетістік жоқ",
    "ach.category.all":            "Барлығы",
    "ach.category.games":          "Партиялар",
    "ach.category.puzzles":        "Жұмбақтар",
    "ach.category.rating":         "Рейтинг",
    "ach.category.streak":         "Тізбектер",
    "ach.category.explore":        "Зерттеу",
    "ach.category.skill":          "Шеберлік",
    "ach.category.social":         "Қауымдастық",
    "stats.title":                 "📊 Ойыншы статистикасы",
    "stats.tab.overview":          "Шолу",
    "stats.tab.openings":          "Дебюттер",
    "stats.tab.timing":            "Уақыт",
    "stats.tab.trend":             "Үрдіс",
    "stats.tab.calibration":       "FIDE",
    "stats.card.wins":             "Жеңістер",
    "stats.card.losses":           "Жеңілістер",
    "stats.card.draws":            "Тең",
    "stats.card.streak":           "Ағымдағы серия",
    "stats.card.best_streak":      "Ең жақсы серия",
    "stats.card.login_streak":     "Login серия",
    "stats.card.avg_length":       "Орт. ұзындық",
    "stats.card.peak_hour":        "Шың сағат",
  },
};

export function loadLocale(): CcLocale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const stored = localStorage.getItem(LOCALE_KEY);
    if (stored === "ru" || stored === "en" || stored === "kk") return stored;
  } catch {}
  // Auto-detect by browser navigator.language prefix
  try {
    const nav = navigator.language?.slice(0, 2).toLowerCase();
    if (nav === "ru" || nav === "en" || nav === "kk") return nav as CcLocale;
    if (nav === "kz") return "kk";
  } catch {}
  return DEFAULT_LOCALE;
}

export function saveLocale(locale: CcLocale): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCALE_KEY, locale);
    // Broadcast change to all useCcI18n hooks in this tab
    window.dispatchEvent(new CustomEvent("cc-locale-changed", { detail: locale }));
  } catch {}
}

export function tFor(locale: CcLocale, key: string): string {
  return DICTIONARY[locale]?.[key] ?? DICTIONARY[DEFAULT_LOCALE]?.[key] ?? key;
}

/** React hook — reactive locale + t() function. */
export function useCcI18n() {
  const [locale, setLocaleState] = useState<CcLocale>(DEFAULT_LOCALE);

  useEffect(() => {
    setLocaleState(loadLocale());
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as CcLocale | undefined;
      if (detail) setLocaleState(detail);
      else setLocaleState(loadLocale());
    };
    window.addEventListener("cc-locale-changed", handler as EventListener);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("cc-locale-changed", handler as EventListener);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const t = useCallback((key: string) => tFor(locale, key), [locale]);
  const setLocale = useCallback((l: CcLocale) => { saveLocale(l); setLocaleState(l); }, []);

  return { t, locale, setLocale };
}
