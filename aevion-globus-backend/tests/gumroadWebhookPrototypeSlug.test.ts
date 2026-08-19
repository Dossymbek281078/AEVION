import { describe, test, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

/**
 * Платёжный вебхук Gumroad — публичная ручка: её адрес указан в настройках
 * Gumroad и известен любому. Слаг товара приходит из ТЕЛА запроса и попадал в
 * поиск по обычному объекту:
 *
 *   KNOWN_PERMALINK_REFERENCE[pingSlug]
 *
 * Обычный объект наследует ключи прототипа, поэтому `product_permalink=constructor`
 * возвращал отсюда ФУНКЦИЮ `Object` вместо строки-ссылки. Дальше код звал
 * `ref.toLowerCase()` — и ручка отвечала 500.
 *
 * Денег это не выдавало, но роняло денежный вход одной строкой в теле запроса,
 * а Gumroad на 500 повторяет доставку. Достаточно слать такие пинги, чтобы
 * забить очередь повторов и утопить настоящие оплаты.
 *
 * Опасны ровно два ключа: `constructor` и `__proto__`. Остальные (`toString`,
 * `valueOf` и прочие) до поиска не доживают — `permalinkSlug()` приводит слаг к
 * нижнему регистру, и "toString" становится "tostring", которого в прототипе
 * нет. Проверено на неисправленном коде: из семи ключей падает два.
 * Родственное: feedback_prototype_keys_in_lookups.
 */

const { provisionMock, writeMock, parseMock, verifyMock } = vi.hoisted(() => ({
  provisionMock: vi.fn(),
  writeMock: vi.fn(),
  parseMock: vi.fn(),
  verifyMock: vi.fn(),
}));

vi.mock("../src/lib/payment/gumroadProvider", () => ({
  gumroadPaymentProvider: { parseWebhook: parseMock },
  verifyGumroadSale: verifyMock,
}));
vi.mock("../src/routes/provisioning", () => ({
  provisionSubscription: provisionMock,
  writeSubscription: writeMock,
}));
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: vi.fn().mockResolvedValue({ rows: [] }) }) }));
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => () => {} }));

// eslint-disable-next-line import/first
import { gumroadWebhookRouter } from "../src/routes/gumroadWebhook";

// ТОЛЬКО те ключи, что переживают приведение к нижнему регистру.
// `permalinkSlug()` делает `.toLowerCase()`, поэтому "toString" превращается в
// "tostring" — а это уже не ключ прототипа, и такой слаг безопасен. Замер:
// из семи ключей опасны ровно два. Первая версия этого теста перечисляла все
// семь и была зелёной на пяти даже БЕЗ починки — то есть обещала охват,
// которого нет. Список, проверенный на неисправленном коде, честнее длинного.
const PROTOTYPE_KEYS = ["constructor", "__proto__"];

function makeApp() {
  const a = express();
  a.use(express.json());
  a.use(gumroadWebhookRouter);
  return a;
}

// Каждый пинг получает свой sale_id: у обработчика есть защита от повторов,
// и одинаковый идентификатор во втором тесте дал бы «deduped» вместо разбора —
// тест был бы зелёным, ничего не проверив.
let n = 0;
function pingWith(slug: string) {
  n += 1;
  parseMock.mockReturnValue({
    eventId: `evt-${n}`,
    result: {
      status: "paid",
      reason: undefined,
      raw: {
        email: `buyer${n}@example.com`,
        sale_id: `sale-${n}-${slug}`,
        product_id: "",
        product_permalink: slug,
      },
    },
  });
  return request(makeApp()).post("/webhook").send({});
}

describe("Вебхук Gumroad: ключ прототипа в слаге не роняет ручку", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GUMROAD_VERIFY_SALES = "0";
    delete process.env.GUMROAD_WEBHOOK_SECRET;
    provisionMock.mockResolvedValue({ subscription: { id: "sub-test" } });
    verifyMock.mockResolvedValue("unverifiable");
  });

  test("обычный незнакомый слаг обрабатывается (контроль)", async () => {
    const r = await pingWith("zzz-unknown-slug");
    expect(r.status).toBe(200);
    expect(provisionMock).toHaveBeenCalledTimes(1);
  });

  test.each(PROTOTYPE_KEYS)("слаг %s не даёт 500", async (slug) => {
    const r = await pingWith(slug);
    // Главное: ручка не падает. 500 здесь — это отказ платёжного входа.
    expect(r.status).not.toBe(500);
    expect(r.status).toBe(200);
    // И тариф должен быть настоящей строкой, а не унаследованной функцией.
    expect(provisionMock).toHaveBeenCalledTimes(1);
    const arg = provisionMock.mock.calls[0][0];
    expect(typeof arg.tierId).toBe("string");
    expect(["lite", "medium", "full"]).toContain(arg.tierId);
  });
});
