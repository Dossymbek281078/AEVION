import { describe, test, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Сторож: выдача по НЕПРОВЕРЕННОЙ продаже оставляет след в Sentry.
 *
 * ЧТО ЗДЕСЬ ВАЖНО ПОНЯТЬ. У Gumroad на проде подписи НЕТ: пустое тело
 * получает 200, тогда как остальные три кассы отвечают 401 (замер 02.09.2026).
 * Значит сверка продажи через API Gumroad — ЕДИНСТВЕННЫЙ замок.
 *
 * Когда сверка не удалась по НАШЕЙ причине (нет токена, API недоступен),
 * подписка выдаётся всё равно — и это осознанный размен в пользу настоящего
 * покупателя. Сторож его НЕ отменяет.
 *
 * Он охраняет другое: чтобы отказ замка был ВИДЕН. Раньше здесь стоял только
 * console.warn. Истеки токен — непроверяемым стал бы каждый вебхук, мы начали
 * бы выдавать подписки кому угодно, и узнать об этом было бы неоткуда.
 */
const { следы } = vi.hoisted(() => ({ следы: [] as string[] }));

vi.mock("../src/lib/sentry/platform", () => ({
  makeServiceCapture: () => (e: unknown) => {
    следы.push(e instanceof Error ? e.message : String(e));
  },
}));

const { режим } = vi.hoisted(() => ({ режим: { verdict: "unverifiable" as string, id: "unver-0" } }));

vi.mock("../src/lib/payment/gumroadProvider", () => ({
  verifyGumroadSaleDetailed: async () => ({ verdict: режим.verdict, sale: null }),
  gumroadPaymentProvider: {
    parseWebhook: () => ({
      result: {
        status: "paid",
        reason: null,
        raw: { email: "b@example.test", sale_id: режим.id, product_id: "unvertest" },
      },
      eventId: режим.id,
    }),
  },
}));

process.env.GUMROAD_PRODUCT_UNVERTEST = "tier_medium_monthly";

const { gumroadWebhookRouter } = await import("../src/routes/gumroadWebhook");

let n = 0;
async function доставка() {
  n += 1;
  режим.id = `unver-${n}`;
  const a = express();
  a.use(express.json());
  a.use((req, _r, next) => {
    (req as unknown as { rawBody: Buffer }).rawBody = Buffer.from("{}");
    next();
  });
  a.use("/api/gumroad", gumroadWebhookRouter);
  // Идентификатор уникален на вызов: иначе дедупликация отсечёт повтор
  // ДО интересующей нас ветки, и тест будет зелёным ни о чём.
  const { __resetWebhookDedupCache } = await import("../src/lib/webhookDedup");
  __resetWebhookDedupCache();
  return request(a).post("/api/gumroad/webhook").send();
}

beforeEach(() => {
  следы.length = 0;
  режим.verdict = "unverifiable";
});

describe("непроверенная продажа оставляет след", () => {
  test("КОНТРОЛЬ: подтверждённая продажа следа НЕ оставляет", async () => {
    // Без этого «след есть» удовлетворялся бы кодом, который шлёт тревогу
    // на КАЖДУЮ покупку — то есть машиной ложных тревог.
    режим.verdict = "confirmed";
    await доставка();
    expect(
      следы.filter((s) => s.includes("unverifiable")),
      "тревога ушла на обычной подтверждённой продаже"
    ).toEqual([]);
  });

  test("непроверяемая продажа даёт тревогу в Sentry", async () => {
    const ответ = await доставка();
    expect(
      следы,
      `выдали подписку по непроверенной продаже и не оставили следа. Ответ: ${ответ.status} ${JSON.stringify(ответ.body)}`
    ).toContain("gumroad_sale_unverifiable_provisioned");
  });
});
