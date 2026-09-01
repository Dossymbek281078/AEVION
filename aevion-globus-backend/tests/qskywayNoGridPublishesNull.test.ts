import { describe, test, expect } from "vitest";
import express from "express";
import request from "supertest";
import { qskywayRouter } from "../src/routes/qskyway";

/**
 * Город без сетки потолков отвечает null, а не нулями.
 *
 * ПОВОД — непоследовательность внутри ОДНОГО литерала. В ответе маршрута
 * рядом стояли честные `compliant: null`, `lowestCeilingM: null` и четыре
 * нуля: coveragePct, exceedingSegments, zeroCeilingSegments, maxExceedanceM.
 * О неопределённости думали, но для одного поля из пяти.
 *
 * И хуже: `airspaceSummary` в соседнем файле на тот же вопрос уже отвечал
 * null. Два наших ответа об одном спорили. Читатель поверил бы тому, что
 * ближе к делу, — ответу маршрута, то есть неверному.
 *
 * Направление лжи здесь ЛЬСТИВОЕ: «превышений потолка 0» успокаивает, а
 * правда в том, что потолков мы не знаем и не проверяли ничего.
 */
function app() {
  const a = express();
  a.use(express.json());
  a.use("/api/qskyway", qskywayRouter);
  return a;
}

const NUMERIC = ["coveragePct", "exceedingSegments", "zeroCeilingSegments", "maxExceedanceM"] as const;

describe("нет сетки потолков — нет и чисел о ней", () => {
  test("Астана: четыре поля null, а не 0", async () => {
    const res = await request(app()).post("/api/qskyway/route").send({ from: 0, to: 3, city: "astana" });
    expect(res.status).toBe(200);
    const a = res.body?.airspace;
    // Контроль: убеждаемся, что попали именно в случай «сетки нет».
    expect(a?.available, "у Астаны появилась сетка — проверка смотрит не на тот случай").toBe(false);

    for (const k of NUMERIC) {
      expect(a[k], k + " = " + JSON.stringify(a[k]) + " (ожидался null: числа тут нет)").toBeNull();
    }
  });

  test("NYC: там же стоят настоящие числа", async () => {
    // Иначе починку можно было бы «сделать», вернув null всегда.
    const res = await request(app()).post("/api/qskyway/route").send({ from: 0, to: 3, city: "nyc" });
    expect(res.status).toBe(200);
    const a = res.body?.airspace;
    expect(a?.available, "у NYC сетка есть, ответ обязан быть по существу").toBe(true);
    expect(typeof a.coveragePct, "coveragePct обязан быть числом там, где сетка есть").toBe("number");
  });

  test("два наших ответа об одном не спорят", async () => {
    // Сводный ответ и ответ маршрута описывают одно и то же покрытие.
    const route = await request(app()).post("/api/qskyway/route").send({ from: 0, to: 3, city: "astana" });
    const city = await request(app()).get("/api/qskyway/city").query({ city: "astana" });
    const fromRoute = route.body?.airspace?.coveragePct ?? null;
    const fromCity = city.body?.airspaceSummary?.coveragePct ?? null;
    expect(fromRoute, "ответ маршрута").toBeNull();
    expect(fromCity, "сводный ответ").toBeNull();
  });
});
