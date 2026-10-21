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
