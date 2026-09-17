import { describe, test, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Сторож: если касса НЕ получает нашу сумму, расхождение видно.
 *
 * ЗАМЕР 04.09.2026, чтением кода. Из четырёх касс нашу сумму списывают две —
 * paybox и paypal. Lemon Squeezy и Gumroad её лишь возвращают обратно и берут
 * ЦЕНУ СВОЕГО ТОВАРА: товар в обоих случаях выбирается по ссылке заказа
 * (с 15.09.2026 — `tier_<ступень>` и `app_<приложение>_<ступень>`).
 *
 * Пока покупка обычная, это незаметно: цена товара и есть платёж за срок.
 * Расхождение появляется, когда наша сумма отличается от базовой — места,
 * промокод, скидка за срок обязательства. Направление «промокод» хуже всех:
 * страница показала МЕНЬШЕ, спишут БОЛЬШЕ — переплачивает покупатель.
 *
 * С 15.09.2026 модули на платном сроке входят в подписку и сумму НЕ меняют —
 * поэтому они стали контролем «тревоги нет», а вторым источником расхождения
 * (вместо «модуля сверх слота») проверяется промокод.
 *
 * ЧЕГО СТОРОЖ НЕ ТРЕБУЕТ. Он не требует списывать правильную сумму: это решение
 * основателя. Охраняется ровно одно: мы об этом ЗНАЕМ.
 */
const { тревоги } = vi.hoisted(() => ({ тревоги: [] as string[] }));

vi.mock("../src/lib/sentry/platform", () => ({
  makeServiceCapture: () => (e: unknown) => {
    тревоги.push(e instanceof Error ? e.message : String(e));
  },
}));

// Только Gumroad: у него адрес строится локально, сети не нужно.
// LS намеренно НЕ настраиваем — иначе createIntent пошёл бы в сеть.
process.env.GUMROAD_PERMALINK_TIER_LITE = "lite-slug";
process.env.GUMROAD_PERMALINK_APP_CYBERCHESS_PRO = "chess-pro-slug";
delete process.env.LEMON_SQUEEZY_API_KEY;
delete process.env.GUMROAD_DEFAULT_PERMALINK;

const { checkoutRouter } = await import("../src/routes/checkout");

function приложение() {
  const a = express();
  a.use(express.json());
  a.use("/api/pricing/checkout", checkoutRouter);
  return a;
}

async function сессия(body: Record<string, unknown>) {
  return request(приложение())
    .post("/api/pricing/checkout/session")
    .send({ tierId: "lite", email: "buyer@example.test", ...body });
}

const ИМЯ = "checkout_amount_not_sent_to_provider";

beforeEach(() => {
  тревоги.length = 0;
});

describe("показанная цена доезжает до кассы", () => {
  test("КОНТРОЛЬ: обычная покупка тревоги НЕ даёт", async () => {
    // Без контроля «тревога есть» удовлетворялось бы кодом, который шлёт её
    // на каждую покупку, — машиной ложных тревог на денежном пути.
    const r = await сессия({ seats: 1 });
    expect(r.status, `обычная покупка сломалась: ${JSON.stringify(r.body)}`).toBe(200);
    expect(r.body.provider).toBe("gumroad");
    expect(тревоги, "тревога ушла на покупке БЕЗ расхождения").toEqual([]);
  });

  test("КОНТРОЛЬ: модули на платном сроке входят в подписку — сумма та же, тревоги нет", async () => {
    const r = await сессия({ seats: 1, modules: ["cyberchess", "qventure", "aevion-ip-bureau"] });
    expect(r.status).toBe(200);
    expect(тревоги, "включённые модули подняли тревогу о расхождении, которого нет").toEqual([]);
  });

  test("КОНТРОЛЬ: отдельное приложение по цене своей ступени тревоги не даёт", async () => {
    const r = await сессия({ tierId: "pro", app: "cyberchess" });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.provider).toBe("gumroad");
    expect(тревоги).toEqual([]);
  });

  test("добавочные места: сумма не доедет — и это видно", async () => {
    const r = await сессия({ seats: 5 });
    expect(r.status).toBe(200);
    expect(
      тревоги,
      "страница посчитала цену на 5 мест, касса спишет цену на одно, и следа нет"
    ).toContain(ИМЯ);
  });

  test("повтор ТОГО ЖЕ случая не шлёт вторую тревогу", async () => {
    // Расхождение суммы — свойство НАСТРОЙКИ (какой товар в магазине, что
    // умеет провайдер), а не отдельного запроса. Слать по тревоге на каждую
    // законную покупку — значит утопить настоящие аварии в шуме.
    //
    // В журнал при этом пишется каждый случай: оттуда берётся частота.
    const первый = await сессия({ seats: 7 });
    expect(первый.status).toBe(200);
    const былоПосле = тревоги.length;
    await сессия({ seats: 7 });
    await сессия({ seats: 7 });
    expect(
      тревоги.length,
      "то же самое сочетание шлёт тревогу на каждую покупку — канал превратится в шум"
    ).toBe(былоПосле);
  });

  test("промокод меняет сумму — тоже видно (переплачивает покупатель)", async () => {
    // Вторая причина расхождения, независимая от мест: без неё сторож
    // охранял бы только один вход в ту же дыру.
    const r = await сессия({ seats: 1, promoCode: "AEVION20" });
    expect(r.status).toBe(200);
    expect(
      тревоги,
      "страница показала сумму со скидкой, касса спишет полную цену товара, и следа нет"
    ).toContain(ИМЯ);
  });
});
