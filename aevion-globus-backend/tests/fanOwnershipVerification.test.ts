import { describe, test, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import jwt from "jsonwebtoken";

/**
 * 🔴 Веерную скидку на СПИСАНИЕ даёт сервер по своим данным, а не клиент по
 * заявлению.
 *
 * Повод — вычитка дифа 2026-07-26. `/checkout/session` брал `ownedModules` и
 * `lastPurchaseAt` прямо из тела и передавал в `buildQuoteWithFan`, а тот
 * уменьшал `quote.total`, то есть РЕАЛЬНОЕ списание. Прогон показал: анонимный
 * запрос с заявлением «я владею вот этими пятью соседями по кластеру» давал
 * Medium+3 модуля за **$59.35 вместо $76** (−$16.65, −22%). Ни авторизации, ни
 * сверки со стором на этом пути не было. Существующие тесты этого не ловили:
 * все они слали честное тело, а «честное тело» здесь и есть уязвимость.
 *
 * Тест держит ОБЕ половины: проверять только «атака не сработала» бессмысленно
 * — этому удовлетворяет и полностью выключенный веер.
 *
 * ВАЖНО про изоляцию: чекаут со stub-провайдером ПРОВИЖИНИТ подписку на каждый
 * вызов, то есть перезаписывает владение того email, который прислали. Первая
 * версия этого файла из-за общего адреса роняла три собственных теста — они
 * переписывали состояние друг другу. Поэтому у каждого теста свой адрес.
 */

const TMP = mkdtempSync(join(tmpdir(), "aevion-fanown-"));
process.env.SUBSCRIPTIONS_FILE = join(TMP, "subscriptions.jsonl");
process.env.AUTH_JWT_SECRET = "fan-ownership-test-secret-at-least-32-chars";
afterAll(() => rmSync(TMP, { recursive: true, force: true }));

/** Покупаем кластер docs-ip. */
const BUYING = ["qsign", "qright", "qcontract"];
/** Владение этими открывает веер на BUYING (соседи по кластерам). */
const NEIGHBOURS = ["aevion-ip-bureau", "qmaskcard", "qstore"];
/** Прайс Medium + три модуля, без единой скидки. Замерено, а не выведено. */
const LIST_PRICE_USD = 76;

let app: express.Express;
let provision: (args: Record<string, unknown>) => Promise<unknown>;

beforeAll(async () => {
  const { checkoutRouter } = await import("../src/routes/checkout");
  const prov = await import("../src/routes/provisioning");
  provision = prov.provisionSubscription as never;
  app = express();
  app.use(express.json());
  app.use("/api/pricing/checkout", checkoutRouter);
});

/** Заводит РЕАЛЬНОГО владельца через тот же провижининг, что и живая покупка. */
async function makeOwner(email: string) {
  await provision({ email, tierId: "medium", modules: NEIGHBOURS, source: "test" });
}

function post(body: Record<string, unknown>, auth?: string) {
  const r = request(app).post("/api/pricing/checkout/session");
  if (auth) r.set("Authorization", auth);
  return r.send({ tierId: "medium", modules: BUYING, ...body });
}

describe("веер на списании — только подтверждённое владение", () => {
  test("🔴 заявленное в теле владение НЕ даёт скидки", async () => {
    const r = await post({
      email: "claim@test.dev",
      ownedModules: [...NEIGHBOURS, "qpaynet-embedded", "qevents"],
      lastPurchaseAt: new Date().toISOString(),
    });
    expect(r.status).toBe(200);
    expect(r.body.fan.appliedUsd, "заявление в теле дало скидку на списание").toBe(0);
    expect(r.body.fan.status).toBe("inactive");
    expect(r.body.quotedUsd).toBe(LIST_PRICE_USD);
  });

  test("будущая дата в lastPurchaseAt не открывает окно", async () => {
    const r = await post({ email: "future@test.dev", lastPurchaseAt: "2999-01-01" });
    expect(r.body.fan.status).not.toBe("active");
    expect(r.body.fan.appliedUsd).toBe(0);
  });

  test("✅ РЕАЛЬНЫЙ владелец скидку получает — иначе проверки выше ничего не значат", async () => {
    await makeOwner("owner-email@test.dev");
    const r = await post({ email: "owner-email@test.dev" });
    expect(r.status).toBe(200);
    expect(r.body.fan.status, "веер не включился у настоящего владельца").toBe("active");
    expect(r.body.fan.appliedUsd).toBeGreaterThan(0);
    expect(r.body.fan.ownershipSource).toBe("email");
    // Скидка реально уменьшает списание, а не только показывается.
    expect(r.body.quotedUsd).toBeLessThan(LIST_PRICE_USD);
  });

  test("✅ владение подтягивается и по валидному JWT (без email в теле)", async () => {
    await makeOwner("owner-token@test.dev");
    const token = jwt.sign(
      { sub: "u1", email: "owner-token@test.dev" },
      process.env.AUTH_JWT_SECRET as string,
      { algorithm: "HS256" },
    );
    const r = await post({}, `Bearer ${token}`);
    expect(r.body.fan.status).toBe("active");
    expect(r.body.fan.ownershipSource).toBe("token");
    expect(r.body.fan.appliedUsd).toBeGreaterThan(0);
  });

  test("битый токен не роняет чекаут и не даёт веера", async () => {
    for (const h of ["Bearer", "Bearer ", "Bearer not.a.jwt", "Basic dXNlcjpwYXNz", "Bearer " + "x".repeat(3000)]) {
      const r = await post({}, h);
      expect(r.status, `заголовок "${h.slice(0, 20)}" дал ${r.status}`).toBe(200);
      expect(r.body.fan.appliedUsd).toBe(0);
    }
  });

  test("токен, подписанный ЧУЖИМ секретом, веера не даёт", async () => {
    await makeOwner("owner-forged@test.dev");
    const forged = jwt.sign({ email: "owner-forged@test.dev" }, "не-тот-секрет-но-достаточно-длинный-000", {
      algorithm: "HS256",
    });
    const r = await post({}, `Bearer ${forged}`);
    expect(r.body.fan.ownershipSource).toBe("none");
    expect(r.body.fan.appliedUsd).toBe(0);
  });

  test("аноним без email и токена платит прайс", async () => {
    const r = await post({});
    expect(r.body.fan.ownershipSource).toBe("none");
    expect(r.body.fan.appliedUsd).toBe(0);
    expect(r.body.quotedUsd).toBe(LIST_PRICE_USD);
  });

  test("адрес без покупок скидки не даёт, хотя формат верный", async () => {
    const r = await post({ email: "nobody-here@test.dev" });
    expect(r.body.fan.ownershipSource).toBe("email");
    expect(r.body.fan.appliedUsd).toBe(0);
  });
});
