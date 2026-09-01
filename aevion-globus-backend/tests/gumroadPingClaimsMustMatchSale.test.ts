import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";

/**
 * Заявленное в оповещении сверяется с ПОДТВЕРЖДЁННОЙ продажей.
 *
 * Что уже было (с 26.07.2026) и работает — проверено на проде 19.08:
 * при неподписанном пинге обработчик спрашивает Gumroad, существует ли
 * продажа, и отвергает выдуманный номер (`401 sale_not_found`).
 *
 * Чего НЕ было: товар и адрес брались из ТЕЛА запроса, а его пишет
 * отправитель. Обладатель настоящего дешёвого чека мог прислать его номер,
 * подставив `product_id` дорогого тарифа, — существование подтверждалось,
 * выдавался дорогой. Тем же способом права выписывались на чужой адрес.
 *
 * Тест проверяет отказ И отсутствие выдачи: «вернул 401» без второй половины
 * было бы зелёным и в случае, когда права всё-таки выданы.
 */

const capture = vi.fn();
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => (...a: unknown[]) => capture(...a) }));

const verifyDetailed = vi.fn();
const parseWebhook = vi.fn();
const provisionSubscription = vi.fn();
const writeSubscription = vi.fn();
const query = vi.fn();

vi.mock("../src/lib/payment/gumroadProvider", () => ({
  gumroadPaymentProvider: { parseWebhook: (...a: unknown[]) => parseWebhook(...a) },
  verifyGumroadSaleDetailed: (...a: unknown[]) => verifyDetailed(...a),
}));
vi.mock("../src/routes/provisioning", () => ({
  provisionSubscription: (...a: unknown[]) => provisionSubscription(...a),
  writeSubscription: (...a: unknown[]) => writeSubscription(...a),
}));
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: (...a: unknown[]) => query(...a) }) }));

// eslint-disable-next-line import/first
import { gumroadWebhookRouter } from "../src/routes/gumroadWebhook";

const app = () => {
  const a = express();
  a.use((req, _res, next) => {
    (req as unknown as { rawBody: Buffer }).rawBody = Buffer.from("stub", "utf8");
    next();
  });
  a.use(express.json());
  a.use(gumroadWebhookRouter);
  return a;
};

/** Дедупликация живёт в модуле и переживает тесты — номер каждый раз новый. */
let n = 0;
const nextSale = () => `sale-${++n}`;

/** Пинг: что ЗАЯВЛЯЕТ отправитель. */
function ping(saleId: string, email: string, productId: string, price?: string) {
  parseWebhook.mockReturnValue({
    eventId: saleId,
    result: {
      status: "paid",
      paidAt: null,
      reason: null,
      raw: {
        sale_id: saleId,
        email,
        product_id: productId,
        // Ссылка на товар нужна, иначе модуль не опознаётся и выдачи нет вовсе:
        // мои первые три случая «падали» именно на этом, а не на сумме.
        product_permalink: "https://aevion.gumroad.com/l/pyiaz",
        ...(price ? { price } : {}),
      },
    },
  });
}
/** Что Gumroad подтвердил на самом деле. */
const confirmed = (email: string, productId: string, price?: string) =>
  verifyDetailed.mockResolvedValue({
    verdict: "confirmed",
    sale: { purchase_email: email, product_id: productId, ...(price === undefined ? {} : { price }) },
  });

const granted = () =>
  provisionSubscription.mock.calls.length > 0 ||
  writeSubscription.mock.calls.length > 0 ||
  query.mock.calls.some((c) => /INSERT INTO "DevHub/.test(String(c[0])));

const SAVED = process.env.GUMROAD_WEBHOOK_SECRET;
beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.GUMROAD_WEBHOOK_SECRET;   // неподписанный пинг — тот самый случай
  delete process.env.GUMROAD_VERIFY_SALES;
  query.mockResolvedValue({ rows: [], rowCount: 0 });
});
afterEach(() => {
  if (SAVED === undefined) delete process.env.GUMROAD_WEBHOOK_SECRET;
  else process.env.GUMROAD_WEBHOOK_SECRET = SAVED;
});

describe("Подделка заявки поверх настоящего чека", () => {
  test("товар в пинге не тот, что в продаже — отказ и НИЧЕГО не выдано", async () => {
    const s = nextSale();
    ping(s, "buyer@example.com", "EXPENSIVE_TIER");
    confirmed("buyer@example.com", "cheap_product");

    const r = await request(app()).post("/webhook").send({});
    expect(r.status).toBe(401);
    expect(granted()).toBe(false);
    // Наружу отдаём то же, что и на несуществующую продажу: её и правда нет —
    // продажи, ОТВЕЧАЮЩЕЙ этой заявке. Точная причина уходит в Sentry, и
    // проверяем именно её, иначе сторож нечем отличить от соседнего.
    expect(String(capture.mock.calls[0][0])).toContain("product_mismatch");
  });

  test("адрес в пинге чужой — отказ и ничего не выдано", async () => {
    const s = nextSale();
    ping(s, "attacker@example.com", "prod-1");
    confirmed("real-buyer@example.com", "prod-1");

    const r = await request(app()).post("/webhook").send({});
    expect(r.status).toBe(401);
    expect(granted()).toBe(false);
    expect(String(capture.mock.calls[0][0])).toContain("email_mismatch");
  });

  test("отклонённый пинг НЕ занимает ключ дедупликации", async () => {
    const s = nextSale();
    ping(s, "a@example.com", "WRONG");
    confirmed("a@example.com", "right");
    const first = await request(app()).post("/webhook").send({});
    expect(first.status).toBe(401);

    // тот же номер, теперь честный — обязан быть обработан, а не «deduped»
    ping(s, "a@example.com", "right");
    confirmed("a@example.com", "right");
    const second = await request(app()).post("/webhook").send({});
    expect(second.body.deduped).toBeUndefined();
  });
});

describe("Честные случаи не сломаны", () => {
  test("заявка совпадает с продажей — пропускаем дальше", async () => {
    const s = nextSale();
    ping(s, "buyer@example.com", "prod-1");
    confirmed("buyer@example.com", "prod-1");
    const r = await request(app()).post("/webhook").send({});
    expect(r.status).not.toBe(401);
  });

  test("Gumroad не вернул полей товара — не выдумываем отказ", async () => {
    const s = nextSale();
    ping(s, "buyer@example.com", "prod-1");
    verifyDetailed.mockResolvedValue({ verdict: "confirmed", sale: { purchase_email: "buyer@example.com" } });
    const r = await request(app()).post("/webhook").send({});
    expect(r.status).not.toBe(401);
  });

  test("подпись задана — к API вообще не ходим, сверять нечего", async () => {
    process.env.GUMROAD_WEBHOOK_SECRET = "s3cret";
    const s = nextSale();
    ping(s, "buyer@example.com", "prod-1");
    const r = await request(app()).post("/webhook").send({});
    expect(verifyDetailed).not.toHaveBeenCalled();
    expect(r.status).not.toBe(401);
  });
});

/**
 * Сумма продажи: два однозначных случая.
 *
 * ЗАЧЕМ. Девять позиций каталога продаются ПРЯМОЙ ссылкой Gumroad — наша сумма
 * в неё не передаётся вовсе, платит человек столько, сколько выставлено у
 * продавца. Сверить факт с нашей ценой нечем: цен модулей бэкенд не хранит.
 * Но два случая не требуют нашей цены и говорят сами за себя.
 *
 * Доступ в обоих случаях ВЫДАЁТСЯ. Отказать оплатившему дороже, чем выдать по
 * купону основателя; меняется только то, что случай перестаёт быть невидимым.
 * Проверяется поэтому не отказ, а СЛЕД.
 */
describe("сумма продажи оставляет след, когда говорит сама за себя", () => {
  let warned: string[] = [];
  beforeEach(() => {
    warned = [];
    vi.spyOn(console, "warn").mockImplementation((...a: unknown[]) => {
      warned.push(a.map(String).join(" "));
    });
  });

  test("нулевая сумма: доступ выдан, но это видно", async () => {
    const s = nextSale();
    ping(s, "buyer@example.com", "prod_1", "0");
    confirmed("buyer@example.com", "prod_1", "0");
    const r = await request(app()).post("/webhook").send({});
    expect(r.status, "вебхук не принял пинг — дальше мерить нечего").toBe(200);
    // Доступ не отбираем: проверяем, что пинг ПРИНЯТ (200 выше) и работа с
    // базой началась. Помощник granted() сюда не годится — он знает пути
    // тарифов и DevHub, а это покупка модуля, и она пишется другим запросом.
    // Утверждать «выдано» его словами значило бы мерить не тот путь.
    expect(
      query.mock.calls.length,
      "пинг принят, но до базы дело не дошло — значит доступ не выдавался",
    ).toBeGreaterThan(0);
    expect(
      warned.join(" "),
      "доступ выдан бесплатно, и об этом не осталось следа — снаружи неотличимо от обычной покупки",
    ).toContain("БЕСПЛАТНО");
  });

  test("сумма в пинге разошлась с продажей: это видно", async () => {
    // Пинг не подписан и адрес его публично известен, поэтому расхождение
    // сумм — признак подделки, а не ошибки округления.
    const s = nextSale();
    ping(s, "buyer@example.com", "prod_1", "100");
    confirmed("buyer@example.com", "prod_1", "4900");
    const r = await request(app()).post("/webhook").send({});
    expect(r.status, "вебхук не принял пинг — дальше мерить нечего").toBe(200);
    expect(warned.join(" "), "расхождение сумм прошло молча").toContain("подделки");
  });

  test("контроль: обычная покупка следа НЕ оставляет", async () => {
    // Без этого «след есть» означало бы «я пишу в журнал всегда», и оба
    // случая выше подтверждались бы сами собой.
    const s = nextSale();
    ping(s, "buyer@example.com", "prod_1", "4900");
    confirmed("buyer@example.com", "prod_1", "4900");
    const r = await request(app()).post("/webhook").send({});
    expect(r.status, "вебхук не принял пинг — дальше мерить нечего").toBe(200);
    const log = warned.join(" ");
    expect(log, "обычная покупка помечена как бесплатная").not.toContain("БЕСПЛАТНО");
    expect(log, "обычная покупка помечена как подделка").not.toContain("подделки");
  });
});
