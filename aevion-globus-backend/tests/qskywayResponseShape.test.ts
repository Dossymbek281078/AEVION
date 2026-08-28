import { describe, test, expect } from "vitest";
import express from "express";
import request from "supertest";

import { qskywayRouter } from "../src/routes/qskyway";

/**
 * Сопутствующие поля ответа не исчезают молча.
 *
 * ПОВОД. 28.08.2026 я сводил одиннадцать копий отказа «неизвестный город» в
 * один общий ответ. Вместе с текстом там ехало `available` — список городов,
 * по которому клиент понимает, что предложить человеку. Не перенеси я его —
 * ничего бы не упало: ни один тест про текст этого не видит, `tsc` тоже
 * (объект собирается заново, а не сужается), и пропажа дошла бы до
 * пользователя.
 *
 * Замер того же дня: из 145 полей в ответах модуля 41 не упомянуто НИ В ОДНОМ
 * тесте. Все 41 закреплять смысла нет — часть внутренние, часть меняется по
 * делу. Здесь закреплены те, чья пропажа дорого стоит и незаметна:
 * дисклеймер (юридическая оговорка на каждом ответе), список городов при
 * отказе, и числа, на которых держится страница.
 *
 * Это НЕ проверка значений — только наличия. Значения проверяют соседние
 * тесты; здесь вопрос один: поле вообще доехало.
 */
function app() {
  const a = express();
  a.use(express.json());
  a.use("/api/qskyway", qskywayRouter);
  return a;
}

/** Поле есть и не пустое. `0` и `false` — законные значения, не «пусто». */
function present(body: Record<string, unknown>, key: string): boolean {
  const v = body?.[key];
  return v !== undefined && v !== null && v !== "";
}

describe("сопутствующие поля ответов QSkyway на месте", () => {
  test("отказ «неизвестный город» несёт список доступных", async () => {
    const res = await request(app()).get("/api/qskyway/city").query({ city: "щщщ-нет-такого" });
    expect(res.status).toBe(404);
    expect(Array.isArray(res.body?.available), "поле available исчезло").toBe(true);
    expect(res.body.available.length, "список городов пуст").toBeGreaterThan(0);
  });

  test("состояние модуля несёт дисклеймер", async () => {
    // Писал этот тест против /city и получил красное. Дефекта не было — была
    // моя догадка: дисклеймер живёт на /health. Оставляю след, потому что урок
    // общий: «поле пропало» и «я спросил не ту ручку» выглядят одинаково.
    const res = await request(app()).get("/api/qskyway/health");
    expect(res.status).toBe(200);
    // Юридическая оговорка «движок/PoC, не сертифицированное авиационное ПО».
    // Её пропажа превращает демонстрацию в заявление.
    expect(present(res.body, "disclaimer"), "дисклеймер исчез из ответа").toBe(true);
  });

  test("город отдаёт сетку", async () => {
    const res = await request(app()).get("/api/qskyway/city").query({ city: "astana" });
    expect(res.status).toBe(200);
    expect(present(res.body, "grid"), "сетка исчезла").toBe(true);
  });

  test("площадки отдают радиус и просвет, а не только имена", async () => {
    const res = await request(app()).get("/api/qskyway/vertiports").query({ city: "astana" });
    expect(res.status).toBe(200);
    const list = (res.body?.vertiports ?? []) as Array<Record<string, unknown>>;
    expect(list.length, "список площадок пуст").toBeGreaterThan(0);
    // Скоринг без этих двух чисел — просто список точек: человек не увидит,
    // ПОЧЕМУ площадка пригодна, а страница печатает их дословно.
    expect(present(list[0], "openRadiusM"), "openRadiusM исчез").toBe(true);
    expect(present(list[0], "clearanceM"), "clearanceM исчез").toBe(true);
  });
});
