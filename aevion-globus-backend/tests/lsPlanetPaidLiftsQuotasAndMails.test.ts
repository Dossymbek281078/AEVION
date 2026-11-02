import { describe, test, expect, beforeEach, vi } from "vitest";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { EventEmitter } from "node:events";
import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";

/**
 * 02.11.2026. Сквозная проверка без настоящей оплаты: человек платит тариф «AEVION Планета»
 * (Lemon Squeezy, tier_max, 12 мес) → вебхук с настоящей подписью HMAC → запись подписки →
 * resolveUserPlan по JWT этого человека → три проверки:
 *   (а) бесплатная норма действий бюро (qright_register, bureau_verify): причина «платящий»;
 *   (б) Мультичат/QCoreAI для вошедшего: платный тариф не упирается ни в гостевые 2/сутки,
 *       ни в бесплатные 100 000 токенов, ни в стену модуля; потолок — свой, тарифный;
 *   (в) приветственное письмо об оплате — ровно одно, и повтор доставки его не дублирует.
 * Контроль: тот же вход БЕЗ оплаты упирается в норму — иначе зелёный тест ничего не доказывает.
 * Отправщик писем настоящий (режим заглушки), письма считаем по строке [email/STUB].
 */
const SECRET = "test-ls-secret-planet-paid-e2e";
vi.hoisted(() => {
  process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = "test-ls-secret-planet-paid-e2e";
  process.env.LEMON_SQUEEZY_VARIANT_MAX = "8312";
  delete process.env.RESEND_API_KEY;
  process.env.PAID_ACTIONS = "qright_register,bureau_verify";
  process.env.QCOREAI_FREE_QUOTA = "1";
  process.env.QCOREAI_TIER_QUOTA = "1";
  process.env.PAYWALL_MODULES = "multichat-engine";
  delete process.env.PAYWALL_DISABLED;
  delete process.env.PAYWALL_ALLOWLIST;
});
const файл = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ls-planet-e2e-")), "subscriptions.jsonl");
process.env.SUBSCRIPTIONS_FILE = файл;

// База: счётчик бесплатных действий — настоящий (по ключу actor|action|ym), остальное пусто.
// Счёт гостя Мультичата валим в ошибку — модуль откатывается на память процесса (штатный путь).
const счётчикДействий = new Map<string, number>();
const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: mockQuery }) }));
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => vi.fn() }));

let израсходованоТокенов = 0;
vi.mock("../src/services/qcoreai/store", () => ({
  getMonthlyTokens: async () => израсходованоТокенов,
  getMonthlyPremiumTokens: async () => 0,
}));

// eslint-disable-next-line import/first
import { lemonSqueezyWebhookRouter } from "../src/routes/lemonSqueezyWebhook";
// eslint-disable-next-line import/first
import { __resetWebhookDedupCache } from "../src/lib/webhookDedup";
// eslint-disable-next-line import/first
import { getJwtSecret } from "../src/lib/authJwt";
// eslint-disable-next-line import/first
import { resolveUserPlan, requireModule } from "../src/lib/planGate";
// eslint-disable-next-line import/first
import { учестьДействие, сброситьГотовностьТаблицы } from "../src/lib/freeActionQuota";
// eslint-disable-next-line import/first
import { enforceFreeTokenQuota } from "../src/lib/qcoreQuota";
// eslint-disable-next-line import/first
import { гостевойСлой, сброситьСчётГостей } from "../src/lib/multichatGuestPass";

function post(id: string, почтаКассы: string, custom: Record<string, string> = {}) {
  const a = express(); a.use(express.json());
  a.use("/api/lemonsqueezy", lemonSqueezyWebhookRouter);
  const raw = JSON.stringify({
    meta: { event_name: "subscription_created", custom_data: custom },
    data: { id, attributes: { user_email: почтаКассы, variant_id: "8312", total: 157500 } },
  });
  const sig = crypto.createHmac("sha256", SECRET).update(raw, "utf8").digest("hex");
  return request(a).post("/api/lemonsqueezy/webhook").set("Content-Type", "application/json").set("X-Signature", sig).send(raw);
}

const токен = (почта: string, sub: string) => jwt.sign({ sub, email: почта }, getJwtSecret(), { algorithm: "HS256" });
function запрос(почта: string, sub: string) {
  const h = { authorization: `Bearer ${токен(почта, sub)}` } as Record<string, string>;
  return { method: "POST", path: "/conversations/c1/dispatch", ip: "203.0.113.50", headers: h, body: {}, get: (k: string) => h[k.toLowerCase()] } as never;
}
function ответ() {
  const e = new EventEmitter() as EventEmitter & { statusCode: number; body?: Record<string, unknown>; status: (n: number) => unknown; json: (b: Record<string, unknown>) => unknown };
  e.statusCode = 200;
  e.status = (n: number) => { e.statusCode = n; return e; };
  e.json = (b) => { e.body = b; return e; };
  return e;
}

/** Один вызов Мультичата через настоящий гостевой слой + настоящую стену модуля. */
async function мультичат(запросЧеловека: never): Promise<{ дошёл: boolean; статус: number; тело?: Record<string, unknown> }> {
  // Слой дописывает req.auth гостю — в проде запрос каждый раз новый, поэтому берём копию.
  const req = { ...(запросЧеловека as object) } as never;
  const res = ответ();
  let дошёл = false;
  const роутер = (() => { дошёл = true; }) as never;
  const слой = гостевойСлой(роутер, requireModule("multichat-engine"));
  await new Promise<void>((готово) => {
    слой(req, res as never, готово);
    setTimeout(готово, 40);
  });
  if (дошёл) { res.emit("finish"); await new Promise((r) => setTimeout(r, 15)); } // норма гостя списывается после ответа
  return { дошёл, статус: res.statusCode, тело: res.body };
}

let журнал: string[] = [];
beforeEach(() => {
  __resetWebhookDedupCache();
  сброситьСчётГостей();
  сброситьГотовностьТаблицы();
  счётчикДействий.clear();
  израсходованоТокенов = 0;
  mockQuery.mockReset();
  mockQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
    const s = String(sql);
    if (s.includes("MultichatGuestUsage")) throw new Error("тест: гостевой счёт — в память");
    if (s.includes("FreeActionUsage") && s.includes("INSERT")) {
      const ключ = (params ?? []).slice(0, 3).join("|");
      const n = (счётчикДействий.get(ключ) ?? 0) + 1;
      счётчикДействий.set(ключ, n);
      return { rows: [{ count: n }], rowCount: 1 };
    }
    return { rows: [], rowCount: 1 };
  });
  журнал = [];
  vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => { журнал.push(a.map(String).join(" ")); });
});
const приветствия = () => журнал.filter((s) => s.startsWith("[email/STUB]") && s.includes("Подписка активна"));
const записиДля = (адрес: string) =>
  fs.existsSync(файл) ? fs.readFileSync(файл, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((r) => r.email === адрес) : [];

/** Оплата прошла вебхуком. */
async function оплатить(id: string, почта: string) {
  const r = await post(id, почта);
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  expect(r.body).toMatchObject({ ok: true, action: "activated", tierId: "max" });
  return r;
}

const ДЕЙСТВИЯ = ["qright_register", "bureau_verify"];

describe("(а) бесплатная норма действий бюро", () => {
  test("контроль: без оплаты вошедший на 4-м действии упирается в «норма исчерпана»", async () => {
    const req = запрос("free-a@buyer.aev", "u_free_a");
    expect(resolveUserPlan(req)).toMatchObject({ tier: "free" });
    for (const д of ДЕЙСТВИЯ) {
      for (let i = 1; i <= 3; i++) expect((await учестьДействие(req, д)).причина).toBe("в норме");
      const четвёртое = await учестьДействие(req, д);
      expect(четвёртое).toMatchObject({ заблокировано: true, причина: "норма исчерпана" });
    }
  });

  test("после вебхука оплаты: причина «платящий», счётчик не трогается, хоть 6 раз", async () => {
    const почта = "paid-a@buyer.aev";
    const req = запрос(почта, "u_paid_a");
    await оплатить("ls_e2e_a", почта);
    const план = resolveUserPlan(req);
    expect(план).toMatchObject({ tier: "full", rawTier: "max", email: почта });
    expect(план.reason).toBe("subscription:max");
    for (const д of ДЕЙСТВИЯ) {
      for (let i = 0; i < 6; i++) {
        expect(await учестьДействие(req, д)).toMatchObject({ заблокировано: false, причина: "платящий" });
      }
    }
    expect([...счётчикДействий.keys()].filter((k) => k.includes(почта))).toEqual([]);
  });
});

describe("(б) Мультичат / QCoreAI для вошедшего", () => {
  test("контроль: без оплаты — бесплатный потолок токенов 100 000 и стена Мультичата", async () => {
    израсходованоТокенов = 150_000;
    const req = запрос("free-b@buyer.aev", "u_free_b");
    const res = ответ();
    expect(await enforceFreeTokenQuota(req, res as never)).toBe(true);
    expect(res.statusCode).toBe(402);
    expect(res.body).toMatchObject({ reason: "free_token_quota_exhausted", limitTokens: 100_000 });
    // Мультичат: две бесплатные отправки, третья — стена 402.
    expect((await мультичат(req)).дошёл).toBe(true);
    expect((await мультичат(req)).дошёл).toBe(true);
    const третья = await мультичат(req);
    expect(третья.дошёл).toBe(false);
    expect(третья.статус).toBe(402);
    expect(третья.тело).toMatchObject({ error: "upgrade_required" });
  });

  test("после оплаты: токены — тарифный потолок (не бесплатные 100k), Мультичат — мимо гостевых 2/сутки", async () => {
    const почта = "paid-b@buyer.aev";
    await оплатить("ls_e2e_b", почта);
    const req = запрос(почта, "u_paid_b");

    // Тот же расход, что запирал бесплатного, платного не трогает.
    израсходованоТокенов = 150_000;
    const ок = ответ();
    expect(await enforceFreeTokenQuota(req, ок as never)).toBe(false);
    expect(ок.statusCode).toBe(200);

    // У платного свой потолок: упирается только за тарифной границей, причина «тариф», не «бесплатный».
    израсходованоТокенов = 60_000_000;
    const упёрся = ответ();
    expect(await enforceFreeTokenQuota(req, упёрся as never)).toBe(true);
    expect(упёрся.body).toMatchObject({ reason: "tier_token_quota_exhausted" });
    expect(Number(упёрся.body?.limitTokens)).toBeGreaterThan(100_000);

    // Мультичат: пять отправок подряд — все доходят до роутера, ни одной 402.
    for (let i = 0; i < 5; i++) {
      const р = await мультичат(req);
      expect(р.дошёл, `отправка ${i + 1}`).toBe(true);
      expect(р.статус).toBe(200);
    }
  });
});

describe("(в) приветственное письмо об оплате", () => {
  test("ровно одно, на почту аккаунта; повтор доставки вебхука письма не добавляет", async () => {
    const почта = "paid-c@buyer.aev";
    await оплатить("ls_e2e_c", почта);
    expect(записиДля(почта)).toHaveLength(1);
    expect(записиДля(почта)[0]).toMatchObject({ tierId: "max", termMonths: 12 });
    expect(приветствия()).toHaveLength(1);
    expect(приветствия()[0]).toContain(`To: ${почта}`);
    const повтор = await post("ls_e2e_c", почта);
    expect(повтор.body).toMatchObject({ ok: true, deduped: true });
    expect(приветствия()).toHaveLength(1);
  });

  test("контроль: плохая подпись — ни доступа, ни письма", async () => {
    const a = express(); a.use(express.json());
    a.use("/api/lemonsqueezy", lemonSqueezyWebhookRouter);
    const raw = JSON.stringify({ meta: { event_name: "subscription_created" }, data: { id: "ls_bad", attributes: { user_email: "bad@buyer.aev", variant_id: "8312", total: 157500 } } });
    const r = await request(a).post("/api/lemonsqueezy/webhook").set("Content-Type", "application/json").set("X-Signature", "00".repeat(32)).send(raw);
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(записиДля("bad@buyer.aev")).toHaveLength(0);
    expect(приветствия()).toHaveLength(0);
  });
});

describe("сквозной сценарий: один человек до и после оплаты", () => {
  test("до — упирается везде; вебхук; после — не упирается нигде; письмо одно", async () => {
    const почта = "e2e-full@buyer.aev";
    const req = запрос(почта, "u_e2e_full");
    израсходованоТокенов = 150_000;

    // До оплаты.
    expect(resolveUserPlan(req).tier).toBe("free");
    for (let i = 0; i < 3; i++) await учестьДействие(req, "bureau_verify");
    expect((await учестьДействие(req, "bureau_verify")).причина).toBe("норма исчерпана");
    expect(await enforceFreeTokenQuota(req, ответ() as never)).toBe(true);
    await мультичат(req); await мультичат(req);
    expect((await мультичат(req)).статус).toBe(402);
    expect(приветствия()).toHaveLength(0);

    // Вебхук оплаты.
    await оплатить("ls_e2e_full", почта);

    // После оплаты — тот же токен, те же запросы.
    expect(resolveUserPlan(req)).toMatchObject({ tier: "full", rawTier: "max" });
    for (const д of ДЕЙСТВИЯ) expect(await учестьДействие(req, д)).toMatchObject({ заблокировано: false, причина: "платящий" });
    expect(await enforceFreeTokenQuota(req, ответ() as never)).toBe(false);
    const м = await мультичат(req);
    expect(м.дошёл).toBe(true);
    expect(м.статус).toBe(200);
    expect(приветствия()).toHaveLength(1);
  });
});
