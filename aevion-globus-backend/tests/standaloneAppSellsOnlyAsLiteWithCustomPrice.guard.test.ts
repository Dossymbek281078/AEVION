import express from "express";
import request from "supertest";
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Отдельный модуль без своего товара в кассе продаётся ТОЛЬКО сроком lite.
 *
 * ЗАЧЕМ ЭТОТ СТОРОЖ. Замер 21.09.2026, в день запуска: qright, qsign,
 * startup_exchange и qskyway имели назначенную цену на витрине, а касса
 * отвечала 503 `checkout_unavailable` — у них нет своего варианта в
 * LemonSqueezy. Контроль той же командой: devhub -> 200, выдуманное
 * приложение -> 400 `invalid_app`. Завести варианты пачкой нельзя: API кассы
 * на POST /v1/products и /v1/variants отвечает 405.
 *
 * Починка продаёт такой модуль ВАРИАНТОМ ТАРИФА lite с нашей ценой
 * (`custom_price`) и модулем в `custom_data`. Вебхук этот случай уже умеет:
 * `tierId === "lite" && customModule` даёт права ровно на один модуль.
 *
 * 🔴 ОПАСНОСТЬ, РАДИ КОТОРОЙ СТОРОЖ И НАПИСАН. У medium/full/max вебхук
 * `custom_data.module` НЕ читает — он выдаёт набор ступени целиком. Стоит
 * кому-нибудь «обобщить» запасной путь на остальные сроки, и qskyway за цену
 * одного модуля откроет всю платформу на год. Это тот же класс, из-за
 * которого 16.09 снимали товары с публикации, только в обратную сторону.
 * Поэтому здесь проверяется не только то, что покупка идёт, но и то, что для
 * НЕ-lite она по-прежнему честно отказывает.
 */

const созданные: any[] = [];

vi.mock("../src/lib/payment/lemonSqueezyProvider", () => ({
  lemonSqueezyPaymentProvider: {
    id: "lemonsqueezy",
    async createIntent(input: any) {
      созданные.push(input);
      return { intentId: "test-intent", checkoutUrl: "https://example.test/checkout/custom/uuid" };
    },
  },
}));

const прежниеПеременные = { ...process.env };

async function собратьПриложение() {
  const { checkoutRouter } = await import("../src/routes/checkout");
  const app = express();
  app.use(express.json());
  app.use("/api/pricing/checkout", checkoutRouter);
  return app;
}

describe("отдельный модуль без своего варианта", () => {
  beforeEach(() => {
    созданные.length = 0;
    vi.resetModules();
    process.env.LEMON_SQUEEZY_API_KEY = "test-key";
    process.env.LEMON_SQUEEZY_STORE_ID = "1";
    process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = "test-secret";
    // Вариант есть ТОЛЬКО у тарифа. Своего варианта у qskyway нет — это и есть
    // состояние прода на 21.09.2026.
    process.env.LEMON_SQUEEZY_VARIANT_LITE = "111111";
    delete process.env.LEMON_SQUEEZY_VARIANT_QSKYWAY_LITE;
    delete process.env.LEMON_SQUEEZY_VARIANT_QSKYWAY_MAX;
  });

  afterEach(() => {
    process.env = { ...прежниеПеременные };
  });

  test("срок lite: касса открывается вариантом тарифа, цену назначаем мы, модуль назван", async () => {
    const приложение = await собратьПриложение();
    const ответ = await request(приложение)
      .post("/api/pricing/checkout/session")
      .send({ tierId: "lite", app: "qskyway", seats: 1, currency: "USD" });

    expect(ответ.status).toBe(200);
    expect(ответ.body.provider).toBe("lemonsqueezy");
    expect(созданные).toHaveLength(1);

    const вход = созданные[0];
    // Вариант берём тарифный — иначе платить не по чему.
    expect(вход.reference).toBe("tier_lite");
    // Но цену — СВОЮ, иначе покупатель заплатит цену планеты.
    expect(вход.customPriceCents).toBe(вход.amountCents);
    expect(вход.customPriceCents).toBeGreaterThan(0);
    // И модуль обязан быть назван: без него вебхук выдаст тариф без границы.
    expect(вход.customData?.module).toBe("qskyway");
  });

  test("🔴 срок НЕ lite: отказ, а не продажа набора за цену одного модуля", async () => {
    const приложение = await собратьПриложение();
    const ответ = await request(приложение)
      .post("/api/pricing/checkout/session")
      .send({ tierId: "max", app: "qskyway", seats: 1, currency: "USD" });

    expect(ответ.status).toBe(503);
    expect(ответ.body.error).toBe("checkout_unavailable");
    // Ни одной кассы создано не было: важно именно это, а не код ответа.
    expect(созданные).toHaveLength(0);
  });

  test("у кого свой вариант есть — путь не изменился, цену назначает касса", async () => {
    process.env.LEMON_SQUEEZY_VARIANT_QSKYWAY_LITE = "222222";
    const приложение = await собратьПриложение();
    const ответ = await request(приложение)
      .post("/api/pricing/checkout/session")
      .send({ tierId: "lite", app: "qskyway", seats: 1, currency: "USD" });

    expect(ответ.status).toBe(200);
    expect(созданные).toHaveLength(1);
    expect(созданные[0].reference).toBe("app_qskyway_lite");
    // Своя цена здесь НЕ передаётся: у товара она уже правильная, а две цены
    // одного и того же доступа — источник расхождения.
    expect(созданные[0].customPriceCents).toBeUndefined();
  });
});

describe("витрина и касса отвечают одно и то же", () => {
  /**
   * Витрина зажигает кнопку по ПОЛОЖИТЕЛЬНОМУ списку `sellable.configured`
   * (frontend/src/app/pricing/page.tsx, `продаётсяСсылка`). Если касса умеет
   * продать, а список молчит — кнопка останется серой с текстом «оформить
   * онлайн пока нельзя, напишите нам». Человек уйдёт писать письмо вместо
   * того, чтобы заплатить: почини мы только кассу, снаружи не изменилось бы
   * ничего.
   */
  const прежние = { ...process.env };
  beforeEach(() => {
    delete process.env.LEMON_SQUEEZY_VARIANT_QSKYWAY_LITE;
    delete process.env.LEMON_SQUEEZY_VARIANT_QSKYWAY_MAX;
    process.env.LEMON_SQUEEZY_VARIANT_LITE = "111111";
  });
  afterEach(() => {
    process.env = { ...прежние };
  });

  test("lite попадает в продаваемые, длинные сроки — нет", async () => {
    const { lemonSqueezySellable } = await import("../src/data/lemonSqueezyVariants");
    const { configured, missing } = lemonSqueezySellable();
    expect(configured).toContain("app_qskyway_lite");
    // Обратный контроль: без него утверждение прошло бы и на списке «всё продаётся».
    expect(missing).toContain("app_qskyway_max");
    expect(configured).not.toContain("app_qskyway_max");
  });

  test("нет тарифного варианта — нет и запасного пути (кнопка честно серая)", async () => {
    delete process.env.LEMON_SQUEEZY_VARIANT_LITE;
    const { lemonSqueezySellable } = await import("../src/data/lemonSqueezyVariants");
    expect(lemonSqueezySellable().missing).toContain("app_qskyway_lite");
  });
});
