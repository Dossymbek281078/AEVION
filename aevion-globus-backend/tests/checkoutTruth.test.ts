import { describe, test, expect, beforeAll, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Контракт правдивости ответа чекаута.
 *
 * Он появился 2026-07-26 из-за находки: на LemonSqueezy и Gumroad скидка НЕ
 * доходит до счёта, а чекаут молча отдавал ссылку на полную цену, показав
 * скидку в смете. Теперь ответ обязан говорить, что произойдёт на самом деле —
 * и это единственная защита покупателя, поэтому она под тестом, а не «по
 * живому запросу один раз».
 *
 * Проверяются три вещи, которые ломаются молча:
 *   1. `chargeCurrency` есть ВСЕГДА (иначе клиент угадывает валюту по наличию
 *      поля — так и заводятся тихие ошибки);
 *   2. на канале, который умеет списывать нашу сумму, `chargedUsd == quotedUsd`;
 *   3. на канале с фиксированной ценой `chargedUsd === null` + причина, а НЕ
 *      красивое выдуманное число.
 */

const OLD_ENV = { ...process.env };
/**
 * Стор подписок — в temp. Чекаут со stub-провайдером ПРОВИЖИНИТ подписку на
 * каждый вызов; без этого тест насыпал бы записи в рабочую копию репозитория
 * (так уже случалось — 6 мусорных подписок в data/subscriptions.jsonl).
 */
const TMP = mkdtempSync(join(tmpdir(), "aevion-checkout-truth-"));

beforeAll(() => {
  process.env.FRONTEND_URL = "http://localhost:3000";
  process.env.SUBSCRIPTIONS_FILE = join(TMP, "subscriptions.jsonl");
  delete process.env.LEMON_SQUEEZY_API_KEY;
  delete process.env.LEMON_SQUEEZY_ALLOW_CUSTOM_PRICE;
});

/**
 * Владельца восстанавливаем ПЕРЕД КАЖДЫМ тестом: сам чекаут провижинит подписку
 * на купленные модули, то есть после первого же запроса владелец «уже владеет»
 * тем, что покупает, и веер честно гаснет. Без этого второй тест в файле падал
 * бы из-за первого, а выглядело бы как дефект веера.
 */
beforeEach(async () => {
  const { provisionSubscription } = await import("../src/routes/provisioning");
  await (provisionSubscription as never as (a: Record<string, unknown>) => Promise<unknown>)({
    email: FAN_OWNER_EMAIL,
    tierId: "medium",
    modules: ["qsign"],
    source: "test",
  });
});

afterAll(() => {
  process.env = { ...OLD_ENV };
  rmSync(TMP, { recursive: true, force: true });
});

/**
 * Роутер импортируется ОДИН раз и кэшируется.
 *
 * Раньше `await import()` стоял внутри каждого запроса. Node кэширует модули,
 * но ПЕРВЫЙ импорт тянет половину графа (Prisma, пул Postgres, провайдеры
 * оплаты), и на загруженной машине он один съедал дефолтные 5 секунд теста:
 * замерено — файл шёл 13.7 с и ронял проверку, хотя в изоляции проходит меньше
 * секунды. Ветвление по каналам от этого не страдает: `channelHonoursAmount` и
 * `gumroadPermalinkConfigured` читают env В МОМЕНТ ЗАПРОСА, а не при импорте,
 * поэтому env можно менять между тестами и после загрузки модуля.
 */
let appPromise: Promise<express.Express> | null = null;
function getApp(): Promise<express.Express> {
  if (!appPromise) {
    appPromise = import("../src/routes/checkout").then(({ checkoutRouter }) => {
      const app = express();
      app.use(express.json());
      app.use("/api/pricing/checkout", checkoutRouter);
      return app;
    });
  }
  return appPromise;
}

async function post(body: unknown, env: Record<string, string | undefined> = {}) {
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  const app = await getApp();
  return request(app).post("/api/pricing/checkout/session").send(body as object);
}

/** Запас на первый импорт под нагрузкой — см. комментарий у getApp(). */
const IMPORT_TIMEOUT_MS = 30_000;

/**
 * Веер здесь должен быть АКТИВЕН — иначе тест «скидка учтена» проверяет только
 * промо. Раньше для этого хватало `ownedModules: ["qsign"]` в теле, но чекаут
 * больше не верит телу о владении (см. tests/fanOwnershipVerification): скидку
 * на списание даёт сервер по своему стору. Поэтому владельца заводим по-настоящему,
 * тем же провижинингом, что и живая покупка, и присылаем его адрес.
 */
const FAN_OWNER_EMAIL = "checkout-truth-owner@test.dev";

const ORDER = {
  tierId: "medium",
  modules: ["qright", "qcontract"],
  email: FAN_OWNER_EMAIL,
  promoCode: "AEVION20",
};

describe("ответ чекаута говорит правду о списании", () => {
  test("валюта списания есть в ответе всегда", async () => {
    const r = await post(ORDER, { GUMROAD_DEFAULT_PERMALINK: undefined });
    expect(r.status).toBe(200);
    expect(r.body.chargeCurrency).toBe("USD");
  }, IMPORT_TIMEOUT_MS);

  test("канал, который списывает нашу сумму: chargedUsd == quotedUsd и скидка учтена", async () => {
    const r = await post(ORDER, { GUMROAD_DEFAULT_PERMALINK: undefined });
    expect(r.body.discountHonoured).toBe(true);
    expect(r.body.chargedUsd).toBe(r.body.quotedUsd);
    expect(r.body.incentiveDiscountUsd).toBeGreaterThan(0);
    expect(r.body.fan.status).toBe("active");
    expect(r.body.fan.appliedUsd).toBeGreaterThan(0);
  }, IMPORT_TIMEOUT_MS);

  test("🔴 канал с фиксированной ценой: chargedUsd === null и названа причина", async () => {
    // Раньше здесь молча отдавалась ссылка на полную цену. Красивое выдуманное
    // число было бы второй ложью вместо первой — поэтому именно null.
    const r = await post(ORDER, { GUMROAD_DEFAULT_PERMALINK: "aevion-test" });
    expect(r.body.provider).toBe("gumroad");
    expect(r.body.discountHonoured).toBe(false);
    expect(r.body.chargedUsd).toBeNull();
    expect(r.body.tierListUsd).toBeGreaterThan(0);
    expect(String(r.body.discountNotHonouredReason)).toMatch(/Gumroad/);
    // Смета всё равно названа — покупателю и владельцу видно расхождение.
    expect(r.body.quotedUsd).toBeGreaterThan(0);
  }, IMPORT_TIMEOUT_MS);

  test("🔴 кривое тело запроса НЕ роняет платёжный эндпоинт", async () => {
    // Найдено 2026-07-26 прогоном враждебных входов: ownedModules приходил в
    // движок веера БЕЗ валидации, и число/null/объект в массиве роняли .trim(),
    // а не-массив — .map(). То есть любой кривой (или злонамеренный) клиент мог
    // получить 500 на ПУТИ К ОПЛАТЕ. Ни один прежний тест этого не ловил: все
    // слали корректное тело.
    const hostile: unknown[] = [
      { tierId: "medium", ownedModules: [42, null, { a: 1 }] },
      { tierId: "medium", ownedModules: "qsign" },
      { tierId: "medium", ownedModules: Array.from({ length: 500 }, (_, i) => `mod${i}`) },
      { tierId: "medium", lastPurchaseAt: { not: "a date" } },
      { tierId: "medium", ownedModules: [""], lastPurchaseAt: "не-дата" },
    ];
    for (const body of hostile) {
      const r = await post(body, { GUMROAD_DEFAULT_PERMALINK: undefined });
      expect(r.status, `упало на теле: ${JSON.stringify(body).slice(0, 60)}`).toBe(200);
      expect(typeof r.body.quotedUsd).toBe("number");
    }
  }, IMPORT_TIMEOUT_MS);

  test("🔴 один запрос = одна запись в метрике, даже если каскад пробовал несколько каналов", async () => {
    // Каскад пробует провайдеров по очереди, а charge() вызывается ДО
    // createIntent(), который может бросить. Пока запись шла из charge(), один
    // запрос попадал в метрику несколько раз — за каналы, которые ничего не
    // отдали, — и «сколько скидок мы потеряли» превращалось в вымысел.
    const { integritySummary } = await import("../src/lib/discountIntegrityLog");
    const before = await integritySummary(30);
    await post(ORDER, { GUMROAD_DEFAULT_PERMALINK: "aevion-test" });
    const after = await integritySummary(30);
    expect(after.sessions - before.sessions).toBe(1);
    expect(after.notHonoured - before.notHonoured).toBe(1);
  }, IMPORT_TIMEOUT_MS);

  test("без скидок discountHonoured остаётся true (нечего не применять)", async () => {
    const r = await post(
      { tierId: "medium" },
      { GUMROAD_DEFAULT_PERMALINK: "aevion-test" },
    );
    expect(r.body.incentiveDiscountUsd).toBe(0);
    expect(r.body.discountHonoured).toBe(true);
  }, IMPORT_TIMEOUT_MS);
});
