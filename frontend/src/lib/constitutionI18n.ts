/**
 * Подписи виджета конституции (ConstitutionEmbed) на ru/en/kk.
 *
 * 21.10.2026, окно «Приложения», задача оркестратора: на главной виджет стоит в блоке
 * «Какой социальный контракт строит AEVION», и его подписи (имя режима, эпоха, короткие
 * оси «Pos-sum», «Multi-status», «Инновация», «Устойчивость») были русскими литералами
 * lib/constitution.ts. en-посетитель видел их английскими только через живой перевод
 * ru→en; при паузе квоты DeepL — русскими (замер на проде 21.10: 60 кириллических строк
 * на en 540×900). На kk «Pos-sum» и «Open Access» оставались латиницей.
 *
 * ru здесь не дублируется: русские тексты по-прежнему живут в lib/constitution.ts
 * (classify, SLIDER_SHORT_LABELS) — это источник для страницы /constitution.
 * kk — черновик, на вычитку носителю.
 */
import type { Sliders } from "@/lib/constitution";

export type ConstitutionLang = "ru" | "en" | "kk";
type Tr2 = { en: string; kk: string };

export const SHORT_LABELS: Record<"en" | "kk", Record<keyof Sliders, string>> = {
  en: {
    floor: "Floor",
    ruleOfLaw: "Law",
    rotation: "Rotation",
    transparency: "Transp.",
    multiStatus: "Multi-status",
    skinInGame: "Skin",
    polycentricity: "Polycentr.",
    positiveSum: "Pos-sum",
  },
  kk: {
    floor: "Еден",
    ruleOfLaw: "Заң",
    rotation: "Ротация",
    transparency: "Ашықтық",
    multiStatus: "Көп мәртебе",
    skinInGame: "Тәуекел",
    polycentricity: "Көп орталық",
    positiveSum: "Оң қосынды",
  },
};

/** Имя и эпоха режима по id из classify(). Набор id сверяет сторож. */
export const REGIME_TEXT: Record<string, { name: Tr2; era: Tr2 }> = {
  "open-access": {
    name: { en: "Open Access Order", kk: "Ашық тәртіп" },
    era: { en: "Ideal — North / Wallis / Weingast", kk: "Идеал — Норт / Уоллис / Вайнгаст" },
  },
  nordic: {
    name: { en: "Nordic model", kk: "Скандинавиялық модель" },
    era: { en: "Sweden / Denmark / Norway — after 1945", kk: "Швеция / Дания / Норвегия — 1945 жылдан кейін" },
  },
  totalitarian: {
    name: { en: "Totalitarian dictatorship", kk: "Тоталитарлық диктатура" },
    era: { en: "Stalin's USSR, Maoist China, North Korea", kk: "Сталиндік КСРО, Мао Қытайы, КХДР" },
  },
  authoritarian: {
    name: { en: "Authoritarian vertical", kk: "Авторитарлық тік билік" },
    era: { en: "20th century — Latin America, post-Soviet regimes", kk: "ХХ ғасыр — Латын Америкасы, посткеңестік режимдер" },
  },
  "extractive-boom": {
    name: { en: "Extractive boom", kk: "Шикізаттық бум" },
    era: { en: "Belgian Congo; oil cycles", kk: "Бельгиялық Конго; мұнай циклдері" },
  },
  "network-post-nation": {
    name: { en: "Networked post-nation", kk: "Желілік постұлт" },
    era: { en: "Hypothesis — competing jurisdictions of the 2030s", kk: "Болжам — 2030 жылдардың бәсекелес юрисдикциялары" },
  },
  feudalism: {
    name: { en: "Late feudalism", kk: "Кеш феодализм" },
    era: { en: "Europe, 14th–17th c.; neo-feudal scenarios", kk: "Еуропа, XIV–XVII ғғ.; жаңа феодалдық сценарийлер" },
  },
  "ancient-polis": {
    name: { en: "Ancient polis", kk: "Антикалық полис" },
    era: { en: "Athens, 5th c. BC", kk: "Афины, б.з.д. V ғасыр" },
  },
  "modern-liberal": {
    name: { en: "Modern liberal democracy", kk: "Қазіргі либералдық демократия" },
    era: { en: "EU / US / Japan / Canada — 21st century", kk: "ЕО / АҚШ / Жапония / Канада — XXI ғасыр" },
  },
  mixed: {
    name: { en: "Mixed unstable regime", kk: "Аралас тұрақсыз режим" },
    era: { en: "Hybrid — too early to classify", kk: "Гибрид — жіктеуге әлі ерте" },
  },
};

export const METRIC_LABELS: Record<ConstitutionLang, { innovation: string; stability: string }> = {
  ru: { innovation: "Инновация", stability: "Устойчивость" },
  en: { innovation: "Innovation", stability: "Stability" },
  kk: { innovation: "Инновация", stability: "Тұрақтылық" },
};

/* ───────── 5.11.2026, окно «Приложения»: тексты редактора и знакомства ─────────
 * Замер на проде 5.11 (en-US, 1463×724): в редакторе /constitution?country=us 44 строки
 * по-русски — подсказки и полюса ползунков, имена стран и пресетов. Метки ползунков
 * (label) уже шли через словарь t(), а hint/low/high/name жили русскими литералами в
 * lib/constitution.ts и зависели от живого перевода. Русский источник остаётся там же;
 * здесь только en/kk. kk — черновик, на вычитку носителю.
 */
export type SliderText = { hint: string; low: string; high: string };

export const SLIDER_TEXT: Record<"en" | "kk", Record<keyof Sliders, SliderText>> = {
  en: {
    floor: { hint: "Guaranteed minimum: basic income / education / health", low: "Every man for himself", high: "No one falls below the floor" },
    ruleOfLaw: { hint: "Even an oligarch can lose in court", low: "Law for the poor", high: "Everyone is equal under the law" },
    rotation: { hint: "Randomly chosen citizens in chambers, councils, juries", low: "Lifelong castes", high: "Regular turnover by lot" },
    transparency: { hint: "Open declarations, public record of decisions", low: "Smoke-filled rooms", high: "Glass corridors" },
    multiStatus: { hint: "Respect through science, craft, care, art, not only money", low: "One axis: money / power", high: "Many legitimate arenas" },
    skinInGame: { hint: "Whoever decides bears the consequences personally (Taleb)", low: "Some decide, others answer", high: "Everyone has their own stakes" },
    polycentricity: { hint: "Real sovereignty of local jurisdictions (Ostrom)", low: "Super-state", high: "Federation of localities" },
    positiveSum: { hint: "A pie that visibly and truly grows (Acemoglu/Robinson)", low: "Carving up a fixed pie", high: "A growing economy for everyone" },
  },
  kk: {
    floor: { hint: "Кепілдік берілген минимум: базалық табыс / білім / денсаулық", low: "Әркім өз қамын ойлайды", high: "Ешкім еденнен төмен түспейді" },
    ruleOfLaw: { hint: "Олигарх та сотта ұтылуы мүмкін", low: "Заң кедейлерге ғана", high: "Заң алдында бәрі тең" },
    rotation: { hint: "Палаталарда, кеңестерде, қазылар алқасында кездейсоқ таңдалған азаматтар", low: "Өмір бойғы касталар", high: "Жеребе арқылы тұрақты ауысу" },
    transparency: { hint: "Ашық декларациялар, шешімдердің жария есебі", low: "Жабық бөлмелер", high: "Шыны дәліздер" },
    multiStatus: { hint: "Ғылым, қолөнер, қамқорлық, өнер арқылы құрмет, тек ақша емес", low: "Бір ось: ақша / билік", high: "Көптеген заңды арена" },
    skinInGame: { hint: "Шешім қабылдаған адам салдарын өзі көтереді (Талеб)", low: "Біреулер шешеді, басқалары жауап береді", high: "Әркім өз тәуекелінде" },
    polycentricity: { hint: "Жергілікті юрисдикциялардың нақты егемендігі (Остром)", low: "Аса мемлекет", high: "Жергілікті қауымдастықтар федерациясы" },
    positiveSum: { hint: "Көзге көрініп, шынымен өсетін пирог (Acemoglu/Robinson)", low: "Тұрақты пирогты бөлісу", high: "Барлығына арналған өсетін экономика" },
  },
};

/** Имя страны по коду (ru-источник — COUNTRIES[].name). */
export const COUNTRY_NAMES: Record<string, Tr2> = {
  us: { en: "USA", kk: "АҚШ" },
  de: { en: "Germany", kk: "Германия" },
  no: { en: "Norway", kk: "Норвегия" },
  jp: { en: "Japan", kk: "Жапония" },
  sg: { en: "Singapore", kk: "Сингапур" },
  ae: { en: "UAE", kk: "БАӘ" },
  sa: { en: "Saudi Arabia", kk: "Сауд Арабиясы" },
  ru: { en: "Russia", kk: "Ресей" },
  cn: { en: "China", kk: "Қытай" },
  ir: { en: "Iran", kk: "Иран" },
  kp: { en: "North Korea", kk: "КХДР" },
  ve: { en: "Venezuela", kk: "Венесуэла" },
  in: { en: "India", kk: "Үндістан" },
  br: { en: "Brazil", kk: "Бразилия" },
  kz: { en: "Kazakhstan", kk: "Қазақстан" },
};

/** Имя пресета по русскому имени из PRESETS (оно же ключ). */
export const PRESET_NAMES: Record<string, Tr2> = {
  "Open Access (идеал)": { en: "Open Access (ideal)", kk: "Open Access (идеал)" },
  "Скандинавская": { en: "Nordic", kk: "Скандинавиялық" },
  "США XXI века": { en: "21st-century USA", kk: "XXI ғасыр АҚШ" },
  "Авторитарная": { en: "Authoritarian", kk: "Авторитарлық" },
  "Феодализм": { en: "Feudalism", kk: "Феодализм" },
  "Сингапур": { en: "Singapore", kk: "Сингапур" },
  "ОАЭ": { en: "UAE", kk: "БАӘ" },
  "Саудовская Аравия": { en: "Saudi Arabia", kk: "Сауд Арабиясы" },
  "СССР 1980": { en: "USSR 1980", kk: "КСРО 1980" },
  "Кочевая Степь": { en: "Nomadic Steppe", kk: "Көшпенді дала" },
};

type AnyLang = string | undefined | null;
const чужойЯзык = (lang: AnyLang): "en" | "kk" | null => (lang === "en" || lang === "kk" ? lang : null);

/** Подсказка и полюса ползунка на языке читателя; ru и прочие языки — русский источник. */
export function sliderText(key: keyof Sliders, lang: AnyLang, ru: SliderText): SliderText {
  const l = чужойЯзык(lang);
  return l ? SLIDER_TEXT[l][key] : { hint: ru.hint, low: ru.low, high: ru.high };
}

export function countryName(code: string, lang: AnyLang, ru: string): string {
  const l = чужойЯзык(lang);
  return (l && COUNTRY_NAMES[code]?.[l]) || ru;
}

export function presetName(ruName: string, lang: AnyLang): string {
  const l = чужойЯзык(lang);
  return (l && PRESET_NAMES[ruName]?.[l]) || ruName;
}

/** Имя и эпоха режима на языке читателя; ru и прочие языки — русский источник из classify(). */
export function regimeText(r: { id: string; name: string; era: string }, lang: AnyLang): { name: string; era: string } {
  const l = чужойЯзык(lang);
  const t = l ? REGIME_TEXT[r.id] : undefined;
  return l && t ? { name: t.name[l], era: t.era[l] } : { name: r.name, era: r.era };
}
