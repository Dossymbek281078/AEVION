import { describe, test, expect, vi, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Сторож: покупка приложения через Gumroad не создаёт платформенную подписку.
 *
 * ВТОРАЯ ПОЛОВИНА КЛАССА. Сосед `ownAppVariantNeverProvisionsThePlanet`
 * (мой же, 12.10) поднимает роутер Lemon Squeezy и ходит на
 * `/api/lemonsqueezy/webhook`. Путь Gumroad он не трогает вовсе — это нашла
 * приёмка мутацией, и это справедливо: класс один, а поставщиков два.
 *
 * ПОЧЕМУ У GUMROAD ЭТО ОПАСНЕЕ, ЧЕМ У LS. Тариф здесь решает СЛОВЕСНАЯ
 * развилка `tierForReference`: `medium` → medium, а `full | all-access |
 * business | team` → full, то есть вся планета. И ссылка приложения
 * `app_cyberchess_full` СОДЕРЖИТ слово `full` сама по себе. Значит покупку
 * CyberChess за свою цену от планеты за $2400 отделяет только то, что ветвь
 * модуля (`moduleSlugForReference` → `app_` → слаг) стоит ВЫШЕ тарифной и
 * возвращает ответ раньше. Никакой мутации для утечки не нужно — достаточно
 * переставить две ветви или убрать разбор `app_`.
 *
 * ⚠️ ПОПРАВКА К ДОВОДУ ПРИЁМКИ, проверенная прогоном (см. мутации в сдаче):
 * мутация «добавить `if (r.includes("max")) return "full"` в tierForReference»
 * остаётся зелёной И ПОСЛЕ этого сторожа — не потому, что сторож пустой, а
 * потому, что ссылки приложений до `tierForReference` не доходят: ветвь модуля
 * отвечает раньше. Несущая строка у Gumroad другая — разбор `app_` в
 * `moduleSlugForReference`, и мутация именно её краснит три теста ниже.
 *
 * ГРАНИЦА: провайдер и выдача права подменены — проверяется, КОГО зовут и что
 * отвечает ручка, а не запись в базу (её держат appPurchaseIsConfirmable и
 * moduleBoughtAnywhereIsDurable). Подпись пинга здесь не проверяется: это
 * предмет соседнего теста.
 */

let сырое: Record<string, string> = {};

const { mockProvision, mockUpsertApp, mockQuery } = vi.hoisted(() => ({
  mockProvision: vi.fn(),
  mockUpsertApp: vi.fn(),
  mockQuery: vi.fn(),
}));

vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => () => {} }));
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: mockQuery }) }));
vi.mock("../src/routes/provisioning", async (orig) => {
  const настоящий = (await orig()) as Record<string, unknown>;
  return { ...настоящий, provisionSubscription: mockProvision, writeSubscription: vi.fn() };
});
vi.mock("../src/lib/appEntitlements", async (orig) => {
  const настоящий = (await orig()) as Record<string, unknown>;
  return { ...настоящий, upsertAppSubscription: mockUpsertApp };
});
vi.mock("../src/lib/payment/gumroadProvider", () => ({
  verifyGumroadSaleDetailed: async () => ({ verdict: "confirmed", sale: null }),
  gumroadPaymentProvider: {
    parseWebhook: () => ({
      result: { status: "paid", reason: null, raw: сырое },
      eventId: сырое.sale_id,
    }),
  },
}));

const каталог = mkdtempSync(join(tmpdir(), "aevion-gum-app-"));
process.env.SUBSCRIPTIONS_FILE = join(каталог, "subs.jsonl");
// Товары Gumroad: ссылка приложения на трёх сроках, три приложения, плюс планета.
process.env.GUMROAD_PRODUCT_APPFULL = "app_cyberchess_full";
process.env.GUMROAD_PRODUCT_APPMAX = "app_cyberchess_max";
process.env.GUMROAD_PRODUCT_APPMEDIUM = "app_qventure_medium";
process.env.GUMROAD_PRODUCT_APPDEVHUB = "app_devhub_max";
process.env.GUMROAD_PRODUCT_PLANETMAX = "tier_max";

const { gumroadWebhookRouter } = await import("../src/routes/gumroadWebhook");

let номер = 0;
async function покупка(товар: string) {
  номер += 1;
  сырое = {
    email: "gum" + номер + "@test.aev",
    sale_id: "gum-app-" + номер,
    product_id: товар,
  };
  const { __resetWebhookDedupCache } = await import("../src/lib/webhookDedup");
  __resetWebhookDedupCache();
  const a = express();
  a.use(express.json());
  a.use((req, _r, next) => {
    (req as unknown as { rawBody: Buffer }).rawBody = Buffer.from("{}");
    next();
  });
  a.use("/api/gumroad", gumroadWebhookRouter);
  return request(a).post("/api/gumroad/webhook").send();
}

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockResolvedValue({ rows: [] });
  mockProvision.mockReset();
  mockProvision.mockResolvedValue({ subscription: { id: "s1" } });
  mockUpsertApp.mockReset();
  mockUpsertApp.mockResolvedValue(undefined);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterAll(() => {
  for (const k of [
    "SUBSCRIPTIONS_FILE",
    "GUMROAD_PRODUCT_APPFULL", "GUMROAD_PRODUCT_APPMAX", "GUMROAD_PRODUCT_APPMEDIUM",
    "GUMROAD_PRODUCT_APPDEVHUB", "GUMROAD_PRODUCT_PLANETMAX",
  ]) delete process.env[k];
  try { rmSync(каталог, { recursive: true, force: true }); } catch { /* уже нет */ }
});

describe("Gumroad: своё приложение не открывает планету", () => {
  test("КОНТРОЛЬ: неизвестный товар не выдаёт ничего (значит путь настоящий)", async () => {
    const r = await покупка("NETAKOGOTOVARA");
    expect(r.status, "неизвестный товар прошёл как покупка").toBe(500);
    expect(r.body.error).toBe("unmapped_product");
    expect(mockProvision, "за неизвестный товар выдали тариф").not.toHaveBeenCalled();
    expect(mockUpsertApp, "за неизвестный товар выдали приложение").not.toHaveBeenCalled();
  });

  test("app_cyberchess_full — ссылка СО СЛОВОМ full — даёт приложение, а не планету", async () => {
    // Самый острый случай класса: слово в ссылке совпадает с тем, по которому
    // словесная развилка выдаёт полный тариф. Спасает только порядок ветвей.
    const r = await покупка("APPFULL");
    expect(r.status, "вебхук отказал: " + JSON.stringify(r.body)).toBe(200);
    expect(r.body.action, "покупка приложения пошла тарифной ветвью").toBe("app_activated");
    expect(mockUpsertApp).toHaveBeenCalledTimes(1);
    expect((mockUpsertApp.mock.calls[0] as unknown[])[1]).toBe("cyberchess");
    expect(
      mockProvision,
      "за приложение выдана ПЛАТФОРМЕННАЯ подписка — это вся планета по цене модуля",
    ).not.toHaveBeenCalled();
  });

  test("ЗНАМЕНАТЕЛЬ: три приложения на трёх сроках — все мимо планеты", async () => {
    const набор: Array<[string, string]> = [
      ["APPFULL", "cyberchess"],
      ["APPMAX", "cyberchess"],
      ["APPMEDIUM", "qventure"],
      ["APPDEVHUB", "devhub"],
    ];
    const слаги: string[] = [];
    for (const [товар, слаг] of набор) {
      const r = await покупка(товар);
      expect(r.body.action, слаг + ": не ветвь приложения").toBe("app_activated");
      слаги.push(String((mockUpsertApp.mock.calls.at(-1) as unknown[])[1]));
    }
    expect(слаги, "проверено меньше четырёх покупок — знаменатель упал").toEqual([
      "cyberchess", "cyberchess", "qventure", "devhub",
    ]);
    expect(mockProvision, "хотя бы одна покупка приложения провижинила планету").not.toHaveBeenCalled();
  });

  test("КОНТРОЛЬ: покупка САМОЙ планеты по-прежнему создаёт платформенную подписку", async () => {
    const r = await покупка("PLANETMAX");
    expect(r.status).toBe(200);
    expect(r.body.action, "планета пошла ветвью приложения").not.toBe("app_activated");
    expect(
      mockProvision,
      "починка отобрала бы оплаченное у купивших тариф — это хуже утечки",
    ).toHaveBeenCalledTimes(1);
    const arg = (mockProvision.mock.calls[0] as unknown[])[0] as { tierId?: string };
    expect(arg.tierId).toBe("max");
  });
});
