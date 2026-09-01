import { describe, test, expect, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Сторож: ручка состояния кассы отражает НАСТОЯЩЕЕ окружение, а не выдумку.
 *
 * ЗАЧЕМ. Этой ручкой пользуются как ПРИБОРОМ — в том числе я сам 01.09.2026:
 * на её ответе построил вывод «токен Gumroad задан, значит дверь охраняется» и
 * «тенге не настроен». Замер в тот же день: мутация «отвечать всегда
 * настроена» НЕ ловилась ни одним из 39 файлов, где упоминаются healthz,
 * checkout или gumroad.
 *
 * То есть прибор мог врать в обе стороны, а вывод по нему звучал бы так же
 * уверенно.
 *
 * Проверяется СОГЛАСИЕ двух наших ответов: что ручка объявляет настроенным —
 * то и должно быть задано в окружении. Значения переменных НЕ печатаются и не
 * сравниваются, только факт наличия.
 */
// У каждой кассы СВОЙ набор переменных, и «настроена» требует их все.
// Имена взяты из кода (isPayboxConfigured / isPaypalConfigured), а не угаданы:
// первая версия этого теста задавала по одной и честно падала.
const ПЕРЕМЕННЫЕ: Record<string, string[]> = {
  gumroad: ["GUMROAD_ACCESS_TOKEN"],
  paybox: ["PAYBOX_MERCHANT_ID", "PAYBOX_SECRET"],
  paypal: ["PAYPAL_CLIENT_ID", "PAYPAL_SECRET"],
};
const ВСЕ = Object.values(ПЕРЕМЕННЫЕ).flat();

const { checkoutRouter } = await import("../src/routes/checkout");

function приложение() {
  const a = express();
  a.use(express.json());
  a.use("/api/pricing/checkout", checkoutRouter);
  return a;
}

const сохранено: Record<string, string | undefined> = {};
beforeEach(() => {
  for (const п of ВСЕ) сохранено[п] = process.env[п];
});
afterAll(() => {
  for (const [п, з] of Object.entries(сохранено)) {
    if (з === undefined) delete process.env[п];
    else process.env[п] = з;
  }
});

async function состояние() {
  const res = await request(приложение()).get("/api/pricing/checkout/healthz");
  expect(res.status).toBe(200);
  return res.body.providers ?? {};
}

describe("состояние кассы совпадает с окружением", () => {
  test("КОНТРОЛЬ: ручка вообще перечисляет кассы", async () => {
    const п = await состояние();
    expect(Object.keys(п).length, "список касс пуст — проверять нечего")
      .toBeGreaterThanOrEqual(3);
  });

  test("ПУСТОЕ окружение — ни одна касса не объявлена настроенной", async () => {
    for (const п of ВСЕ) delete process.env[п];
    const п = await состояние();
    const соврала = Object.entries(ПЕРЕМЕННЫЕ)
      .filter(([имя]) => п[имя]?.configured === true)
      .map(([имя]) => имя);
    expect(соврала, "переменной нет, а касса объявлена настроенной").toEqual([]);
  });

  test("ЗАДАННОЕ окружение — касса объявлена настроенной", async () => {
    // Вторая половина пары: без неё «не соврала» проходило бы и на коде,
    // который всегда отвечает «не настроена».
    for (const п of ВСЕ) process.env[п] = "x-not-a-real-secret";
    const п = await состояние();
    const промолчала = Object.entries(ПЕРЕМЕННЫЕ)
      .filter(([имя]) => п[имя]?.configured !== true)
      .map(([имя]) => имя);
    expect(промолчала, "переменная задана, а касса не объявлена настроенной").toEqual([]);
  });
});
