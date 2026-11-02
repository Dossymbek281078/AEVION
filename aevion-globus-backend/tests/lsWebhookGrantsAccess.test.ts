import { describe, test, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import crypto from "node:crypto";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

/**
 * «Оплатил на кассе → вебхук LemonSqueezy → доступ, который видит ВСЁ остальное».
 *
 * Для каждой из четырёх живых покупок (CyberChess $50/год, DevHub и Мультичат
 * через План Max $150/мес, модуль Бюро) проверяется вся цепочка ЛОКАЛЬНО:
 *
 *   POST /api/pricing/checkout/session (настоящий обработчик кассы; касса LS
 *   подменена и лишь запоминает, что бы она открыла: вариант, сумму, custom_data)
 *   → подписанный HMAC вебхук с ровно этой полезной нагрузкой
 *   → запись (subscriptions.jsonl / AppSubscription / DevHubEmailTier)
 *   → те же функции и маршруты, которыми пользуется продукт
 *   → subscription_cancelled забирает доступ.
 *
 * Ни сети, ни прода, ни настоящих секретов: все ключи, варианты и секрет вебхука
 * тестовые, база — в памяти, файлы — во временном каталоге, fetch запрещён.
 */

const SECRET = "test-ls-grants-secret-0211";
const JWT_SECRET = "test-jwt-secret-for-grants-0211-0123456789";

const tmp = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fsx = require("node:fs") as typeof import("node:fs");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const osx = require("node:os") as typeof import("node:os");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const px = require("node:path") as typeof import("node:path");
  const dir = fsx.mkdtempSync(px.join(osx.tmpdir(), "ls-grants-0211-"));
  const e = process.env;
  for (const k of [
    "RESEND_API_KEY", "BREVO_API_KEY", "SENDGRID_API_KEY", "FOUNDER_EMAIL_SHA256", "PAYWALL_ALLOWLIST",
    "PAYWALL_DISABLED", "PAYWALL_SOURCE", "PAYBOX_MERCHANT_ID", "PAYBOX_SECRET", "PAYPAL_CLIENT_ID",
    "PAYPAL_SECRET", "GUMROAD_DEFAULT_PERMALINK", "LEMON_SQUEEZY_VARIANT_MULTICHAT_LITE",
  ]) delete e[k];
  e.NODE_ENV = "test";
  e.SUBSCRIPTIONS_FILE = px.join(dir, "subscriptions.jsonl");
  e.EVENTS_FILE = px.join(dir, "events.jsonl");
  e.WEBHOOK_DEDUP_FILE = px.join(dir, "webhook-dedup.jsonl");
  e.AUTH_JWT_SECRET = "test-jwt-secret-for-grants-0211-0123456789";
  // Касса LS «настроена» фиктивными ключами — наружу они не уходят (провайдер подменён).
  e.LEMON_SQUEEZY_API_KEY = "test-api-key";
  e.LEMON_SQUEEZY_STORE_ID = "123";
  e.LEMON_SQUEEZY_WEBHOOK_SECRET = "test-ls-grants-secret-0211";
  // Тестовые варианты. Числа выдуманы; на прод не похожи.
  e.LEMON_SQUEEZY_VARIANT_LITE = "7001"; // tier_lite: запасной вариант (модуль Бюро / Мультичат)
  e.LEMON_SQUEEZY_VARIANT_CYBERCHESS_MAX = "7002"; // app_cyberchess_max
  e.LEMON_SQUEEZY_VARIANT_PLANET_MAX_MONTHLY = "7003"; // tier_max_monthly
  e.LEMON_SQUEEZY_VARIANT_IP_BUREAU = "7004"; // прежний товар Бюро (app_ip_bureau)
  // Платные действия Бюро включены, бесплатная норма — ноль: любой без оплаты упрётся.
  e.PAID_ACTIONS = "bureau_verify,qright_register";
  e.FREE_BUREAU_VERIFY_PER_MONTH = "0";
  e.FREE_QRIGHT_REGISTER_PER_MONTH = "0";
  // Платная стена Мультичата включена, как на проде.
  e.PAYWALL_MODULES = "multichat-engine";
  e.QCOREAI_FREE_QUOTA = "1";
  e.QCOREAI_TIER_QUOTA = "1";
  return { dir };
});

/* ───────── база в памяти: ровно те запросы, что делает бэкенд на этом пути ───────── */

interface AppRow { status: string; lsSubId: string | null }
const db = {
  appSub: new Map<string, AppRow>(), // "email|slug"
  devhubEmailTier: new Map<string, string>(),
  devhubTier: new Map<string, string>(),
  users: new Map<string, string>(), // id -> email
  freeUsage: new Map<string, number>(),
};
const unknownSql: string[] = [];

async function fakeQuery(sql: unknown, params: unknown[] = []): Promise<{ rows: any[]; rowCount: number }> {
  const s = String(sql);
  const p = params;
  if (/^\s*SELECT 1\s*$/.test(s)) return { rows: [{ "?column?": 1 }], rowCount: 1 };
  // Телеметрия «лучшее из возможного» (журнал здоровья провайдеров, журнал отказов стены) — к доступу не относится.
  if (/provider_health_log|paywall_deny_log/.test(s)) return { rows: [], rowCount: 0 };
  if (/CREATE TABLE|CREATE UNIQUE INDEX|CREATE INDEX|ALTER TABLE/.test(s)) return { rows: [], rowCount: 0 };
  if (s.includes('INSERT INTO "AppSubscription"')) {
    const [email, slug, lsSubId, status] = p as [string, string, string | null, string];
    const key = `${email}|${slug}`;
    db.appSub.set(key, { status, lsSubId: lsSubId ?? db.appSub.get(key)?.lsSubId ?? null });
    return { rows: [], rowCount: 1 };
  }
  if (s.includes('FROM "AppSubscription"') && s.includes('"appSlug"=$2')) {
    const [email, slug] = p as [string, string];
    const hit = db.appSub.get(`${email}|${slug}`)?.status === "active";
    return { rows: hit ? [{ "?column?": 1 }] : [], rowCount: hit ? 1 : 0 };
  }
  if (s.includes('SELECT "appSlug" FROM "AppSubscription"')) {
    const [email] = p as [string];
    const rows = [...db.appSub.entries()]
      .filter(([k, v]) => k.startsWith(`${email}|`) && v.status === "active")
      .map(([k]) => ({ appSlug: k.split("|")[1] }));
    return { rows, rowCount: rows.length };
  }
  if (s.includes('INSERT INTO "DevHubEmailTier"')) {
    db.devhubEmailTier.set(String(p[0]), String(p[1]));
    return { rows: [], rowCount: 1 };
  }
  if (s.includes('INSERT INTO "DevHubTier"')) {
    db.devhubTier.set(String(p[0]), String(p[1]));
    return { rows: [], rowCount: 1 };
  }
  if (s.includes('SELECT "id" FROM "AEVIONUser" WHERE LOWER("email")')) {
    const id = [...db.users.entries()].find(([, e]) => e === p[0])?.[0];
    return { rows: id ? [{ id }] : [], rowCount: id ? 1 : 0 };
  }
  if (s.includes('SELECT "deletedAt" FROM "AEVIONUser"')) {
    return db.users.has(String(p[0])) ? { rows: [{ deletedAt: null }], rowCount: 1 } : { rows: [], rowCount: 0 };
  }
  if (s.includes('SELECT LOWER("email") AS email FROM "AEVIONUser"')) {
    const e = db.users.get(String(p[0]));
    return { rows: e ? [{ email: e }] : [], rowCount: e ? 1 : 0 };
  }
  if (s.includes('SELECT "tier" FROM "DevHubTier"')) {
    const t = db.devhubTier.get(String(p[0]));
    return { rows: t ? [{ tier: t }] : [], rowCount: t ? 1 : 0 };
  }
  if (s.includes('JOIN "DevHubEmailTier"')) {
    const e = db.users.get(String(p[0]));
    const t = e ? db.devhubEmailTier.get(e) : undefined;
    return { rows: t ? [{ tier: t }] : [], rowCount: t ? 1 : 0 };
  }
  if (s.includes('FROM "DevHubUsage"')) return { rows: [], rowCount: 0 };
  if (s.includes('INSERT INTO "FreeActionUsage"')) {
    const key = `${p[0]}|${p[1]}|${p[2]}`;
    const n = (db.freeUsage.get(key) ?? 0) + 1;
    db.freeUsage.set(key, n);
    return { rows: [{ count: n }], rowCount: 1 };
  }
  unknownSql.push(s.replace(/\s+/g, " ").slice(0, 160));
  throw new Error("unexpected SQL in test: " + s.slice(0, 120));
}

const pool = { query: fakeQuery };
vi.mock("../src/lib/dbPool", () => ({ getPool: () => pool, getPoolStats: () => null }));
vi.mock("../src/lib/ensureDevHubTables", () => ({
  ensureDevHubTables: vi.fn().mockResolvedValue(undefined),
  isDevHubDbReady: () => true,
  getDevHubDbError: () => null,
}));
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => vi.fn() }));
vi.mock("../src/services/qcoreai/store", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  getMonthlyTokens: async () => 0,
  getMonthlyPremiumTokens: async () => 0,
}));

/** Что открыла бы касса LS: вариант, сумма и custom_data — ровно то, что вернёт вебхук. */
interface Opened { reference: string; amountCents: number; customPriceCents?: number; customData?: Record<string, string>; email?: string | null }
const opened: Opened[] = [];
vi.mock("../src/lib/payment/lemonSqueezyProvider", async (orig) => {
  const real = await orig<Record<string, unknown>>();
  return {
    ...real,
    lemonSqueezyPaymentProvider: {
      id: "lemonsqueezy",
      createIntent: async (input: Opened) => {
        opened.push(input);
        return { intentId: "intent-test", checkoutUrl: "https://checkout.example.test/buy" };
      },
    },
  };
});

const networkCalls: string[] = [];
const realFetch = global.fetch;

/* Импорты — после env и моков. */
const { lemonSqueezyWebhookRouter } = await import("../src/routes/lemonSqueezyWebhook");
const { checkoutRouter } = await import("../src/routes/checkout");
const { pricingRouter } = await import("../src/routes/pricing");
const { appAccessRouter } = await import("../src/routes/appAccess");
const { devhubRouter } = await import("../src/routes/devhub");
const { multichatRouter } = await import("../src/routes/multichat");
const { гостевойСлой, сброситьСчётГостей } = await import("../src/lib/multichatGuestPass");
const { requireModule, resolveUserPlan, isModuleEntitled } = await import("../src/lib/planGate");
const { учестьДействие } = await import("../src/lib/freeActionQuota");
const { hasMultichatPass, monthlyQuotaHeadroom } = await import("../src/lib/qcoreQuota");
const { resetAppEntitlementsCache } = await import("../src/lib/appEntitlements");
const { resetAppSubscriptionEnsured } = await import("../src/lib/ensureAppSubscriptionTable");
const { getTier } = await import("../src/data/pricing");
const { resolveLemonSqueezyVariant, fallbackVariantForReference } = await import("../src/data/lemonSqueezyVariants");
const { __resetDevHubStore } = await import("../src/routes/devhub");

function makeApp() {
  const app = express();
  app.set("trust proxy", true);
  app.use(express.json());
  app.use("/api/lemonsqueezy", lemonSqueezyWebhookRouter);
  app.use("/api/pricing/checkout", checkoutRouter);
  app.use("/api/pricing", pricingRouter);
  app.use("/api/apps/access", appAccessRouter);
  app.use("/api/devhub", devhubRouter);
  // Тот же слой, что в index.ts: гостевой пропуск → платная стена Мультичата → роутер.
  app.use("/api/multichat", гостевойСлой(multichatRouter, requireModule("multichat-engine", multichatRouter)));
  return app;
}
const app = makeApp();

let ipN = 0;
const nextIp = () => `10.20.${Math.floor(++ipN / 250)}.${(ipN % 250) + 1}`;

function tokenFor(sub: string, email: string): string {
  return jwt.sign({ sub, email, role: "user" }, JWT_SECRET, { algorithm: "HS256", expiresIn: "1h" });
}

let subSeq = 0;
function lsPayload(opts: {
  event: string; variantId: string; email: string; total?: number; customData?: Record<string, string>;
  subId: string; createdAt?: string; renewsAt?: string;
}) {
  return {
    meta: { event_name: opts.event, ...(opts.customData ? { custom_data: opts.customData } : {}), test_mode: true },
    data: {
      id: opts.subId,
      attributes: {
        user_email: opts.email,
        variant_id: Number(opts.variantId),
        status: opts.event === "subscription_cancelled" ? "cancelled" : "active",
        created_at: opts.createdAt ?? new Date().toISOString(),
        renews_at: opts.renewsAt ?? new Date(Date.now() + 30 * 864e5).toISOString(),
        ...(opts.total === undefined ? {} : { total: opts.total }),
      },
    },
  };
}
function sendHook(payload: unknown) {
  const raw = JSON.stringify(payload);
  const sig = crypto.createHmac("sha256", SECRET).update(raw, "utf8").digest("hex");
  return request(app).post("/api/lemonsqueezy/webhook")
    .set("Content-Type", "application/json").set("X-Signature", sig).send(raw);
}
function checkout(token: string, body: Record<string, unknown>) {
  return request(app).post("/api/pricing/checkout/session")
    .set("Authorization", `Bearer ${token}`).set("X-Forwarded-For", nextIp()).send(body);
}
const authed = (t: string) => ({ Authorization: `Bearer ${t}` });

function fakeReq(token: string | null) {
  return { headers: token ? { authorization: `Bearer ${token}` } : {}, socket: { remoteAddress: "10.99.0.1" }, method: "POST", path: "/x" } as never;
}

function newBuyer(tag: string) {
  const email = `${tag}-buyer@test.aev`;
  const sub = `user-${tag}`;
  db.users.set(sub, email);
  return { email, sub, token: tokenFor(sub, email) };
}

function wipe() {
  for (const m of Object.values(db)) (m as Map<unknown, unknown>).clear();
  opened.length = 0;
  resetAppEntitlementsCache();
  resetAppSubscriptionEnsured();
  try { fs.rmSync(process.env.SUBSCRIPTIONS_FILE!, { force: true }); } catch { /* нет файла */ }
  try { fs.rmSync(process.env.WEBHOOK_DEDUP_FILE!, { force: true }); } catch { /* нет файла */ }
  сброситьСчётГостей();
  __resetDevHubStore();
}

beforeAll(() => {
  global.fetch = (async (url: unknown) => {
    networkCalls.push(String(url));
    throw new Error("сеть запрещена в этом тесте: " + String(url));
  }) as never;
});
afterAll(() => {
  global.fetch = realFetch;
  try { fs.rmSync(tmp.dir, { recursive: true, force: true }); } catch { /* ничего */ }
});
beforeEach(wipe);

/* ═════════════════════════════════════════════════════════════════════════════ */

describe("стенд: контроль прибора", () => {
  test("тестовые переменные и пути заданы, прод-секретов нет", () => {
    expect(process.env.SUBSCRIPTIONS_FILE!.startsWith(os.tmpdir())).toBe(true);
    expect(process.env.LEMON_SQUEEZY_WEBHOOK_SECRET).toBe(SECRET);
    expect(resolveLemonSqueezyVariant("app_cyberchess_max")).toBe("7002");
    expect(resolveLemonSqueezyVariant("tier_max_monthly")).toBe("7003");
    expect(tmp.dir).toBeTruthy();
  });

  test("вебхук без верной подписи не выдаёт ничего (контроль: подпись работает)", async () => {
    const r = await request(app).post("/api/lemonsqueezy/webhook")
      .set("Content-Type", "application/json").set("X-Signature", "00")
      .send(JSON.stringify(lsPayload({ event: "subscription_created", variantId: "7002", email: "x@test.aev", subId: "s0" })));
    expect(r.status).toBe(401);
  });
});

describe("1) CyberChess $50/год: {tierId:max, app:cyberchess}", () => {
  test("касса → вебхук → AppSubscription → глубокий анализ открыт, кабинет видит; отмена забирает", async () => {
    const b = newBuyer("chess");

    // До оплаты: гейт закрыт (контроль, что «открыто» потом — не из-за пустого ответа).
    const before = await request(app).get("/api/apps/access/check?app=cyberchess").set(authed(b.token));
    expect(before.status).toBe(200);
    expect(before.body.active).toBe(false);

    // Что откроет касса — настоящий обработчик.
    const co = await checkout(b.token, { tierId: "max", app: "cyberchess", seats: 1, currency: "USD" });
    expect(co.status, JSON.stringify(co.body)).toBe(200);
    expect(opened).toHaveLength(1);
    const o = opened[0];
    expect(o.reference).toBe("app_cyberchess_max");
    expect(o.customPriceCents).toBe(5000); // $50
    const variantId = resolveLemonSqueezyVariant(o.reference)!;
    expect(variantId).toBe("7002");

    const payload = (event: string) => lsPayload({
      event, variantId, email: b.email, total: o.customPriceCents, customData: o.customData, subId: "ls_chess_1",
    });
    // order_created один доступа не даёт.
    const ord = await sendHook({ ...payload("order_created"), data: { id: "o1", attributes: { user_email: b.email, first_order_item: { variant_id: 7002 } } } });
    expect(ord.status).toBe(200);
    expect((await request(app).get("/api/apps/access/check?app=cyberchess").set(authed(b.token))).body.active).toBe(false);

    const hook = await sendHook(payload("subscription_created"));
    expect(hook.status, JSON.stringify(hook.body)).toBe(200);
    expect(hook.body).toMatchObject({ action: "app_activated", appSlug: "cyberchess" });

    // записано
    expect(db.appSub.get(`${b.email}|cyberchess`)?.status).toBe("active");
    // гейт «Глубокий анализ» (frontend checkAppAccess → /api/apps/access/check)
    const chk = await request(app).get("/api/apps/access/check?app=cyberchess").set(authed(b.token));
    expect(chk.body).toMatchObject({ active: true, source: "app" });
    // кабинет: список купленных приложений
    const acc = await request(app).get("/api/apps/access").set(authed(b.token));
    expect(acc.body.apps).toContain("cyberchess");
    // чужой адрес не получил (нет утечки)
    const other = newBuyer("chess-other");
    expect((await request(app).get("/api/apps/access/check?app=cyberchess").set(authed(other.token))).body.active).toBe(false);

    // отмена
    const cancel = await sendHook(payload("subscription_cancelled"));
    expect(cancel.body).toMatchObject({ action: "app_cancelled", appSlug: "cyberchess" });
    resetAppEntitlementsCache();
    expect((await request(app).get("/api/apps/access/check?app=cyberchess").set(authed(b.token))).body.active).toBe(false);
    expect((await request(app).get("/api/apps/access").set(authed(b.token))).body.apps).not.toContain("cyberchess");
  });
});

/** Общая часть двух покупок Плана Max помесячно: касса → вебхук (создание). */
async function buyPlanetMaxMonthly(b: ReturnType<typeof newBuyer>, subId: string) {
  const co = await checkout(b.token, { tierId: "max", seats: 1, billing: "monthly", currency: "USD" });
  expect(co.status, JSON.stringify(co.body)).toBe(200);
  const o = opened[opened.length - 1];
  expect(o.reference).toBe("tier_max_monthly");
  expect(o.customPriceCents).toBe(15000); // $150
  expect(o.customData).toMatchObject({ term: "max", billing: "monthly", accountEmail: b.email });
  const variantId = resolveLemonSqueezyVariant(o.reference)!;
  const payload = (event: string) => lsPayload({
    event, variantId, email: b.email, total: o.customPriceCents, customData: o.customData, subId,
  });
  const hook = await sendHook(payload("subscription_created"));
  expect(hook.status, JSON.stringify(hook.body)).toBe(200);
  expect(hook.body).toMatchObject({ action: "activated", tierId: "max" });
  return { payload, o };
}

describe("2) DevHub через План Max помесячно $150", () => {
  test("подписка записана, planGate видит платный, кабинет и DevHub-тариф «pro»; отмена возвращает free", async () => {
    const b = newBuyer("devhub");

    const credits = async () => (await request(app).get("/api/devhub/studio/credits").set(authed(b.token))).body;
    const c0 = await credits();
    expect(c0.tier).toBe("free"); // контроль

    const { payload } = await buyPlanetMaxMonthly(b, "ls_planet_dev");

    // запись + кабинет (frontend/src/app/account → GET /api/pricing/subscription/me)
    const me = await request(app).get("/api/pricing/subscription/me").set(authed(b.token));
    expect(me.status).toBe(200);
    expect(me.body.subscription).toMatchObject({ tierId: "max", termMonths: 12, source: "lemonsqueezy", amountUsd: 150 });
    expect(new Date(me.body.subscription.validUntil).getTime()).toBeGreaterThan(Date.now());

    // planGate
    const plan = resolveUserPlan(fakeReq(b.token));
    expect(plan.tier).toBe("full");
    expect(plan.rawTier).toBe("max");
    expect(isModuleEntitled(plan, "devhub")).toBe(true);

    // гейт DevHub (тариф и кредиты)
    const c1 = await credits();
    expect(c1.tier).toBe("pro");
    expect(c1.tierKnown).toBe(true);
    expect(c1.usage.codegen?.limit ?? Object.values<any>(c1.usage)[0].limit).toBeGreaterThan(
      c0.usage.codegen?.limit ?? Object.values<any>(c0.usage)[0].limit,
    );

    // отмена
    const cancel = await sendHook(payload("subscription_cancelled"));
    expect(cancel.body).toMatchObject({ action: "downgraded" });
    expect((await request(app).get("/api/pricing/subscription/me").set(authed(b.token))).body.subscription.tierId).toBe("free");
    expect(resolveUserPlan(fakeReq(b.token)).tier).toBe("free");
    expect((await credits()).tier).toBe("free");
  });
});

describe("3) Мультичат через План Max помесячно $150", () => {
  test("платная стена Мультичата открыта, без оплаты — 402; потолок токенов снят с бесплатного; отмена закрывает", async () => {
    const b = newBuyer("mc");
    const presets = (t: string | null) =>
      request(app).get("/api/multichat/presets").set(t ? authed(t) : {});

    // До оплаты: вошедший без тарифа — 402 (контроль).
    const unpaid = await presets(b.token);
    expect(unpaid.status).toBe(402);
    expect(unpaid.body.error).toBe("upgrade_required");
    const reqUnpaid = { ...(fakeReq(b.token) as object) } as never;
    expect(await hasMultichatPass({ email: b.email })).toBe(false);
    const hrUnpaid = await monthlyQuotaHeadroom({ ...(reqUnpaid as object) } as never);
    expect(hrUnpaid?.rawTier).toBe("free"); // бесплатный потолок действует

    const { payload } = await buyPlanetMaxMonthly(b, "ls_planet_mc");

    const paid = await presets(b.token);
    expect(paid.status, JSON.stringify(paid.body).slice(0, 200)).toBe(200);
    expect(paid.body.total).toBeGreaterThan(0);

    // Потолок токенов: теперь по тарифу Max, а не бесплатный.
    const hr = await monthlyQuotaHeadroom(fakeReq(b.token));
    const maxLimit = getTier("max")?.limits.llmTokensPerMonth;
    if (maxLimit == null) expect(hr).toBeNull();
    else {
      expect(hr?.rawTier).toBe("max");
      expect(hr?.limit).toBe(maxLimit);
      expect(hr!.limit).toBeGreaterThan(100_000);
    }
    // /me/token-quota — не нужен: он читает ту же resolveUserPlan.
    expect(resolveUserPlan(fakeReq(b.token)).tier).toBe("full");

    // Кабинет
    expect((await request(app).get("/api/pricing/subscription/me").set(authed(b.token))).body.subscription.tierId).toBe("max");

    // Отмена
    await sendHook(payload("subscription_cancelled"));
    expect((await presets(b.token)).status).toBe(402);
    expect((await monthlyQuotaHeadroom(fakeReq(b.token)))?.rawTier).toBe("free");
  });

  test("отдельная подписка на Мультичат (запасной путь tier_lite + module) снимает потолок через hasMultichatPass", async () => {
    const b = newBuyer("mc-app");
    const co = await checkout(b.token, { tierId: "lite", app: "multichat", seats: 1, currency: "USD" });
    // Мультичат продаётся отдельно или нет — решает каталог; если нет, это не дефект вебхука.
    if (co.status !== 200) {
      expect(co.body.error).toBe("invalid_app");
      return;
    }
    const o = opened[opened.length - 1];
    expect(o.reference).toBe("tier_lite");
    expect(o.customData?.module).toBe("multichat");
    const variantId = resolveLemonSqueezyVariant(o.reference)!;
    const mk = (event: string) => lsPayload({ event, variantId, email: b.email, total: o.customPriceCents, customData: o.customData, subId: "ls_mc_app" });

    expect(await hasMultichatPass({ email: b.email })).toBe(false);
    const hook = await sendHook(mk("subscription_created"));
    expect(hook.body).toMatchObject({ action: "app_activated", appSlug: "multichat" });
    expect(await hasMultichatPass({ email: b.email })).toBe(true);
    expect(await monthlyQuotaHeadroom(fakeReq(b.token))).toBeNull(); // без потолка
    expect((await request(app).get("/api/multichat/presets").set(authed(b.token))).status).toBe(200);
    expect((await request(app).get("/api/apps/access").set(authed(b.token))).body.apps).toContain("multichat");

    await sendHook(mk("subscription_cancelled"));
    resetAppEntitlementsCache();
    expect(await hasMultichatPass({ email: b.email })).toBe(false);
    expect((await request(app).get("/api/multichat/presets").set(authed(b.token))).status).toBe(402);
  });
});

describe("4) модуль Бюро (IP Bureau): уже оплаченное узнаётся", () => {
  test("касса больше не продаёт Бюро отдельно (контроль)", async () => {
    const b = newBuyer("bureau-co");
    const co = await checkout(b.token, { tierId: "lite", app: "ip_bureau", seats: 1, currency: "USD" });
    expect(co.status).toBe(400);
    expect(co.body.error).toBe("invalid_app");
  });

  test.each([
    {
      name: "запасной путь: tier_lite + custom_data.module=ip_bureau",
      variant: () => fallbackVariantForReference("app_ip_bureau_lite") ?? resolveLemonSqueezyVariant("tier_lite")!,
      custom: { module: "ip_bureau", accountEmail: "bureau-fb@test.aev" },
      email: "bureau-fb@test.aev",
    },
    {
      name: "прежний товар Бюро (app_ip_bureau)",
      variant: () => resolveLemonSqueezyVariant("app_ip_bureau") ?? "7004",
      custom: { accountEmail: "bureau-old@test.aev" },
      email: "bureau-old@test.aev",
    },
  ])("$name → AppSubscription ip_bureau → норма Бюро не режет, кабинет видит; отмена возвращает норму", async ({ variant, custom, email }) => {
    const sub = `user-${email}`;
    db.users.set(sub, email);
    const token = tokenFor(sub, email);
    const variantId = variant();
    expect(variantId, "вариант не найден — стенд не настроен").toBeTruthy();
    const mk = (event: string) => lsPayload({ event, variantId, email, total: 3200, customData: custom, subId: `ls_bur_${email}` });

    // До оплаты: бесплатная норма 0 → упирается (контроль).
    const q0 = await учестьДействие(fakeReq(token), "bureau_verify");
    expect(q0.заблокировано).toBe(true);
    expect(q0.причина).toBe("норма исчерпана");

    const hook = await sendHook(mk("subscription_created"));
    expect(hook.status, JSON.stringify(hook.body)).toBe(200);
    expect(hook.body).toMatchObject({ action: "app_activated", appSlug: "ip_bureau" });
    expect(db.appSub.get(`${email}|ip_bureau`)?.status).toBe("active");

    // план платформы остался бесплатным — доступ даёт именно AppSubscription (то, что не видел freeActionQuota 1.11)
    expect(resolveUserPlan(fakeReq(token)).tier).toBe("free");
    for (const action of ["bureau_verify", "qright_register"]) {
      const q = await учестьДействие(fakeReq(token), action);
      expect(q, action).toMatchObject({ заблокировано: false, причина: "платящий" });
    }
    // гейт модуля и кабинет
    expect((await request(app).get("/api/apps/access/check?app=ip_bureau").set(authed(token))).body).toMatchObject({ active: true, source: "app" });
    expect((await request(app).get("/api/apps/access").set(authed(token))).body.apps).toContain("ip_bureau");

    // отмена
    const cancel = await sendHook(mk("subscription_cancelled"));
    expect(cancel.body).toMatchObject({ action: "app_cancelled", appSlug: "ip_bureau" });
    resetAppEntitlementsCache();
    const q1 = await учестьДействие(fakeReq(token), "bureau_verify");
    expect(q1.заблокировано).toBe(true);
    expect((await request(app).get("/api/apps/access/check?app=ip_bureau").set(authed(token))).body.active).toBe(false);
  });
});

describe("итог стенда", () => {
  test("ни одного обращения к сети и ни одного неожиданного SQL", () => {
    expect(networkCalls).toEqual([]);
    expect(unknownSql, JSON.stringify(unknownSql, null, 1)).toEqual([]);
  });
});
