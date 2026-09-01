import { describe, test, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";

/**
 * Сумма PayBox не попадает в поле, названное в ДРУГОЙ валюте.
 *
 * ЗАМЕР 01.09.2026. Сегодня фактически списанное начали записывать в подписку,
 * и напрашивалось «добавить то же самое у PayBox». Но pg_amount приходит в
 * ОСНОВНОЙ единице валюты платежа, а у PayBox это тенге, тогда как поле в
 * записи называется amountUsd.
 *
 * Записать одно в другое — завысить выручку в сотни раз. Дефект молчаливый:
 * ничего не падает, панель просто показывает неправдоподобную цифру, и понять
 * причину можно только вспомнив про валюту.
 *
 * Пересчёт по курсу здесь невозможен честно: курса на день платежа мы не
 * храним, а «сегодняшний» сделал бы прошлые суммы плавающими. Пустое поле
 * честнее приблизительного — в сводке рядом с суммой всегда идёт знаменатель
 * withAmount, и он покажет пробел как пробел.
 */

const provisionSubscription = vi.fn();
const parseWebhook = vi.fn();

vi.mock("../src/lib/payment/payboxProvider", () => ({
  payboxPaymentProvider: { parseWebhook: (...a: unknown[]) => parseWebhook(...a) },
}));
vi.mock("../src/routes/provisioning", () => ({
  provisionSubscription: (...a: unknown[]) => provisionSubscription(...a),
  writeSubscription: vi.fn(),
}));
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => vi.fn() }));

// eslint-disable-next-line import/first
import { payboxWebhookRouter } from "../src/routes/payboxWebhook";

const app = () => {
  const a = express();
  a.use((req, _res, next) => {
    (req as unknown as { rawBody: Buffer }).rawBody = Buffer.from("stub", "utf8");
    next();
  });
  a.use(express.urlencoded({ extended: true }));
  return a.use(payboxWebhookRouter);
};

let n = 0;
function paid(currency: string, amount: string, channel?: string) {
  n += 1;
  parseWebhook.mockReturnValue({
    eventId: `pb_${n}`,
    result: {
      status: "paid",
      paidAt: null,
      reason: null,
      raw: {
        pg_payment_id: `pb_${n}`,
        pg_order_id: `tier_lite_monthly_${n}`,
        pg_user_contact_email: "buyer@test.aev",
        pg_currency: currency,
        pg_amount: amount,
        ...(channel ? { pg_param_channel: channel } : {}),
      },
    },
  });
  return request(app()).post("/webhook").send({});
}

const lastArg = () =>
  provisionSubscription.mock.calls.at(-1)?.[0] as
    | { amountUsd?: number; channel?: string }
    | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  provisionSubscription.mockResolvedValue({ subscription: { id: "s1" } });
});

describe("PayBox: сумма пишется только в своей валюте", () => {
  test("контроль: доллары ДОХОДЯТ до записи", async () => {
    // Положительная сторона обязательна: без неё «тенге не записываются» могло
    // бы означать «не записывается ничего», и проверка ниже подтверждала бы
    // сама себя.
    const r = await paid("USD", "19.00");
    expect(r.status, "вебхук не принял пинг — дальше мерить нечего").toBe(200);
    expect(lastArg()?.amountUsd, "долларовая сумма не дошла до записи").toBe(19);
  });

  test("тенге в поле долларов НЕ попадают", async () => {
    const r = await paid("KZT", "9500");
    expect(r.status).toBe(200);
    expect(
      lastArg() && "amountUsd" in (lastArg() as object),
      "сумма в тенге записана в поле, названное в долларах — выручка завышена в сотни раз",
    ).toBe(false);
  });

  test("нулевая и нечисловая сумма поля не создают", async () => {
    await paid("USD", "0");
    expect(lastArg() && "amountUsd" in (lastArg() as object), "ноль записан как сумма").toBe(false);
    await paid("USD", "мусор");
    expect(lastArg() && "amountUsd" in (lastArg() as object), "нечисловое записано как сумма").toBe(false);
  });
});

/**
 * Канал привлечения доезжает до записи подписки.
 *
 * ЗАЧЕМ. Выручка по каналу считается только там, где известны ОБА поля —
 * сумма и канал. До 01.09.2026 звена не было вовсе: витрина канал знала,
 * ссылка на кассу его не несла, и покупки через PayBox попадали в сводке в
 * ключ "direct". Деньги не терялись, но ответа «что окупилось» по ним не было.
 *
 * Путь общий, не особый: тело чекаута → customData → pg_param_channel → сюда.
 * Тем же путём давно ездит выбранный модуль.
 */
describe("PayBox: канал привлечения доезжает", () => {
  test("канал из ссылки кассы попадает в запись", async () => {
    const r = await paid("USD", "19.00", "tt");
    expect(r.status).toBe(200);
    expect(lastArg()?.channel, "канал не дошёл — выручка по каналам его не увидит").toBe("tt");
  });

  test("без канала поле не выдумывается", async () => {
    // Пустой канал хуже отсутствующего: в сводке он стал бы отдельным
    // безымянным ключом, и сумма по каналам перестала бы сходиться с общей.
    await paid("USD", "19.00");
    expect(lastArg() && "channel" in (lastArg() as object), "поле проставлено на пустом месте").toBe(false);
  });
});
