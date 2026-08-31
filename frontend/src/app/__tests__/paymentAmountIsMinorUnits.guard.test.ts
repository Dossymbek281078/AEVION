import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { formatPaymentAmount, minorUnitDigits } from "@/lib/paymentAmount";

/**
 * Сторож: цена на экране покупателя равна цене, выставленной продавцом.
 *
 * ЗАЧЕМ. API объявляет суммы в минорных единицах — это написано в спеке
 * («Minor units of the chosen currency»), повторено в его собственном
 * сообщении об ошибке и подтверждено примером спеки: 9900. Страница оплаты
 * печатала это число как есть с двумя знаками, то есть показывала $9 900.00
 * вместо $99.00. Ошибка в сто раз, на том самом экране, где человек решает
 * платить.
 */
const ROOT = join(__dirname, "..", "..");

describe("сумма на странице оплаты — минорные единицы", () => {
  it("пример из спеки печатается как выставленная цена", () => {
    // 9900 — ровно то число, которое спека приводит как пример amount.
    expect(formatPaymentAmount(9900, "USD")).toBe("$99.00");
    expect(formatPaymentAmount(9900, "EUR")).toBe("€99.00");
    // Ни при какой валюте на экране не должно оказаться исходное число.
    for (const cur of ["USD", "EUR", "KZT"]) {
      expect(
        // Убираем ТОЛЬКО разделители тысяч. Запятую трогать нельзя: в ru-RU
        // она десятичная, и «99,00» превратилось бы в «9900» — прибор
        // обвинил бы исправный код (поймано на себе).
        formatPaymentAmount(9900, cur).replace(/[\s  ]/g, ""),
        `валюта ${cur} печатает сырое число`
      ).not.toMatch(/9900/);
    }
  });

  it("служебное слово вместо валюты не даёт NaN на цене", () => {
    // Поиск по объекту вернул бы функцию из прототипа, деление дало бы NaN.
    for (const мусор of ["constructor", "__proto__", "toString", "нет-такой"]) {
      expect(minorUnitDigits(мусор), `${мусор} сломал показатель`).toBe(2);
      expect(formatPaymentAmount(9900, мусор)).not.toMatch(/NaN/);
    }
  });

  it("страница оплаты не форматирует сумму сама", () => {
    const page = readFileSync(join(ROOT, "app", "pay", "[id]", "page.tsx"), "utf8");
    // Контроль прибора: файл прочитан и это действительно страница оплаты.
    expect(page.includes("formatAmount("), "прочитан не тот файл").toBe(true);
    // Своё форматирование вернуло бы дефект, не тронув общий модуль.
    expect(
      page.includes("amount.toLocaleString"),
      "страница снова печатает сумму сама, мимо общего показателя валюты"
    ).toBe(false);
  });
});
