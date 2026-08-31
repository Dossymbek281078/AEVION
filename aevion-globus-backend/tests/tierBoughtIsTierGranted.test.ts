import { describe, test, expect, vi, beforeEach } from "vitest";
import { tierForReference as поPayBox } from "../src/routes/payboxWebhook";
import { tierForReference as поPayPal } from "../src/routes/paypalWebhook";

/**
 * Сторож: за какой тариф заплатили, тот и выдаём.
 *
 * ЗАЧЕМ. Ручка чекаута принимает шесть тарифов явным списком, а ссылку заказа
 * строит как `tier_<id>_<период>`. Разбор ссылки в вебхуках знал только часть
 * имён, и всё незнакомое проваливалось в дефолт `lite`. Замер до починки:
 * `tier_pro_monthly` -> "lite" при контроле `tier_medium_monthly` -> "medium",
 * то есть покупатель «Universe» за $149/мес получал самый дешёвый тариф.
 *
 * Обе кассы держат СВОЮ копию разбора, поэтому проверяются обе: сторож на одну
 * из двух — это ровно то «хотя бы один», что переживает потерю второго.
 */
const кассы: Array<[string, (r: string) => string]> = [
  ["PayBox", поPayBox],
  ["PayPal", поPayPal],
];

describe.each(кассы)("%s: ссылка заказа выдаёт купленный тариф", (_имя, разбор) => {
  beforeEach(() => {
    // Незнакомая ссылка предупреждает — шум глушим, иначе он утонет в выводе.
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  test.each([
    ["tier_lite_monthly", "lite"],
    ["tier_medium_monthly", "medium"],
    ["tier_full_annual", "full"],
    ["tier_pro_monthly", "pro"],
    ["tier_enterprise_annual", "enterprise"],
  ])("%s -> %s", (ссылка, ожидаем) => {
    expect(разбор(ссылка)).toBe(ожидаем);
  });

  test("подстрока не выдаёт себя за тариф: tier_promo_ это НЕ pro", () => {
    // `includes("pro")` поймал бы промо-ссылку и выдал бы за неё старший тариф.
    // Точный префикс с подчёркиванием этого не делает.
    expect(разбор("tier_promo_monthly")).not.toBe("pro");
  });

  test("незнакомая ссылка по-прежнему падает в lite, а не в старший тариф", () => {
    // Направление дефолта осознанное: ошибиться в пользу платящего дороже,
    // чем раздать всем старший тариф. Меняется только то, что известные
    // тарифы больше не считаются незнакомыми.
    expect(разбор("совершенно-другой-формат-42")).toBe("lite");
  });
});
