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
    // 30.09.2026: две подписи ушли из кода в словарь — сторож attrI18n считал их
    // русским текстом на переводимой странице, и он прав: на английском экране
    // они оставались русскими. Дата запуска здесь НЕ пишется — её подставляет
    // page.tsx из CHESS_LAUNCH_UTC и убирает, когда день прошёл.
    "wl.launch.title": "Полный запуск CyberChess",
    "buy.card.title": "Оплата картой · открывает «Глубокий анализ» (Stockfish NNUE)",
    // Категории контроля времени (первый экран выбора игры). Были хардкодом в
    // page.tsx — теперь через словарь, чтобы следовать выбранному языку.
    "tc.bullet": "Пуля", "tc.blitz": "Блиц", "tc.rapid": "Рапид", "tc.custom": "Свой",
    // Первые два экрана доски. Были жёстко вписаны в page.tsx и потому
    // оставались русскими на любом языке. Вынесены в словарь 05.10.2026:
    // модуль продаётся федерации Казахстана, и «работает на казахском» должно
    // быть правдой на экране, а не в списке языков.
    // Карточки «С чего начать» и «Чего нет у конкурентов» — первый и второй
    // экраны хаба. Были жёстко русскими.
    "start.title": "С чего начать",
    "start.game.title": "Сыграй первую партию",
    "start.game.desc": "Соперник любого уровня — от Новичка до полной силы движка. 5 секунд до старта.",
    "start.game.cta": "Начать",
    "start.puzzle.title": "Реши задачу",
    "start.puzzle.descHead": "Тактика на 1–5 ходов.",
    // Русский хвост этой подписи собирается склонением (ccPlural) и потому
    // остаётся в коде: «502 584 задачи» против «задач» — разные формы, и
    // одним ключом их не покрыть. Для остальных языков склонения не нужно.
    "start.puzzle.solved": "Решено {n}",
    "start.puzzle.bank": "{n} задач в банке.",
    "start.puzzle.bankHalf": "Полмиллиона задач в банке.",
    "start.puzzle.cta": "К задачам",
    "start.coach.title": "Спроси тренера",
    "start.coach.desc": "ИИ-тренер разберёт партию, объяснит план, подскажет ход.",
    "start.coach.cta": "Открыть",
    "start.daily.title": "Задача дня",
    "start.daily.desc": "Одна задача каждый день. Серия, таблица лидеров, награды.",
    "start.daily.cta": "Сегодня",
    "killer.title": "Чего нет у конкурентов",
    "killer.sections": "Все разделы",
    "killer.tournaments.title": "Турниры онлайн",
    "killer.tournaments.desc": "Швейцарская · круговой · нокаут. Призовой фонд в Chessy.",
    "killer.tournaments.cta": "К турнирам",
    "killer.cpi.title": "CPI рейтинг",
    "killer.cpi.desc": "Составной рейтинг по 11 факторам — такого нет ни у lichess, ни у chess.com.",
    "killer.cpi.cta": "Открыть",
    "killer.economy.title": "Chessy Экономика",
    "killer.economy.desc": "Аукцион, аренда коуча, подписки на стримеров на нашей валюте. Пока превью замысла — скоро.",
    "killer.economy.cta": "Смотреть",
    "killer.variants.title": "12 вариантов",
    "killer.variants.desc": "Атомные · Шахматы Фишера · Царь горы · Крейзихаус · Только кони и др.",
    "killer.variants.cta": "Выбрать",
    "mode.quick": "Быстрый матч",
    "mode.quick.sub": "ИИ ≈ {n}",
    "mode.two": "Два игрока",
    "mode.two.sub": "один экран",
    "mode.online": "Онлайн-матч",
    "mode.online.sub": "реальный соперник",
    "stats.rating": "Рейтинг",
    "stats.winrate": "Процент побед",
    "stats.nogames": "Пока нет игр",
    "stats.total": "Всего {n}",
    "stats.achievements": "Достижения",
    "more.title": "А ещё",
    "chip.lichessDaily": "Задача дня · Lichess",
    "chip.classics": "Классика",
    "chip.rating": "Рейтинг",
    "chip.history": "История",
    "chip.history.aria": "История онлайн-матчей",
    // Названия уровней ИИ. Ключ — поле name из таблицы ALS в нижнем регистре.
    "ai.beginner": "Новичок",
    "ai.casual": "Любитель",
    "ai.club": "Клубный",
    "ai.advanced": "Продвинутый",
    "ai.expert": "Эксперт",
    "ai.master": "Мастер",
    "ai.stockfish": "Stockfish",
    "tc.approxMin": "≈ {n} мин",
    "ai.label": "ИИ",
    "chip.analysis": "Анализ",
    // Подписи-атрибуты (title, aria-label) идут ЧЕРЕЗ СЛОВАРЬ, а не строкой
    // в разметке: сторож attrI18n считает кириллицу в атрибутах долгом, и
    // число ему разрешено только уменьшаться. Заодно эти подписи читает
    // человек со скринридером — им тоже нужен его язык.
    "coach.askAboutPuzzle": "Открыть эту позицию у ИИ-тренера и спросить о ней",
    "coach.fenField": "FEN позиции",
    "nav.coach": "Тренер",
    // Нижняя навигация на телефоне подписана короче, чем кнопка в шапке.
    // Разные ключи намеренно: иначе русский интерфейс менялся бы вместе с переводом.
    "nav.coachShort": "Коуч",
    "nav.more": "Ещё",
    "nav.play": "Играть",
    "nav.puzzles": "Задачи",
    "nav.analysis": "Анализ",
    "nav.profile": "Профиль",
    "board.cta.start": "Нажмите доску — начнём партию",
    "board.premoves": "Премувы",
    "side.color": "Цвет",
    "side.white": "Белые",
    "side.black": "Чёрные",
    "goals.title": "Цели на сегодня",
    "goals.done": "выполнено",
    "goals.play": "Сыграй {n}",
    "goals.solve": "Реши {n} задач",
    "goals.opencoach": "Открой тренера",
    "goals.daily": "Задача дня",
    "game.unfinished": "Незавершённая партия",
    "game.continue": "Продолжить",
    "game.cancel": "Отмена",
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
    "spectator.viewer.live":       "🔴 В ЭФИРЕ",
    "spectator.viewer.offline":    "НЕ В ЭФИРЕ",
    "spectator.viewer.finished":   "ЗАВЕРШЕНА",
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
    "chat.host_badge":             "👑 ведущий",
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
    "match.p2p_live":              "🔴 ИГРА НАПРЯМУЮ",
    "match.p2p_badge":             "⚔ P2P",
    // Anti-cheat panel
    "ac.title":                    "Анти-чит анализ",
    "ac.verdict.clean":            "Чисто",
    "ac.verdict.unusual":          "Нестандартно",
    "ac.verdict.suspicious":       "Подозрительно",
    "ac.verdict.flagged":          "Нарушение",
    "ac.fen_copy":                 "FEN скопирован!",
    "ac.confidence.insufficient":  "Мало данных",
    "ac.confidence.low":           "Низкая уверенность",
    "ac.confidence.medium":        "Средняя уверенность",
    "ac.confidence.high":          "Высокая уверенность",
    "ac.session_games":            "партий в сессии",
    // OBS overlay
    "obs.title":                   "OBS оверлей",
    "obs.copied":                  "Скопировано!",
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
    "fide.factor.blunder":         "Частота зевков",
    "fide.factor.time":            "Управление временем",
    "fide.whatif":                 "Что если?",
    "fide.whatif.hint":            "Двигай слайдеры — увидь как изменится оценка",
    "fide.reset":                  "Сбросить",
    "fide.before":                 "Сейчас",
    "fide.after":                  "После",
    "fide.calib.badge":            "Калибровано",
    "fide.calib.floor_active":     "GM-точная",
    "fide.calib.floor_inactive":   "не активна",
    "fide.calib.tooltip_source":   "Источник",
    "fide.calib.tooltip_samples":  "Партий в обучении",
    "fide.calib.tooltip_features": "Признаков модели",
    "fide.calib.tooltip_rmse":     "Средняя ошибка",
    "fide.calib.tooltip_r2":       "Объяснённая дисперсия R²",
    "fide.calib.tooltip_floor":    "Спец-модель высокого уровня",
    // AI personality picker
    "ai.title":                    "Стиль ИИ",
    "ai.picker_label":             "Выбор стиля соперника",
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
    "stats.card.login_streak":     "Серия заходов",
    "stats.card.avg_length":       "Средняя длина",
    "stats.card.peak_hour":        "Пиковый час",
    // Common shared
    "common.close":                "Закрыть",
    // Clock Pressure Drill
    "drill.correct_count":         "Правильных ответов",
    "drill.accuracy":              "Точность",
    "drill.best_streak":           "Лучшая серия",
    "drill.restart":               "Заново",
    "drill.no_puzzles":            "Пазлы не загружены. Загрузите базу пазлов.",
    "drill.theme":                 "Тема",
    "drill.choose_piece":          "Выберите фигуру и ход",
    "drill.selected":              "Выбрано",
    "drill.click_target":          "→ кликните цель",
    "drill.correct":               "✓ Верно! +1",
    "drill.wrong":                 "✗ Неверно. Правильно:",
    "drill.timeout":               "⏱ Время вышло! Ответ:",
    // Mirror Mode panel
    "mirror.studied":              "ИИ изучил твои последние партии",
    "mirror.no_data":              "Нет данных об играх",
    "mirror.plays_like_you":       "играет как ты",
    "mirror.need_games":           "Нужно 5+ партий для анализа",
    "mirror.depth":                "Глубина",
    "mirror.fav_opening":          "Любимый дебют:",
    "mirror.unknown":              "нет данных",
    // Opening Flash Card
    "flash.know_theory":           "Знаешь теорию этого дебюта?",
    "flash.continuation":          "продолжение по теории:",
    // Уведомление о лицензии движка. GPLv3 требует назвать лицензию и дать
    // доступ к исходникам ИМЕННО той сборки, которую мы раздаём. Ссылка ведёт
    // на nmrugg/stockfish.js (производная от Stockfish), а не на официальный
    // Stockfish: по ссылке человек должен найти тот код, из которого собраны
    // наши файлы. Тег подтверждён у источника: v18.0.0, «Stockfish 18».
    "engine.license": "Шахматные движки — Stockfish.js и lila-stockfish-web, производные от Stockfish. Лицензии, версии и исходный код:",
    "engine.license.copy": "лицензии движков",
    "flash.on_my_own":             "Продолжаю сам 💪",
    "flash.show_theory":           "Покажи теорию 📚",
  },
  en: {
    "wl.launch.title": "CyberChess full launch",
    "buy.card.title": "Card payment · unlocks Deep analysis (Stockfish NNUE)",
    "tc.bullet": "Bullet", "tc.blitz": "Blitz", "tc.rapid": "Rapid", "tc.custom": "Custom",
    "start.title": "Where to start",
    "start.game.title": "Play your first game",
    "start.game.desc": "An opponent at any level — from Beginner to full engine strength. Five seconds to start.",
    "start.game.cta": "Start",
    "start.puzzle.title": "Solve a puzzle",
    "start.puzzle.descHead": "Tactics in 1–5 moves.",
    "start.puzzle.solved": "{n} solved",
    "start.puzzle.bank": "{n} puzzles in the bank.",
    "start.puzzle.bankHalf": "Half a million puzzles in the bank.",
    "start.puzzle.cta": "To puzzles",
    "start.coach.title": "Ask the coach",
    "start.coach.desc": "The AI coach reviews your game, explains the plan and suggests a move.",
    "start.coach.cta": "Open",
    "start.daily.title": "Puzzle of the day",
    "start.daily.desc": "One puzzle every day. Streak, leaderboard, rewards.",
    "start.daily.cta": "Today",
    "killer.title": "What competitors do not have",
    "killer.sections": "All sections",
    "killer.tournaments.title": "Online tournaments",
    "killer.tournaments.desc": "Swiss · round robin · knockout. Prize fund in Chessy.",
    "killer.tournaments.cta": "To tournaments",
    "killer.cpi.title": "CPI rating",
    "killer.cpi.desc": "A composite rating across 11 factors — neither lichess nor chess.com has one.",
    "killer.cpi.cta": "Open",
    "killer.economy.title": "Chessy Economy",
    "killer.economy.desc": "Auction, coach rental, streamer subscriptions in our currency. A preview of the idea for now — soon.",
    "killer.economy.cta": "Take a look",
    "killer.variants.title": "12 variants",
    "killer.variants.desc": "Atomic · Fischer Random · King of the Hill · Crazyhouse · Knights only and more.",
    "killer.variants.cta": "Choose",
    "mode.quick": "Quick match",
    "mode.quick.sub": "AI ≈ {n}",
    "mode.two": "Two players",
    "mode.two.sub": "one screen",
    "mode.online": "Online match",
    "mode.online.sub": "a real opponent",
    "stats.rating": "Rating",
    "stats.winrate": "Win rate",
    "stats.nogames": "No games yet",
    "stats.total": "Total {n}",
    "stats.achievements": "Achievements",
    "more.title": "And more",
    "chip.lichessDaily": "Puzzle of the day · Lichess",
    "chip.classics": "Classics",
    "chip.rating": "Rating",
    "chip.history": "History",
    "chip.history.aria": "Online match history",
    "ai.beginner": "Beginner",
    "ai.casual": "Casual",
    "ai.club": "Club",
    "ai.advanced": "Advanced",
    "ai.expert": "Expert",
    "ai.master": "Master",
    "ai.stockfish": "Stockfish",
    "tc.approxMin": "≈ {n} min",
    "ai.label": "AI",
    "chip.analysis": "Analysis",
    "coach.askAboutPuzzle": "Open this position with the AI coach and ask about it",
    "coach.fenField": "Position FEN",
    "nav.coach": "Coach",
    "nav.coachShort": "Coach",
    "nav.more": "More",
    "nav.play": "Play",
    "nav.puzzles": "Puzzles",
    "nav.analysis": "Analysis",
    "nav.profile": "Profile",
    "board.cta.start": "Tap the board — let's play",
    "board.premoves": "Premoves",
    "side.color": "Color",
    "side.white": "White",
    "side.black": "Black",
    "goals.title": "Today's goals",
    "goals.done": "done",
    "goals.play": "Play {n}",
    "goals.solve": "Solve {n} puzzles",
    "goals.opencoach": "Open the coach",
    "goals.daily": "Puzzle of the day",
    "game.unfinished": "Unfinished game",
    "game.continue": "Continue",
    "game.cancel": "Cancel",
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
    "match.p2p_live":              "P2P LIVE",
    "match.p2p_badge":             "⚔ P2P",
    // Anti-cheat panel
    "ac.title":                    "Anti-cheat analysis",
    "ac.verdict.clean":            "Clean",
    "ac.verdict.unusual":          "Unusual",
    "ac.verdict.suspicious":       "Suspicious",
    "ac.verdict.flagged":          "Flagged",
    "ac.fen_copy":                 "FEN copied!",
    "ac.confidence.insufficient":  "Insufficient data",
    "ac.confidence.low":           "Low confidence",
    "ac.confidence.medium":        "Medium confidence",
    "ac.confidence.high":          "High confidence",
    "ac.session_games":            "games in session",
    // OBS overlay
    "obs.title":                   "OBS overlay",
    "obs.copied":                  "Copied!",
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
    "fide.calib.badge":            "Calibrated",
    "fide.calib.floor_active":     "GM-precise",
    "fide.calib.floor_inactive":   "inactive",
    "fide.calib.tooltip_source":   "Source",
    "fide.calib.tooltip_samples":  "Training games",
    "fide.calib.tooltip_features": "Model features",
    "fide.calib.tooltip_rmse":     "Mean error",
    "fide.calib.tooltip_r2":       "Explained variance R²",
    "fide.calib.tooltip_floor":    "High-Elo specialist",
    "ai.title":                    "AI style",
    "ai.picker_label":             "Choose opponent style",
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
    // Common shared
    "common.close":                "Close",
    // Clock Pressure Drill
    "drill.correct_count":         "Correct answers",
    "drill.accuracy":              "Accuracy",
    "drill.best_streak":           "Best streak",
    "drill.restart":               "Restart",
    "drill.no_puzzles":            "No puzzles loaded. Load a puzzle database.",
    "drill.theme":                 "Theme",
    "drill.choose_piece":          "Pick a piece and a move",
    "drill.selected":              "Selected",
    "drill.click_target":          "→ click target",
    "drill.correct":               "✓ Correct! +1",
    "drill.wrong":                 "✗ Wrong. Correct:",
    "drill.timeout":               "⏱ Time's up! Answer:",
    // Mirror Mode panel
    "mirror.studied":              "AI studied your recent games",
    "mirror.no_data":              "No game data",
    "mirror.plays_like_you":       "plays like you",
    "mirror.need_games":           "Need 5+ games for analysis",
    "mirror.depth":                "Depth",
    "mirror.fav_opening":          "Favorite opening:",
    "mirror.unknown":              "no data",
    // Opening Flash Card
    "flash.know_theory":           "Know the theory for this opening?",
    "flash.continuation":          "theory continuation:",
    "engine.license": "Chess engines — Stockfish.js and lila-stockfish-web, derived from Stockfish. Licences, versions and source code:",
    "engine.license.copy": "engine licences",
    "flash.on_my_own":             "I'll continue 💪",
    "flash.show_theory":           "Show theory 📚",
  },
  kk: {
    "wl.launch.title": "CyberChess толық іске қосылуы",
    "buy.card.title": "Картамен төлеу · «Терең талдауды» ашады (Stockfish NNUE)",
    // 🔴 ЭТИХ ЧЕТЫРЁХ КЛЮЧЕЙ ЗДЕСЬ НЕ БЫЛО до 05.10.2026, и пропуск не падал,
    // а ТИХО откатывался на русский: человек выбирал «Қазақша» и видел
    // «Пуля · Блиц · Рапид · Свой». Замер того дня: при выбранном KZ из 57
    // текстовых элементов страницы казахские буквы были ровно в ОДНОМ.
    "tc.bullet": "Оқ", "tc.blitz": "Блиц", "tc.rapid": "Рапид", "tc.custom": "Өзімдікі",
    // ⚠️ ПЕРЕВОД ЧЕРНОВОЙ — НУЖНА ВЫЧИТКА НОСИТЕЛЯ ЯЗЫКА.
    // Сделан окном 61 05.10.2026 под письмо в федерацию и НЕ проверен казахоязычным
    // человеком. Список для вычитки одним файлом:
    // Desktop/АЕВИОН/01-CyberChess/2026-10-05-КАЗАХСКИЙ-на-вычитку.md
    // Шахматные термины — главный риск: «Оқ» для пули и «Алдын ала жүрістер» для
    // премувов могут быть не теми словами, которыми пользуются тренеры в Казахстане.
    "start.title": "Неден бастау керек",
    "start.game.title": "Алғашқы ойыныңды ойна",
    "start.game.desc": "Кез келген деңгейдегі қарсылас — Жаңадан бастаушыдан қозғалтқыштың толық күшіне дейін. Бастауға бес секунд.",
    "start.game.cta": "Бастау",
    "start.puzzle.title": "Есеп шығар",
    "start.puzzle.descHead": "1–5 жүрістегі тактика.",
    "start.puzzle.solved": "{n} шығарылды",
    "start.puzzle.bank": "Банкте {n} есеп.",
    "start.puzzle.bankHalf": "Банкте жарты миллион есеп.",
    "start.puzzle.cta": "Есептерге",
    "start.coach.title": "Жаттықтырушыдан сұра",
    "start.coach.desc": "ЖИ-жаттықтырушы ойынды талдайды, жоспарды түсіндіреді, жүрісті ұсынады.",
    "start.coach.cta": "Ашу",
    "start.daily.title": "Күннің есебі",
    "start.daily.desc": "Күн сайын бір есеп. Топтама, көшбасшылар кестесі, сыйлықтар.",
    "start.daily.cta": "Бүгін",
    "killer.title": "Бәсекелестерде жоқ нәрсе",
    "killer.sections": "Барлық бөлімдер",
    "killer.tournaments.title": "Онлайн турнирлер",
    "killer.tournaments.desc": "Швейцариялық · айналма · нокаут. Жүлде қоры Chessy-де.",
    "killer.tournaments.cta": "Турнирлерге",
    "killer.cpi.title": "CPI рейтингі",
    "killer.cpi.desc": "11 фактор бойынша құрама рейтинг — мұндай lichess-те де, chess.com-да да жоқ.",
    "killer.cpi.cta": "Ашу",
    "killer.economy.title": "Chessy Экономикасы",
    "killer.economy.desc": "Аукцион, жаттықтырушы жалдау, стримерлерге жазылу — біздің валютамызда. Әзірге идеяның алдын ала нұсқасы — жақында.",
    "killer.economy.cta": "Қарау",
    "killer.variants.title": "12 нұсқа",
    "killer.variants.desc": "Атомдық · Фишер шахматы · Төбе патшасы · Крейзихаус · Тек аттар және т.б.",
    "killer.variants.cta": "Таңдау",
    "mode.quick": "Жылдам ойын",
    "mode.quick.sub": "ЖИ ≈ {n}",
    "mode.two": "Екі ойыншы",
    "mode.two.sub": "бір экран",
    "mode.online": "Онлайн ойын",
    "mode.online.sub": "нағыз қарсылас",
    "stats.rating": "Рейтинг",
    "stats.winrate": "Жеңіс пайызы",
    "stats.nogames": "Әзірге ойын жоқ",
    "stats.total": "Барлығы {n}",
    "stats.achievements": "Жетістіктер",
    "more.title": "Тағы да",
    "chip.lichessDaily": "Күннің есебі · Lichess",
    "chip.classics": "Классика",
    "chip.rating": "Рейтинг",
    "chip.history": "Тарих",
    "chip.history.aria": "Онлайн ойындар тарихы",
    // Коротко намеренно: подпись стоит рядом с рейтингом в строке без переноса.
    // «Жаңадан бастаушы» (16 знаков) эту строку развалило бы.
    "ai.beginner": "Бастаушы",
    "ai.casual": "Әуесқой",
    "ai.club": "Клубтық",
    "ai.advanced": "Озық",
    "ai.expert": "Сарапшы",
    "ai.master": "Шебер",
    "ai.stockfish": "Stockfish",
    "tc.approxMin": "≈ {n} мин",
    "ai.label": "ЖИ",
    "chip.analysis": "Талдау",
    "coach.askAboutPuzzle": "Бұл позицияны ЖИ-жаттықтырушыда ашып, сұрау қою",
    "coach.fenField": "Позиция FEN-і",
    "nav.coach": "Жаттықтырушы",
    // 🔴 КОРОТКОЕ слово здесь обязательно. «Жаттықтырушы» — 12 знаков, а в
    // нижнюю навигацию на 320px помещается пять разделов, то есть ~8 знаков
    // на подпись. Длинное слово молча обрезается в «Жаттықт…»: контейнер
    // стоит с textOverflow:"ellipsis" и об ошибке никто не узнает.
    // Поймал сторож nizhnyayaNavigaciya320 — я бы этого не увидел.
    // На вычитку носителю: нужен короткий казахский вариант вместо заимствования.
    "nav.coachShort": "Коуч",
    "nav.more": "Тағы",
    "nav.play": "Ойнау",
    "nav.puzzles": "Есептер",
    "nav.analysis": "Талдау",
    "nav.profile": "Профиль",
    "board.cta.start": "Тақтаны басыңыз — ойынды бастаймыз",
    "board.premoves": "Алдын ала жүрістер",
    "side.color": "Түс",
    "side.white": "Ақтар",
    "side.black": "Қаралар",
    "goals.title": "Бүгінгі мақсаттар",
    "goals.done": "орындалды",
    "goals.play": "{n} ойын ойна",
    "goals.solve": "{n} есеп шығар",
    "goals.opencoach": "Жаттықтырушыны аш",
    "goals.daily": "Күннің есебі",
    "game.unfinished": "Аяқталмаған ойын",
    "game.continue": "Жалғастыру",
    "game.cancel": "Болдырмау",
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
    "match.p2p_live":              "P2P ТІКЕЛЕЙ",
    "match.p2p_badge":             "⚔ P2P",
    // Anti-cheat panel
    "ac.title":                    "Алаяқтыққа қарсы талдау",
    "ac.verdict.clean":            "Таза",
    "ac.verdict.unusual":          "Ерекше",
    "ac.verdict.suspicious":       "Күдікті",
    "ac.verdict.flagged":          "Белгіленген",
    "ac.fen_copy":                 "FEN көшірілді!",
    "ac.confidence.insufficient":  "Деректер жеткіліксіз",
    "ac.confidence.low":           "Төмен сенімділік",
    "ac.confidence.medium":        "Орташа сенімділік",
    "ac.confidence.high":          "Жоғары сенімділік",
    "ac.session_games":            "сессиядағы ойын",
    // OBS overlay
    "obs.title":                   "OBS қабаттамасы",
    "obs.copied":                  "Көшірілді!",
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
    "fide.calib.badge":            "Калибрленген",
    "fide.calib.floor_active":     "GM-дәл",
    "fide.calib.floor_inactive":   "белсенді емес",
    "fide.calib.tooltip_source":   "Дереккөз",
    "fide.calib.tooltip_samples":  "Оқыту партиялары",
    "fide.calib.tooltip_features": "Модель белгілері",
    "fide.calib.tooltip_rmse":     "Орташа қателік",
    "fide.calib.tooltip_r2":       "Түсіндірілген дисперсия R²",
    "fide.calib.tooltip_floor":    "Жоғары деңгей мамандандырылған",
    "ai.title":                    "AI стилі",
    "ai.picker_label":             "Қарсылас стилін таңдау",
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
    // Common shared
    "common.close":                "Жабу",
    // Clock Pressure Drill
    "drill.correct_count":         "Дұрыс жауаптар",
    "drill.accuracy":              "Дәлдік",
    "drill.best_streak":           "Ең жақсы серия",
    "drill.restart":               "Қайта",
    "drill.no_puzzles":            "Жұмбақтар жүктелмеген. Жұмбақ базасын жүктеңіз.",
    "drill.theme":                 "Тақырып",
    "drill.choose_piece":          "Тас пен жүрісті таңдаңыз",
    "drill.selected":              "Таңдалды",
    "drill.click_target":          "→ нысанды басыңыз",
    "drill.correct":               "✓ Дұрыс! +1",
    "drill.wrong":                 "✗ Қате. Дұрысы:",
    "drill.timeout":               "⏱ Уақыт бітті! Жауабы:",
    // Mirror Mode panel
    "mirror.studied":              "AI соңғы партияларыңды үйренді",
    "mirror.no_data":              "Ойындар туралы дерек жоқ",
    "mirror.plays_like_you":       "сен сияқты ойнайды",
    "mirror.need_games":           "Талдау үшін 5+ партия керек",
    "mirror.depth":                "Тереңдік",
    "mirror.fav_opening":          "Сүйікті дебют:",
    "mirror.unknown":              "дерек жоқ",
    // Opening Flash Card
    "flash.know_theory":           "Бұл дебют теориясын білесің бе?",
    "flash.continuation":          "теория жалғасы:",
    "engine.license": "Шахмат қозғалтқыштары — Stockfish.js және lila-stockfish-web, Stockfish негізінде. Лицензиялар, нұсқалар және бастапқы код:",
    "engine.license.copy": "қозғалтқыш лицензиялары",
    "flash.on_my_own":             "Өзім жалғастырамын 💪",
    "flash.show_theory":           "Теорияны көрсет 📚",
  },
};

/**
 * Ключ, под которым язык хранит ПЕРЕКЛЮЧАТЕЛЬ В ШАПКЕ САЙТА (lib/i18n.tsx).
 * Он другой, чем наш: у страницы шахмат два переключателя — свой в настройках
 * и общий в шапке, — и до 21.08.2026 они друг о друге не знали. Человек
 * выбирал английский в шапке, а панели шахмат оставались на языке браузера.
 */
const SITE_LANG_KEY = "aevion_lang_v1";

/** Языки сайта шире наших трёх; de/fr отдаём английскому, а не роняем в русский. */
function siteLangToCc(v: string | null): CcLocale | null {
  if (v === "ru" || v === "en" || v === "kk") return v;
  if (v === "de" || v === "fr") return "en";
  return null;
}

/** Выбор языка платформы приходит КУКОЙ `aevion_lang_v1` (её ставит setLang в
 *  lib/i18n.tsx и SSR-страницы читают её на сервере). Раньше шахматы читали
 *  выбор только из localStorage — а выбор из ДРУГОЙ сессии/через SSR живёт в
 *  куке, и /cyberchess (клиентский) его не видел: оставался на языке браузера,
 *  пока /qventure и /bureau (SSR, читают куку) слушались. Замер соседнего окна
 *  08.09.2026: cookie=en, браузер RU → /cyberchess 88% кириллицы. */
function readSiteLangCookie(): string | null {
  if (typeof document === "undefined") return null;
  try {
    for (const part of document.cookie.split("; ")) {
      const eq = part.indexOf("=");
      if (eq > 0 && part.slice(0, eq) === SITE_LANG_KEY) {
        return decodeURIComponent(part.slice(eq + 1) || "");
      }
    }
  } catch {}
  return null;
}

export function loadLocale(): CcLocale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    // 1. Свой явный выбор — старше всех: человек выбрал язык именно для шахмат.
    const stored = localStorage.getItem(LOCALE_KEY);
    if (stored === "ru" || stored === "en" || stored === "kk") return stored;
    // 2. Выбор языка платформы. КУКА старше localStorage: выбор из другой
    //    сессии/через SSR приходит именно кукой (setLang пишет и то, и другое,
    //    но localStorage — только в той вкладке, где переключали). Без чтения
    //    куки общий переключатель на /cyberchess не действовал в cookie-сценарии.
    const siteCookie = siteLangToCc(readSiteLangCookie());
    if (siteCookie) return siteCookie;
    const site = siteLangToCc(localStorage.getItem(SITE_LANG_KEY));
    if (site) return site;
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
    // Переключатель в шапке события не шлёт, но выставляет lang на корневом
    // элементе (lib/i18n.tsx). Наблюдаем за ним — иначе смена языка в шапке
    // доходила бы до шахмат только после перезагрузки страницы.
    let observer: MutationObserver | null = null;
    if (typeof MutationObserver !== "undefined" && typeof document !== "undefined") {
      observer = new MutationObserver(() => setLocaleState(loadLocale()));
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    }
    return () => {
      window.removeEventListener("cc-locale-changed", handler as EventListener);
      window.removeEventListener("storage", handler);
      observer?.disconnect();
    };
  }, []);

  const t = useCallback((key: string) => tFor(locale, key), [locale]);
  const setLocale = useCallback((l: CcLocale) => { saveLocale(l); setLocaleState(l); }, []);

  return { t, locale, setLocale };
}
