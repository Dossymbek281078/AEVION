import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "crypto";
import express from "express";
import request from "supertest";

/**
 * ДЕНЕЖНАЯ ГРАНИЦА: за $16 покупатель не должен получать товар планеты.
 *
 * Как устроена продажа девяти отдельных приложений. У большинства нет своего
 * товара в LemonSqueezy, и чтобы их вообще можно было купить (до 24.09.2026
 * касса отвечала 503), покупка идёт ВАРИАНТОМ ТАРИФА ПЛАНЕТЫ `tier_lite`, а
 * цену мы передаём своим `custom_price`. Узкость этого запасного пути держат
 * ЧЕТЫРЕ условия, и каждое — про деньги:
 *   1. `resolveLemonSqueezyVariant(reference)` непуст → подменять НЕЛЬЗЯ
 *      (у приложения есть свой товар, подмена выставила бы чужой счёт);
 *   2. ссылка обязана быть `app_<слаг>_lite` — только у lite вебхук читает
 *      `custom_data.module`; на medium/pro/full/max выдалась бы вся ступень;
 *   3. слаг обязан быть в STANDALONE_APPS — снятое с продажи не продаётся;
 *   4. на стороне ВЫДАЧИ: `tierId === "lite" && customModule` — иначе
 *      покупка одного модуля открыла бы платформенную подписку.
 *
 * 🔴 ПОЧЕМУ ЭТОТ ФАЙЛ ПОЯВИЛСЯ. 11.10.2026 замером: все ЧЕТЫРЕ условия были
 * без охраны. Мутации (каждое условие — в отдельном прогоне):
 *   У1 убрать «свой товар есть»      -> 8 из 8 ЗЕЛЁНЫХ
 *   У2 пустить medium и pro          -> 8 из 8 ЗЕЛЁНЫХ
 *   У3 убрать проверку STANDALONE    -> 8 из 8 ЗЕЛЁНЫХ
 *   У4 убрать `tierId === "lite"`    -> 8 из 8 ЗЕЛЁНЫХ
 * Гонялись `oneModulePurchaseDoesNotOpenThePlanet.guard.test.ts` и
 * `storefrontSellableHidesRemovedApps.guard.test.ts` — единственные, где
 * `fallbackVariantForReference` вообще упоминается, причём В КОММЕНТАРИИ
 * (строки 13 и 12), а не в коде: текст О вещи неотличим от вещи, и мой
 * собственный греп по имени дал ложное «охраняется».
 * ПОЛОЖИТЕЛЬНЫЙ КОНТРОЛЬ прибора в тот же заход: подмена выдаваемого модуля
 * на чужой роняет их (2 упало из 8) — значит они краснеть умеют, и дело
 * было в непокрытых ветвях, а не в приборе.
 */

const SECRET = "test-ls-secret-fallback-narrow";
process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = SECRET;

const { mockQuery, mockProvision, mockUpsertApp } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockProvision: vi.fn(),
  mockUpsertApp: vi.fn(),
}));

vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: mockQuery }) }));
vi.mock("../src/routes/provisioning", () => ({
  // Имена ровно те, что зовёт вебхук: первая попытка с выдуманным
  // provisionPaidAccount дала 500 — мой промах, не дефект продукта.
  provisionSubscription: mockProvision,
  writeSubscription: vi.fn(),
}));
vi.mock("../src/lib/appEntitlements", async (orig) => {
  const настоящий = (await orig()) as Record<string, unknown>;
  return { ...настоящий, upsertAppSubscription: mockUpsertApp };
});
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => vi.fn() }));

const { fallbackVariantForReference } = await import("../src/data/lemonSqueezyVariants");
const { STANDALONE_APPS } = await import("../src/data/pricing");
const { lemonSqueezyWebhookRouter } = await import("../src/routes/lemonSqueezyWebhook");

// Тот же идентификатор, что и `variant_id` в теле вебхука: иначе ссылка не узнаётся.
const ПЛАНЕТА = "8001";
const МЕДИУМ = "8002";
const СВОЙ = "own-product-variant-999";
const СЛАГИ = STANDALONE_APPS.map((a) => a.slug);
/** Сколько приложений продаётся по состоянию на 11.10.2026. Упало ниже — сторож краснеет. */
const СЛАГОВ_БЫЛО = 9;

const убратьНаши = () => {
  for (const k of Object.keys(process.env)) {
    if (k.startsWith("LEMON_SQUEEZY_VARIANT_")) delete process.env[k];
  }
};

beforeEach(() => {
  убратьНаши();
  process.env.LEMON_SQUEEZY_VARIANT_LITE = ПЛАНЕТА;
  mockUpsertApp.mockClear();
  mockProvision.mockReset();
  // Без этого ветвь ступени бросает на `result.subscription.id`
  // и ответ 500 читался бы как дефект продукта — это был мой промах.
  mockProvision.mockResolvedValue({ subscription: { id: "s1" } });
  mockQuery.mockReset();
  mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
});
afterEach(убратьНаши);

describe("Касса: запасной путь остаётся узким", () => {
  it("прибор видит предмет: знаменатель не упал", () => {
    expect(СЛАГИ.length).toBeGreaterThanOrEqual(СЛАГОВ_БЫЛО);
    expect(СЛАГИ).toContain("qskyway");
  });

  it("🔴 У1: у приложения есть СВОЙ товар — подменять планетой нельзя", () => {
    process.env.LEMON_SQUEEZY_VARIANT_QSKYWAY_LITE = СВОЙ;
    expect(fallbackVariantForReference("app_qskyway_lite")).toBeNull();
  });

  it("ПОЛОЖИТЕЛЬНЫЙ КОНТРОЛЬ к У1: своего товара нет — запасной путь работает", () => {
    expect(fallbackVariantForReference("app_qskyway_lite")).toBe(ПЛАНЕТА);
  });

  it("🔴 У2: запасным путём идёт ТОЛЬКО lite — ни medium, ни pro, ни full, ни max", () => {
    for (const ступень of ["medium", "pro", "full", "max"]) {
      expect(
        fallbackVariantForReference(`app_qskyway_${ступень}`),
        `ступень ${ступень} не должна проходить запасным путём`,
      ).toBeNull();
    }
  });

  it("🔴 У3: слаг не из продаваемых — запасного пути нет (снятое не продаётся)", () => {
    for (const чужой of ["qnews", "qlearn", "qfusionai", "qai"]) {
      expect(СЛАГИ, `${чужой} внезапно продаётся — пересмотрите тест`).not.toContain(чужой);
      expect(fallbackVariantForReference(`app_${чужой}_lite`)).toBeNull();
    }
  });

  it("весь знаменатель: все продаваемые слаги проходят lite и НЕ проходят medium", () => {
    let прошли = 0;
    for (const s of СЛАГИ) {
      expect(fallbackVariantForReference(`app_${s}_lite`), `lite для ${s}`).toBe(ПЛАНЕТА);
      expect(fallbackVariantForReference(`app_${s}_medium`), `medium для ${s}`).toBeNull();
      прошли += 1;
    }
    expect(прошли).toBe(СЛАГИ.length);
    expect(прошли).toBeGreaterThanOrEqual(СЛАГОВ_БЫЛО);
  });
});

/*
 * 🔴 ПОПРАВКА К МОЕМУ ЖЕ ЗАМЕРУ. Первая версия этого теста посылала
 * `custom_data.reference = "tier_medium"` и называла дефектом то, что модуль
 * всё равно выдался. Дефекта нет: вебхук берёт ступень ИЗ `variant_id`
 * (`referenceForVariantId` → `tierForLemonSqueezyReference`), а `custom_data.reference`
 * для ступени не читает вовсе. Значит ступень задаётся ТОЛЬКО вариантом.
 */
function вебхук(variantId: string, module: string | undefined, n: number) {
  const payload = {
    meta: {
      event_name: "subscription_created",
      custom_data: module ? { module } : {},
    },
    data: {
      id: `sub_narrow_${n}`,
      attributes: { user_email: `buyer${n}@test.aev`, variant_id: variantId, total: 1600 },
    },
  };
  const raw = JSON.stringify(payload);
  const sig = crypto.createHmac("sha256", SECRET).update(raw, "utf8").digest("hex");
  const a = express();
  a.use(express.json());
  a.use("/api/lemonsqueezy", lemonSqueezyWebhookRouter);
  return request(a)
    .post("/api/lemonsqueezy/webhook")
    .set("Content-Type", "application/json")
    .set("X-Signature", sig)
    .send(raw);
}

describe("Выдача: модуль выдаётся только по lite-ссылке", () => {
  it("ПОЛОЖИТЕЛЬНЫЙ КОНТРОЛЬ: вариант lite + модуль -> право на модуль выдано", async () => {
    const r = await вебхук(ПЛАНЕТА, "qskyway", 1);
    expect(r.status).toBe(200);
    expect(mockUpsertApp).toHaveBeenCalled();
    expect(mockUpsertApp.mock.calls[0][1]).toBe("qskyway");
  });

  it("🔴 У4: вариант medium + залётный модуль -> покупатель получает СТУПЕНЬ, а не один модуль", async () => {
    process.env.LEMON_SQUEEZY_VARIANT_MEDIUM = МЕДИУМ;
    const r = await вебхук(МЕДИУМ, "qskyway", 2);
    expect(r.status).toBe(200);
    expect(
      mockUpsertApp.mock.calls.map((c) => c[1]),
      "ссылка не lite, а модуль всё равно выдан этим путём",
    ).not.toContain("qskyway");
  });
});
