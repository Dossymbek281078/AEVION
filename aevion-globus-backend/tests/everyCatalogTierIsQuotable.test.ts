import { describe, test, expect } from "vitest";
import express from "express";
import request from "supertest";
import { pricingRouter } from "../src/routes/pricing";
import { TIERS } from "../src/data/pricing";

/**
 * Храповик: тариф, который каталог ПРОДАЁТ, обязан приниматься расчётом сметы.
 *
 * ЗАЧЕМ. Список допустимых тарифов был переписан руками в трёх местах и
 * разошёлся с каталогом. Замер на проде 01.09.2026: /api/pricing отдавал шесть
 * тарифов (витрина рисует кнопку для каждого), а POST /api/pricing/quote с
 * tierId="pro" отвечал 400 invalid_tier — калькулятор ломался на самом дорогом
 * тарифе. Контроль: medium в том же запросе давал 200.
 *
 * С 15.09.2026 тариф — это срок (lite 1 мес … max 12), оплата за весь срок вперёд:
 * смета тарифа без добавок обязана равняться платежу за срок (priceTermTotal), а не
 * цене одного месяца. Список больше не перечисляется руками — он берётся из каталога.
 */
function приложение() {
  const a = express();
  a.use(express.json());
  a.use("/api/pricing", pricingRouter);
  return a;
}

describe("каждый тариф каталога считается", () => {
  const продаваемые = TIERS.map((t) => t.id);

  test("контроль охвата: тарифов в каталоге не меньше семи, включая max", () => {
    // Опустевший или переименованный TIERS сделал бы проверку ниже пустой
    // и молча зелёной.
    expect(продаваемые.length).toBeGreaterThanOrEqual(7);
    expect(продаваемые).toContain("pro");
    expect(продаваемые).toContain("max");
  });

  test.each(продаваемые)("смета для тарифа %s не отклоняется", async (id) => {
    const res = await request(приложение())
      .post("/api/pricing/quote")
      .send({ tierId: id, currency: "USD" });

    expect(
      res.body?.error,
      `каталог продаёт тариф ${id}, а расчёт сметы его не знает`,
    ).not.toBe("invalid_tier");
    expect(res.status).toBe(200);

    // 200 с НЕВЕРНОЙ суммой хуже отказа: отказ виден, неверная цена нет.
    // Цену берём из каталога, а не зашиваем — иначе сторож накажет за
    // законное изменение прайса вместо того, чтобы ловить расхождение.
    const tier = TIERS.find((t) => t.id === id)!;
    if (typeof tier.priceTermTotal === "number") {
      expect(
        res.body?.total,
        `смета для ${id} разошлась с каталогом: платёж за срок ${tier.priceTermTotal}`,
      ).toBe(tier.priceTermTotal);
    }
  });

  test("КОНТРОЛЬ: на сроке длиннее месяца смета — не цена одного месяца", async () => {
    // Иначе сравнение выше проходило бы на расчёте, который забыл умножить на срок,
    // если бы у всех тарифов срок был один месяц.
    const max = TIERS.find((t) => t.id === "max")!;
    expect(max.termMonths).toBeGreaterThan(1);
    const res = await request(приложение()).post("/api/pricing/quote").send({ tierId: "max", currency: "USD" });
    expect(res.body?.total).not.toBe(max.priceMonthly);
  });

  test("контроль: выдуманный тариф по-прежнему отклоняется", async () => {
    // Иначе «все тарифы принимаются» означало бы, что принимается что угодно.
    const res = await request(приложение())
      .post("/api/pricing/quote")
      .send({ tierId: "совершенно-другой", currency: "USD" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_tier");
  });
});
