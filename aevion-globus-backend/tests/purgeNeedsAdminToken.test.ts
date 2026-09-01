import { describe, test, expect, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Сторож: очистка подписок требует админский токен И НИЧЕГО НЕ УДАЛЯЕТ без него.
 *
 * ЗАЧЕМ. Эта ручка УДАЛЯЕТ записи о покупках — то есть лишает человека
 * оплаченного доступа. Замер 01.09.2026: её не звал НИ ОДИН тест, а мутация
 * «убрать проверку токена» не ловилась ничем (проверено против 25 файлов, где
 * упоминаются admin/purge/pricingRouter).
 *
 * Проверяется не только код ответа, но и ФАЙЛ: 401 без удаления и 401 с
 * удалением выглядят одинаково снаружи, а разница — в том, потерял ли человек
 * покупку.
 */
const каталог = mkdtempSync(join(tmpdir(), "aevion-purge-"));
const файл = join(каталог, "subscriptions.jsonl");
process.env.SUBSCRIPTIONS_FILE = файл;
// Латиница обязательна: HTTP-заголовок это ByteString, кириллица роняет запрос.
process.env.ADMIN_TOKEN = "test-admin-token-01092026";

const { pricingRouter } = await import("../src/routes/pricing");

function приложение() {
  const a = express();
  a.use(express.json());
  a.use("/api/pricing", pricingRouter);
  return a;
}

const ПОКУПКА = JSON.stringify({
  id: "sub_1", ts: new Date().toISOString(), email: "buyer@example.com",
  tierId: "medium", period: "monthly", seats: 1, modules: [], trialDays: 0,
  source: "test",
});

beforeEach(() => {
  writeFileSync(файл, ПОКУПКА + "\n", "utf8");
});

afterAll(() => {
  delete process.env.SUBSCRIPTIONS_FILE;
  delete process.env.ADMIN_TOKEN;
  try { rmSync(каталог, { recursive: true, force: true }); } catch { /* уже нет */ }
});

const записьНаМесте = () => readFileSync(файл, "utf8").includes("buyer@example.com");

describe("очистка подписок закрыта админским токеном", () => {
  test("КОНТРОЛЬ: с верным токеном очистка работает", async () => {
    // Иначе «без токена не удалило» означало бы, что не удаляет никогда.
    const res = await request(приложение())
      .post("/api/pricing/subscriptions/purge")
      .set("x-admin-token", process.env.ADMIN_TOKEN as string)
      .send({ email: "buyer@example.com" });

    expect(res.status).toBe(200);
    expect(res.body.removed, "с верным токеном ничего не удалилось").toBeGreaterThan(0);
    expect(записьНаМесте(), "запись должна была исчезнуть").toBe(false);
  });

  test("без токена — 401 и запись НА МЕСТЕ", async () => {
    const res = await request(приложение())
      .post("/api/pricing/subscriptions/purge")
      .send({ email: "buyer@example.com" });

    expect(res.status, "очистка сработала без токена").toBe(401);
    expect(записьНаМесте(), "без токена запись всё же удалена").toBe(true);
  });

  test("токен НЕ ЗАДАН в окружении — ручка закрывается, а не открывается", async () => {
    // Самая опасная ветка: «настройки нет» должно означать «нельзя», а не
    // «можно всем». Мутация этой строки не ловилась, пока тест всегда задавал
    // токен — то есть проверялась только половина решения.
    const сохранён = process.env.ADMIN_TOKEN;
    delete process.env.ADMIN_TOKEN;
    try {
      const res = await request(приложение())
        .post("/api/pricing/subscriptions/purge")
        .send({ email: "buyer@example.com" });

      expect(res.status, "при незаданном токене ручка открылась").toBe(401);
      expect(res.body.error).toBe("admin_token_not_configured");
      expect(записьНаМесте(), "при незаданном токене запись удалена").toBe(true);
    } finally {
      process.env.ADMIN_TOKEN = сохранён;
    }
  });

  test("с ЧУЖИМ токеном — 401 и запись на месте", async () => {
    const res = await request(приложение())
      .post("/api/pricing/subscriptions/purge")
      .set("x-admin-token", "sovsem-drugoi-token")
      .send({ email: "buyer@example.com" });

    expect(res.status, "принят чужой токен").toBe(401);
    expect(записьНаМесте(), "с чужим токеном запись удалена").toBe(true);
  });
});
