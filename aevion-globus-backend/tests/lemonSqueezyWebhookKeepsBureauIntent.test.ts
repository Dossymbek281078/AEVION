/*
 * 21.10.2026: наш идентификатор намерения (custom_data.bureauIntentId) уходил в
 * кассу и терялся на записи: вебхук передавал его в provisionSubscription, а
 * та не знала такого поля — в строке подписки его не было, и /checkout/status
 * для тарифной покупки LS отвечал «ещё нет» навсегда (найти можно было только
 * по номеру подписки кассы, которого страница успеха не знает).
 * Сторож идёт настоящим путём: подписанное тело → вебхук → строка файла →
 * /checkout/status по одному bureauIntentId.
 */
import { describe, test, expect, beforeEach, vi } from "vitest";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import request from "supertest";
import express from "express";

const SECRET = "test-ls-secret-intent";
process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = SECRET;
process.env.LEMON_SQUEEZY_VARIANT_LITE = "8101";
delete process.env.RESEND_API_KEY;
const FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ls-intent-")), "subscriptions.jsonl");
process.env.SUBSCRIPTIONS_FILE = FILE;

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: mockQuery }) }));
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => vi.fn() }));

// eslint-disable-next-line import/first
import { lemonSqueezyWebhookRouter } from "../src/routes/lemonSqueezyWebhook";
// eslint-disable-next-line import/first
import { checkoutRouter } from "../src/routes/checkout";

function app() {
  const a = express(); a.use(express.json());
  a.use("/api/lemonsqueezy", lemonSqueezyWebhookRouter);
  a.use("/api/pricing/checkout", checkoutRouter);
  return a;
}
function webhook(custom: Record<string, string>, lsId: string) {
  const payload = {
    meta: { event_name: "subscription_created", custom_data: custom },
    data: { id: lsId, attributes: { user_email: "intent-buyer@test.aev", variant_id: "8101", total: 25000 } },
  };
  const raw = JSON.stringify(payload);
  const sig = crypto.createHmac("sha256", SECRET).update(raw, "utf8").digest("hex");
  return request(app()).post("/api/lemonsqueezy/webhook").set("Content-Type", "application/json").set("X-Signature", sig).send(raw);
}
const rows = () => (fs.existsSync(FILE) ? fs.readFileSync(FILE, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);

beforeEach(() => { mockQuery.mockReset(); mockQuery.mockResolvedValue({ rows: [] }); });

describe("bureauIntentId доходит до строки подписки и до /checkout/status", () => {
  test("вебхук с bureauIntentId → поле в строке; статус по нему ready, без номера кассы", async () => {
    const intent = "intent_ls_tier_7f3a9c21";
    const r = await webhook({ bureauIntentId: intent }, "ls_sub_intent_1");
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const строка = rows().find((s) => s.providerPaymentId === "ls_sub_intent_1");
    console.log(`[сторож intent] в строке bureauIntentId=${JSON.stringify(строка?.bureauIntentId)}`);
    expect(строка?.bureauIntentId).toBe(intent);

    const st = await request(app()).get(`/api/pricing/checkout/status?intentId=${intent}`);
    console.log(`[сторож intent] /checkout/status → ${st.status} ${JSON.stringify(st.body)}`);
    expect(st.status).toBe(200);
    expect(st.body).toMatchObject({ ready: true, tier: "lite" });
  });

  test("КОНТРОЛЬ: чужой intent не находит покупку (ready:false), без bureauIntentId поле не пишется", async () => {
    expect((await webhook({}, "ls_sub_intent_2")).status).toBe(200);
    expect(rows().find((s) => s.providerPaymentId === "ls_sub_intent_2")).not.toHaveProperty("bureauIntentId");
    const st = await request(app()).get("/api/pricing/checkout/status?intentId=intent_never_paid_000");
    expect(st.body).toEqual({ ready: false });
  });
});
