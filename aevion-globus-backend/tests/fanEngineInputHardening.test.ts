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

/**
 * Обратный отсчёт окна — механика, а не украшение.
 *
 * У Higgsfield держит именно видимый дедлайн. До 2026-07-27 сервер отдавал
 * только `validUntil`, а витрина рисовала серую дату: «до 10.08» за одиннадцать
 * дней выглядело ровно так же, как за один. `daysLeft` считает СЕРВЕР — клиент,
 * вычисляющий разницу дат сам, разойдётся с ним на границе суток и в других
 * часовых поясах, а это счётчик, по которому человек решает покупать сегодня.
 */
describe("окно веера: обратный отсчёт", () => {
  const anchor = "2026-07-01T12:00:00.000Z";

  test("считается вниз и от anchor, а не от «сейчас»", () => {
    // Окно 14 дней от 01.07 → закрытие 15.07. На 10.07 остаётся 5 суток.
    const fan = computeFan({
      owned: ["qsign"],
      lastPurchaseAt: anchor,
      now: new Date("2026-07-10T12:00:00.000Z"),
    });
    expect(fan.status).toBe("active");
    expect(fan.daysLeft).toBe(5);
  });

  test("округление ВНИЗ — 1.9 суток это «1 день», а не «2»", () => {
    // Ошибка в счётчике должна быть в пользу покупателя, а не продавца.
    const fan = computeFan({
      owned: ["qsign"],
      lastPurchaseAt: anchor,
      now: new Date("2026-07-13T14:00:00.000Z"), // до закрытия 1 день 22 часа
    });
    expect(fan.daysLeft).toBe(1);
  });

  test("последние часы — 0, а не отрицательное и не null", () => {
    const fan = computeFan({
      owned: ["qsign"],
      lastPurchaseAt: anchor,
      now: new Date("2026-07-15T06:00:00.000Z"), // 6 часов до закрытия
    });
    expect(fan.status).toBe("active");
    expect(fan.daysLeft).toBe(0);
  });

  test("окно закрыто и веер не начат → null, а не 0", () => {
    // 0 и null различаются намеренно: «сегодня последний день» и «окна нет» —
    // разные сообщения, и витрина обязана их различать.
    const expired = computeFan({
      owned: ["qsign"],
      lastPurchaseAt: anchor,
      now: new Date("2026-08-01T00:00:00.000Z"),
    });
    expect(expired.status).toBe("expired");
    expect(expired.daysLeft).toBeNull();

    const never = computeFan({ owned: [] });
    expect(never.status).toBe("inactive");
    expect(never.daysLeft).toBeNull();
  });

  test("daysLeft согласован с validUntil — два поля не расходятся", () => {
    const now = new Date("2026-07-05T00:00:00.000Z");
    const fan = computeFan({ owned: ["qsign"], lastPurchaseAt: anchor, now });
    const fromUntil = Math.floor((Date.parse(fan.validUntil!) - now.getTime()) / 86_400_000);
    expect(fan.daysLeft).toBe(fromUntil);
  });
});
