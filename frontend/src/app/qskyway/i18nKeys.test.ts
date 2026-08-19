import { describe, test, expect } from "vitest";

/**
 * ⚠️ ЕСЛИ ЭТОТ ИМПОРТ СЛОМАЛСЯ — не чините его вслепую.
 *
 * Ветка `fix/devhub-media-insert-not-overwrite` (worktree aevion-qrenew)
 * разбирает `i18n-data.ts` на `lib/i18n-lang/{язык}.ts`: 2457 КБ → 2.7 КБ,
 * экспорта `translations` там больше нет. Замер 14.08.2026.
 *
 * Это значит, что при слиянии естественное решение — «взять их сторону
 * файла» — молча выбросит 24 строки переводов QSkyway, добавленные сюда
 * 14.08 (8 ключей × 3 локали: verify.checking/ok/failed/unknown,
 * just.unknown, tip.verifySig/noAutoClearance/smokeBooking). На странице
 * вместо текста появятся голые имена ключей, и НИЧЕГО не упадёт.
 *
 * Порядок при слиянии: перенести эти ключи в новые `i18n-lang/en|ru|kk.ts`,
 * переключить импорт ниже на новый источник и убедиться, что список KEYS
 * по-прежнему зелёный. Удалять список — нельзя: он и есть доказательство,
 * что перенос ничего не потерял.
 */
import { allTranslations } from "../__tests__/localeSource";

/**
 * Ключи модуля живут ровно в трёх локалях — en, ru, kk (остальные восемь в
 * файле переводов заглушки на два десятка строк). Потерять одну из трёх легко:
 * ключи добавляются вручную в три разных места одного большого файла, и язык,
 * до которого не дошли, молча показывает английский или пустоту.
 *
 * Вторая половина проверки важнее первой: подстановки внутри ключа должны
 * совпадать между языками. Ключ, где в русском есть {routable}, а в казахском
 * его забыли, не падает и не подсвечивается — он просто теряет ЧИСЛО, то есть
 * ровно то, ради чего строка написана. Именно так «задето маршрутов 23 из 42»
 * превращается в «задето маршрутов».
 */
const LOCALES = ["en", "ru", "kk"] as const;

const KEYS = [
  "qskyway.pad.prohibited",
  "qskyway.pad.cityProhibited",
  "qskyway.subst.head",
  "qskyway.subst.underRoutes",
  "qskyway.subst.noRoutes",
  "qskyway.verify.ephemeralKey",
  "qskyway.verify.checking",
  "qskyway.verify.ok",
  "qskyway.verify.failed",
  "qskyway.verify.unknown",
  "qskyway.just.unknown",
  "qskyway.tip.verifySig",
  "qskyway.tip.noAutoClearance",
  "qskyway.tip.smokeBooking",
  "qskyway.hero.eyebrow",
  "qskyway.hero.lede1",
  "qskyway.hero.lede2",
  "qskyway.hero.disclaimer",
  "qskyway.city.label",
  "qskyway.err.cityLoad",
  "qskyway.map.head",
  "qskyway.loading.city",
  "qskyway.btn.newFlight",
  "qskyway.btn.heightColors",
  "qskyway.strict.tipOn",
  "qskyway.strict.tipOff",
  "qskyway.strict.on",
  "qskyway.strict.off",
  "qskyway.pad.candidate",
  "qskyway.pad.needsInfra",
  "qskyway.pad.unsuitable",
  "qskyway.pad.unrated",
  "qskyway.btn.pause",
  "qskyway.btn.play",
  "qskyway.btn.traffic",
  "qskyway.wind.label",
  "qskyway.wind.metarTip",
  "qskyway.wind.demoTip",
  "qskyway.wind.demo",
  "qskyway.unit.buildings",
  "qskyway.height.suspect",
  "qskyway.panel.heightProfile",
  "qskyway.panel.telemetry",
  "qskyway.tel.distance",
  "qskyway.tel.cruiseAlt",
  "qskyway.tel.eta",
  "qskyway.tel.separated",
  "qskyway.tel.heightConfidence",
  "qskyway.unit.km",
  "qskyway.unit.m",
  "qskyway.unit.min",
  "qskyway.tel.windSuffix",
  "qskyway.tel.byBuildings",
  "qskyway.tel.confClearance",
  "qskyway.route.noCeilingLimit",
  "qskyway.route.withinCeiling",
  "qskyway.route.aboveCeiling",
  "qskyway.route.lowestCeiling",
  "qskyway.btn.bookSlot",
  "qskyway.panel.padSuitability",
  "qskyway.pad.needsAtc",
  "qskyway.pad.algorithmicNote",
  "qskyway.panel.slotMarket",
  "qskyway.slots.testSuffix",
  "qskyway.slots.empty",
  "qskyway.legend.pads",
  "qskyway.legend.needsInfraShort",
  "qskyway.legend.heightGuessed",
  "qskyway.just.heights",
  "qskyway.just.noCityMeasure",
  "qskyway.pad.rowDetails",
  "qskyway.pad.ceiling",
  "qskyway.slots.storeDurable",
  "qskyway.slots.storeMemory",
  "qskyway.slots.testBadge",
  "qskyway.dispute.tagVsLevels",
  "qskyway.dispute.published",
  "qskyway.dispute.ratio",
  "qskyway.dispute.affects",
  "qskyway.dispute.noEffect",
  "qskyway.subst.byType",
  "qskyway.wind.value",
  "qskyway.subst.tipHead",
  "qskyway.subst.tipExample",
  "qskyway.subst.tipTail",
  "qskyway.height.suspectTip",
  "qskyway.tel.obstacleTip",
  "qskyway.just.byBuildingsSuffix",
  "qskyway.booking.netError",
  "prov.measured",
  "prov.derived",
  "prov.guessed",
  "qskyway.slots.receipt",
  "qskyway.slots.capacity",
  "qskyway.reg.subject.prohibition",
  "qskyway.reg.subject.permission",
  "qskyway.impact.head",
  "qskyway.impact.body",
];

const placeholders = (s: string): string[] => (s.match(/\{(\w+)\}/g) ?? []).sort();

/**
 * Совпадение английского значения с русским — почти всегда копипаста при
 * добавлении ключа: ключ есть во всех локалях, подстановки совпадают, все
 * прежние проверки зелёные, а англоязычный читатель видит кириллицу.
 *
 * Замер 19.08.2026 на 95 ключах: таких случаев НОЛЬ. Проверка заведена,
 * чтобы так и осталось.
 *
 * Казахский сюда НЕ включён намеренно: там шесть значений законно совпадают
 * с русскими («трафик», «демо», «телеметрия», «км», «м», «мин» — заимствования
 * и сокращения, которые в казахском пишутся так же). Требовать различий
 * значило бы заставлять переводить то, что перевода не требует.
 */
const SAME_EN_RU_ALLOWED: string[] = [];

describe("ключи перевода qskyway", () => {
  for (const key of KEYS) {
    test(`${key} — есть во всех трёх языках и с теми же подстановками`, () => {
      const values = LOCALES.map((l) => {
        const dict = (allTranslations() as Record<string, Record<string, string>>)[l];
        return dict?.[key];
      });
      for (const [i, v] of values.entries()) {
        expect(v, `${key} отсутствует в локали ${LOCALES[i]}`).toBeTruthy();
      }
      const sets = values.map((v) => placeholders(v as string));
      for (const [i, set] of sets.entries()) {
        expect(set, `${key}: подстановки в ${LOCALES[i]} разошлись с ${LOCALES[0]}`).toEqual(sets[0]);
      }
    });
  }

  test("тексты для человека не выдают устройство системы", () => {
    // Ворота запуска, пункт 4: «тексты ошибок — человеческие, без кодов и
    // адресов серверов». 19.08.2026 карточка ошибки на этой странице
    // советовала посетителю «проверь, что бэкенд поднят» и печатала путь
    // /api/qskyway/city, а ошибка бронирования показывала сырое исключение.
    // Это указания разработчику, показанные человеку.
    //
    // Проверяем ЗНАЧЕНИЯ всех ключей модуля во всех локалях.
    const tbl = allTranslations() as Record<string, Record<string, string>>;
    const FORBIDDEN: { re: RegExp; why: string }[] = [
      { re: /\/api\//, why: "путь API" },
      { re: /https?:\/\//, why: "адрес сервера" },
      { re: /localhost|127\.0\.0\.1/, why: "локальный адрес" },
      { re: /бэкенд|backend/i, why: "слово «бэкенд» — это про наше устройство, не про человека" },
      { re: /\{(err|detail|stack)\}/, why: "сырое значение ошибки" },
    ];
    // Исключение с причиной, а не ослабление правила: подсказка про чек
    // брони НАЗЫВАЕТ публичную ручку проверки намеренно. В этом и ценность
    // модуля для регулятора — «проверьте сами вот здесь», а не «поверьте
    // нам». Убирать оттуда адрес значило бы убрать саму проверяемость.
    const ALLOWED_TO_NAME_ENDPOINT = new Set(["qskyway.slots.receipt"]);

    const bad: string[] = [];
    for (const lang of LOCALES) {
      for (const k of KEYS) {
        const v = tbl[lang]?.[k];
        if (!v) continue;
        const isPublicEndpointDoc = ALLOWED_TO_NAME_ENDPOINT.has(k);
        for (const f of FORBIDDEN) {
          if (isPublicEndpointDoc && f.why === "путь API") continue;
          if (f.re.test(v)) bad.push(`${lang}/${k}: ${f.why} → ${v.slice(0, 50)}`);
        }
      }
    }
    expect(bad, "текст для человека выдаёт устройство системы").toEqual([]);
  });

  test("английский перевод не равен русскому (ловит копипасту)", () => {
    const tbl = allTranslations() as Record<string, Record<string, string>>;
    const same = KEYS.filter((k) => {
      const ru = tbl.ru?.[k];
      const en = tbl.en?.[k];
      return ru != null && en != null && ru === en && !SAME_EN_RU_ALLOWED.includes(k);
    });
    expect(same, "английское значение совпало с русским — похоже, ключ скопировали").toEqual([]);
  });
});
