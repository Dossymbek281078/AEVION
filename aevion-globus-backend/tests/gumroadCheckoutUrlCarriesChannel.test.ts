import { describe, test, expect, beforeAll } from "vitest";

/**
 * Ссылка на кассу Gumroad несёт канал привлечения.
 *
 * ЗАЧЕМ. Наш вебхук ДАВНО читает `url_params[channel]` — так канал кладёт
 * витрина, собирая ссылку сама. А ссылки, которые собираем МЫ (ручка чекаута),
 * канал не несли вовсе: покупка приходила без него и попадала в сводке выручки
 * в ключ "direct". Деньги не терялись, но ответа «что окупилось» по ним не было.
 *
 * Проверяется ПОВЕДЕНИЕ настоящего провайдера, а не наличие строки: мутация
 * «не класть канал в ссылку» прошла мимо всех прежних тестов — они подменяют
 * провайдера целиком и до сборщика адреса не доходят.
 */

process.env.GUMROAD_DEFAULT_PERMALINK = "test-permalink";

let createIntent: (i: {
  reference: string;
  amountCents: number;
  currency: string;
  description: string;
  email?: string | null;
  customData?: Record<string, string>;
}) => Promise<{ checkoutUrl: string }>;

beforeAll(async () => {
  const mod = await import("../src/lib/payment/gumroadProvider");
  createIntent = mod.gumroadPaymentProvider.createIntent.bind(mod.gumroadPaymentProvider) as typeof createIntent;
});

const base = {
  reference: "tier_lite_monthly",
  amountCents: 1900,
  currency: "USD",
  description: "AEVION Lite",
};

describe("ссылка на кассу Gumroad несёт канал", () => {
  test("канал попадает в адрес тем именем, которое читает вебхук", async () => {
    const { checkoutUrl } = await createIntent({ ...base, customData: { channel: "tt" } });
    // Имя параметра ровно то, что разбирает gumroadWebhook — не похожее.
    expect(checkoutUrl, "канала нет в ссылке").toContain("url_params%5Bchannel%5D=tt");
  });

  test("без канала лишнего параметра в адресе нет", async () => {
    const { checkoutUrl } = await createIntent({ ...base });
    // Сперва доказываем, что адрес ВООБЩЕ собран: `not.toContain` верно и на
    // пустой строке, поэтому без этой строки проверка прошла бы при полностью
    // сломанном сборщике. Класс принесла соседняя вкладка — у неё так оказалась
    // пустой проверка про персональные данные на денежном пути.
    expect(checkoutUrl, "адрес не собран — отрицание ниже ничего не значит").toContain("test-permalink");
    expect(checkoutUrl).not.toContain("url_params");
  });

  test("почта и канал уживаются в одном адресе", async () => {
    // Раньше адрес собирался склейкой и второй параметр было некуда добавить:
    // при наличии почты возвращалась строка с уже занятым «?».
    const { checkoutUrl } = await createIntent({
      ...base,
      email: "buyer@example.com",
      customData: { channel: "ig" },
    });
    expect(checkoutUrl, "почта потерялась").toContain("wanted_email=buyer%40example.com");
    expect(checkoutUrl, "канал потерялся").toContain("url_params%5Bchannel%5D=ig");
    expect(checkoutUrl.split("?").length, "в адресе два знака вопроса").toBe(2);
  });
});
