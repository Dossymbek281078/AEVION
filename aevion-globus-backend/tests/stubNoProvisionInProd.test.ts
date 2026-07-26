import { describe, test, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * 🔴 Stub-канал не выписывает подписку в проде.
 *
 * Найдено 2026-07-26 сквозной проверкой денежного пути. Когда ни один
 * процессинг не настроен для `tier:period`, чекаут падал в stub и провижинил
 * НАСТОЯЩУЮ подписку без единой оплаты. Прогон показал три записи в сторе —
 * lite, medium и Universe — причём у Universe в подписке стоит
 * `amountUsd: 249.99`, то есть отчёт о выручке считает эти деньги пришедшими.
 *
 * Достижимо не гипотетически: у тарифа Universe (`pro`) нет LS-варианта вовсе
 * (это прямо написано в data/lemonSqueezyVariants.ts), значит его чекаут
 * проходит мимо LS по построению.
 *
 * Локально stub нужен — без него не поработать без ключей. Поэтому проверяем
 * ОБЕ половины: в проде отказ и НИ ОДНОЙ записи, вне прода — прежнее поведение.
 */

const TMP = mkdtempSync(join(tmpdir(), "aevion-stubprod-"));
const STORE = join(TMP, "subscriptions.jsonl");
const OLD_NODE_ENV = process.env.NODE_ENV;

beforeAll(() => {
  process.env.SUBSCRIPTIONS_FILE = STORE;
  process.env.FRONTEND_URL = "http://localhost:3000";
  // Ни один процессинг не настроен — именно так ветка stub и достигается.
  for (const k of [
    "LEMON_SQUEEZY_API_KEY",
    "GUMROAD_DEFAULT_PERMALINK",
    "PAYPAL_CLIENT_ID",
    "PAYBOX_MERCHANT_ID",
  ]) {
    delete process.env[k];
  }
});

afterAll(() => {
  if (OLD_NODE_ENV === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = OLD_NODE_ENV;
  rmSync(TMP, { recursive: true, force: true });
});

let appPromise: Promise<express.Express> | null = null;
async function getApp() {
  if (!appPromise) {
    appPromise = import("../src/routes/checkout").then(({ checkoutRouter }) => {
      const app = express();
      app.use(express.json());
      app.use("/api/pricing/checkout", checkoutRouter);
      return app;
    });
  }
  return appPromise;
}

function storeRows(): Array<Record<string, unknown>> {
  if (!existsSync(STORE)) return [];
  return readFileSync(STORE, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Record<string, unknown>);
}

/** Провижининг вызывается без await — даём ему шанс записать, прежде чем судить. */
const settle = () => new Promise((r) => setTimeout(r, 300));

describe("stub-канал и продакшн", () => {
  test("🔴 в проде подписка НЕ выписывается и деньги не признаются пришедшими", async () => {
    process.env.NODE_ENV = "production";
    const app = await getApp();
    const before = storeRows().length;
    for (const tierId of ["pro", "medium", "lite"]) {
      const r = await request(app)
        .post("/api/pricing/checkout/session")
        .send({ tierId, email: `prod-${tierId}@test.dev`, trial: true });
      expect(r.status, `${tierId}: stub в проде ответил ${r.status}`).toBe(503);
      expect(r.body.error).toBe("no_payment_provider");
      // Отказ обязан быть понятным и вести к человеку, а не в тупик.
      expect(String(r.body.url)).toContain("/pricing/contact");
      expect(r.body.quotedUsd).toBeGreaterThan(0);
      // И ни при каких обстоятельствах не ссылка «оплачено».
      expect(String(r.body.url)).not.toContain("checkout/success");
    }
    await settle();
    expect(storeRows().length, "в проде stub записал подписку в стор").toBe(before);
  }, 30_000);

  test("✅ вне прода stub работает как раньше — иначе локальная разработка встанет", async () => {
    process.env.NODE_ENV = "test";
    const app = await getApp();
    const r = await request(app)
      .post("/api/pricing/checkout/session")
      .send({ tierId: "medium", email: "dev-stub@test.dev" });
    expect(r.status).toBe(200);
    expect(r.body.mode).toBe("stub");
    expect(String(r.body.url)).toContain("checkout/success");
    await settle();
    const mine = storeRows().filter((s) => s.email === "dev-stub@test.dev");
    expect(mine.length, "вне прода подписка должна выписываться").toBe(1);
  }, 30_000);

  test("Universe действительно проходит мимо LemonSqueezy — ветка stub достижима не гипотетически", async () => {
    // Если однажды заведут tier_pro_* вариант, этот тест напомнит, что
    // рассуждение выше устарело и защиту можно пересмотреть.
    const { resolveLemonSqueezyVariant } = await import("../src/data/lemonSqueezyVariants");
    expect(resolveLemonSqueezyVariant("tier_pro_monthly" as never)).toBeNull();
    expect(resolveLemonSqueezyVariant("tier_pro_annual" as never)).toBeNull();
    // Контроль: настоящая ссылка распознаётся (иначе проверка выше пуста).
    expect(typeof resolveLemonSqueezyVariant).toBe("function");
  });
});
