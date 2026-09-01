import { describe, test, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

/**
 * Сторож: ответ кассы называет валюту, в которой ПОЙДЁТ оплата.
 *
 * ЗАЧЕМ. Страница цен спрашивает состояние канала при загрузке и, если PayBox
 * жив, обещает человеку оплату в тенге. Но обещание дано ПО СОСТОЯНИЮ, а
 * исход конкретного запроса может быть другим: вызов PayBox падает, касса
 * честно пишет в журнал и уходит к запасным, которые считают в долларах.
 *
 * Раньше ответ называл только провайдера, и витрине пришлось бы выводить
 * валюту из его имени. Теперь она узнаёт правду прямо из ответа — а этот тест
 * проверяет СЛЕДСТВИЕ: при сбое местного канала в ответе стоит USD, а не то,
 * что просил клиент.
 */
vi.mock("../src/lib/payment/payboxProvider", () => ({
  isPayboxConfigured: () => true,
  payboxPaymentProvider: {
    createIntent: vi.fn(async () => {
      throw new Error("PayBox недоступен");
    }),
  },
}));

vi.mock("../src/lib/payment/lemonSqueezyProvider", () => ({
  lemonSqueezyPaymentProvider: {
    createIntent: vi.fn(async () => ({
      checkoutUrl: "https://ls.example/checkout",
      intentId: "int_ls_1",
    })),
  },
}));

const { checkoutRouter } = await import("../src/routes/checkout");

const app = express();
app.use(express.json());
app.use("/api/pricing/checkout", checkoutRouter);

beforeEach(() => {
  process.env.LEMON_SQUEEZY_API_KEY = "ключ-для-теста";
  process.env.LEMON_SQUEEZY_STORE_ID = "1";
  // Ворота Lemon Squeezy требуют ЧЕТЫРЁХ условий, и это правильно: секрет
  // вебхука здесь не формальность, без него купленное не выдадут. Тест
  // поднимает все четыре, иначе касса честно отвечает 503.
  process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = "секрет-для-теста";
  process.env.LEMON_SQUEEZY_VARIANT_MEDIUM_MONTHLY = "12345";
});

describe("ответ кассы называет валюту фактической оплаты", () => {
  test("местный канал упал — в ответе доллары, а не запрошенные тенге", async () => {
    const r = await request(app)
      .post("/api/pricing/checkout/session")
      .send({ tierId: "medium", currency: "KZT" });

    // Контроль прибора: запрос вообще дошёл до создания ссылки.
    expect(r.status, `касса ответила ${r.status}: ${JSON.stringify(r.body)}`).toBe(200);
    expect(r.body.url, "ссылка не выдана — проверять нечего").toBeTruthy();

    expect(r.body.provider, "ожидался переход на запасного").toBe("lemonsqueezy");
    expect(
      r.body.currency,
      "ответ не называет валюту фактической оплаты — витрина не сможет сказать правду"
    ).toBe("USD");
  });
});
