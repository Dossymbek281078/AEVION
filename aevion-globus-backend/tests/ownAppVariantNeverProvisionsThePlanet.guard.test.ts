import { describe, test, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import crypto from "node:crypto";

/**
 * Сторож: покупка приложения по ЕГО СОБСТВЕННОМУ товару — на любом сроке — не
 * создаёт платформенную подписку.
 *
 * ЧЕТВЁРТАЯ ВЕТВЬ ОДНОГО КЛАССА. Сосед `oneModulePurchaseDoesNotOpenThePlanet`
 * охраняет ЗАПАСНОЙ путь (вариант планеты `tier_lite` плюс `custom_data.module`:
 * так продаются qright, qsign, qskyway, биржа). Но пять приложений имеют СВОЙ
 * товар в кассе, и у каждого пять сроков — `app_<слаг>_{lite…max}`. Этот путь
 * не охранял никто: прежний сторож остался бы зелёным, потому что проверяет
 * другую ветку.
 *
 * ПОЧЕМУ ЭТО ОПАСНО ИМЕННО ЗДЕСЬ (замер 12.10.2026, окно user-d7):
 *   tierForLemonSqueezyReference("app_cyberchess_max") → "lite"
 * — у ссылок приложений тариф не разбирается вовсе, отдаётся УМОЛЧАНИЕ "lite"
 * (в коде оно подписано как самый безопасный платный вход). С 15.09.2026 тариф
 * это срок, и normalizeTier("lite") даёт "full", то есть доступ ко ВСЕЙ
 * планете. Значит единственное, что отделяет покупку CyberChess за 24 доллара
 * (или 144 за 12 месяцев) от планеты за 2400 — ПОРЯДОК двух ветвей в
 * обработчике: `isAppReference` стоит ВЫШЕ тарифной. Переставь их местами, и
 * утечка вернётся молча.
 *
 * Замеры живой кассы той же ночью (помеченные запросы): cyberchess+lite → 200,
 * страница кассы «AEVION CyberChess Lite — 1 month», 24,00; cyberchess+max →
 * 200, «CyberChess Max — 12 months», 144,00 и подпись «billed every 12
 * months». То есть длинные сроки приложений реально продаются, и эта ветвь не
 * теория.
 *
 * ГРАНИЦА: выдача права (upsertAppSubscription) и платформенное провижинивание
 * здесь подменены — проверяется, КОГО зовут и с чем, а не что записано в базу.
 * Запись прав проверяют appPurchaseIsConfirmable и moduleBoughtAnywhereIsDurable.
 */

const SECRET = "test-ls-secret-own-app-variant";
process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = SECRET;
// Свои товары приложений: один слаг на двух сроках плюс планета для контроля.
process.env.LEMON_SQUEEZY_VARIANT_CYBERCHESS_LITE = "7701";
process.env.LEMON_SQUEEZY_VARIANT_CYBERCHESS_MAX = "7702";
process.env.LEMON_SQUEEZY_VARIANT_DEVHUB_MAX = "7703";
process.env.LEMON_SQUEEZY_VARIANT_QVENTURE_MEDIUM = "7704";
process.env.LEMON_SQUEEZY_VARIANT_MAX = "7705";

const { mockQuery, mockProvision, mockUpsertApp, mockDevHub } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockProvision: vi.fn(),
  mockUpsertApp: vi.fn(),
  mockDevHub: vi.fn(),
}));

vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: mockQuery }) }));
vi.mock("../src/routes/provisioning", () => ({
  provisionSubscription: mockProvision,
  writeSubscription: vi.fn(),
}));
vi.mock("../src/lib/appEntitlements", async (orig) => {
  const настоящий = (await orig()) as Record<string, unknown>;
  return { ...настоящий, upsertAppSubscription: mockUpsertApp };
});
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => vi.fn() }));

const { lemonSqueezyWebhookRouter } = await import("../src/routes/lemonSqueezyWebhook");
const { normalizeTier, isModuleEntitled } = await import("../src/lib/planGate");
const { tierForLemonSqueezyReference, referenceForVariantId } = await import(
  "../src/data/lemonSqueezyVariants"
);

function приложение() {
  const a = express();
  a.use(express.json());
  a.use("/api/lemonsqueezy", lemonSqueezyWebhookRouter);
  return a;
}

let счётчик = 0;
/**
 * Покупка по СВОЕМУ товару приложения. `custom_data.module` НЕ кладём
 * намеренно: замер checkout.ts — его кладут только на сроке lite с явно
 * выбранным модулем либо на запасном пути. У своего товара на длинном сроке
 * этого поля в вебхуке нет.
 */
function купилПриложение(вариант: string, сумма: number) {
  счётчик += 1;
  const payload = {
    meta: { event_name: "subscription_created", custom_data: {} },
    data: {
      id: "sub_app_" + счётчик,
      attributes: { user_email: "app" + счётчик + "@test.aev", variant_id: вариант, total: сумма },
    },
  };
  const raw = JSON.stringify(payload);
  const sig = crypto.createHmac("sha256", SECRET).update(raw, "utf8").digest("hex");
  return request(приложение())
    .post("/api/lemonsqueezy/webhook")
    .set("Content-Type", "application/json")
    .set("X-Signature", sig)
    .send(raw);
}

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockResolvedValue({ rows: [] });
  mockProvision.mockReset();
  mockProvision.mockResolvedValue({ subscription: { id: "s1" } });
  mockUpsertApp.mockReset();
  mockUpsertApp.mockResolvedValue(undefined);
  mockDevHub.mockReset();
  mockDevHub.mockResolvedValue(undefined);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("свой товар приложения не открывает планету", () => {
  test("ПОЧЕМУ ПОРЯДОК ВЕТВЕЙ НЕСУЩИЙ: ссылка приложения даёт тариф, открывающий всё", () => {
    // Не утверждение о замысле, а замер: именно из этих двух фактов следует,
    // что тарифная ветка для покупки приложения означала бы всю планету.
    //
    // ⚠️ Первая версия этого теста передавала в isModuleEntitled СТРОКУ тарифа
    // и получила false по всем ступеням, включая enterprise. Ошибся прибор, а
    // не система: ручка принимает ОБЪЕКТ плана, и у строки нет поля tier.
    // План собираем так же, как его собирает planGate.
    expect(tierForLemonSqueezyReference("app_cyberchess_max" as never)).toBe("lite");
    const планПриложенияКакТариф = {
      tier: normalizeTier("lite"),
      rawTier: "lite",
      email: "app@test.aev",
      reason: "test",
      chosenModules: [] as string[],
    };
    expect(планПриложенияКакТариф.tier, "ступень lite больше не нормализуется в full").toBe("full");
    expect(
      isModuleEntitled(планПриложенияКакТариф, "multichat-engine"),
      "тариф lite перестал открывать всё — обоснование сторожа устарело, перечитать",
    ).toBe(true);
  });

  test("КОНТРОЛЬ: варианты опознаются как ссылки приложений", () => {
    expect(referenceForVariantId("7702")).toBe("app_cyberchess_max");
    expect(referenceForVariantId("7705")).toBe("tier_max");
  });

  test("12 месяцев CyberChess за 144: право на приложение, платформенной подписки НЕТ", async () => {
    const r = await купилПриложение("7702", 14400);
    expect(r.status, "вебхук отказал: " + JSON.stringify(r.body)).toBe(200);
    expect(r.body.action, "покупка приложения пошла не той ветвью").toBe("app_activated");
    expect(r.body.appSlug).toBe("cyberchess");
    expect(mockUpsertApp).toHaveBeenCalledTimes(1);
    expect((mockUpsertApp.mock.calls[0] as unknown[])[1]).toBe("cyberchess");
    expect(
      mockProvision,
      "за 144 выдана ПЛАТФОРМЕННАЯ подписка — это вся планета за 2400",
    ).not.toHaveBeenCalled();
  });

  test("то же на коротком сроке (24, lite) — тоже только приложение", async () => {
    const r = await купилПриложение("7701", 2400);
    expect(r.body.action).toBe("app_activated");
    expect(r.body.appSlug).toBe("cyberchess");
    expect(mockProvision, "короткий срок приложения провижинит планету").not.toHaveBeenCalled();
  });

  test("ЗНАМЕНАТЕЛЬ: три разных приложения на трёх сроках — все мимо планеты", async () => {
    const набор: Array<[string, string, number]> = [
      ["7702", "cyberchess", 14400],
      ["7703", "devhub", 120000],
      ["7704", "qventure", 24000],
    ];
    const слаги: string[] = [];
    for (const [вариант, слаг, сумма] of набор) {
      const r = await купилПриложение(вариант, сумма);
      expect(r.body.action, слаг + ": не ветвь приложения").toBe("app_activated");
      слаги.push(String(r.body.appSlug));
    }
    expect(слаги, "проверено меньше трёх приложений — знаменатель упал").toEqual([
      "cyberchess",
      "devhub",
      "qventure",
    ]);
    expect(mockProvision, "хотя бы одно приложение провижинило планету").not.toHaveBeenCalled();
  });

  test("КОНТРОЛЬ: покупка САМОЙ планеты по-прежнему создаёт платформенную подписку", async () => {
    const r = await купилПриложение("7705", 240000);
    expect(r.status).toBe(200);
    expect(r.body.action, "планета пошла ветвью приложения").toBe("activated");
    expect(
      mockProvision,
      "починка отобрала бы оплаченное у тех, кто купил тариф — это хуже утечки",
    ).toHaveBeenCalledTimes(1);
    const arg = (mockProvision.mock.calls[0] as unknown[])[0] as { tierId?: string };
    expect(arg.tierId).toBe("max");
  });
});
