import { describe, test, expect, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

/**
 * Касса обязана брать ровно ту сумму, которую показала витрина.
 *
 * До 13.08.2026 у `/api/pricing/checkout/session` была СВОЯ арифметика: тариф,
 * места, модули и промо считались заново, отдельно от `buildQuote`. Пока обе
 * формулы совпадали, это выглядело исправным — но веерные скидки, добавленные в
 * buildQuote, до кассы не доехали: витрина показывала одну сумму, списывали
 * другую. Разойтись эти расчёты могли молча в любой момент.
 *
 * Тест сравнивает ДВА пути на одних входных данных. Пока он зелёный, второй
 * арифметики в кассе нет.
 */

import { vi } from "vitest";

process.env.NODE_ENV = "test";
// Без провайдеров чекаут честно отвечает 503 «оплата недоступна» — сумму из
// него не увидеть. Поэтому включаем ОДИН путь (Gumroad) и перехватываем то,
// что реально ушло бы в списание: amountCents. Это и есть «сколько возьмут».
for (const k of [
  "LEMON_SQUEEZY_API_KEY", "LEMON_SQUEEZY_STORE_ID",
  "PAYBOX_MERCHANT_ID", "PAYBOX_SECRET", "PAYPAL_CLIENT_ID", "PAYPAL_SECRET",
]) delete process.env[k];
process.env.GUMROAD_DEFAULT_PERMALINK = "test-permalink";

const { charged } = vi.hoisted(() => ({
  charged: { cents: -1 } as { cents: number; customData?: Record<string, string> },
}));
vi.mock("../src/lib/payment/gumroadProvider", () => ({
  gumroadPaymentProvider: {
    id: "gumroad",
    createIntent: async (input: { amountCents: number; customData?: Record<string, string> }) => {
      charged.cents = input.amountCents;
      charged.customData = input.customData;
      return { intentId: "i1", checkoutUrl: "https://example.test/checkout" };
    },
  },
}));

const { checkoutRouter } = await import("../src/routes/checkout");
const { buildQuote } = await import("../src/data/pricing");
const { MODULES_PRICING } = await import("../src/data/pricing");

function app() {
  const a = express();
  a.use(express.json());
  a.use("/api/pricing/checkout", checkoutRouter);
  return a;
}

function paidModules(n: number): string[] {
  return MODULES_PRICING
    .filter((m) => typeof m.addonMonthly === "number" && (m.addonMonthly ?? 0) > 0)
    .sort((a, b) => (a.addonMonthly ?? 0) - (b.addonMonthly ?? 0))
    .slice(0, n)
    .map((m) => m.id);
}

/** Сколько касса реально выставит, в центах — перехвачено у провайдера. */
async function checkoutCents(body: Record<string, unknown>): Promise<number> {
  charged.cents = -1;
  const r = await request(app()).post("/api/pricing/checkout/session").send(body);
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  expect(charged.cents, "провайдер не был вызван — сумму не перехватили").toBeGreaterThanOrEqual(0);
  return charged.cents;
}

const cases: Array<{ name: string; body: Record<string, unknown> }> = [
  { name: "тариф без ничего", body: { tierId: "medium" } },
  { name: "годовая оплата", body: { tierId: "full", period: "annual" } },
  { name: "восемь модулей — верхняя ступень веера", body: { tierId: "lite", modules: paidModules(8) } },
  { name: "двенадцать мест", body: { tierId: "medium", seats: 12 } },
  { name: "промо-код поверх всего", body: { tierId: "full", modules: paidModules(5), promoCode: "AEVION20" } },
  { name: "срок 36 месяцев", body: { tierId: "full", period: "annual", commitmentMonths: 36 } },
];

beforeEach(() => { /* окружение задано выше, состояния между случаями нет */ });

describe("касса берёт ровно то, что показала витрина", () => {
  for (const c of cases) {
    test(c.name, async () => {
      const quote = buildQuote({
        tierId: c.body.tierId as never,
        modules: c.body.modules as string[] | undefined,
        seats: c.body.seats as number | undefined,
        period: c.body.period as never,
        currency: "USD",
        promoCode: c.body.promoCode as string | undefined,
        commitmentMonths: c.body.commitmentMonths as number | undefined,
      });

      const cents = await checkoutCents(c.body);

      expect(cents).toBe(Math.round(quote.total * 100));
    });
  }

  test("контроль: веер ДЕЙСТВИТЕЛЬНО меняет сумму, иначе сравнение ничего не значит", async () => {
    // Если бы веер не влиял, все случаи выше совпадали бы и при старой
    // арифметике — тест проходил бы, не проверяя ничего.
    const withFan = await checkoutCents({ tierId: "lite", modules: paidModules(8) });
    const noFan = await checkoutCents({ tierId: "lite", modules: paidModules(2) });

    const q8 = buildQuote({ tierId: "lite", modules: paidModules(8) });
    expect(q8.fans.length).toBeGreaterThan(0);

    // Восемь модулей со скидкой всё равно дороже двух без неё — но именно
    // разница подтверждает, что скидка вычтена, а не проигнорирована.
    const sum8 = q8.subtotal;
    expect(withFan).toBeLessThan(Math.round(sum8 * 100));
    expect(noFan).toBeGreaterThan(0);
  });
});

/**
 * Канал привлечения доезжает от витрины до кассы.
 *
 * ЗАЧЕМ. Выручка по каналу считается только там, где известны ОБА поля —
 * сумма и канал. До 01.09.2026 канал знала только витрина: в ссылку
 * LemonSqueezy она клала его сама, а через нашу ручку чекаута он не проходил
 * вовсе, и покупки PayBox/PayPal попадали в сводке в ключ "direct".
 *
 * Едет он общим путём — через customData, тем же, которым давно ездит
 * выбранный модуль. Отдельного поля у провайдеров нет и не нужно.
 */
describe("канал привлечения доезжает до кассы", () => {
  test("канал из тела запроса попадает в customData", async () => {
    charged.customData = undefined;
    const r = await request(app())
      .post("/api/pricing/checkout/session")
      .send({ tierId: "lite", period: "monthly", channel: "tt" });
    expect(r.status, "чекаут не отдал сессию — дальше мерить нечего").toBe(200);
    expect(charged.customData?.channel, "канал не доехал до кассы").toBe("tt");
  });

  test("без канала лишнего поля не появляется", async () => {
    // Пустой канал хуже отсутствующего: в сводке он стал бы отдельным
    // безымянным ключом, и сумма по каналам перестала бы сходиться с общей.
    charged.customData = undefined;
    const r = await request(app())
      .post("/api/pricing/checkout/session")
      .send({ tierId: "lite", period: "monthly" });
    expect(r.status).toBe(200);
    expect(charged.customData?.channel, "канал придуман на пустом месте").toBeUndefined();
  });

  test("слишком длинный канал обрезается, а не уходит целиком", async () => {
    // Значение приходит из адресной строки, оттуда приезжает что угодно.
    charged.customData = undefined;
    await request(app())
      .post("/api/pricing/checkout/session")
      .send({ tierId: "lite", period: "monthly", channel: "x".repeat(200) });
    expect(charged.customData?.channel?.length, "длина не ограничена").toBe(40);
  });
});
