import { describe, test, expect, beforeEach, vi } from "vitest";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import request from "supertest";
import express from "express";

/**
 * 01.11.2026: план оплачен с почтой кассы B, вошёл аккаунтом A. План выдаётся обеим,
 * но приветственное письмо — одно и на почту аккаунта (как у модулей в
 * lsModulePurchaseSendsOneMail). До правки provisionSubscription в цикле слал два.
 * Отправщик здесь настоящий (режим заглушки), письма считаем по его строке [email/STUB].
 */
const SECRET = "test-ls-secret-plan-welcome";
process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = SECRET;
process.env.LEMON_SQUEEZY_VARIANT_MAX = "8312";
delete process.env.RESEND_API_KEY;
const файл = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ls-planmail-")), "subscriptions.jsonl");
process.env.SUBSCRIPTIONS_FILE = файл;

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: mockQuery }) }));
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => vi.fn() }));

// eslint-disable-next-line import/first
import { lemonSqueezyWebhookRouter } from "../src/routes/lemonSqueezyWebhook";
// eslint-disable-next-line import/first
import { __resetWebhookDedupCache } from "../src/lib/webhookDedup";

function post(id: string, custom: Record<string, string>, userEmail: string) {
  const a = express(); a.use(express.json());
  a.use("/api/lemonsqueezy", lemonSqueezyWebhookRouter);
  const raw = JSON.stringify({
    meta: { event_name: "subscription_created", custom_data: custom },
    data: { id, attributes: { user_email: userEmail, variant_id: "8312", total: 157500 } },
  });
  const sig = crypto.createHmac("sha256", SECRET).update(raw, "utf8").digest("hex");
  return request(a).post("/api/lemonsqueezy/webhook").set("Content-Type", "application/json").set("X-Signature", sig).send(raw);
}

let журнал: string[] = [];
beforeEach(() => {
  __resetWebhookDedupCache();
  mockQuery.mockReset(); mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
  журнал = [];
  vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => { журнал.push(a.map(String).join(" ")); });
});
const приветствия = () => журнал.filter((s) => s.startsWith("[email/STUB]") && s.includes("Подписка активна"));
const записиДля = (адрес: string) =>
  fs.readFileSync(файл, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((r) => r.email === адрес);

describe("план на две почты — одно приветственное письмо", () => {
  test("аккаунт A, касса B: план обеим, письмо одно и на A; повтор доставки — без письма", async () => {
    const r1 = await post("ls_plan_two_1", { accountEmail: "a@buyer-a.aev" }, "b@buyer-b.aev");
    expect(r1.status, JSON.stringify(r1.body)).toBe(200);
    expect(r1.body).toMatchObject({ action: "activated" });
    expect(записиДля("a@buyer-a.aev").length).toBe(1);
    expect(записиДля("b@buyer-b.aev").length).toBe(1);
    expect(приветствия()).toHaveLength(1);
    expect(приветствия()[0]).toContain("To: a@buyer-a.aev");
    const r2 = await post("ls_plan_two_1", { accountEmail: "a@buyer-a.aev" }, "b@buyer-b.aev");
    expect(r2.body).toMatchObject({ ok: true, deduped: true });
    expect(приветствия()).toHaveLength(1);
  });

  test("одна почта (аккаунт = касса): письмо по-прежнему уходит", async () => {
    const r = await post("ls_plan_two_2", {}, "solo@buyer-c.aev");
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(приветствия()).toHaveLength(1);
    expect(приветствия()[0]).toContain("To: solo@buyer-c.aev");
  });
});
