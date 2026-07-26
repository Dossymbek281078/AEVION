import { describe, test, expect } from "vitest";
import { computeFan, fanPreview, buildQuoteWithFan } from "../src/data/fanDiscounts";

/**
 * Второй слой защиты на денежной точке входа.
 *
 * Повод: вычитка дифа 2026-07-26. Ручки нормализуют вход (`parseCurrency`,
 * `seats` через `Number.isFinite`), поэтому ЖИВОГО дефекта нет — но движок
 * внутри делал `CURRENCY_RATES[currency].rate` и `Math.max(1, seats ?? 1)`,
 * а оба выражения тихо дают мусор, а не отказ:
 *   - прототипный ключ валюты → курс `undefined` → вся смета в `NaN` при 200;
 *   - `Math.max(1, NaN)` — это `NaN`, а не 1 (тот же капкан, что в `?limit=`).
 *
 * Эти функции экспортированы и зовутся из нескольких мест; следующий
 * вызывающий про `parseCurrency` знать не обязан. Тест держит второй слой.
 */

const JUNK_CURRENCY = ["constructor", "__proto__", "toString", "valueOf", "БЕЛИБЕРДА", "", "usd"];

describe("движок веера не доверяет вызывающему", () => {
  test("computeFan: мусорная валюта откатывается на USD, числа остаются числами", () => {
    for (const cur of JUNK_CURRENCY) {
      const fan = computeFan({ owned: ["qsign"], currency: cur as never });
      expect(fan.currency, `currency=${cur} не откатился на USD`).toBe("USD");
      for (const o of fan.offers) {
        expect(Number.isFinite(o.priceMonthly), `${cur}/${o.module}: priceMonthly=${o.priceMonthly}`).toBe(true);
        expect(Number.isFinite(o.savingMonthly)).toBe(true);
      }
      expect(Number.isFinite(fan.summary.maxSavingMonthly)).toBe(true);
    }
  });

  test("computeFan: НАСТОЯЩАЯ валюта по-прежнему конвертирует", () => {
    // Без этой половины проверка выше совместима с «функция всегда отдаёт USD».
    const usd = computeFan({ owned: ["qsign"], currency: "USD" });
    const kzt = computeFan({ owned: ["qsign"], currency: "KZT" });
    expect(kzt.currency).toBe("KZT");
    const usdOffer = usd.offers.find((o) => o.listMonthly > 0)!;
    const kztOffer = kzt.offers.find((o) => o.module === usdOffer.module)!;
    expect(kztOffer.listMonthly).toBeGreaterThan(usdOffer.listMonthly * 100);
  });

  test("fanPreview: то же самое на витрине", () => {
    for (const cur of JUNK_CURRENCY) {
      const rows = fanPreview(cur as never);
      expect(rows.length).toBeGreaterThan(5);
      for (const r of rows) {
        expect(Number.isFinite(r.listMonthly), `${cur}/${r.module}: listMonthly=${r.listMonthly}`).toBe(true);
        expect(Number.isFinite(r.ring1SavingMonthly)).toBe(true);
      }
    }
    // И настоящая валюта по-прежнему меняет числа.
    const usd = fanPreview("USD");
    const kzt = fanPreview("KZT");
    expect(kzt[0].listMonthly).toBeGreaterThan(usd[0].listMonthly * 100);
  });

  test("🔴 buildQuoteWithFan: мусорные seats не уводят смету в NaN", () => {
    // Math.max(1, NaN) === NaN — самое коварное место: выражение читается как
    // «пол 1», но пола не даёт, и NaN протекает в КАЖДУЮ строку сметы.
    for (const seats of [Number.NaN, Number.POSITIVE_INFINITY, "3" as never, null as never, {} as never, -5, 0, 1e12]) {
      const q = buildQuoteWithFan({ tierId: "medium", seats: seats as never, modules: ["qsign"] });
      expect(Number.isFinite(q.total), `seats=${String(seats)}: total=${q.total}`).toBe(true);
      expect(Number.isFinite(q.subtotal)).toBe(true);
      expect(q.total, `seats=${String(seats)}: отрицательный итог`).toBeGreaterThanOrEqual(0);
      for (const line of q.lines) {
        expect(Number.isFinite(line.total), `seats=${String(seats)}: строка "${line.label}" = ${line.total}`).toBe(true);
      }
    }
  });

  test("buildQuoteWithFan: настоящие seats по-прежнему меняют цену", () => {
    // Иначе тест выше проходил бы и при «seats всегда 1».
    const one = buildQuoteWithFan({ tierId: "medium", seats: 1 });
    const ten = buildQuoteWithFan({ tierId: "medium", seats: 10 });
    expect(ten.total).toBeGreaterThan(one.total);
    // И потолок 1000 держится: миллиард мест не дороже тысячи.
    const huge = buildQuoteWithFan({ tierId: "medium", seats: 1e12 });
    const max = buildQuoteWithFan({ tierId: "medium", seats: 1000 });
    expect(huge.total).toBe(max.total);
  });

  test("buildQuoteWithFan: мусорная валюта не роняет смету", () => {
    for (const cur of JUNK_CURRENCY) {
      const q = buildQuoteWithFan({ tierId: "medium", currency: cur as never, modules: ["qsign"] });
      expect(q.currency).toBe("USD");
      expect(Number.isFinite(q.total), `currency=${cur}: total=${q.total}`).toBe(true);
    }
  });
});

/**
 * 🔴 Всеобъемлющие тарифы не получают предложений «докупи».
 *
 * Найдено прогоном 2026-07-26: `includedIn` НИ У ОДНОГО модуля не содержит
 * `"pro"` — Universe ($249.99) там просто не упомянут, он всеобъемлющий через
 * `limits.modules: null`. Из-за сравнения по сырому `tier.id` веер предлагал
 * подписчику Universe **31 модуль к докупке — ровно столько же, сколько
 * бесплатному**. Самому дорогому покупателю продавали то, за что он заплатил.
 *
 * Правило берём готовое — `planGate.normalizeTier` (`pro`→`full`, а
 * `full`/`enterprise` всеобъемлющи, см. `isModuleEntitled`), чтобы не завести
 * второе представление о «что входит в тариф».
 */
describe("веер и всеобъемлющие тарифы", () => {
  test("Universe/full/enterprise: докупать нечего", () => {
    for (const tierId of ["pro", "full", "enterprise"] as const) {
      const fan = computeFan({ tierId, owned: ["qsign"] });
      expect(fan.offers.length, `${tierId}: предложено ${fan.offers.length} модулей к докупке`).toBe(0);
      expect(fan.coveredByTier.length, `${tierId}: пустой coveredByTier`).toBeGreaterThan(20);
    }
  });

  test("тарифы НИЖЕ всеобъемлющих предложения по-прежнему получают", () => {
    // Без этой половины проверка выше проходила бы и при «веер выключен всем».
    const medium = computeFan({ tierId: "medium", owned: ["qsign"] });
    expect(medium.offers.length).toBeGreaterThan(5);
    expect(medium.coveredByTier.length).toBeGreaterThan(5);
    const free = computeFan({ tierId: "free", owned: ["qsign"] });
    expect(free.offers.length).toBeGreaterThan(medium.offers.length);
  });
});
