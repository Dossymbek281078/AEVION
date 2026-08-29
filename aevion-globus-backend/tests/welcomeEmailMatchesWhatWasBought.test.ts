/**
 * Письмо, которое человек получает СРАЗУ ПОСЛЕ ОПЛАТЫ, должно описывать то,
 * что он купил.
 *
 * До 28.08.2026 оно этого не делало, и оба дефекта были невидимы:
 *
 *   1. «Все 27 модулей AEVION» — число зашито руками. Пришло из документации
 *      апреля 2026, а в реестре сейчас 41 запись и 36 живых модулей. То есть
 *      письмо занижало продукт на девять модулей. Занижение никто не ловит:
 *      на завышенное обещание приходит жалоба, на заниженное — тишина.
 *
 *   2. Кнопка «Открыть QRight» — адрес зашит. Её получал КАЖДЫЙ, включая
 *      того, кто минуту назад купил CyberChess за $19.
 *
 *   3. Пустой список модулей значит разное у разных тарифов: у `full` это
 *      «всё», у `lite` — «модуль ещё не выбран». Прежний текст не различал,
 *      и подписчику Lite обещали все модули.
 *
 * Проверяется ПОВЕДЕНИЕ функций, а не наличие строки в исходнике: сторож,
 * который ищет слово в файле, зеленеет от переименования переменной.
 */

import { describe, it, expect } from "vitest";
import { includedLine, ctaFor, welcomeHtml, LIVE_MODULE_COUNT } from "../src/routes/provisioning";
import type { Subscription } from "../src/routes/provisioning";
import { projects } from "../src/data/projects";

function sub(over: Partial<Subscription>): Subscription {
  return {
    id: "sub_test",
    ts: new Date(0).toISOString(),
    email: "buyer@example.com",
    tierId: "full",
    period: "monthly",
    seats: 1,
    modules: [],
    trialDays: 0,
    ...over,
  };
}

describe("письмо после оплаты описывает купленное", () => {
  // Контроль прибора: если реестр вдруг опустеет или переименуется, все
  // проверки ниже станут бессмысленно зелёными.
  it("реестр читается и непуст", () => {
    expect(projects.length).toBeGreaterThan(10);
    expect(LIVE_MODULE_COUNT).toBeGreaterThan(0);
    expect(LIVE_MODULE_COUNT).toBeLessThanOrEqual(projects.length);
  });

  it("число модулей берётся из реестра, а не из головы", () => {
    const line = includedLine(sub({ tierId: "full" }));
    expect(line).toContain(String(LIVE_MODULE_COUNT));
    // Именно то число, которое устарело и жило в письме четыре месяца.
    // Проверка предметная: она обязана краснеть, если кто-то впишет его снова.
    if (LIVE_MODULE_COUNT !== 27) {
      expect(line).not.toContain("27");
    }
  });

  it("Lite не обещает все модули, пока модуль не выбран", () => {
    const line = includedLine(sub({ tierId: "lite", modules: [] }));
    expect(line.toLowerCase()).not.toContain("все модули");
    expect(line).toContain("выберите");
  });

  it("купленный модуль называется поимённо", () => {
    expect(includedLine(sub({ tierId: "lite", modules: ["cyberchess"] }))).toBe("cyberchess");
    expect(includedLine(sub({ modules: ["qright", "qsign"] }))).toBe("qright · qsign");
  });

  it("кнопка ведёт в купленный модуль, а не всегда в QRight", () => {
    const cta = ctaFor(sub({ tierId: "lite", modules: ["cyberchess"] }));
    expect(cta.href).toBe("/cyberchess");
    // Смысл всей правки: покупатель шахмат не должен получать чужой модуль.
    expect(cta.href).not.toBe("/qright");
  });

it("ссылка ведёт в модуль, только если он ЕСТЬ в реестре", () => {
    // Слаг приезжает из custom_data чекаута, а адрес чекаута собирает сам
    // покупатель. Подпись вебхука доказывает, что данные от Lemon Squeezy,
    // но не то, что значение осмысленно.
    expect(ctaFor(sub({ tierId: "lite", modules: ["cyberchess"] })).href).toBe("/cyberchess");
    expect(ctaFor(sub({ tierId: "lite", modules: ["нет-такого-модуля"] })).href).toBe("/account");
  });

  it("подставленный слаг не уводит из письма наружу", () => {
    // `//чужой-сайт` в href превратился бы в ссылку на другой домен прямо в
    // нашем письме о покупке. Найдено вычиткой собственного дифа — тесты
    // были зелёные.
    for (const evil of ["//evil.example", "../../etc", 'x" onmouseover="1', "javascript:alert(1)"]) {
      const href = ctaFor(sub({ tierId: "lite", modules: [evil] })).href;
      expect(href, `опасный слаг доехал до ссылки: ${evil}`).toBe("/account");
    }
  });

it("опасный слаг не попадает в разметку письма как разметка", () => {
    // Мутация показала, что экранирование я добавил, а проверки на него нет.
    // Слаг приходит из custom_data чекаута: строка, которую собрал покупатель.
    const html = welcomeHtml(sub({ tierId: "lite", modules: ['<img src=x onerror="1">'] }));
    expect(html, "тег доехал до письма как тег").not.toContain('<img src=x');
    expect(html, "экранированный вид отсутствует — значит не экранировали").toContain("&lt;img");
  });

  it("контроль: обычное имя модуля не искажается", () => {
    // Иначе проверка выше была бы зелёной и на коде, который ломает всё подряд.
    const html = welcomeHtml(sub({ tierId: "lite", modules: ["cyberchess"] }));
    expect(html).toContain("cyberchess");
  });

  it("когда модуль неизвестен — ведём в кабинет, а не наугад", () => {
    const cta = ctaFor(sub({ tierId: "full", modules: [] }));
    expect(cta.href).toBe("/account");
  });

  it("покупатель QRight по-прежнему попадает в QRight", () => {
    // Отрицательный контроль правки: чинили не тем, что убрали QRight, а тем,
    // что перестали слать туда всех подряд.
    expect(ctaFor(sub({ tierId: "lite", modules: ["qright"] })).href).toBe("/qright");
  });
});
