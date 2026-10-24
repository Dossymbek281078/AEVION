/**
 * Перевод страницы /cyberchess/cpi (24.10.2026: на /en 46 русских строк из 134).
 * Ключ — строка из кода, значения — недостающие языки. tt(lang, src): есть перевод — он, нет — исходник.
 * ⚠️ kk — черновой перевод, нужна вычитка носителя.
 */
type Tr = Partial<Record<"en" | "ru" | "kk", string>>;

export const CPI_TEXT: Record<string, Tr> = {
  "Средняя потеря оценки за партию в сотых пешки (точность)": { en: "Average centipawn loss per game (accuracy)", kk: "Ойындағы орташа centipawn-loss (дәлдік)" },
  "Равномерность затрат времени на ход": { en: "How evenly time is spent per move", kk: "Жүріске жұмсалған уақыттың біркелкілігі" },
  "% ходов из первой десятки базы до 10-го хода": { en: "% of moves in the database TOP-10 before move 10", kk: "10-жүріске дейін базаның TOP-10 ішіндегі жүрістер %" },
  "% ходов = первый выбор движка": { en: "% of moves = the engine's #1 choice", kk: "Жүрістер % = қозғалтқыштың №1 таңдауы" },
  "% ходов = #2 (частичный кредит)": { en: "% of moves = #2 (partial credit)", kk: "Жүрістер % = №2 (ішінара есеп)" },
  "% ходов = #3 (слабый кредит)": { en: "% of moves = #3 (weak credit)", kk: "Жүрістер % = №3 (әлсіз есеп)" },
  "% найденных матов в 1 ход": { en: "% of mates in 1 found", kk: "Табылған 1 жүрістік маттар %" },
  "% найденных матов в 2 хода": { en: "% of mates in 2 found", kk: "Табылған 2 жүрістік маттар %" },
  "% найденных матов в 3 хода": { en: "% of mates in 3 found", kk: "Табылған 3 жүрістік маттар %" },
  "Зевки фигур (оценка падает на 300+ сотых пешки)": { en: "Hung pieces (−300+ cp swing)", kk: "Қорғаусыз қалған фигуралар (−300+ cp)" },
  "Жертвы и неочевидные сильные ходы": { en: "Sacrifices and non-obvious strong moves", kk: "Құрбандықтар мен айқын емес күшті жүрістер" },
  "Проиграл, но качество отличное": { en: "Lost, but the quality was excellent", kk: "Жеңілді, бірақ сапасы тамаша" },
  "В Elo было бы −15. У нас даже за проигрыш — большой плюс.": { en: "In Elo this would be −15. Here even a loss earns a big plus.", kk: "Elo-да −15 болар еді. Бізде жеңілістің өзі — үлкен плюс." },
  "Выиграл, но с зевком": { en: "Won, but with a blunder", kk: "Жеңді, бірақ өрескел қатемен" },
  "В Elo было бы +15. У нас победа есть, но качество посредственное — маленький плюс.": { en: "In Elo this would be +15. Here the win counts, but the quality is mediocre — a small plus.", kk: "Elo-да +15 болар еді. Бізде жеңіс бар, бірақ сапасы орташа — кішкене плюс." },
  "Идеальная ничья": { en: "Perfect draw", kk: "Мінсіз тең ойын" },
  "В Elo было бы ≈ 0. У нас — большой плюс за технику.": { en: "In Elo this would be ≈ 0. Here — a big plus for technique.", kk: "Elo-да ≈ 0 болар еді. Бізде — техника үшін үлкен плюс." },
  "Только результат + Elo соперника": { en: "Result only + opponent's Elo", kk: "Тек нәтиже + қарсыластың Elo" },
  "Результат + RD (отклонение рейтинга)": { en: "Result + RD (rating deviation)", kk: "Нәтиже + RD (рейтинг ауытқуы)" },
  "Результат + волатильность": { en: "Result + volatility", kk: "Нәтиже + құбылмалылық" },
  "11 факторов качества + R-бонус": { en: "11 quality factors + R bonus", kk: "11 сапа факторы + R-бонус" },
  "✓ — наш": { en: "✓ — ours", kk: "✓ — біздікі" },
  "v0.1 · ЧЕРНОВИК · 2026-05-12": { en: "v0.1 · DRAFT · 2026-05-12", kk: "v0.1 · ЖОБА · 2026-05-12" },
  "Новая система рейтинга для CyberChess. Принципиально отличается от FIDE Elo, Lichess Glicko-2 и chess.com Glicko:": { en: "A new rating system for CyberChess. It differs fundamentally from FIDE Elo, Lichess Glicko-2 and chess.com Glicko:", kk: "CyberChess үшін жаңа рейтинг жүйесі. FIDE Elo, Lichess Glicko-2 және chess.com Glicko жүйелерінен түбегейлі ерекшеленеді:" },
  "даёт баллы за каждую партию независимо от результата": { en: "it awards points for every game regardless of the result", kk: "нәтижеге қарамастан әр ойын үшін ұпай береді" },
  ", на основе составной оценки качества игры.": { en: ", based on a composite score of the quality of play.", kk: ", ойын сапасының құрама бағасы негізінде." },
  "Зачем нужна новая система": { en: "Why a new system", kk: "Жаңа жүйе не үшін керек" },
  "Все три топа (FIDE/Lichess/chess.com) считают рейтинг": { en: "All three leading systems (FIDE/Lichess/chess.com) compute rating", kk: "Үш жетекші жүйе де (FIDE/Lichess/chess.com) рейтингті" },
  "только по результату партии": { en: "only from the game result", kk: "тек ойын нәтижесі бойынша есептейді" },
  ". Это:": { en: ". That is:", kk: ". Бұл:" },
  "грубо — один блестящий ход в проигранной партии = 0 баллов": { en: "crude — one brilliant move in a lost game = 0 points", kk: "дөрекі — жеңілген ойындағы бір тамаша жүріс = 0 ұпай" },
  "демотивирует тренировку — упорная игра без победы = минус": { en: "it demotivates training — a stubborn game without a win = minus", kk: "жаттығуға деген ынтаны төмендетеді — жеңіссіз табанды ойын = минус" },
  "скрывает реальный прогресс — можно расти качественно, но падать в рейтинге": { en: "it hides real progress — you can improve in quality yet drop in rating", kk: "нақты прогресті жасырады — сапа өссе де, рейтинг түсуі мүмкін" },
  "Сравнение с конкурентами": { en: "Comparison with competitors", kk: "Бәсекелестермен салыстыру" },
  "Система": { en: "System", kk: "Жүйе" },
  "Что измеряет": { en: "What it measures", kk: "Нені өлшейді" },
  "Скилл-чувствительность": { en: "Skill sensitivity", kk: "Шеберлікке сезімталдық" },
  "Формула ΔCPI": { en: "ΔCPI formula", kk: "ΔCPI формуласы" },
  "Веса предварительные. Финальные будут подобраны после симуляции на 100+ исторических партиях разного уровня.": { en: "The weights are preliminary. Final ones will be tuned after a simulation on 100+ historical games of different levels.", kk: "Салмақтар алдын ала. Соңғылары әр деңгейдегі 100+ тарихи ойындағы симуляциядан кейін таңдалады." },
  "11 факторов": { en: "11 factors", kk: "11 фактор" },
  "Примеры — CPI vs Elo": { en: "Examples — CPI vs Elo", kk: "Мысалдар — CPI vs Elo" },
  "План развития": { en: "Roadmap", kk: "Даму жоспары" },
  "(этот экран — текущая фаза ✓)": { en: "(this screen — current phase ✓)", kk: "(бұл экран — ағымдағы кезең ✓)" },
  "— Stockfish с тремя лучшими линиями в игровом цикле": { en: "— Stockfish with the top three lines in the game loop", kk: "— Stockfish үздік үш жолымен ойын циклінде" },
  "функция": { en: "function", kk: "функциясы" },
  "с SVG-графиками": { en: "with SVG charts", kk: "SVG графиктерімен" },
  "— Подбор от тренера по CPI — автоподборка упражнений по слабому фактору": { en: "— Coach picks by CPI — automatic exercise selection by the weakest factor", kk: "— CPI бойынша жаттықтырушы таңдауы — әлсіз фактор бойынша жаттығуларды автоматты іріктеу" },
  "Открытые вопросы": { en: "Open questions", kk: "Ашық сұрақтар" },
  "Веса факторов": { en: "Factor weights", kk: "Фактор салмақтары" },
  "— симуляция на 100+ партий разного уровня": { en: "— a simulation on 100+ games of different levels", kk: "— әр деңгейдегі 100+ ойында симуляция" },
  "Сопоставление CPI и FIDE": { en: "Mapping CPI to FIDE", kk: "CPI мен FIDE салыстыру" },
  "— показывать ли «эквивалент по FIDE»?": { en: "— should we show an «FIDE equivalent»?", kk: "— «FIDE баламасын» көрсету керек пе?" },
  "Античит": { en: "Anti-cheat", kk: "Античит" },
  "— сильный игрок может симулировать ошибки. Считать только в режимах против ИИ?": { en: "— a strong player can fake mistakes. Count only in modes against the AI?", kk: "— күшті ойыншы қателерді әдейі жасай алады. Тек ЖИ-ге қарсы режимдерде есептеу керек пе?" },
  "Затухание": { en: "Decay", kk: "Өшу" },
  "— должен ли CPI «затухать», если не играешь?": { en: "— should CPI «decay» if you don't play?", kk: "— ойнамасаңыз, CPI «өшуі» керек пе?" },
  "Стеклянный потолок": { en: "Glass ceiling", kk: "Шыны төбе" },
  "— потолок 4000 — может ли быть мало для топов?": { en: "— is a ceiling of 4000 too low for top players?", kk: "— 4000 шегі үздіктер үшін аз болуы мүмкін бе?" },
  "📄 Полная спецификация на GitHub": { en: "📄 Full spec on GitHub", kk: "📄 GitHub-тағы толық спецификация" },
  "Версия 0.1 · 2026-05-12 · может меняться": { en: "Version 0.1 · 2026-05-12 · subject to revision", kk: "Нұсқа 0.1 · 2026-05-12 · өзгеруі мүмкін" },
};

export function tt(lang: string | undefined, src: string): string {
  const e = CPI_TEXT[src];
  return (lang && e?.[lang as "en" | "ru" | "kk"]) || src;
}
