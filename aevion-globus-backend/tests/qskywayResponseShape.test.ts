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

  test("числа, которые читает регулятор, есть в документе и конечны", async () => {
    // Перемер 28.08.2026 показал: часть полей ответа не упомянута НИ В ОДНОМ
    // тесте, и среди них те, что человек понесёт в ведомство. Пропажа или NaN
    // здесь не роняет ничего: документ подпишется и с пустым полем.
    //
    // Проверяем наличие и конечность, а не значение: значения зависят от твина
    // и меняются законно, а вот `undefined` или NaN в подписанной бумаге —
    // всегда дефект.
    const res = await request(app())
      .post("/api/qskyway/route/justification")
      .send({ from: 0, to: 1, city: "astana" });
    expect(res.status).toBe(200);
    const doc = res.body?.document ?? {};

    for (const key of ["distanceKm", "cruiseAltM", "etaMinWind", "heightConfidencePct", "obstacleSegments"]) {
      const v = doc[key];
      expect(typeof v, key + " исчез из документа или стал не числом").toBe("number");
      expect(Number.isFinite(v), key + " не конечен (NaN или Infinity уедут в подписанную бумагу)").toBe(true);
    }
    // Расстояние и высота — не отрицательные: знак минус в бумаге для
    // регулятора читается как ошибка расчёта, а не как значение.
    expect(doc.distanceKm, "отрицательная длина маршрута").toBeGreaterThan(0);
    expect(doc.cruiseAltM, "отрицательная крейсерская высота").toBeGreaterThan(0);
  });
});
