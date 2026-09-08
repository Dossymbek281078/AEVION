import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { stripComments } from "@/app/__tests__/helpers/sourceCode";

/**
 * Без признака платежа страница не утверждает, что платёж был.
 *
 * 🔴 ЗАЧЕМ. Замер 08.09.2026 отрисовкой прода: по адресу
 * /pricing/checkout/success БЕЗ параметров — и с выдуманным intentId —
 * страница бессрочно показывала «🎉 Оплата принята — проверяем доступ»,
 * «Деньги получены», «🔒 Оплата прошла · безопасно». Наблюдалось на 5-й,
 * 20-й и 45-й секунде, текст не менялся. Сервер при этом отвечает честно:
 * status на выдуманный номер даёт {"ready":false}, а без номера — 400.
 *
 * Класс на платформе уже признан вредным и вычищен в кабинете — там в коде
 * стоит прямая запись: «Первая версия говорила „Оплата принята“ всякому, у
 * кого в адресе стоит ?purchased=<что угодно>… утверждение об успехе, ничем
 * не проверенное». На странице успеха он оставался.
 *
 * ГРАНИЦА. Сторож судит по ИСХОДНИКУ страницы: что ветка «признака платежа
 * нет» существует и ведёт к отдельному тексту. Он НЕ проверяет саму
 * отрисовку и не знает, что увидит человек, — это работа браузерной пробы.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, "../page.tsx");
const RU = join(HERE, "../../../../../lib/i18n-lang/ru.ts");

describe("страница успеха не утверждает оплату без её признака", () => {
  const src = stripComments(readFileSync(PAGE, "utf8"));

  it("прибор видит предмет: страница прочитана и знает про исходы", () => {
    expect(src).toContain("checkoutSuccess.titlePending");
    expect(src).toContain("intentId");
  });

  it("есть отдельная ветка на случай «признака платежа нет»", () => {
    // «Оплата принята» допустима, только когда номер платежа ЕСТЬ
    expect(
      src,
      "заголовок ожидания должен зависеть от наличия intentId, иначе страница "
      + "говорит «Деньги получены» всякому, кто открыл адрес",
    ).toMatch(/intentId[\s\S]{0,80}checkoutSuccess\.titlePending/);
    expect(src, "нужен отдельный текст для случая без платежа")
      .toContain("checkoutSuccess.titleNoPayment");
    expect(src).toContain("checkoutSuccess.subtitleNoPayment");
  });

  it("тексты для этого случая существуют и не утверждают оплату", () => {
    const ru = readFileSync(RU, "utf8");
    const строка = ru.match(/"pricing\.checkoutSuccess\.titleNoPayment":\s*"([^"]*)"/);
    const под = ru.match(/"pricing\.checkoutSuccess\.subtitleNoPayment":\s*"([^"]*)"/);
    expect(строка, "ключ titleNoPayment отсутствует в русском словаре").not.toBeNull();
    expect(под, "ключ subtitleNoPayment отсутствует в русском словаре").not.toBeNull();
    // главное: этот текст НЕ должен утверждать, что деньги получены
    for (const [имя, m] of [["заголовок", строка], ["подзаголовок", под]] as const) {
      const текст = m![1];
      expect(
        /Оплата принята|Деньги получены|Оплата прошла/.test(текст),
        `${имя} для случая без платежа утверждает оплату: «${текст.slice(0, 60)}»`,
      ).toBe(false);
    }
  });
});
