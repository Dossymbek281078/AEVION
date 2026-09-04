import { describe, test, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import crypto from "node:crypto";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { periodForReference } from "../src/lib/payment/billingPeriod";

/**
 * Сторож: годовая покупка записывается ГОДОВОЙ, а не месячной.
 *
 * ЗАМЕР 04.09.2026. Правило «период берётся из ссылки заказа» жило ТРЕМЯ
 * копиями — своя функция у paybox, такая же у paypal, встроенное выражение
 * у gumroad. Четвёртая касса, Lemon Squeezy, копии не получила и зашивала
 * `period: "monthly"`, хотя магазин продаёт годовые тарифы
 * (LEMON_SQUEEZY_VARIANT_{LITE,MEDIUM,FULL,PLANET}_ANNUAL), а витрина строит
 * ссылку `tier_${id}_annual` (routes/checkout.ts).
 *
 * ЦЕНА. Срок доступа считается по периоду. Годовая покупка, записанная
 * месячной, гасит доступ через месяц, а следующего события от кассы пришлось
 * бы ждать одиннадцать. Заплатил за год — пользуешься месяц, и ни одна наша
 * проверка об этом не сообщает: записи есть, ответы 200, тревог нет.
 *
 * ПОЧЕМУ ОТСТАВАНИЕ БЫЛО НЕВИДИМЫМ: пока правило живёт копиями, отставшая
 * копия ничем себя не выдаёт. Теперь источник один — lib/payment/billingPeriod,
 * и первый тест ниже охраняет ЕГО, а второй и третий — что касса им
 * пользуется, а не зашивает период снова.
 */
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => () => {} }));
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: async () => ({ rowCount: 1, rows: [] }) }),
}));

const SECRET = "test-ls-secret-annual";
process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = SECRET;
process.env.LEMON_SQUEEZY_VARIANT_LITE_MONTHLY = "9102";
process.env.LEMON_SQUEEZY_VARIANT_LITE_ANNUAL = "9103";

const каталог = mkdtempSync(join(tmpdir(), "aevion-annual-"));
const файл = join(каталог, "subs.jsonl");
process.env.SUBSCRIPTIONS_FILE = файл;

const { lemonSqueezyWebhookRouter } = await import("../src/routes/lemonSqueezyWebhook");

let n = 0;
async function покупка(variantId: number) {
  n += 1;
  const тело = {
    meta: { event_name: "subscription_created" },
    data: {
      id: `ls-annual-${n}`,
      attributes: {
        user_email: `buyer${n}@example.test`,
        variant_id: variantId,
        status: "active",
        renews_at: "2030-01-01T00:00:00.000Z",
      },
    },
  };
  const сырое = JSON.stringify(тело);
  const подпись = crypto.createHmac("sha256", SECRET).update(сырое, "utf8").digest("hex");
  const a = express();
  a.use(express.json());
  a.use((req, _r, next) => {
    (req as unknown as { rawBody: Buffer }).rawBody = Buffer.from(сырое);
    next();
  });
  a.use("/api/lemonsqueezy", lemonSqueezyWebhookRouter);
  return request(a)
    .post("/api/lemonsqueezy/webhook")
    .set("x-signature", подпись)
    .set("content-type", "application/json")
    .send(сырое);
}

/** Последняя записанная подписка. */
function последняя(): { period?: string; validUntil?: string; ts?: string } | null {
  if (!existsSync(файл)) return null;
  const строки = readFileSync(файл, "utf8").split("\n").filter((l) => l.trim());
  if (!строки.length) return null;
  return JSON.parse(строки[строки.length - 1]);
}

/** Сколько месяцев между выдачей и концом срока (округлённо). */
function месяцевДоконца(s: { validUntil?: string; ts?: string }): number {
  if (!s.validUntil || !s.ts) return -1;
  const дней = (new Date(s.validUntil).getTime() - new Date(s.ts).getTime()) / 86400000;
  return Math.round(дней / 30.44);
}

describe("годовая покупка записывается годовой", () => {
  test("ИСТОЧНИК ПРАВИЛА: ссылка со словом annual даёт годовой период", () => {
    // Двусторонне: без второй половины «всегда annual» тоже прошло бы.
    expect(periodForReference("tier_lite_annual")).toBe("annual");
    expect(periodForReference("TIER_FULL_ANNUAL")).toBe("annual");
    expect(periodForReference("tier_lite_monthly")).toBe("monthly");
    expect(periodForReference("")).toBe("monthly");
  });

  test("КОНТРОЛЬ: месячная покупка остаётся месячной", async () => {
    // Без контроля «период годовой» удовлетворялось бы кодом, который всем
    // ставит annual, — то есть мы раздавали бы год за цену месяца.
    const r = await покупка(9102);
    expect(r.status, `месячная покупка не обработана: ${JSON.stringify(r.body)}`).toBe(200);
    const s = последняя();
    expect(s, "месячная покупка ничего не записала").not.toBeNull();
    expect(s!.period).toBe("monthly");
    expect(месяцевДоконца(s!), "срок месячной подписки не похож на месяц").toBe(1);
  });

  test("годовая покупка: период annual и срок около года", async () => {
    const r = await покупка(9103);
    expect(r.status, `годовая покупка не обработана: ${JSON.stringify(r.body)}`).toBe(200);
    const s = последняя();
    expect(s, "годовая покупка ничего не записала").not.toBeNull();
    expect(
      s!.period,
      "годовая покупка записана месячной: доступ погаснет через месяц, а следующего события от кассы ждать одиннадцать"
    ).toBe("annual");
    expect(
      месяцевДоконца(s!),
      `срок доступа ${месяцевДоконца(s!)} мес. вместо двенадцати — человек заплатил за год`
    ).toBe(12);
  });
});

// Уборка каталога после файла — rmSync в afterAll снял бы файл до чтения
// последним тестом, если бы порядок изменился.
process.on("exit", () => rmSync(каталог, { recursive: true, force: true }));
