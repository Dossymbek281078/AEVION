import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  formatPaymentAmount,
  minorUnitDigits,
  toMinorUnits,
} from "@/lib/paymentAmount";

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

  it("что ввёл человек — то он и увидит (круговой ход)", () => {
    // 31.08.2026. Показ и ввод считали ПО-РАЗНОМУ: панель ссылок слала в API
    // доллары (parseFloat("99.00") = 99), а контракт объявляет минорные
    // единицы. Пока показ печатал число как есть, ссылки из панели выглядели
    // верно, а из API — в сто раз дороже; починка показа поменяла местами,
    // кто врёт. Здесь закреплено, что обе стороны считают одинаково.
    for (const [валюта, ожидание] of [
      ["USD", "$99.00"],
      ["EUR", "€99.00"],
    ] as const) {
      expect(toMinorUnits(99, валюта)).toBe(9900);
      expect(
        formatPaymentAmount(toMinorUnits(99, валюта), валюта),
        `круговой ход ${валюта} потерял цену`
      ).toBe(ожидание);
    }
    // У знака без дробной части круг тоже должен сходиться.
    expect(toMinorUnits(99, "AEC")).toBe(99);
    expect(formatPaymentAmount(toMinorUnits(99, "AEC"), "AEC")).toContain("99");
  });

  it("панель ссылок не шлёт в API сырую сумму", () => {
    const page = readFileSync(
      join(ROOT, "app", "payments", "links", "page.tsx"),
      "utf8"
    );
    // Контроль прибора: файл прочитан и это действительно панель ссылок.
    expect(page.includes("api/payments/v1/links"), "прочитан не тот файл").toBe(true);
    expect(
      page.includes("amount: local.amount,"),
      "панель снова шлёт доллары туда, где ждут минорные единицы"
    ).toBe(false);
  });

  it("служебное слово вместо валюты не даёт NaN на цене", () => {
    // Поиск по объекту вернул бы функцию из прототипа, деление дало бы NaN.
    for (const мусор of ["constructor", "__proto__", "toString", "нет-такой"]) {
      expect(minorUnitDigits(мусор), `${мусор} сломал показатель`).toBe(2);
      expect(formatPaymentAmount(9900, мусор)).not.toMatch(/NaN/);
    }
  });

  it("ни одна платёжная поверхность не форматирует сумму сама", () => {
    // Копий форматирования было ТРИ, и разошлись они именно поэтому: страница
    // оплаты и письмо-чек несли один и тот же дефект независимо. Сторож
    // охраняет класс, а не два известных места.
    const поверхности: string[] = [];
    const обойти = (dir: string) => {
      for (const i of readdirSync(dir, { withFileTypes: true })) {
        if (i.name === "__tests__") continue;
        const путь = join(dir, i.name);
        if (i.isDirectory()) обойти(путь);
        else if (i.name.endsWith(".ts") || i.name.endsWith(".tsx")) {
          const src = readFileSync(путь, "utf8");
          if (src.includes("link.amount") || src.includes("refund.amount")) {
            поверхности.push(путь);
          }
        }
      }
    };
    обойти(join(ROOT, "app", "pay"));
    обойти(join(ROOT, "app", "api", "pay"));

    // Знаменатель: поверхностей заведомо несколько, иначе обход сломан.
    expect(поверхности.length, "поверхностей не найдено — сторож проверял пустоту")
      .toBeGreaterThan(1);

    const свои = поверхности.filter((f) => {
      const src = readFileSync(f, "utf8");
      return /\.amount\.(toFixed|toLocaleString)\s*\(/.test(src);
    });
    expect(свои, "поверхность печатает сумму мимо общего показателя валюты").toEqual([]);
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
