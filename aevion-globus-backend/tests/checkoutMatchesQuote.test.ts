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
 * С 15.09.2026 тариф — это срок: сумма тарифа — платёж за весь срок вперёд, а
 * отдельное приложение продаётся по своей базе на той же лестнице (termTotal).
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
  charged: { cents: -1 } as { cents: number; customData?: Record<string, string>; reference?: string },
}));
vi.mock("../src/lib/payment/gumroadProvider", () => ({
  gumroadPaymentProvider: {
    id: "gumroad",
    createIntent: async (input: { amountCents: number; reference: string; customData?: Record<string, string> }) => {
      charged.cents = input.amountCents;
      charged.customData = input.customData;
      charged.reference = input.reference;
      return { intentId: "i1", checkoutUrl: "https://example.test/checkout" };
    },
  },
  gumroadSellable: () => ({ configured: [], missing: [] }),
}));

const { checkoutRouter } = await import("../src/routes/checkout");
const { buildQuote, MODULES_PRICING, termTotal, standaloneApp } = await import("../src/data/pricing");

function app() {
  const a = express();
  a.use(express.json());
  a.use("/api/pricing/checkout", checkoutRouter);
  return a;
}

/** Модули с ценой надстройки — на платном сроке они обязаны входить в подписку. */
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
  { name: "срок Medium без ничего", body: { tierId: "medium" } },
  { name: "срок Max — 12 месяцев вперёд", body: { tierId: "max" } },
  { name: "модули на платном сроке входят в подписку", body: { tierId: "lite", modules: paidModules(4) } },
  { name: "двенадцать мест", body: { tierId: "medium", seats: 12 } },
  { name: "промо-код поверх мест", body: { tierId: "full", seats: 3, promoCode: "AEVION20" } },
  { name: "срок обязательства 36 месяцев", body: { tierId: "max", commitmentMonths: 36 } },
  { name: "прежнее поле period ничего не меняет", body: { tierId: "pro", period: "annual" } },
];

beforeEach(() => { /* окружение задано выше, состояния между случаями нет */ });

describe("касса берёт ровно то, что показала витрина", () => {
  for (const c of cases) {
    test(c.name, async () => {
      const quote = buildQuote({
        tierId: c.body.tierId as never,
        modules: c.body.modules as string[] | undefined,
        seats: c.body.seats as number | undefined,
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
    // арифметике — тест проходил бы, не проверяя ничего. На платном сроке модули
    // входят в подписку, поэтому ступень веера даёт объём мест.
    const withFan = await checkoutCents({ tierId: "medium", seats: 12 });
    const noFan = await checkoutCents({ tierId: "medium", seats: 1 });

    const q12 = buildQuote({ tierId: "medium", seats: 12 });
    expect(q12.fans.length, "у двенадцати мест нет ступени веера — контроль пустой").toBeGreaterThan(0);

    expect(withFan, "скидка веера не вычтена из суммы кассы").toBeLessThan(Math.round(q12.subtotal * 100));
    expect(noFan).toBeGreaterThan(0);
  });

  test("КОНТРОЛЬ: срок в сумме участвует — Max не стоит как один месяц", async () => {
    const max = await checkoutCents({ tierId: "max" });
    const lite = await checkoutCents({ tierId: "lite" });
    expect(max, "платёж за 12 месяцев равен платежу за месяц").toBeGreaterThan(lite);
  });
});

describe("отдельное приложение: касса берёт цену его ступени", () => {
  test("CyberChess на срок Pro — платёж за шесть месяцев по базе приложения", async () => {
    const chess = standaloneApp("cyberchess")!;
    const cents = await checkoutCents({ tierId: "pro", app: "cyberchess" });
    expect(cents, "касса взяла не цену приложения на этой ступени").toBe(termTotal(chess.baseMonthly, "pro") * 100);
    expect(charged.reference).toBe("app_cyberchess_pro");
  });

  test("КОНТРОЛЬ: другая ступень того же приложения стоит иначе, а не как планета", async () => {
    const pro = await checkoutCents({ tierId: "pro", app: "cyberchess" });
    const max = await checkoutCents({ tierId: "max", app: "cyberchess" });
    const планетаPro = Math.round(buildQuote({ tierId: "pro" }).total * 100);
    expect(max).not.toBe(pro);
    expect(pro, "приложение продано по цене всей планеты").not.toBe(планетаPro);
  });

  test("приложение вне пяти и бесплатный срок — отказ 400, а не тихая покупка тарифа", async () => {
    const чужое = await request(app()).post("/api/pricing/checkout/session").send({ tierId: "pro", app: "smeta" });
    expect(чужое.status).toBe(400);
    expect(чужое.body.error).toBe("invalid_app");
    const бесплатно = await request(app()).post("/api/pricing/checkout/session").send({ tierId: "free", app: "cyberchess" });
    expect(бесплатно.status).toBe(400);
    expect(бесплатно.body.error).toBe("invalid_app");
  });
});

/**
 * Канал привлечения доезжает от витрины до кассы.
 *
 * ЗАЧЕМ. Выручка по каналу считается только там, где известны ОБА поля —
 * сумма и канал. До 01.09.2026 канал знала только витрина: в ссылку
 * LemonSqueezy она клала его сама, а через нашу ручку чекаута он не проходил
 * вовсе, и покупки PayBox/PayPal попадали в сводке в ключ "direct".
 */
describe("канал привлечения доезжает до кассы", () => {
  test("канал из тела запроса попадает в customData", async () => {
    charged.customData = undefined;
    const r = await request(app())
      .post("/api/pricing/checkout/session")
      .send({ tierId: "lite", channel: "tt" });
    expect(r.status, "чекаут не отдал сессию — дальше мерить нечего").toBe(200);
    expect((charged.customData as Record<string, string> | undefined)?.channel, "канал не доехал до кассы").toBe("tt");
  });

  test("без канала лишнего поля не появляется", async () => {
    // Пустой канал хуже отсутствующего: в сводке он стал бы отдельным
    // безымянным ключом, и сумма по каналам перестала бы сходиться с общей.
    charged.customData = undefined;
    const r = await request(app())
      .post("/api/pricing/checkout/session")
      .send({ tierId: "lite" });
    expect(r.status).toBe(200);
    expect((charged.customData as Record<string, string> | undefined)?.channel, "канал придуман на пустом месте").toBeUndefined();
  });

  test("слишком длинный канал обрезается, а не уходит целиком", async () => {
    // Значение приходит из адресной строки, оттуда приезжает что угодно.
    charged.customData = undefined;
    await request(app())
      .post("/api/pricing/checkout/session")
      .send({ tierId: "lite", channel: "x".repeat(200) });
    expect((charged.customData as Record<string, string> | undefined)?.channel?.length, "длина не ограничена").toBe(40);
  });
});
