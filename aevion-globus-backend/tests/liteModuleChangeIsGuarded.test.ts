import { describe, test, expect, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Сторож: смена выбранного модуля у тарифа Lite.
 *
 * ЗАЧЕМ. Свип 01.09.2026 по денежным ручкам: из 43 маршрутов 5 меняют
 * состояние или закрыты доступом, и 3 из них не звал НИ ОДИН тест. Эта — среди
 * них, и она ближе всех к деньгам: человек выбирает, ЗА КАКОЙ продукт он
 * платит, и выбор пишется в тот же файл подписок.
 *
 * Отдельная причина проверить: утром я поменял поведение записи (отказ больше
 * не проглатывается), а эта ручка — один из шести её вызывающих. До сегодня
 * никто не подтверждал, что она вообще работает.
 */
const каталог = mkdtempSync(join(tmpdir(), "aevion-lite-"));
const файл = join(каталог, "subscriptions.jsonl");
process.env.SUBSCRIPTIONS_FILE = файл;
// Латиницей: секрет уходит в HTTP-заголовок, а это ByteString.
process.env.AUTH_JWT_SECRET = "test-jwt-secret-for-lite-module-01092026";

const { pricingRouter } = await import("../src/routes/pricing");

function приложение() {
  const a = express();
  a.use(express.json());
  a.use("/api/pricing", pricingRouter);
  return a;
}

const токен = (email: string) =>
  jwt.sign({ email, sub: email }, process.env.AUTH_JWT_SECRET as string, {
    algorithm: "HS256",
    expiresIn: "1h",
  });

function подписка(email: string, tierId: string) {
  return JSON.stringify({
    id: `sub_${tierId}`, ts: new Date().toISOString(), email, tierId,
    period: "monthly", seats: 1, modules: [], trialDays: 0, source: "test",
  });
}

beforeEach(() => {
  writeFileSync(файл, подписка("lite@example.com", "lite") + "\n"
                    + подписка("medium@example.com", "medium") + "\n", "utf8");
});

afterAll(() => {
  delete process.env.SUBSCRIPTIONS_FILE;
  delete process.env.AUTH_JWT_SECRET;
  try { rmSync(каталог, { recursive: true, force: true }); } catch { /* уже нет */ }
});

const вФайле = (что: string) => readFileSync(файл, "utf8").includes(что);

describe("смена выбранного модуля у Lite", () => {
  test("КОНТРОЛЬ: владелец Lite меняет модуль, и выбор СОХРАНЯЕТСЯ", async () => {
    // Без этого «чужому отказано» означало бы, что отказано всем.
    const res = await request(приложение())
      .post("/api/pricing/subscription/lite-module")
      .set("Authorization", `Bearer ${токен("lite@example.com")}`)
      .send({ moduleId: "qcontract" });

    expect(res.status, `ответ: ${JSON.stringify(res.body)}`).toBe(200);
    expect(res.body.module).toBe("qcontract");
    expect(вФайле("lite_module_change"), "выбор не записан в файл").toBe(true);
  });

  test("без токена — 401 и в файле ничего не изменилось", async () => {
    const res = await request(приложение())
      .post("/api/pricing/subscription/lite-module")
      .send({ moduleId: "qcontract" });
    expect(res.status).toBe(401);
    expect(вФайле("lite_module_change"), "запись появилась без токена").toBe(false);
  });

  test("выдуманный модуль — 400 и ничего не записано", async () => {
    const res = await request(приложение())
      .post("/api/pricing/subscription/lite-module")
      .set("Authorization", `Bearer ${токен("lite@example.com")}`)
      .send({ moduleId: "sovsem-vydumannyi-modul" });
    expect(res.status).toBe(400);
    expect(вФайле("lite_module_change"), "выдуманный модуль всё же записан").toBe(false);
  });

  test("владелец СТАРШЕГО тарифа сюда не ходит — 409, и тариф не понижен", async () => {
    // Иначе смена модуля превратилась бы в тихий переход на Lite.
    const res = await request(приложение())
      .post("/api/pricing/subscription/lite-module")
      .set("Authorization", `Bearer ${токен("medium@example.com")}`)
      .send({ moduleId: "qcontract" });

    expect(res.status).toBe(409);
    expect(вФайле("lite_module_change"), "тариф medium понижен сменой модуля").toBe(false);
  });
});
