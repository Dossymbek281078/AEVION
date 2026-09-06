import { describe, test, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Сторож: годовая покупка у Gumroad записывается как ГОДОВАЯ.
 *
 * ЧТО БЫЛО (замер 03.09.2026). В обработчике стояло
 * `const period = isMembership ? "monthly" : "monthly"` — тернарник, у
 * которого обе ветки одинаковы, то есть флаг не влиял ни на что. Все покупки
 * записывались месячными.
 *
 * Цена ошибки: Gumroad продаёт годовые тарифы (tier_lite_annual,
 * tier_medium_annual, tier_full_annual — у каждого своя переменная товара).
 * Срок доступа считается по периоду, а годовая покупка у Gumroad — РАЗОВЫЙ
 * платёж: продления не будет. Человек платил за год и терял доступ через
 * месяц, а следующего события пришлось бы ждать одиннадцать месяцев.
 *
 * Проверяется ЗАПИСЬ, а не ответ 200: в журнале подписок должен стоять
 * период annual и срок примерно через год.
 */
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => () => {} }));
vi.mock("../src/lib/payment/gumroadProvider", () => ({
  verifyGumroadSaleDetailed: async () => ({ verdict: "confirmed", sale: null }),
  gumroadPaymentProvider: {
    parseWebhook: () => ({
      result: { status: "paid", reason: null, raw: сырое },
      eventId: сырое.sale_id,
    }),
  },
}));

const каталог = mkdtempSync(join(tmpdir(), "aevion-annual-"));
const файл = join(каталог, "subs.jsonl");
process.env.SUBSCRIPTIONS_FILE = файл;
process.env.GUMROAD_PRODUCT_ANNUALTEST = "tier_full_annual";
process.env.GUMROAD_PRODUCT_MONTHLYTEST = "tier_full_monthly";

let сырое: Record<string, string> = {};
const { gumroadWebhookRouter } = await import("../src/routes/gumroadWebhook");

let n = 0;
async function покупка(product: string) {
  n += 1;
  сырое = { email: `b${n}@example.test`, sale_id: `annual-${n}`, product_id: product };
  const { __resetWebhookDedupCache } = await import("../src/lib/webhookDedup");
  __resetWebhookDedupCache();
  const a = express();
  a.use(express.json());
  a.use((req, _r, next) => {
    (req as unknown as { rawBody: Buffer }).rawBody = Buffer.from("{}");
    next();
  });
  a.use("/api/gumroad", gumroadWebhookRouter);
  const res = await request(a).post("/api/gumroad/webhook").send();
  const строки = existsSync(файл)
    ? readFileSync(файл, "utf8").split("\n").filter((l) => l.trim())
    : [];
  const последняя = строки.length ? (JSON.parse(строки[строки.length - 1]) as Record<string, unknown>) : null;
  return { res, запись: последняя };
}

beforeEach(() => {
  n += 0;
});

describe("годовая покупка Gumroad не становится месячной", () => {
  test("годовой товар записан как annual и срок ~год", async () => {
    const { res, запись } = await покупка("annualtest");
    expect(res.status, `покупка не прошла: ${JSON.stringify(res.body)}`).toBe(200);
    expect(запись?.period, "годовая покупка записана НЕ как годовая").toBe("annual");

    const до = new Date(String(запись?.validUntil)).getTime();
    const дней = (до - Date.now()) / 86400000;
    expect(
      дней,
      `срок ${Math.round(дней)} дней — человек заплатил за год, а доступ короче`
    ).toBeGreaterThan(300);
  });

  test("КОНТРОЛЬ: месячный товар остаётся месячным", async () => {
    // Иначе «annual» удовлетворялось бы кодом, который всем ставит годовой
    // период, — и мы дарили бы год за месячную цену.
    const { запись } = await покупка("monthlytest");
    expect(запись?.period, "месячная покупка записана как годовая").toBe("monthly");
    const дней = (new Date(String(запись?.validUntil)).getTime() - Date.now()) / 86400000;
    expect(дней, `срок ${Math.round(дней)} дней — это не месяц`).toBeLessThan(40);
  });
});

process.on("exit", () => rmSync(каталог, { recursive: true, force: true }));
