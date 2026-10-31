// Тексты и мета /cyberchess/guide (и /en, /kk) — страница для людей из поиска
// «chess coach AI» / «разбор партии онлайн», ведёт в тренера и в тариф $50/год.
// Всё сказанное сверено с кодом 31.10.2026: moveQuality.ts (6 ярлыков хода по падению
// оценки Stockfish, пороги зависят от фазы партии), page.tsx (isPro: уровни ИИ 5–6,
// Ghost-подсказки и «Глубокий разбор партии» без монет), DeepAnalysisPanel.tsx
// (игра, задачи, ИИ-коуч и лёгкий анализ бесплатны). Глубокий NNUE-анализ НЕ обещаем:
// на проде он не работает (i18n.ts, 07.10.2026). Примеры — из traps.ts, ходы проверяет тест.
import type { Metadata } from "next";
import type { Yazyk } from "../traps/traps";

const SITE = "https://aevion.app";
export const GUIDE_CHANNEL = "seo-cc-guide";

export const GUIDE_PATHS: Record<Yazyk, string> = {
  ru: "/cyberchess/guide",
  en: "/en/cyberchess/guide",
  kk: "/kk/cyberchess/guide",
};

export const guideUrl = (lang: Yazyk): string => SITE + GUIDE_PATHS[lang];
export const GUIDE_LANGUAGES: Record<string, string> = {
  ru: SITE + GUIDE_PATHS.ru,
  en: SITE + GUIDE_PATHS.en,
  kk: SITE + GUIDE_PATHS.kk,
  "x-default": SITE + GUIDE_PATHS.en,
};

/** Кнопка «к тренеру»: свой языковой адрес шахмат и метка канала. */
export function coachHref(lang: Yazyk): string {
  const base = lang === "ru" ? "/cyberchess" : `/${lang}/cyberchess`;
  return `${base}?c=${GUIDE_CHANNEL}`;
}
/** Кнопка тарифа: та же касса, что у ссылки тренера на норму (normaTrenera.ts). */
export const PRICING_HREF = `/pricing?app=cyberchess&c=${GUIDE_CHANNEL}`;
/** Ссылка на ловушку на странице ловушек того же языка. */
export const trapHref = (lang: Yazyk, id: string): string =>
  `${lang === "ru" ? "/cyberchess/traps" : `/${lang}/cyberchess/traps`}#${id}`;

/** Три живых примера: id ловушки в traps.ts и полуход ошибки (сверяет тест). */
export const GUIDE_EXAMPLES = [
  { id: "legal", san: "Bxd1" },
  { id: "scholars", san: "Nf6" },
  { id: "blackburne-shilling", san: "Nxe5" },
] as const;

export type GuideText = {
  title: string;
  description: string;
  locale: string;
  h1: string;
  lead: string;
  ctaCoach: string;
  ctaPrice: string;
  howH: string;
  how: { h: string; p: string }[];
  labelsH: string;
  labels: string[];
  paidH: string;
  paidLead: string;
  paid: string[];
  freeNote: string;
  examplesH: string;
  examplesLead: string;
  examples: string[];
  trapsLink: string;
  faqH: string;
  faq: { q: string; a: string }[];
  ctaH: string;
};

export const GUIDE: Record<Yazyk, GuideText> = {
  ru: {
    title: "ИИ-тренер по шахматам: разбор партии онлайн по каждому ходу | CyberChess",
    description:
      "Как тренер CyberChess разбирает ход: Stockfish в браузере, ярлык от «блестяще» до «зевка» после каждого хода, разбор всей партии. Что даёт подписка за $50 в год.",
    locale: "ru_RU",
    h1: "Как ИИ-тренер разбирает вашу партию",
    lead: "Играете в браузере, без установки. После каждого вашего хода тренер оценивает позицию движком Stockfish и говорит, насколько ход хорош, а после партии проходит по ней целиком.",
    ctaCoach: "Сыграть с тренером",
    ctaPrice: "Подписка — $50 в год",
    howH: "Что происходит после хода",
    how: [
      { h: "Оценка до и после", p: "Движок Stockfish считает позицию до вашего хода и после него. Разница в оценке — это то, сколько ход стоил." },
      { h: "Порог зависит от фазы", p: "В эндшпиле малая потеря значит больше, чем в дебюте, поэтому пороги там ниже. Потеря, которая превращает выигранную позицию в проигранную, считается строже, чем та же потеря в уже безнадёжной." },
      { h: "Ярлык и объяснение", p: "Вы видите ярлык хода и короткую подсказку тренера: что висит, что под ударом, какая идея у соперника." },
      { h: "Разбор всей партии", p: "На вкладке анализа движок проходит по всем ходам партии и отмечает, где оценка упала сильнее всего." },
    ],
    labelsH: "Шесть ярлыков хода",
    labels: ["Блестяще — ход заметно лучше, чем ждал движок", "Отлично", "Хорошо", "Неточность", "Ошибка", "Зевок — потеря, которая меняет исход"],
    paidH: "Что даёт подписка за $50 в год",
    paidLead: "Оплата картой, один платёж на год. После оплаты в вашем аккаунте открываются:",
    paid: [
      "два сильнейших уровня ИИ-соперника — Master и Stockfish;",
      "Ghost-подсказки без монет: на 3 секунды видно лучший ход на доске;",
      "«Глубокий разбор партии» без монет: тренер проходит по всем ходам и даёт план на будущее.",
    ],
    freeNote: "Без подписки бесплатно остаются игра, задачи, ИИ-коуч и лёгкий анализ.",
    examplesH: "Три примера из тренера",
    examplesLead: "Классические ловушки: на каждом из этих ходов тренер ставит «зевок». Откройте ловушку и пролистайте ходы на доске.",
    examples: [
      "Мат Легаля: 5...Bxd1?? — чёрные берут ферзя и получают мат в два хода",
      "Детский мат: 3...Nf6?? — пропущена угроза на f7, следом 4.Qxf7#",
      "Блэкберн–Шиллинг: 4.Nxe5?? — после 4...Qg5! белые теряют g2 и могут получить мат",
    ],
    trapsLink: "Все 10 ловушек на доске",
    faqH: "Вопросы и ответы",
    faq: [
      { q: "Нужно ли что-то устанавливать?", a: "Нет. Тренер и движок Stockfish работают в браузере, на телефоне и на компьютере." },
      { q: "Чем тренер отличается от обычного движка?", a: "Движок даёт число. Тренер переводит падение оценки в ярлык хода с учётом фазы партии и объясняет словами, что произошло на доске." },
      { q: "Можно ли разобрать уже сыгранную партию?", a: "Да, партию, сыгранную в CyberChess: на вкладке анализа движок проходит по всем её ходам." },
      { q: "Что бесплатно?", a: "Игра, задачи, ИИ-коуч и лёгкий анализ. Подписка открывает два сильнейших уровня ИИ, подсказки и глубокий разбор партии без монет." },
      { q: "Сколько стоит подписка?", a: "$50 в год, оплата картой. Цена и условия — на странице тарифа." },
      { q: "На каких языках работает тренер?", a: "Страница и экраны шахмат есть на русском, английском и казахском." },
      { q: "Тренер может ошибаться?", a: "Ярлык опирается на оценку движка на ограниченной глубине. В острых позициях оценка может меняться, поэтому ярлык — подсказка, а не приговор." },
    ],
    ctaH: "Попробуйте на своей партии",
  },
  en: {
    title: "AI chess coach: move-by-move game review online | CyberChess",
    description:
      "How the CyberChess coach reviews a move: Stockfish in your browser, a label from brilliant to blunder after every move, a full game review. What the $50 a year plan adds.",
    locale: "en_US",
    h1: "How the AI coach reviews your game",
    lead: "Play in the browser, nothing to install. After each of your moves the coach evaluates the position with Stockfish and tells you how good the move was, and after the game it goes through the whole of it.",
    ctaCoach: "Play the coach",
    ctaPrice: "Plan: $50 a year",
    howH: "What happens after a move",
    how: [
      { h: "Evaluation before and after", p: "Stockfish evaluates the position before your move and after it. The drop in evaluation is what the move cost." },
      { h: "Thresholds follow the game phase", p: "In the endgame a small loss matters more than in the opening, so the thresholds are lower there. A loss that turns a winning position into a losing one is judged more strictly than the same loss in a position that was already lost." },
      { h: "A label and an explanation", p: "You see the move label and a short coach hint: what is hanging, what is attacked, what your opponent is planning." },
      { h: "Review of the whole game", p: "On the analysis tab the engine goes through every move of the game and marks where the evaluation dropped the most." },
    ],
    labelsH: "Six move labels",
    labels: ["Brilliant: clearly better than the engine expected", "Great", "Good", "Inaccuracy", "Mistake", "Blunder: a loss that changes the result"],
    paidH: "What the $50 a year plan adds",
    paidLead: "Card payment, one payment per year. After payment your account unlocks:",
    paid: [
      "the two strongest AI opponent levels, Master and Stockfish;",
      "Ghost hints with no coins: the best move shows on the board for 3 seconds;",
      "Deep game review with no coins: the coach goes through every move and gives you a plan.",
    ],
    freeNote: "Without the plan, playing, puzzles, the AI coach and light analysis stay free.",
    examplesH: "Three examples from the coach",
    examplesLead: "Classic traps: the coach labels each of these moves a blunder. Open a trap and step through the moves on the board.",
    examples: [
      "Légal's Mate: 5...Bxd1?? Black takes the queen and is mated in two moves",
      "Scholar's Mate: 3...Nf6?? misses the threat on f7, then 4.Qxf7#",
      "Blackburne Shilling: 4.Nxe5?? after 4...Qg5! White loses g2 and can get mated",
    ],
    trapsLink: "All 10 traps on the board",
    faqH: "Questions and answers",
    faq: [
      { q: "Do I need to install anything?", a: "No. The coach and the Stockfish engine run in the browser, on a phone or a computer." },
      { q: "How is the coach different from a plain engine?", a: "An engine gives a number. The coach turns the drop in evaluation into a move label that accounts for the game phase and explains in words what happened on the board." },
      { q: "Can I review a game I already played?", a: "Yes, a game played in CyberChess: on the analysis tab the engine goes through all of its moves." },
      { q: "What is free?", a: "Playing, puzzles, the AI coach and light analysis. The plan adds the two strongest AI levels, hints and deep game review with no coins." },
      { q: "How much is the plan?", a: "$50 a year, paid by card. Price and terms are on the pricing page." },
      { q: "Which languages does the coach speak?", a: "This page and the chess screens are available in English, Russian and Kazakh." },
      { q: "Can the coach be wrong?", a: "A label rests on the engine evaluation at a limited depth. In sharp positions the evaluation can shift, so treat a label as a hint, not a verdict." },
    ],
    ctaH: "Try it on your own game",
  },
  kk: {
    title: "Шахматтағы ЖИ-жаттықтырушы: партияны әр жүріс бойынша онлайн талдау | CyberChess",
    description:
      "CyberChess жаттықтырушысы жүрісті қалай талдайды: браузердегі Stockfish, әр жүрістен кейін «керемет» пен «өрескел қате» арасындағы белгі, бүкіл партияны талдау. Жылына $50 жазылым не береді.",
    locale: "kk_KZ",
    h1: "ЖИ-жаттықтырушы партияңызды қалай талдайды",
    lead: "Браузерде ойнайсыз, ештеңе орнатпайсыз. Әр жүрісіңізден кейін жаттықтырушы позицияны Stockfish қозғалтқышымен бағалап, жүрістің қаншалықты жақсы екенін айтады, ал партиядан кейін оны толық қарап шығады.",
    ctaCoach: "Жаттықтырушымен ойнау",
    ctaPrice: "Жазылым — жылына $50",
    howH: "Жүрістен кейін не болады",
    how: [
      { h: "Жүріске дейінгі және кейінгі баға", p: "Stockfish позицияны жүрісіңізге дейін және кейін бағалайды. Бағаның төмендеуі — жүрістің құны." },
      { h: "Шек партия кезеңіне байланысты", p: "Эндшпильде аз шығын дебюттегіден маңыздырақ, сондықтан онда шектер төмен. Ұтылған позицияны ұтылғанға айналдыратын шығын бұрыннан үмітсіз позициядағы сондай шығыннан қатаңырақ бағаланады." },
      { h: "Белгі және түсініктеме", p: "Жүріс белгісін және жаттықтырушының қысқа кеңесін көресіз: не қорғаусыз тұр, не шабуылда, қарсыластың ойы қандай." },
      { h: "Бүкіл партияны талдау", p: "Талдау қойындысында қозғалтқыш партияның барлық жүрістерін қарап, баға ең көп түскен жерлерді белгілейді." },
    ],
    labelsH: "Жүрістің алты белгісі",
    labels: ["Керемет — қозғалтқыш күткеннен айқын жақсы", "Өте жақсы", "Жақсы", "Дәлсіздік", "Қате", "Өрескел қате — нәтижені өзгертетін шығын"],
    paidH: "Жылына $50 жазылым не береді",
    paidLead: "Картамен төлем, жылына бір рет. Төлемнен кейін аккаунтыңызда ашылады:",
    paid: [
      "ЖИ-қарсыластың ең күшті екі деңгейі — Master және Stockfish;",
      "тиынсыз Ghost-кеңестер: ең жақсы жүріс тақтада 3 секунд көрінеді;",
      "тиынсыз «Партияны терең талдау»: жаттықтырушы барлық жүрістерді қарап, болашаққа жоспар береді.",
    ],
    freeNote: "Жазылымсыз ойын, есептер, ЖИ-коуч және жеңіл талдау тегін қалады.",
    examplesH: "Жаттықтырушыдан үш мысал",
    examplesLead: "Классикалық тұзақтар: жаттықтырушы осы жүрістердің әрқайсысына «өрескел қате» белгісін қояды. Тұзақты ашып, тақтадағы жүрістерді парақтаңыз.",
    examples: [
      "Легаль маты: 5...Bxd1?? — қаралар уәзірді алып, екі жүрісте мат алады",
      "Балалар маты: 3...Nf6?? — f7-ге қауіп байқалмайды, артынша 4.Qxf7#",
      "Блэкберн–Шиллинг: 4.Nxe5?? — 4...Qg5! кейін ақтар g2-ні жоғалтып, мат алуы мүмкін",
    ],
    trapsLink: "Тақтадағы барлық 10 тұзақ",
    faqH: "Сұрақтар мен жауаптар",
    faq: [
      { q: "Бірдеңе орнату керек пе?", a: "Жоқ. Жаттықтырушы мен Stockfish қозғалтқышы браузерде, телефонда да, компьютерде де жұмыс істейді." },
      { q: "Жаттықтырушының қарапайым қозғалтқыштан айырмасы неде?", a: "Қозғалтқыш сан береді. Жаттықтырушы бағаның төмендеуін партия кезеңін ескеріп жүріс белгісіне айналдырады және тақтада не болғанын сөзбен түсіндіреді." },
      { q: "Ойналған партияны талдауға бола ма?", a: "Иә, CyberChess-те ойналған партияны: талдау қойындысында қозғалтқыш оның барлық жүрістерін қарап шығады." },
      { q: "Не тегін?", a: "Ойын, есептер, ЖИ-коуч және жеңіл талдау. Жазылым ЖИ-дің ең күшті екі деңгейін, кеңестерді және партияны терең талдауды тиынсыз ашады." },
      { q: "Жазылым қанша тұрады?", a: "Жылына $50, картамен төленеді. Баға мен шарттар — тариф бетінде." },
      { q: "Жаттықтырушы қай тілдерде жұмыс істейді?", a: "Бұл бет пен шахмат экрандары қазақ, орыс және ағылшын тілдерінде бар." },
      { q: "Жаттықтырушы қателесе ме?", a: "Белгі қозғалтқыштың шектеулі тереңдіктегі бағасына сүйенеді. Өткір позицияларда баға өзгеруі мүмкін, сондықтан белгі — үкім емес, кеңес." },
    ],
    ctaH: "Өз партияңызда байқап көріңіз",
  },
};

export function guideMetadata(lang: Yazyk): Metadata {
  const t = GUIDE[lang];
  const url = guideUrl(lang);
  return {
    title: { absolute: t.title },
    description: t.description,
    alternates: { canonical: url, languages: GUIDE_LANGUAGES },
    openGraph: { title: t.title, description: t.description, url, type: "article", locale: t.locale, siteName: "AEVION CyberChess" },
    twitter: { card: "summary", title: t.title, description: t.description },
  };
}

/** JSON-LD FAQPage на языке страницы. */
export function guideFaqJsonLd(lang: Yazyk) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: lang,
    mainEntity: GUIDE[lang].faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}
