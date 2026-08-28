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
  // Прочерк «зоны рядом нет» отдельным ключом: раньше на его месте стоял
  // символ «—», приклеенный в коде вместе с русской единицей.
  "qskyway.pad.rowDetailsFar",
  // Пояснение знаковой договорённости у разницы времени с ветром.
  "qskyway.tel.windTip",
  // Добавлены 28.08.2026: чипы спорной высоты и суффикс доли по зданиям.
  // Пятый ключ — честная замена «×undefined к застройке»: при отсутствии
  // кратности говорим, что высота под вопросом, и не выдумываем число.
  "qskyway.disp.vsLevels",
  "qskyway.disp.vsPublished",
  "qskyway.disp.vsBuilt",
  "qskyway.disp.suspectPlain",
  "qskyway.just.byBuildings",
  // Добавлены 28.08.2026 вместе с переводом четырёх мест, где страница
  // говорила по-русски независимо от выбранного языка: единицы ветра,
  // сообщение об ошибке сети и два чипа влияния спорной высоты.
  "qskyway.meta.wind",
  "qskyway.err.network",
  "qskyway.disp.affects",
  "qskyway.disp.noAffect",
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
  "qskyway.tel.blindInert",
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
  "qskyway.slots.receipt",
  "qskyway.slots.capacity",
  "qskyway.reg.subject.prohibition",
  "qskyway.reg.subject.permission",
  "qskyway.impact.head",
  "qskyway.impact.body",
];

const placeholders = (s: string): string[] => (s.match(/\{(\w+)\}/g) ?? []).sort();

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

  test("успех брони называет её демонстрационной на всех трёх языках", () => {
    // Человек видит квитанцию `✓ slot-… · qright:…`. Без прямой оговорки он
    // читает это как занятое им воздушное окно, тогда как демо-кнопка
    // подписывается зашитым «AEVION demo» и в глубину рынка не идёт
    // (сервер: aevion-globus-backend/src/lib/slotOrigin.ts).
    const dicts = allTranslations() as Record<string, Record<string, string>>;
    const marker: Record<string, string> = { en: "demo", ru: "демонстрац", kk: "демонстрац" };
    for (const [lang, word] of Object.entries(marker)) {
      const text = dicts[lang]?.["qskyway.book.demoOk"];
      expect(text, `ключ отсутствует в ${lang}`).toBeTruthy();
      expect(text.toLowerCase(), `в ${lang} бронь не названа демонстрационной`).toContain(word);
      // Квитанция обязана остаться: оговорка не должна вытеснить сам номер.
      expect(text, `в ${lang} потерян номер брони`).toContain("{id}");
      expect(text, `в ${lang} потеряна квитанция`).toContain("{receipt}");
    }
  });
});
