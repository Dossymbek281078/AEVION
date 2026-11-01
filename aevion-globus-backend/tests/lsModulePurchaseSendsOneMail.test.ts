import { describe, test, expect, beforeEach, vi } from "vitest";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import request from "supertest";
import express from "express";

/**
 * Покупка отдельного модуля (ссылка app_<slug> и запасной tier_lite с
 * custom_data.module) даёт ровно одно письмо; повтор доставки — без второго.
 */
const SECRET = "test-ls-secret-module-mail";
process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = SECRET;
process.env.LEMON_SQUEEZY_VARIANT_LITE = "8201";
process.env.LEMON_SQUEEZY_VARIANT_IP_BUREAU = "8202";
process.env.SUBSCRIPTIONS_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ls-modmail-")), "subscriptions.jsonl");

const { mockQuery, sendEmailMock } = vi.hoisted(() => ({ mockQuery: vi.fn(), sendEmailMock: vi.fn() }));
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: mockQuery }) }));
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => vi.fn() }));
vi.mock("../src/routes/provisioning", async (orig) => ({
  ...(await orig<typeof import("../src/routes/provisioning")>()),
  sendEmail: sendEmailMock,
}));

// eslint-disable-next-line import/first
import { lemonSqueezyWebhookRouter } from "../src/routes/lemonSqueezyWebhook";
// eslint-disable-next-line import/first
import { __resetWebhookDedupCache } from "../src/lib/webhookDedup";

function post(variant: string, id: string, custom: Record<string, string>, renews = "2026-12-01T00:00:00Z") {
  const a = express(); a.use(express.json());
  a.use("/api/lemonsqueezy", lemonSqueezyWebhookRouter);
  const raw = JSON.stringify({
    meta: { event_name: "subscription_created", custom_data: custom },
    data: { id, attributes: { user_email: "modbuyer@test.aev", variant_id: variant, total: 3200, renews_at: renews } },
  });
  const sig = crypto.createHmac("sha256", SECRET).update(raw, "utf8").digest("hex");
  return request(a).post("/api/lemonsqueezy/webhook").set("Content-Type", "application/json").set("X-Signature", sig).send(raw);
}

beforeEach(() => {
  __resetWebhookDedupCache();
  mockQuery.mockReset(); mockQuery.mockResolvedValue({ rows: [], rowCount: 1 });
  sendEmailMock.mockReset(); sendEmailMock.mockResolvedValue({ ok: true, mode: "stub" });
});

describe("письмо после покупки модуля", () => {
  test("app-ссылка: одно письмо, повтор доставки — deduped, письмо не повторяется", async () => {
    const r1 = await post("8202", "ls_mod_1", { channel: "yt-bureau" });
    expect(r1.status, JSON.stringify(r1.body)).toBe(200);
    expect(r1.body).toMatchObject({ action: "app_activated", appSlug: "ip_bureau", mailed: true });
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const письмо = sendEmailMock.mock.calls[0][0];
    expect(письмо.to).toBe("modbuyer@test.aev");
    expect(письмо.text).toContain("https://aevion.app/account?c=yt-bureau");
    expect(письмо.text).toContain("IP Bureau");
    const r2 = await post("8202", "ls_mod_1", { channel: "yt-bureau" });
    expect(r2.body).toMatchObject({ ok: true, deduped: true });
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  test("tier_lite + custom_data.module: одно письмо, ссылка с ls-module; повтор — без письма", async () => {
    const r1 = await post("8201", "ls_mod_2", { module: "ip_bureau" });
    expect(r1.status, JSON.stringify(r1.body)).toBe(200);
    expect(r1.body).toMatchObject({ action: "app_activated", mailed: true });
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock.mock.calls[0][0].text).toContain("https://aevion.app/account?c=ls-module");
    const r2 = await post("8201", "ls_mod_2", { module: "ip_bureau" });
    expect(r2.body.deduped).toBe(true);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  test("письмо не ушло: выдача цела, ok:true, mailed:false (и при броске)", async () => {
    sendEmailMock.mockResolvedValueOnce({ ok: false, mode: "real", error: "rejected" });
    const r1 = await post("8202", "ls_mod_3", {});
    expect(r1.status).toBe(200);
    expect(r1.body).toMatchObject({ ok: true, action: "app_activated", mailed: false });
    sendEmailMock.mockRejectedValueOnce(new Error("boom"));
    const r2 = await post("8202", "ls_mod_4", {});
    expect(r2.body).toMatchObject({ ok: true, action: "app_activated", mailed: false });
  });
});
