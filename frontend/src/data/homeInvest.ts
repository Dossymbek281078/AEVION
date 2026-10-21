// 🔴 21.10.2026 (окно Приложения, задача оркестратора): блок «Why partner with AEVION» на главной
// шёл живым переводом, и на kk в нём оставались английские фразы (Creator economy, Trust Graph,
// Shamir's Secret Sharing — замер yazyk-glavnaya-porog.mjs на ee436fb36, 4 строки на каждом окне).
// Решение оркестратора: «Trust Graph» (имя нашего модуля) и «Shamir's Secret Sharing» (имя
// алгоритма) — имена, они в brandNames.json; прочие фразы переводятся. Тексты блока — здесь,
// на трёх языках; числа — только из pitchFacts (сторож pitchNumbers читает этот файл).
// kk — черновик, на вычитку носителю.
import type { ModuleLang } from "./moduleNames";
import { MODULE_NODES, TAM, BOTTOM_UP_REGIONAL_ARR, BOTTOM_UP_BEACHHEAD_ARR } from "./pitchFacts";

type Tr = Record<ModuleLang, string>;
/** metric — строка, если это число/величина одинаковая на всех языках; иначе перевод. */
export type InvestCard = { title: Tr; desc: Tr; metric: string | Tr; sub: Tr };

export const INVEST_HEAD = {
  kicker: { en: "FOR INVESTORS", ru: "ДЛЯ ИНВЕСТОРОВ", kk: "ИНВЕСТОРЛАРҒА" },
  title: { en: "Why partner with AEVION", ru: "Почему стоит работать с AEVION", kk: "Неліктен AEVION-мен серіктес болу керек" },
  demo: { en: "Full investor demo →", ru: "Полное демо для инвесторов →", kk: "Инвесторларға толық демо →" },
  tryIt: { en: "Try the pipeline yourself →", ru: "Попробуйте конвейер сами →", kk: "Конвейерді өзіңіз байқап көріңіз →" },
} satisfies Record<string, Tr>;

export const INVEST_CARDS: InvestCard[] = [
  {
    title: { en: "First-mover lead", ru: "Преимущество первого", kk: "Бірінші болу артықшылығы" },
    desc: {
      en: "A first-mover, fully integrated proof-of-authorship bureau. The moat is the integrated Trust Graph and network effects — a competitor must rebuild all five layers as one system, not just copy the idea.",
      ru: "Первое полностью интегрированное бюро доказательства авторства. Защита — единый Trust Graph и сетевые эффекты: конкуренту придётся заново построить все пять слоёв как одну систему, а не просто скопировать идею.",
      kk: "Авторлықты дәлелдейтін алғашқы толық біріктірілген бюро. Қорғаныс — біртұтас Trust Graph және желілік әсерлер: бәсекелес идеяны көшіріп қана қоймай, бес қабатты бір жүйе ретінде қайта құруы керек.",
    },
    metric: { en: "5-in-1", ru: "5 в 1", kk: "5 бірде" },
    sub: { en: "integrated pipeline", ru: "единый конвейер", kk: "біртұтас конвейер" },
  },
  {
    title: { en: `${TAM} addressable market`, ru: `Доступный рынок ${TAM}`, kk: `Қолжетімді нарық ${TAM}` },
    desc: {
      en: "IP licensing ($180B) + Creator economy ($104B) + Digital payments ($56B). AEVION sits at the intersection of all three.",
      ru: "Лицензирование IP ($180B) + экономика авторов ($104B) + цифровые платежи ($56B). AEVION стоит на пересечении всех трёх.",
      kk: "IP лицензиялау ($180B) + авторлар экономикасы ($104B) + цифрлық төлемдер ($56B). AEVION үшеуінің түйіскен жерінде тұр.",
    },
    metric: TAM,
    sub: { en: "TAM", ru: "TAM", kk: "TAM" },
  },
  {
    title: { en: "4 network effects", ru: "4 сетевых эффекта", kk: "4 желілік әсер" },
    desc: {
      en: "Trust Graph (data), Creator Economy (economic), Financial (switching costs), Cross-module (scope) — each one alone justifies investment.",
      ru: "Trust Graph (данные), экономика авторов (экономический), финансовый (стоимость перехода), межмодульный (охват) — каждый в одиночку оправдывает вложения.",
      kk: "Trust Graph (деректер), авторлар экономикасы (экономикалық), қаржылық (ауысу құны), модульаралық (қамту) — әрқайсысы жеке өзі инвестицияны ақтайды.",
    },
    metric: "4x",
    sub: { en: "compounding moats", ru: "нарастающая защита", kk: "өсетін қорғаныс" },
  },
  {
    title: { en: `${MODULE_NODES} product nodes`, ru: `Продуктовых узлов: ${MODULE_NODES}`, kk: `${MODULE_NODES} өнім түйіні` },
    desc: {
      en: "Not slides. Working code deployed at aevion.app. Full pipeline: register → sign → certify → earn. Try it yourself.",
      ru: "Не слайды. Рабочий код на aevion.app. Полный конвейер: регистрация → подпись → сертификат → доход. Попробуйте сами.",
      kk: "Слайдтар емес. aevion.app сайтындағы жұмыс істейтін код. Толық конвейер: тіркеу → қол қою → сертификат → табыс. Өзіңіз байқап көріңіз.",
    },
    metric: `${MODULE_NODES}`,
    sub: { en: "nodes on the map", ru: "узлов на карте", kk: "картадағы түйін" },
  },
  {
    title: { en: "Quantum-resistant", ru: "Устойчивость к квантовым атакам", kk: "Кванттық шабуылға төзімді" },
    desc: {
      en: "Ed25519 + Shamir's Secret Sharing + HMAC-SHA256. Ready for post-quantum migration. No other IP platform has this.",
      ru: "Ed25519 + Shamir's Secret Sharing + HMAC-SHA256. Готово к переходу на постквантовую криптографию. Ни у одной другой IP-платформы этого нет.",
      kk: "Ed25519 + Shamir's Secret Sharing + HMAC-SHA256. Посткванттық криптографияға көшуге дайын. Басқа ешбір IP платформасында мұндай жоқ.",
    },
    metric: { en: "3-layer", ru: "3 слоя", kk: "3 қабат" },
    sub: { en: "crypto shield", ru: "криптозащита", kk: "крипто қорғаныс" },
  },
  {
    title: { en: "Bottom-up revenue model", ru: "Модель выручки снизу вверх", kk: "Төменнен жоғары табыс моделі" },
    desc: {
      en: `Conservative bottom-up from real published prices on 3 of the modules: ${BOTTOM_UP_BEACHHEAD_ARR} beachhead → ${BOTTOM_UP_REGIONAL_ARR} regional modelled ARR. The rest is upside. Company is pre-revenue today.`,
      ru: `Осторожный расчёт снизу вверх по реальным опубликованным ценам 3 модулей: ${BOTTOM_UP_BEACHHEAD_ARR} на плацдарме → ${BOTTOM_UP_REGIONAL_ARR} модельной годовой выручки в регионе. Остальное — потенциал роста. Выручки у компании сегодня ещё нет.`,
      kk: `3 модульдің нақты жарияланған бағалары бойынша төменнен жоғары сақ есеп: бастапқы нарықта ${BOTTOM_UP_BEACHHEAD_ARR} → өңірде ${BOTTOM_UP_REGIONAL_ARR} модельдік жылдық табыс. Қалғаны — өсу әлеуеті. Компанияның бүгін әлі табысы жоқ.`,
    },
    metric: BOTTOM_UP_REGIONAL_ARR,
    sub: { en: "modelled ARR · 3 flagships", ru: "модельный ARR · 3 флагмана", kk: "модельдік ARR · 3 флагман" },
  },
];
