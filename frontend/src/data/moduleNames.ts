// 🔴 21.10.2026 (окно Приложения, замер kk-главной): названия модулей каталога и карточек
// главной шли живым переводом, и запасной переводчик (Claude, kk) возвращал эхом
// «HEALTHAI: HealthAI — Personal AI Doctor», «core • live — Реестр + Postgres» —
// 56 из 61 латинских строк, правка подсказки 56→52, нарезка 56→45. Поэтому названия —
// словарём здесь, по id проекта (id из aevion-globus-backend/src/data/projects.ts),
// а на экране они стоят под translate="no", живому переводу не отдаются.
// Бренд — из brandNames.json (одно место), описание — на трёх языках.
// kk — черновик, на вычитку носителю.
import brandNames from "./brandNames.json";

export type ModuleLang = "en" | "ru" | "kk";
type Tr = Record<ModuleLang, string>;

export const BRAND_NAMES: readonly string[] = brandNames.names;

/** brand — имя собственное (есть в BRAND_NAMES); sub — описание, переводится. */
export const MODULE_NAMES: Record<string, { brand: string; sub?: Tr }> = {
  "revenue-hub": { brand: "Revenue Hub", sub: { en: "Monetization Central", ru: "Центр монетизации", kk: "Монетизация орталығы" } },
  ventures: { brand: "AEVION Ventures", sub: { en: "Idea Market", ru: "Идея-Маркет", kk: "Идеялар нарығы" } },
  globus: { brand: "AEVION Globus" },
  qcoreai: { brand: "QCoreAI", sub: { en: "AI Core Engine", ru: "ИИ-ядро", kk: "ЖИ өзегі" } },
  "multichat-engine": { brand: "AEVION Multichat Engine" },
  qfusionai: { brand: "QFusionAI", sub: { en: "Hybrid AI Engine", ru: "Гибридный ИИ-движок", kk: "Гибридті ЖИ қозғалтқышы" } },
  qright: { brand: "QRight", sub: { en: "Legal & IP Protection System", ru: "Правовая защита авторства", kk: "Авторлықты құқықтық қорғау жүйесі" } },
  qsign: { brand: "QSign", sub: { en: "Digital Signature & Integrity", ru: "Цифровая подпись и целостность", kk: "Цифрлық қолтаңба және тұтастық" } },
  "aevion-ip-bureau": { brand: "AEVION", sub: { en: "Digital IP Bureau — Proof of Authorship & Prior Art", ru: "Цифровое бюро авторства — доказательство авторства и приоритета", kk: "Цифрлық авторлық бюросы — авторлық пен басымдықтың дәлелі" } },
  qtradeoffline: { brand: "QTradeOffline", sub: { en: "Offline Trade & Payments", ru: "Офлайн-торговля и платежи", kk: "Офлайн сауда және төлемдер" } },
  "qpaynet-embedded": { brand: "QPayNet Embedded", sub: { en: "Payment Core", ru: "Платёжное ядро", kk: "Төлем өзегі" } },
  qmaskcard: { brand: "QMaskCard", sub: { en: "Protected Bank Card", ru: "Защищённая банковская карта", kk: "Қорғалған банк картасы" } },
  veilnetx: { brand: "VeilNetX", sub: { en: "Privacy Crypto & Network", ru: "Приватная криптография и сеть", kk: "Құпия криптография және желі" } },
  cyberchess: { brand: "CyberChess", sub: { en: "New Chess Platform", ru: "Новая шахматная платформа", kk: "Жаңа шахмат платформасы" } },
  healthai: { brand: "HealthAI", sub: { en: "Personal AI Doctor", ru: "Личный ИИ-доктор", kk: "Жеке ЖИ-дәрігер" } },
  qlife: { brand: "QLife", sub: { en: "Longevity & Healthy Habits", ru: "Долголетие и здоровые привычки", kk: "Ұзақ өмір және салауатты әдеттер" } },
  qmelanin: { brand: "QMelanin", sub: { en: "Grey Hair, by the Research", ru: "Седина по исследованиям", kk: "Шаш ағаруы — зерттеулер бойынша" } },
  qrenew: { brand: "QRenew", sub: { en: "Biological Age", ru: "Биологический возраст", kk: "Биологиялық жас" } },
  qgood: { brand: "QGood", sub: { en: "Psychology & Mental Health", ru: "Психология и ментальное здоровье", kk: "Психология және психикалық денсаулық" } },
  "psyapp-deps": { brand: "PsyApp", sub: { en: "Dependencies Exit", ru: "Выход из зависимостей", kk: "Тәуелділіктен шығу" } },
  qpersona: { brand: "QPersona", sub: { en: "Digital Avatar", ru: "Цифровой аватар", kk: "Цифрлық аватар" } },
  "kids-ai-content": { brand: "Kids AI Content", sub: { en: "Multi-language Learning", ru: "Обучение на нескольких языках", kk: "Бірнеше тілде оқыту" } },
  "voice-of-earth": { brand: "Voice of the Earth Series" },
  "startup-exchange": { brand: "Startup Exchange", sub: { en: "Idea / MVP / Product Marketplace", ru: "Биржа идей, MVP и продуктов", kk: "Идеялар, MVP және өнімдер биржасы" } },
  qventure: { brand: "QVenture", sub: { en: "AI Investment Analyst", ru: "ИИ-инвестаналитик", kk: "ЖИ инвестициялық талдаушы" } },
  qspace: { brand: "QSpace", sub: { en: "3D Room & Interior Modeler", ru: "3D-моделирование помещений и интерьера", kk: "Бөлме мен интерьердің 3D модельдеушісі" } },
  devhub: { brand: "DevHub Studio", sub: { en: "Prompt-to-App IDE", ru: "Приложение по описанию", kk: "Сипаттама бойынша қосымша" } },
  qskyway: { brand: "QSkyway", sub: { en: "Urban Air-Corridor Navigation", ru: "Навигация по городским аэрокоридорам", kk: "Қалалық әуе дәліздері бойынша навигация" } },
  qreal: { brand: "QReal Studio", sub: { en: "Fully-Alive AI Video", ru: "Живое ИИ-видео без съёмки", kk: "Түсірілімсіз тірі ЖИ-бейне" } },
  deepsan: { brand: "DeepSan", sub: { en: "Anti-chaos App", ru: "Приложение против хаоса", kk: "Хаосқа қарсы қосымша" } },
  mapreality: { brand: "MapReality", sub: { en: "Map of Real Needs", ru: "Карта реальных потребностей", kk: "Нақты қажеттіліктер картасы" } },
  "z-tide": { brand: "Z-Tide", sub: { en: "Soft Ecosystem Reputation", ru: "Мягкая репутация экосистемы", kk: "Экожүйенің жұмсақ беделі" } },
  qcontract: { brand: "QContract", sub: { en: "Self-destruct Smart Documents", ru: "Самоуничтожающиеся смарт-документы", kk: "Өзін-өзі жоятын смарт-құжаттар" } },
  shadownet: { brand: "ShadowNet", sub: { en: "Private Network Simulator", ru: "Симулятор приватной сети", kk: "Жеке желі симуляторы" } },
  lifebox: { brand: "LifeBox", sub: { en: "Digital Safe for Future Self", ru: "Цифровой сейф для себя в будущем", kk: "Болашақтағы өзіңізге цифрлық сейф" } },
  qbuild: { brand: "QBuild", sub: { en: "Construction Hiring Platform", ru: "Платформа найма в строительстве", kk: "Құрылыста жұмысқа алу платформасы" } },
  qchaingov: { brand: "QChainGov", sub: { en: "DAO Governance", ru: "Управление DAO", kk: "DAO басқаруы" } },
  "smeta-trainer": { brand: "Smeta Trainer", sub: { en: "AI Cost-Estimate Trainer (Kazakhstan)", ru: "ИИ-тренажёр сметного дела РК", kk: "ҚР смета ісінің ЖИ-тренажері" } },
  qnews: { brand: "QNews", sub: { en: "Industry News Aggregator", ru: "Отраслевой агрегатор новостей", kk: "Салалық жаңалықтар агрегаторы" } },
  qmedia: { brand: "QMedia", sub: { en: "Music, Video & Creative AI", ru: "Музыка, видео и творческий ИИ", kk: "Музыка, бейне және шығармашылық ЖИ" } },
  qai: { brand: "QAI", sub: { en: "Real-time Streaming AI", ru: "Потоковый ИИ в реальном времени", kk: "Нақты уақыттағы ағынды ЖИ" } },
  qlearn: { brand: "QLearn", sub: { en: "Learning Platform", ru: "Платформа обучения", kk: "Оқу платформасы" } },
  qstore: { brand: "QStore", sub: { en: "Ecosystem Marketplace", ru: "Маркетплейс экосистемы", kk: "Экожүйе маркетплейсі" } },
  qevents: { brand: "QEvents", sub: { en: "Events & Conferences", ru: "События и конференции", kk: "Іс-шаралар мен конференциялар" } },
  constitution: { brand: "Constitution", sub: { en: "World-System Design Lab", ru: "Лаборатория проектирования мироустройства", kk: "Әлемдік жүйені жобалау зертханасы" } },
};

/** Карточки модулей на главной: заголовок и описание на трёх языках. */
export const HOME_CARDS: { id: string; href: string; t: Tr; d: Tr }[] = [
  { id: "qright", href: "/qright", t: { en: "QRight", ru: "QRight", kk: "QRight" }, d: {
    en: "Forever-verifiable IP. SHA-256, Ed25519, distributed Shamir shards, Bitcoin-anchored timestamps — works offline if AEVION goes dark.",
    ru: "Авторство, которое проверяется всегда: SHA-256, Ed25519, доли Шамира, отметка времени в Bitcoin — проверка работает офлайн, даже если AEVION перестанет работать.",
    kk: "Авторлықты әрқашан тексеруге болады: SHA-256, Ed25519, Шамир үлестері, Bitcoin уақыт белгісі — AEVION тоқтаса да, тексеру офлайн жұмыс істейді." } },
  { id: "qsign", href: "/qsign", t: { en: "QSign", ru: "QSign", kk: "QSign" }, d: {
    en: "Cryptographic data integrity via HMAC — same payload format as Bureau.",
    ru: "Криптографическая целостность данных через HMAC — тот же формат, что у Бюро.",
    kk: "HMAC арқылы деректердің криптографиялық тұтастығы — Бюромен бірдей пішім." } },
  { id: "bureau", href: "/bureau", t: { en: "IP Bureau", ru: "Патентное бюро", kk: "Авторлық бюросы" }, d: {
    en: "Sign and verify registry records — certificate-ready compliance.",
    ru: "Подпись и проверка записей реестра — документы, готовые к сертификату.",
    kk: "Тізілім жазбаларына қол қою және тексеру — сертификатқа дайын құжаттар." } },
  { id: "planet", href: "/planet", t: { en: "Planet", ru: "Planet", kk: "Planet" }, d: {
    en: "Compliance layer, evidence root, and transparency for regulatory reporting.",
    ru: "Слой соответствия, корень доказательств и прозрачность для отчётности регуляторам.",
    kk: "Сәйкестік қабаты, дәлелдер түбірі және реттеушілерге есеп берудің ашықтығы." } },
  { id: "bank", href: "/bank", t: { en: "AEVION Bank", ru: "Банк AEVION", kk: "AEVION Банкі" }, d: {
    en: "Digital wallet, P2P transfers, auto-royalties, and AEC credits economy.",
    ru: "Цифровой кошелёк, P2P-переводы, авто-роялти и экономика кредитов AEC.",
    kk: "Цифрлық әмиян, P2P аударымдар, авто-роялти және AEC кредиттер экономикасы." } },
  { id: "cyberchess", href: "/cyberchess", t: { en: "CyberChess", ru: "CyberChess", kk: "CyberChess" }, d: {
    en: "Next-gen chess platform — play AI, solve puzzles, earn ratings and titles.",
    ru: "Шахматы нового поколения — игра с ИИ, задачи, рейтинг и звания.",
    kk: "Жаңа буын шахматы — ЖИ-мен ойын, есептер, рейтинг пен атақтар." } },
  { id: "awards-music", href: "/awards/music", t: { en: "Music Awards", ru: "Music Awards", kk: "Music Awards" }, d: {
    en: "AEVION Music Awards showcase — submit via Planet and earn community votes.",
    ru: "Витрина AEVION Music Awards — подайте работу через Planet и соберите голоса сообщества.",
    kk: "AEVION Music Awards көрмесі — жұмысты Planet арқылы жіберіп, қауымдастық дауыстарын жинаңыз." } },
  { id: "awards-film", href: "/awards/film", t: { en: "Film Awards", ru: "Film Awards", kk: "Film Awards" }, d: {
    en: "AEVION Film Awards showcase — submit via Planet and earn community votes.",
    ru: "Витрина AEVION Film Awards — подайте фильм через Planet и соберите голоса сообщества.",
    kk: "AEVION Film Awards көрмесі — фильмді Planet арқылы жіберіп, қауымдастық дауыстарын жинаңыз." } },
];

export function moduleLang(lang: string): ModuleLang {
  return lang === "ru" || lang === "kk" ? lang : "en";
}

/** «Бренд — описание» на языке посетителя; неизвестный id — запасное имя из API как есть. */
export function moduleTitle(id: string, lang: string, fallback: string): string {
  const m = MODULE_NAMES[id];
  if (!m) return fallback;
  return m.sub ? `${m.brand} — ${m.sub[moduleLang(lang)]}` : m.brand;
}

/** Заголовки покупок на главной стоят под translate="no" (имя товара); описательные — переводим здесь. */
const BUY_TITLES: Record<string, Tr> = {
  "Every AEVION module": { en: "Every AEVION module", ru: "Все модули AEVION", kk: "AEVION-ның барлық модульдері" },
};
export function buyTitle(title: string, lang: string): string {
  return BUY_TITLES[title]?.[moduleLang(lang)] ?? title;
}
