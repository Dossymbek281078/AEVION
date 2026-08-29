import { describe, test, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

import { startupExchangeRouter } from "../src/routes/startupExchange";
import { __resetStartupExchangeDbState } from "../src/lib/ensureStartupExchangeTables";

/**
 * Запасной путь обязан НАЗЫВАТЬ себя.
 *
 * Дефект, ради которого написано: идея легла в Map, не переживёт перезапуск,
 * а ответ был неотличим от настоящего сохранения — включая contentHash, по
 * которому человек считает идею защищённой. Молчаливый отказ выглядит успехом.
 *
 * ПОЧЕМУ ПОВЕДЕНИЕМ, А НЕ ГРЕПОМ. Прежняя версия сторожа искала в исходнике
 * строку `storage: "db"`. 29.08.2026 при сведении с веткой биржи два пути
 * записи свелись в один помощник, хранилище стало приходить аргументом —
 * способность сохранилась, строка исчезла, сторож покраснел на верной правке.
 * Я переписал его на другой шаблон — и мутация показала, что он совпадает с
 * СОБСТВЕННОЙ подпоркой: `storage:` есть в сигнатуре, `"memory"` в типе.
 * То есть грепом этот класс не стережётся вовсе. Проверять надо ответ.
 */
describe("ответ называет, куда легла идея", () => {
  beforeEach(() => {
    __resetStartupExchangeDbState();
  });

  const app = () => {
    const a = express();
    a.use(express.json());
    a.use("/api/startupx", startupExchangeRouter);
    return a;
  };

  test("без базы ответ честно говорит memory, а не молчит", async () => {
    const res = await request(app())
      .post("/api/startupx/ideas")
      .send({
        title: "Проверка именования хранилища",
        description:
          // Уровню «Только идея» нужно не менее 120 символов описания
          // (model.ts, minDescription). Держим с запасом, чтобы тест не падал
          // от изменения порога на единицу.
          "Описание идеи достаточной длины, чтобы пройти проверку полей на " +
          "входе: уровню «Только идея» нужно не менее ста двадцати символов, " +
          "и здесь их заведомо больше, с запасом на изменение порога.",
        tier: "idea",
        // У каждого типа сделки своя обязательная пара чисел: для «raise»
        // это запрашиваемая сумма и доля. Без них заявка не принимается.
        deal: { intent: "raise", askUsd: 50000, equityOfferedPct: 10 },
      });

    expect(res.status, `неожиданный ответ: ${JSON.stringify(res.body).slice(0, 200)}`).toBe(201);
    const data = res.body?.data ?? res.body;
    expect(data.storage, "ответ не назвал хранилище — запасной путь неотличим от настоящего")
      .toBe("memory");
  });

  test("и не выдаёт запасной путь за настоящее сохранение", async () => {
    const res = await request(app())
      .post("/api/startupx/ideas")
      .send({
        title: "Вторая проверка",
        description:
          "Описание второй заявки, тоже с запасом по длине: уровню «Только " +
          "идея» нужно не менее ста двадцати символов, и здесь их больше, " +
          "чтобы проверка полей пропустила заявку.",
        tier: "idea",
        // У каждого типа сделки своя обязательная пара чисел: для «raise»
        // это запрашиваемая сумма и доля. Без них заявка не принимается.
        deal: { intent: "raise", askUsd: 50000, equityOfferedPct: 10 },
      });
    const data = res.body?.data ?? res.body;
    expect(data.storage).not.toBe("db");
  });
});
