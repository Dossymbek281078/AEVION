// Пределы на формах заявок обходились ОДНИМ заголовком.
//
// НАЙДЕНО 27.08.2026. В routes/pricing.ts ключ ограничителя брался так:
//
//     const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]
//                ?.trim() || req.ip || "unknown";
//
// Прокси дописывает свой адрес СПРАВА, поэтому ЛЕВОЕ значение пишет сам
// вызывающий. Меняя заголовок от запроса к запросу, любой получал свежее окно
// каждый раз — предел «5 обращений за 10 минут» не ограничивал ничего.
//
// Так было во ВСЕХ СЕМИ местах файла, и все семь — ключи ограничителей:
// заявка (/lead), подписка на рассылку (/newsletter) и три программы
// (партнёрская, партнёры, образование) в двух вариантах каждая.
//
// Цена вопроса не абстрактная: сюда приходят адреса для рассылки, а у почты
// жёсткий суточный потолок. Поток заявок выжигает и список, и квоту.
//
// Тест шлёт ЗАВЕДОМО НЕГОДНОЕ тело: ограничитель считает запрос до разбора
// тела, а валидация отбивает его до единой записи на диск.

import { describe, expect, it } from "vitest";
import request from "supertest";
import express from "express";
import { pricingRouter } from "../src/routes/pricing";

const app = () => {
  const a = express();
  a.use(express.json());
  a.use("/api/pricing", pricingRouter);
  return a;
};

/** Негодное тело: до записи дело не дойдёт ни при каком исходе. */
const JUNK = { name: "", email: "" };

async function post(path: string, xff: string | null) {
  const req = request(app()).post(path).send(JUNK);
  if (xff !== null) req.set("X-Forwarded-For", xff);
  return req;
}

describe("подделка X-Forwarded-For не даёт свежее окно", () => {
  it("контроль: первое обращение проходит ограничитель", async () => {
    const r = await post("/api/pricing/lead", null);
    // 400 — тело негодное, но ограничитель пропустил. Именно это и нужно:
    // если бы здесь был 429, весь тест ниже ничего не доказывал бы.
    expect(r.status).toBe(400);
  });

  it("шесть обращений с РАЗНЫМИ заголовками упираются в предел", async () => {
    // Предел — 5 за 10 минут. До правки шесть разных заголовков давали шесть
    // разных ключей, и 429 не наступал никогда.
    const codes: number[] = [];
    for (let i = 0; i < 8; i++) {
      const r = await post("/api/pricing/lead", `10.0.0.${i}, 203.0.113.9`);
      codes.push(r.status);
    }
    expect(codes, `коды: ${codes.join(", ")}`).toContain(429);
  });

  it("предел общий и для рассылки", async () => {
    const codes: number[] = [];
    for (let i = 0; i < 8; i++) {
      const r = await post("/api/pricing/newsletter", `10.1.0.${i}`);
      codes.push(r.status);
    }
    expect(codes, `коды: ${codes.join(", ")}`).toContain(429);
  });

  it("предел общий и для партнёрской программы", async () => {
    const codes: number[] = [];
    for (let i = 0; i < 8; i++) {
      const r = await post("/api/pricing/affiliate/apply", `10.2.0.${i}`);
      codes.push(r.status);
    }
    expect(codes, `коды: ${codes.join(", ")}`).toContain(429);
  });
});

describe("ограничитель не превратился в общий на всех", () => {
  it("исходник больше не читает ЛЕВОЕ значение заголовка", async () => {
    // Проверка по тексту здесь уместна: она стережёт не поведение (его
    // стерегут тесты выше), а возврат конкретной формулы, которую легко
    // вписать обратно «для определения страны».
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(
      new URL("../src/routes/pricing.ts", import.meta.url),
      "utf8",
    );
    // Контроль самого детектора: он обязан находить эту форму, когда она есть.
    const sample =
      'const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]';
    expect(sample).toMatch(/x-forwarded-for"\] as string\)\?\.split/);
    expect(src).not.toMatch(/x-forwarded-for"\] as string\)\?\.split/);
  });
});
