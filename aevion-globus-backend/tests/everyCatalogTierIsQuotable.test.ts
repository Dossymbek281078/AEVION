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
 * tierId="pro" отвечал 400 invalid_tier — то есть калькулятор ломался на самом
 * дорогом тарифе, «Universe» за $149/мес. Контроль: medium в том же запросе
 * давал 200.
 *
 * Это была ЧЕТВЁРТАЯ копия одного пропуска: pro путали с Lite в стене
 * (починено 22.07), в письме о покупке и в разборе ссылки заказа (31.08).
 * Поэтому список больше не перечисляется руками — он берётся из каталога, а
 * этот сторож следит, чтобы так и осталось.
 */
function приложение() {
  const a = express();
  a.use(express.json());
  a.use("/api/pricing", pricingRouter);
  return a;
}

describe("каждый тариф каталога считается", () => {
  const продаваемые = TIERS.map((t) => t.id);

  test("контроль охвата: тарифов в каталоге не меньше шести", () => {
    // Опустевший или переименованный TIERS сделал бы проверку ниже пустой
    // и молча зелёной.
    expect(продаваемые.length).toBeGreaterThanOrEqual(6);
    expect(продаваемые).toContain("pro");
  });

  test.each(продаваемые)("смета для тарифа %s не отклоняется", async (id) => {
    const res = await request(приложение())
      .post("/api/pricing/quote")
      .send({ tierId: id, period: "monthly", currency: "USD" });

    expect(
      res.body?.error,
      `каталог продаёт тариф ${id}, а расчёт сметы его не знает`,
    ).not.toBe("invalid_tier");
    expect(res.status).toBe(200);

    // 200 с НЕВЕРНОЙ суммой хуже отказа: отказ виден, неверная цена нет.
    // Цену берём из каталога, а не зашиваем — иначе сторож накажет за
    // законное изменение прайса вместо того, чтобы ловить расхождение.
    const изКаталога = TIERS.find((t) => t.id === id)?.priceMonthly;
    if (typeof изКаталога === "number") {
      expect(
        res.body?.total,
        `смета для ${id} разошлась с каталогом`,
      ).toBe(изКаталога);
    }
  });

  test("контроль: выдуманный тариф по-прежнему отклоняется", async () => {
    // Иначе «все тарифы принимаются» означало бы, что принимается что угодно.
    const res = await request(приложение())
      .post("/api/pricing/quote")
      .send({ tierId: "совершенно-другой", period: "monthly", currency: "USD" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_tier");
  });
});
