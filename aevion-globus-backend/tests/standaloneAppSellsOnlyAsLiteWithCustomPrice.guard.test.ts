import express from "express";
import request from "supertest";
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Снятые с ОТДЕЛЬНОЙ продажи модули — касса честно отказывает (400 «входит в
 * подписку»), витрина их не предлагает.
 *
 * ИСТОРИЯ. 21.09.2026 qright, qsign, startup_exchange, qskyway имели цену на
 * витрине, но своего варианта в LemonSqueezy не было — их продавали вариантом
 * тарифа lite с нашей ценой (`custom_price`) и модулем в `custom_data`. Этот
 * сторож стерёг тот запасной путь и 🔴 главную его опасность: у medium/full/max
 * вебхук `custom_data.module` НЕ читает и выдаёт набор ступени целиком, так что
 * «обобщение» запасного пути продало бы всю платформу за цену одного модуля.
 *
 * 🔴 01.10.2026 — РЕШЕНИЕ ОСНОВАТЕЛЯ: эти четыре модуля СНЯТЫ с отдельной
 * продажи. Касса на страница оплаты обещала «$400.00 billed every month» при
 * цене модуля $16–$40 (вариант планеты с подменой цены), и вместо репрайса
 * основатель убрал их из отдельной продажи. Источник правды — `продаётсяОтдельно`
 * (src/data/moduleAccess.ts), её же спрашивает касса (routes/checkout.ts) и —
 * с 05.10 — ручка состояния витрины (фильтр в /healthz, сторож
 * storefrontSellableHidesRemovedApps.guard). Поэтому НЫНЕ верное поведение:
 * любой срок снятого модуля → 400 `invalid_app`, касса не создаётся.
 *
 * 🔁 ЕСЛИ МОДУЛИ ВЕРНУТ В ПРОДАЖУ (путь B — свои варианты в кабинете LS):
 * восстановить ПРЕЖНИЕ ожидания этого сторожа — продажа ТОЛЬКО сроком lite
 * вариантом tier_lite + `custom_price` + `custom_data.module`, а medium/full/max
 * честно отказывают. Прежняя версия: `git show 83f5d1c5d:aevion-globus-backend/
 * tests/standaloneAppSellsOnlyAsLiteWithCustomPrice.guard.test.ts`.
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

const СНЯТЫЕ = ["qskyway", "qright", "qsign", "startup_exchange"] as const;

describe("снятые с отдельной продажи — касса честно отказывает (решение основателя 01.10)", () => {
  beforeEach(() => {
    созданные.length = 0;
    vi.resetModules();
    process.env.LEMON_SQUEEZY_API_KEY = "test-key";
    process.env.LEMON_SQUEEZY_STORE_ID = "1";
    process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = "test-secret";
    // Вариант тарифа ЗАДАН — то есть запасной путь технически доступен. Отказ
    // ниже обязан идти от `продаётсяОтдельно`, а не от «нет варианта»: иначе
    // сторож прошёл бы и на коде, который просто забыл настроить кассу.
    process.env.LEMON_SQUEEZY_VARIANT_LITE = "111111";
    // Свои варианты снятых — на всякий случай убираем: отказ не от их наличия.
    for (const slug of СНЯТЫЕ) {
      for (const t of ["LITE", "MEDIUM", "PRO", "FULL", "MAX"]) {
        delete process.env[`LEMON_SQUEEZY_VARIANT_${slug.toUpperCase()}_${t}`];
      }
    }
  });

  afterEach(() => {
    process.env = { ...прежниеПеременные };
  });

  for (const slug of СНЯТЫЕ) {
    for (const tierId of ["lite", "max"]) {
      test(`${slug} / ${tierId}: 400 invalid_app, касса не создаётся`, async () => {
        const приложение = await собратьПриложение();
        const ответ = await request(приложение)
          .post("/api/pricing/checkout/session")
          .send({ tierId, app: slug, seats: 1, currency: "USD" });

        expect(ответ.status, `${slug}/${tierId} обязан отвечать 400, а не 200/503`).toBe(400);
        expect(ответ.body.error).toBe("invalid_app");
        // Важнее кода: касса НЕ создана — ни по своему варианту, ни запасным путём.
        expect(созданные, `${slug}/${tierId}: касса не должна создаваться`).toHaveLength(0);
      });
    }
  }

  test("КОНТРОЛЬ: ещё продаваемый модуль (Multichat, свой вариант) — 200, касса создаётся", async () => {
    // Вторая половина пары: без неё «все 400» прошло бы и на коде, который
    // сломал кассу ЦЕЛИКОМ. Multichat продаётся отдельно (продаётсяОтдельно=true)
    // и имеет свой вариант — путь обязан работать.
    process.env.LEMON_SQUEEZY_VARIANT_MULTICHAT_LITE = "222222";
    const приложение = await собратьПриложение();
    const ответ = await request(приложение)
      .post("/api/pricing/checkout/session")
      .send({ tierId: "lite", app: "multichat", seats: 1, currency: "USD" });

    expect(ответ.status, "проданный Multichat обязан отвечать 200").toBe(200);
    expect(созданные).toHaveLength(1);
    expect(созданные[0].reference).toBe("app_multichat_lite");
  });
});
