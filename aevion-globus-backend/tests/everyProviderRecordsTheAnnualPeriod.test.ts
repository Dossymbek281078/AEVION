import { describe, test, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import crypto from "node:crypto";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { termMonthsForReference } from "../src/lib/payment/billingPeriod";
import { readFileSync as читатьФайл, readdirSync as читатьКаталог } from "node:fs";
import { join as соединить, resolve as разрешить } from "node:path";

/**
 * Сторож: покупка СРОКА записывается своим сроком, а не месячной.
 *
 * ЗАМЕР 04.09.2026. Правило «период берётся из ссылки заказа» жило ТРЕМЯ
 * копиями — своя функция у paybox, такая же у paypal, встроенное выражение
 * у gumroad. Четвёртая касса, Lemon Squeezy, копии не получила и зашивала
 * `period: "monthly"`, хотя магазин продавал годовые тарифы. Годовая покупка,
 * записанная месячной, гасила доступ через месяц.
 *
 * С 15.09.2026 тариф — это СРОК (lite 1 мес, medium 3, pro 6, full 9, max 12),
 * и цена того же дефекта выросла: Max оплачивается за 12 месяцев вперёд, Medium
 * за 3. Запись «1 месяц» по любой из них — это заплатил за год/квартал,
 * пользуешься месяц, и ни одна проверка об этом не сообщает: записи есть,
 * ответы 200, тревог нет.
 *
 * Прежние ссылки (tier_lite_annual) продолжают пониматься: по ним уже купили,
 * продление придёт с ними же — годовая остаётся на 12 месяцев.
 *
 * Источник правила один — lib/payment/billingPeriod (termMonthsForReference);
 * первый тест охраняет ЕГО, следующие — что касса им пользуется, а не зашивает
 * срок снова. Имя файла прежнее, чтобы история сторожа не терялась.
 */
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => () => {} }));
vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: async () => ({ rowCount: 1, rows: [] }) }),
}));

const SECRET = "test-ls-secret-annual";
process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = SECRET;
process.env.LEMON_SQUEEZY_VARIANT_LITE = "9101";
process.env.LEMON_SQUEEZY_VARIANT_MEDIUM = "9102";
process.env.LEMON_SQUEEZY_VARIANT_MAX = "9104";
// Прежний годовой вариант — не продаётся, но продление по нему приходит.
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
function последняя(): { tierId?: string; termMonths?: number | null; validUntil?: string; ts?: string } | null {
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

describe("покупка срока записывается своим сроком", () => {
  test("ИСТОЧНИК ПРАВИЛА: срок берётся из ссылки заказа", () => {
    // Многосторонне: «всегда 12» или «всегда 1» не пройдут ни одну из половин.
    expect(termMonthsForReference("tier_max")).toBe(12);
    expect(termMonthsForReference("tier_full")).toBe(9);
    expect(termMonthsForReference("tier_pro")).toBe(6);
    expect(termMonthsForReference("tier_medium")).toBe(3);
    expect(termMonthsForReference("tier_lite")).toBe(1);
    expect(termMonthsForReference("app_cyberchess_pro")).toBe(6);
    expect(termMonthsForReference("app_ip_bureau_max")).toBe(12);
    // Прежние ссылки: годовая остаётся годовой, месячная месячной.
    expect(termMonthsForReference("tier_lite_annual")).toBe(12);
    expect(termMonthsForReference("TIER_FULL_ANNUAL")).toBe(12);
    expect(termMonthsForReference("tier_lite_monthly")).toBe(1);
    expect(termMonthsForReference("")).toBe(1);
  });

  test("КОНТРОЛЬ: месячная покупка (Lite) остаётся на месяц", async () => {
    // Без контроля «срок длинный» удовлетворялось бы кодом, который всем ставит
    // 12 месяцев, — то есть мы раздавали бы год за цену месяца.
    const r = await покупка(9101);
    expect(r.status, `покупка Lite не обработана: ${JSON.stringify(r.body)}`).toBe(200);
    const s = последняя();
    expect(s, "покупка Lite ничего не записала").not.toBeNull();
    expect(s!.tierId).toBe("lite");
    expect(s!.termMonths).toBe(1);
    expect(месяцевДоконца(s!), "срок Lite не похож на месяц").toBe(1);
  });

  test("Medium: записан срок 3 месяца и доступ на квартал", async () => {
    const r = await покупка(9102);
    expect(r.status, `покупка Medium не обработана: ${JSON.stringify(r.body)}`).toBe(200);
    const s = последняя();
    expect(s, "покупка Medium ничего не записала").not.toBeNull();
    expect(s!.tierId).toBe("medium");
    expect(s!.termMonths, "Medium оплачен за 3 месяца вперёд").toBe(3);
    expect(месяцевДоконца(s!)).toBe(3);
  });

  test("Max: записан срок 12 месяцев и доступ на год", async () => {
    const r = await покупка(9104);
    expect(r.status, `покупка Max не обработана: ${JSON.stringify(r.body)}`).toBe(200);
    const s = последняя();
    expect(s, "покупка Max ничего не записала").not.toBeNull();
    expect(s!.tierId).toBe("max");
    expect(
      s!.termMonths,
      "покупка на год записана короче: доступ погаснет раньше, а следующего события от кассы ждать год"
    ).toBe(12);
    expect(
      месяцевДоконца(s!),
      `срок доступа ${месяцевДоконца(s!)} мес. вместо двенадцати — человек заплатил за год`
    ).toBe(12);
  });

  test("прежняя годовая подписка (продление) остаётся годовой", async () => {
    const r = await покупка(9103);
    expect(r.status, `продление прежней годовой не обработано: ${JSON.stringify(r.body)}`).toBe(200);
    const s = последняя();
    expect(s, "продление ничего не записало").not.toBeNull();
    expect(s!.termMonths, "прежняя годовая записана короче года").toBe(12);
    expect(месяцевДоконца(s!)).toBe(12);
  });
});

// Уборка каталога после файла — rmSync в afterAll снял бы файл до чтения
// последним тестом, если бы порядок изменился.
process.on("exit", () => rmSync(каталог, { recursive: true, force: true }));


/**
 * Храповик: правило «период берётся из ссылки» живёт в ОДНОМ месте.
 *
 * Дефект 04.09.2026 пережил вчерашнюю починку не потому, что кто-то ошибся в
 * логике, а потому что правило было СКОПИРОВАНО трижды и четвёртая касса
 * копии не получила. Значит охранять надо единственность правила, а не
 * поведение каждой кассы по отдельности.
 */
describe("правило периода не копируется", () => {
  const КОРЕНЬ = разрешить(__dirname, "../src");

  function всеИсходники(каталог: string): string[] {
    const найдено: string[] = [];
    for (const имя of читатьКаталог(каталог, { withFileTypes: true })) {
      const путь = соединить(каталог, имя.name);
      if (имя.isDirectory()) найдено.push(...всеИсходники(путь));
      else if (имя.name.endsWith(".ts")) найдено.push(путь);
    }
    return найдено;
  }

  test("КОНТРОЛЬ: обход исходников действительно что-то читает", () => {
    // Иначе «копий нет» удовлетворялось бы пустым списком файлов.
    expect(
      всеИсходники(КОРЕНЬ).length,
      "обход не нашёл исходников — проверять было нечего"
    ).toBeGreaterThan(50);
  });

  test("признак периода объявлен ровно в одном файле", () => {
    const свои = всеИсходники(КОРЕНЬ).filter((p) => {
      const текст = читатьФайл(p, "utf8");
      return текст.includes('includes("annual")') || текст.includes("includes('annual')");
    });
    const короткие = свои.map((p) => p.slice(КОРЕНЬ.length + 1).split("\\").join("/"));
    expect(
      короткие,
      `правило «период из ссылки» снова размножено: ${короткие.join(", ")} — ` +
        "именно из-за трёх копий четвёртая касса отстала молча"
    ).toEqual(["lib/payment/billingPeriod.ts"]);
  });
});
