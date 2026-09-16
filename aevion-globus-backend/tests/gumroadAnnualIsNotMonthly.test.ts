import { describe, test, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Сторож: покупка срока у Gumroad записывается СВОИМ сроком, а не месяцем.
 *
 * ЧТО БЫЛО (замер 03.09.2026). В обработчике стояло
 * `const period = isMembership ? "monthly" : "monthly"` — тернарник, у
 * которого обе ветки одинаковы, то есть флаг не влиял ни на что. Все покупки
 * записывались месячными. Годовая покупка у Gumroad — РАЗОВЫЙ платёж:
 * продления не будет, и человек, заплативший за год, терял доступ через месяц.
 *
 * С 15.09.2026 тариф — это СРОК: tier_max оплачивается за 12 месяцев вперёд,
 * tier_medium за 3. Цена прежнего дефекта выросла: запись «1 месяц» по Max —
 * это одиннадцать оплаченных месяцев без доступа.
 *
 * Проверяется ЗАПИСЬ, а не ответ 200: в журнале подписок должен стоять срок в
 * месяцах и дата окончания примерно через этот срок. Прежняя годовая ссылка
 * (tier_full_annual) по-прежнему понимается — продления уже купленного.
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
process.env.GUMROAD_PRODUCT_MAXTEST = "tier_max";
process.env.GUMROAD_PRODUCT_MEDIUMTEST = "tier_medium";
process.env.GUMROAD_PRODUCT_LITETEST = "tier_lite";
process.env.GUMROAD_PRODUCT_LEGACYANNUAL = "tier_full_annual";

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

const днейДоКонца = (запись: Record<string, unknown> | null) =>
  (new Date(String(запись?.validUntil)).getTime() - Date.now()) / 86400000;

beforeEach(() => {
  n += 0;
});

describe("покупка срока у Gumroad не становится месячной", () => {
  test("Max записан сроком 12 месяцев и доступом ~год", async () => {
    const { res, запись } = await покупка("maxtest");
    expect(res.status, `покупка не прошла: ${JSON.stringify(res.body)}`).toBe(200);
    expect(запись?.tierId).toBe("max");
    expect(запись?.termMonths, "покупка на год записана НЕ годовой").toBe(12);
    const дней = днейДоКонца(запись);
    expect(дней, `срок ${Math.round(дней)} дней — человек заплатил за год, а доступ короче`).toBeGreaterThan(360);
  });

  test("Medium записан сроком 3 месяца", async () => {
    const { res, запись } = await покупка("mediumtest");
    expect(res.status, `покупка не прошла: ${JSON.stringify(res.body)}`).toBe(200);
    expect(запись?.tierId).toBe("medium");
    expect(запись?.termMonths).toBe(3);
    const дней = днейДоКонца(запись);
    expect(дней).toBeGreaterThan(85);
    expect(дней).toBeLessThan(95);
  });

  test("КОНТРОЛЬ: Lite остаётся на месяц", async () => {
    // Иначе «длинный срок» удовлетворялось бы кодом, который всем ставит
    // двенадцать месяцев, — и мы дарили бы год за месячную цену.
    const { запись } = await покупка("litetest");
    expect(запись?.termMonths, "месячная покупка записана длиннее месяца").toBe(1);
    const дней = днейДоКонца(запись);
    expect(дней, `срок ${Math.round(дней)} дней — это не месяц`).toBeLessThan(40);
  });

  test("прежний годовой товар (продление) — 12 месяцев, тариф новой лестницы", async () => {
    const { res, запись } = await покупка("legacyannual");
    expect(res.status, `покупка не прошла: ${JSON.stringify(res.body)}`).toBe(200);
    expect(запись?.tierId).toBe("full");
    expect(запись?.termMonths, "прежняя годовая записана короче года").toBe(12);
    expect(днейДоКонца(запись)).toBeGreaterThan(360);
  });
});

process.on("exit", () => rmSync(каталог, { recursive: true, force: true }));
