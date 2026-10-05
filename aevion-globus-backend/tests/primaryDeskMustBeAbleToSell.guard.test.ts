import { describe, test, expect, beforeEach, afterAll } from "vitest";
import {
  primaryCheckoutProvider,
  gumroadCanSell,
  lemonSqueezyCanDeliver,
} from "../src/lib/payment/primaryProvider";

/**
 * Сторож: основной кассой не может быть та, которая не может продать.
 *
 * 🔴 Поправка к моей же работе от 29.09.2026. Функция возвращала «gumroad» всякий раз,
 * когда Lemon Squeezy не может выдавать, — и это противоречило замеру, записанному в
 * шапке того же файла: у Gumroad не настроено ни одной продаваемой позиции. Замер прода
 * 05.10: у LS товаров 30, у Gumroad 0 из 30. То есть при отказе LS платформа называла бы
 * основной кассой ту, что не продаёт ничего, — и людям в отчётах, и коду в маршрутизации.
 *
 * Исходов теперь три, и третий честный: «none» — кассы сейчас нет. Это хуже для отчёта и
 * лучше для правды: отсутствие кассы видно сразу, а не после первой неудачной покупки.
 */

const СНИМОК = { ...process.env };

function сбросить() {
  for (const k of Object.keys(process.env)) {
    if (
      k.startsWith("LEMON_SQUEEZY_") ||
      k.startsWith("GUMROAD_")
    ) {
      delete process.env[k];
    }
  }
}

beforeEach(() => сбросить());
afterAll(() => {
  сбросить();
  Object.assign(process.env, СНИМОК);
});

describe("кто основная касса", () => {
  test("Lemon Squeezy может выдавать — она и основная", () => {
    process.env.LEMON_SQUEEZY_API_KEY = "k";
    process.env.LEMON_SQUEEZY_STORE_ID = "s";
    process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = "w";
    expect(lemonSqueezyCanDeliver()).toBe(true);
    expect(primaryCheckoutProvider()).toBe("lemonsqueezy");
  });

  test("🔴 LS не выдаёт, у Gumroad НЕТ товаров — ответ «none», а не «gumroad»", () => {
    // Ровно состояние прода на 05.10: ключи у Gumroad есть, товаров нет.
    process.env.GUMROAD_ACCESS_TOKEN = "есть-ключ-но-нет-товаров";
    expect(gumroadCanSell(), "касса без товаров объявлена способной продать").toBe(false);
    expect(
      primaryCheckoutProvider(),
      "основной названа касса, которая не может продать ничего",
    ).toBe("none");
  });

  test("у Gumroad есть общий товар — она становится основной", () => {
    process.env.GUMROAD_DEFAULT_PERMALINK = "aevion";
    expect(gumroadCanSell()).toBe(true);
    expect(primaryCheckoutProvider()).toBe("gumroad");
  });

  test("у Gumroad есть товар на одну позицию — тоже годится", () => {
    process.env.GUMROAD_PERMALINK_APP_MULTICHAT_LITE = "mc-lite";
    expect(gumroadCanSell()).toBe(true);
    expect(primaryCheckoutProvider()).toBe("gumroad");
  });

  test("КОНТРОЛЬ: пустые значения не считаются товаром", () => {
    // Без этого «задана, но пустая» читалась бы как рабочая — наш записанный класс
    // (set but empty reads as configured).
    process.env.GUMROAD_DEFAULT_PERMALINK = "   ";
    process.env.GUMROAD_PERMALINK_APP_QRIGHT_LITE = "";
    expect(gumroadCanSell(), "пустая переменная сошла за товар").toBe(false);
    expect(primaryCheckoutProvider()).toBe("none");
  });

  test("КОНТРОЛЬ: LS с ключами но БЕЗ секрета вебхука основной не считается", () => {
    // Взять деньги она сможет, а выдать купленное — нет. Правило файла: основной
    // считается тот, кто доведёт покупку до ВЫДАЧИ.
    process.env.LEMON_SQUEEZY_API_KEY = "k";
    process.env.LEMON_SQUEEZY_STORE_ID = "s";
    expect(lemonSqueezyCanDeliver()).toBe(false);
    expect(primaryCheckoutProvider()).toBe("none");
  });
});
