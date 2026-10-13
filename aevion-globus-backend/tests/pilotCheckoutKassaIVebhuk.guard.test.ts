import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import crypto from "node:crypto";
import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/*
 * 🔴 129б (13.10.2026): пилот $490 продаётся через кассу тем же путём, что подписки.
 * Сторож ДЕЛАЕТ ЗАПРОСЫ к ручкам (0-СТОРОЖ-ДЕЛАЕТ-ЗАПРОС): товар в каталоге, ссылка
 * выдаётся с верным вариантом/custom_data/redirect, выдуманный товар — 400, касса не
 * настроена — 503 без вызова кассы; вебхук order_created по варианту пилота — письмо на
 * data@, строка журнала, событие оплаты; чужой вариант пилотом не считается.
 */
const каталог = mkdtempSync(join(tmpdir(), "aevion-pilot-kassa-"));
process.env.LEADS_FILE = join(каталог, "leads.jsonl");
const SECRET = "whsec_test_pilot";
process.env.LEMON_SQUEEZY_API_KEY = "ls_test_key";
process.env.LEMON_SQUEEZY_STORE_ID = "123456";
process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = SECRET;
process.env.AEVION_PUBLIC_BASE_URL = "https://aevion.app";
delete process.env.LEMON_SQUEEZY_VARIANT_PILOT_490;

const { письма, вызовыКассы, оплаты, почтаОк } = vi.hoisted(() => ({
  письма: [] as Array<{ to: string; subject: string; text: string }>,
  вызовыКассы: [] as Array<{ url: string; body: Record<string, unknown> }>,
  оплаты: [] as Array<Record<string, unknown>>,
  почтаОк: { v: true },
}));
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: async () => ({ rows: [], rowCount: 0 }) }) }));
vi.mock("../src/routes/provisioning", () => ({
  sendEmail: async (p: { to: string; subject: string; text: string }) => { письма.push(p); return почтаОк.v ? { ok: true, mode: "real" } : { ok: false, mode: "real", error: "resend 500" }; },
  provisionSubscription: vi.fn(),
  writeSubscription: vi.fn(),
  readLatestSubscription: vi.fn(async () => null),
  возвратКасаетсяДействующей: vi.fn(() => false),
}));
vi.mock("../src/lib/rateLimit", async (orig) => ({ ...(await orig<typeof import("../src/lib/rateLimit")>()), rateLimit: () => (_q: unknown, _s: unknown, n: () => void) => n() }));
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => vi.fn() }));
vi.mock("../src/lib/payment/paymentConfirmedEvent", () => ({ записатьПодтверждённуюОплату: (x: Record<string, unknown>) => { оплаты.push(x); } }));

vi.stubGlobal("fetch", vi.fn(async (url: string | URL, init?: { body?: string }) => {
  вызовыКассы.push({ url: String(url), body: JSON.parse(init?.body ?? "{}") as Record<string, unknown> });
  return { ok: true, status: 200, json: async () => ({ data: { id: "chk_pilot_1", attributes: { url: "https://aevion.lemonsqueezy.com/checkout/custom/chk_pilot_1" } } }), text: async () => "" };
}));

async function приложение() {
  const { proofPilotRouter } = await import("../src/routes/proofPilot");
  const { lemonSqueezyWebhookRouter } = await import("../src/routes/lemonSqueezyWebhook");
  const app = express();
  app.use(express.json());
  app.use("/api/proof", proofPilotRouter);
  app.use("/api/lemonsqueezy", lemonSqueezyWebhookRouter);
  return app;
}
function вебхук(app: express.Express, payload: Record<string, unknown>) {
  const raw = JSON.stringify(payload);
  const sig = crypto.createHmac("sha256", SECRET).update(raw, "utf8").digest("hex");
  return request(app).post("/api/lemonsqueezy/webhook").set("Content-Type", "application/json").set("X-Signature", sig).send(raw);
}
const журнал = () => (existsSync(process.env.LEADS_FILE!) ? readFileSync(process.env.LEADS_FILE!, "utf8").trim().split("\n").map((l) => JSON.parse(l) as Record<string, unknown>) : []);

beforeEach(() => { письма.length = 0; вызовыКассы.length = 0; оплаты.length = 0; почтаОк.v = true; if (existsSync(process.env.LEADS_FILE!)) rmSync(process.env.LEADS_FILE!); process.env.LEMON_SQUEEZY_API_KEY = "ls_test_key"; });
afterAll(() => rmSync(каталог, { recursive: true, force: true }));

describe("каталог кассы", () => {
  it("🔴 товар pilot_490 есть: вариант 2242340 по умолчанию, переменная подменяет, /health-статус его видит", async () => {
    const { resolveLemonSqueezyVariant, lemonSqueezyVariantStatus, PILOT_490_REFERENCE } = await import("../src/data/lemonSqueezyVariants");
    expect(PILOT_490_REFERENCE).toBe("pilot_490");
    expect(resolveLemonSqueezyVariant("pilot_490")).toBe("2242340");
    process.env.LEMON_SQUEEZY_VARIANT_PILOT_490 = "777";
    expect(resolveLemonSqueezyVariant("pilot_490")).toBe("777");
    delete process.env.LEMON_SQUEEZY_VARIANT_PILOT_490;
    expect((lemonSqueezyVariantStatus() as Record<string, boolean>).pilot_490).toBe(true);
    expect(resolveLemonSqueezyVariant("pilot_491")).toBeNull();
  });
});

describe("POST /api/proof/pilot-checkout", () => {
  it("🔴 выдаёт ссылку кассы: вариант 2242340, custom_data с module/channel/post, redirect на успех с ref=pilot_490, строка в журнал", async () => {
    const r = await request(await приложение()).post("/api/proof/pilot-checkout").send({ channel: "yt-test", post: "yt-test", path: "/proof?c=yt-test" });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body).toMatchObject({ ok: true, url: "https://aevion.lemonsqueezy.com/checkout/custom/chk_pilot_1", provider: "lemonsqueezy", mode: "real", product: "pilot_490", amountCents: 49000, currency: "USD", journaled: true });
    expect(вызовыКассы).toHaveLength(1);
    expect(вызовыКассы[0].url).toMatch(/\/checkouts$/);
    const data = вызовыКассы[0].body.data as { attributes: { checkout_data: { custom: Record<string, string> }; product_options: { redirect_url: string; enabled_variants: number[] } }; relationships: { variant: { data: { id: string } } } };
    expect(data.relationships.variant.data.id).toBe("2242340");
    expect(data.attributes.product_options.enabled_variants).toEqual([2242340]);
    expect(data.attributes.checkout_data.custom).toMatchObject({ module: "pilot_490", channel: "yt-test", post: "yt-test", reference: "pilot_490" });
    expect(data.attributes.product_options.redirect_url).toContain("/pricing/checkout/success?");
    expect(data.attributes.product_options.redirect_url).toContain("ref=pilot_490");
    expect(data.attributes.product_options.redirect_url).toContain("appId=pilot_490");
    expect(журнал().map((z) => z.kind)).toEqual(["pilot_490_checkout"]);
  });

  it("🔴 выдуманный товар — 400 invalid_product, касса не вызывается", async () => {
    const r = await request(await приложение()).post("/api/proof/pilot-checkout").send({ product: "pilot_4900" });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("invalid_product");
    expect(вызовыКассы).toHaveLength(0);
  });

  it("касса не настроена — 503 checkout_unavailable с именем недостающего, ничего не вызвано", async () => {
    delete process.env.LEMON_SQUEEZY_API_KEY;
    const r = await request(await приложение()).post("/api/proof/pilot-checkout").send({});
    expect(r.status).toBe(503);
    expect(r.body.error).toBe("checkout_unavailable");
    expect(r.body.missing).toContain("LEMON_SQUEEZY_API_KEY");
    expect(r.body.message).toContain("Nothing was charged");
    expect(вызовыКассы).toHaveLength(0);
  });
});

describe("вебхук кассы: заказ пилота", () => {
  it("🔴 order_created по варианту 2242340 → письмо на data@ с суммой и заказом, журнал pilot_490_paid, событие оплаты", async () => {
    const app = await приложение();
    const r = await вебхук(app, { meta: { event_name: "order_created", custom_data: { reference: "pilot_490", module: "pilot_490", channel: "yt-test", post: "yt-test" } }, data: { id: "ord_pilot_1", attributes: { user_email: "Buyer@Example.com", variant_id: 2242340, total: 49000 } } });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body).toMatchObject({ ok: true, action: "pilot_490_paid", email: "buyer@example.com", mailed: true, journaled: true, errors: [] });
    expect(письма).toHaveLength(1);
    expect(письма[0].to).toBe("data@aevion.app");
    expect(письма[0].subject).toContain("Pilot PAID — $490 — buyer@example.com");
    expect(письма[0].text).toContain("$490.00");
    expect(письма[0].text).toContain("ord_pilot_1");
    expect(письма[0].text).toContain("within 24 hours");
    expect(журнал().map((z) => [z.kind, z.orderId, z.channel])).toEqual([["pilot_490_paid", "ord_pilot_1", "yt-test"]]);
    expect(оплаты).toHaveLength(1);
    expect(оплаты[0]).toMatchObject({ source: "lemonsqueezy", tier: "pilot_490", reference: "pilot_490", event: "order_created", email: "buyer@example.com", value: 490 });
  });

  it("order_refunded → письмо REFUNDED, журнал pilot_490_refunded, события оплаты нет", async () => {
    const r = await вебхук(await приложение(), { meta: { event_name: "order_refunded" }, data: { id: "ord_pilot_2", attributes: { user_email: "buyer@example.com", variant_id: "2242340", total: 49000 } } });
    expect(r.body.action).toBe("pilot_490_refunded");
    expect(письма[0].subject).toContain("REFUNDED");
    expect(журнал().map((z) => z.kind)).toEqual(["pilot_490_refunded"]);
    expect(оплаты).toHaveLength(0);
  });

  it("отказ почты не молчит: mailed=false и причина в errors, журнал всё равно записан", async () => {
    почтаОк.v = false;
    const r = await вебхук(await приложение(), { meta: { event_name: "order_created" }, data: { id: "ord_pilot_3", attributes: { user_email: "buyer@example.com", variant_id: 2242340, total: 49000 } } });
    expect(r.body).toMatchObject({ action: "pilot_490_paid", mailed: false, journaled: true });
    expect(r.body.errors.join(" ")).toContain("resend 500");
  });

  it("контроль: заказ по чужому варианту пилотом не считается", async () => {
    const r = await вебхук(await приложение(), { meta: { event_name: "order_created" }, data: { id: "ord_x", attributes: { user_email: "x@example.com", variant_id: "5555", total: 100 } } });
    expect(r.status).toBe(200);
    expect(r.body.action).toBeUndefined();
    expect(письма).toHaveLength(0);
    expect(журнал()).toEqual([]);
  });
});
