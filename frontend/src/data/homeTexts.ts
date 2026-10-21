// 🔴 21.10.2026 (окно Приложения, задача оркестратора): остаток kk-главной после шапки и подвала —
// замер yazyk-glavnaya-porog.mjs на ee436fb36, 10 латинских строк на каждой из 5 пар окон.
// Здесь — подписи двух рядов ссылок на модули («Other modules» и ряд под каталогом) и блока
// «Какой социальный контракт строит AEVION». Блок был русскими литералами: en-посетитель видел
// его английским только через живой перевод ru→en, а при паузе квоты DeepL — русским
// (прод 21.10: 60 кириллических строк на en 540×900). kk — черновик, на вычитку носителю.
import type { ModuleLang } from "./moduleNames";

type Tr = Record<ModuleLang, string>;

export const HOME_TEXT = {
  otherModules: { en: "Other modules", ru: "Другие модули", kk: "Басқа модульдер" },
  qrightRegistry: { en: "QRight Registry", ru: "Реестр QRight", kk: "QRight тізілімі" },
  qcoreMulti: { en: "QCoreAI · Multi-agent", ru: "QCoreAI · Мультиагент", kk: "QCoreAI · Көп агентті" },
  musicAwards: { en: "Music Awards", ru: "Музыкальные премии", kk: "Музыка сыйлықтары" },
  filmAwards: { en: "Film Awards", ru: "Кинопремии", kk: "Кино сыйлықтары" },
  fullDemo: { en: "Full demo", ru: "Полное демо", kk: "Толық демо" },
  investorPitch: { en: "Investor pitch", ru: "Питч для инвесторов", kk: "Инвесторларға питч" },
  ipBureau: { en: "IP Bureau", ru: "Патентное бюро", kk: "Авторлық бюросы" },
  planet: { en: "Planet", ru: "Планета", kk: "Планета" },
  multiAgent: { en: "Multi-agent", ru: "Мультиагент", kk: "Көп агентті" },
  auth: { en: "Auth", ru: "Авторизация", kk: "Кіру" },
  constLabel: { en: "AEVION fingerprint", ru: "Отпечаток AEVION", kk: "AEVION таңбасы" },
  constTitle: {
    en: "What social contract AEVION is building",
    ru: "Какой социальный контракт строит AEVION",
    kk: "AEVION қандай қоғамдық келісім құрып жатыр",
  },
  constText: {
    en: "Open access as the ecosystem's philosophy: a high floor at the bottom, law above the top, rotation, transparency, polycentricity. This isn't marketing — it's 8 concrete sliders built into the design of every platform module.",
    ru: "Open Access как философия экосистемы: высокий пол снизу, закон над верхом, ротация, прозрачность, полицентричность. Это не маркетинг — это конкретные 8 ползунков, заложенных в дизайн каждого модуля платформы.",
    kk: "Экожүйенің философиясы — ашық қолжетімділік: төменде биік еден, жоғарыда заң үстемдігі, ротация, ашықтық, көп орталықтылық. Бұл маркетинг емес — платформаның әр модулінің дизайнына салынған нақты 8 жүгірткі.",
  },
  constCta: { en: "Build your own constitution →", ru: "Построить свою конституцию →", kk: "Өз конституцияңызды құрыңыз →" },
} satisfies Record<string, Tr>;

export type HomeTextKey = keyof typeof HOME_TEXT;

export function homeText(key: HomeTextKey, lang: ModuleLang): string {
  return HOME_TEXT[key][lang];
}
