/*
 * 21.10.2026: режим оплаты плана (monthly | prepaid) и начало обязательства
 * пишутся В ЗАПИСЬ ПОДПИСКИ. Сторож идёт настоящим путём: подписанное тело →
 * ручка вебхука → provisionSubscription → строка файла подписок, и читает
 * значение из строки, а не из вызова заглушки. Только запись данных: штрафа и
 * новых обещаний покупателю по этим полям нет.
 */
import { describe, test, expect, beforeAll, beforeEach, vi } from "vitest";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import request from "supertest";
import express from "express";

const SECRET = "test-ls-secret-billing";
process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = SECRET;
process.env.LEMON_SQUEEZY_VARIANT_LITE = "8101";
process.env.LEMON_SQUEEZY_VARIANT_MAX = "8112";
delete process.env.RESEND_API_KEY;
const FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ls-billing-")), "subscriptions.jsonl");
process.env.SUBSCRIPTIONS_FILE = FILE;

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: mockQuery }) }));
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => vi.fn() }));

// eslint-disable-next-line import/first
import { lemonSqueezyWebhookRouter } from "../src/routes/lemonSqueezyWebhook";

let n = 0;
function post(custom: Record<string, string> | undefined, variantId: string, totalCents: number, opts: { event?: string; id?: string; createdAt?: string } = {}) {
  n += 1;
  const payload = {
    meta: { event_name: opts.event ?? "subscription_created", ...(custom ? { custom_data: custom } : {}) },
    data: {
      id: opts.id ?? `sub_billing_${n}`,
      attributes: { user_email: `buyer${n}@test.aev`, variant_id: variantId, total: totalCents, ...(opts.createdAt ? { created_at: opts.createdAt } : {}) },
    },
  };
  const raw = JSON.stringify(payload);
  const sig = crypto.createHmac("sha256", SECRET).update(raw, "utf8").digest("hex");
  const app = express(); app.use(express.json()); app.use("/api/lemonsqueezy", lemonSqueezyWebhookRouter);
  return request(app).post("/api/lemonsqueezy/webhook").set("Content-Type", "application/json").set("X-Signature", sig).send(raw);
}
function rows(): Array<Record<string, unknown>> {
  if (!fs.existsSync(FILE)) return [];
  return fs.readFileSync(FILE, "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
}
const lastFor = (providerPaymentId: string) => rows().filter((r) => r.providerPaymentId === providerPaymentId).at(-1);

beforeAll(() => { if (fs.existsSync(FILE)) fs.unlinkSync(FILE); });
beforeEach(() => { mockQuery.mockReset(); mockQuery.mockResolvedValue({ rows: [] }); });

describe("вебхук LS пишет режим оплаты в строку подписки", () => {
  test("три случая: monthly, prepaid, без custom_data — значение из строки, знаменатель 3", async () => {
    const случаи = [
      { имя: "monthly", custom: { term: "medium", billing: "monthly" }, variant: "8101", cents: 22500, ждём: "monthly", created: "2026-10-01T10:00:00.000Z" },
      { имя: "prepaid", custom: { term: "max", billing: "prepaid" }, variant: "8112", cents: 157500, ждём: "prepaid", created: "2026-10-02T11:00:00.000Z" },
      { имя: "пусто", custom: undefined, variant: "8101", cents: 25000, ждём: null, created: "2026-10-03T12:00:00.000Z" },
    ] as const;
    let совпало = 0;
    for (const с of случаи) {
      const id = `sub_case_${с.имя}`;
      const r = await post(с.custom as Record<string, string> | undefined, с.variant, с.cents, { id, createdAt: с.created });
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      const строка = lastFor(id);
      console.log(`[сторож billing] ${с.имя}: billing=${JSON.stringify(строка?.billing)} commitStartedAt=${JSON.stringify(строка?.commitStartedAt)}`);
      expect(строка, `строки для ${id} нет`).toBeDefined();
      expect(строка).toHaveProperty("billing", с.ждём);
      expect(строка).toHaveProperty("commitStartedAt", с.ждём ? с.created : null);
      совпало += 1;
    }
    console.log(`[сторож billing] совпало ${совпало} из ${случаи.length}`);
    expect(совпало).toBe(3);
  });

  test("продление (subscription_updated) не сдвигает начало обязательства: берётся created_at кассы", async () => {
    const id = "sub_renewal";
    const created = "2026-09-01T08:00:00.000Z";
    expect((await post({ term: "max", billing: "monthly" }, "8101", 15000, { id, createdAt: created })).status).toBe(200);
    expect((await post({ term: "max", billing: "monthly" }, "8101", 15000, { id, createdAt: created, event: "subscription_updated" })).status).toBe(200);
    const свои = rows().filter((r) => r.providerPaymentId === id);
    expect(свои.length).toBe(2);
    expect(свои.map((r) => r.commitStartedAt)).toEqual([created, created]);
  });

  test("created_at мусор → начало = время записи, ответ 2xx", async () => {
    const id = "sub_bad_created";
    const до = Date.now();
    const r = await post({ term: "medium", billing: "monthly" }, "8101", 22500, { id, createdAt: "не дата" });
    expect(r.status).toBe(200);
    const t = Date.parse(String(lastFor(id)?.commitStartedAt));
    expect(t).toBeGreaterThanOrEqual(до - 1000);
    expect(t).toBeLessThanOrEqual(Date.now() + 1000);
  });

  test("custom_data без полей плана (только канал) → billing null, 2xx", async () => {
    const id = "sub_channel_only";
    const r = await post({ channel: "ig" }, "8101", 25000, { id });
    expect(r.status).toBe(200);
    expect(lastFor(id)).toMatchObject({ billing: null, commitStartedAt: null, channel: "ig" });
  });
});
