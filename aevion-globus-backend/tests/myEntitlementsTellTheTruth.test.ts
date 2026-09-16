import { describe, test, expect, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Сторож: «что мне доступно» говорит правду о том, за что человек заплатил.
 *
 * ЗАЧЕМ. Эту ручку читает кабинет покупателя. Замер 01.09.2026: её не звал НИ
 * ОДИН тест — как и две соседние (/paywall/policy, /paywall/funnel). Соврёт
 * она в любую сторону — и это увидит именно тот, кто заплатил: либо «доступа
 * нет» у оплатившего, либо обещание доступа у того, кто не платил.
 *
 * Проверяется ПАРА: заплативший видит доступ, не заплативший не видит. По
 * отдельности каждое утверждение проходит и на сломанном коде — «всё доступно»
 * или «ничего не доступно» выглядят зелёными, если спрашивать одну сторону.
 */
const каталог = mkdtempSync(join(tmpdir(), "aevion-ent-"));
const файл = join(каталог, "subscriptions.jsonl");
process.env.SUBSCRIPTIONS_FILE = файл;
// Латиницей: секрет уходит в HTTP-заголовок, а это ByteString.
process.env.AUTH_JWT_SECRET = "test-jwt-secret-entitlements-01092026";

const { entitlementsRouter } = await import("../src/routes/entitlements");
const { MODULES_PRICING } = await import("../src/data/pricing");

function приложение() {
  const a = express();
  a.use(express.json());
  a.use("/api", entitlementsRouter);
  return a;
}

const токен = (email: string) =>
  jwt.sign({ email, sub: email }, process.env.AUTH_JWT_SECRET as string, {
    algorithm: "HS256",
    expiresIn: "1h",
  });

beforeEach(() => {
  writeFileSync(файл, JSON.stringify({
    id: "sub_paid", ts: new Date().toISOString(), email: "paid@example.com",
    tierId: "medium", termMonths: 3, seats: 1, modules: [], trialDays: 0,
    source: "test",
  }) + "\n", "utf8");
});

afterAll(() => {
  delete process.env.SUBSCRIPTIONS_FILE;
  delete process.env.AUTH_JWT_SECRET;
  try { rmSync(каталог, { recursive: true, force: true }); } catch { /* уже нет */ }
});

async function права(email?: string) {
  const req = request(приложение()).get("/api/me/entitlements");
  if (email) req.set("Authorization", `Bearer ${токен(email)}`);
  return req;
}

describe("«что мне доступно» говорит правду", () => {
  test("оплативший срок medium видит доступ всей планеты и закрытый модуль", async () => {
    // С 15.09.2026 любой срок — доступ ко всей планете: ручка отдаёт канонический
    // план full (срок в месяцах живёт в записи подписки, а не в этом ответе).
    const res = await права("paid@example.com");
    expect(res.status).toBe(200);
    expect(res.body.plan, "оплатил срок medium, а ручка не признаёт платный план").toBe("full");

    const мультичат = (res.body.modules ?? []).find(
      (m: { module: string }) => m.module === "multichat-engine",
    );
    expect(мультичат, "модуля нет в ответе — проверять нечего").toBeTruthy();
    expect(мультичат.entitled, "заплатил, а доступ не показан").toBe(true);
  });

  test("не заплативший НЕ видит доступа к тому же модулю", async () => {
    // Вторая половина пары: без неё «доступ показан» проходило бы и на коде,
    // который показывает доступ всем.
    const res = await права("nobody@example.com");
    expect(res.status).toBe(200);
    expect(res.body.plan).toBe("free");

    const мультичат = (res.body.modules ?? []).find(
      (m: { module: string }) => m.module === "multichat-engine",
    );
    expect(мультичат.entitled, "не платил, а доступ обещан").toBe(false);
  });

  test("без токена ручка отвечает, но доступа не обещает", async () => {
    // Она публичная по замыслу: кабинет зовёт её и до входа.
    const res = await права();
    expect(res.status).toBe(200);
    expect(res.body.plan).toBe("free");
    // Бесплатные модули анонимному доступны ЗАКОННО — те, что каталог включает во free.
    // requiredTiers ручки канонические и без free (lite сведён к full), поэтому
    // «закрытый» берём ИЗ КАТАЛОГА: модуль, которого нет во free.
    const бесплатные = new Set(MODULES_PRICING.filter((m) => m.includedIn.includes("free")).map((m) => m.id));
    expect(бесплатные.size, "контроль: бесплатные модули в каталоге есть").toBeGreaterThan(0);
    const закрытыеСДоступом = (res.body.modules ?? []).filter(
      (m: { module: string; entitled: boolean }) => m.entitled && !бесплатные.has(m.module),
    );
    // Контроль: бесплатные модули анонимному действительно открыты — иначе «ничего
    // не открыто» проходило бы и на коде, закрывающем всё.
    expect((res.body.modules ?? []).filter((m: { module: string; entitled: boolean }) => m.entitled && бесплатные.has(m.module)).length).toBe(бесплатные.size);
    expect(
      закрытыеСДоступом.map((m: { module: string }) => m.module),
      "анонимному обещан доступ к платному модулю",
    ).toEqual([]);
  });
});
