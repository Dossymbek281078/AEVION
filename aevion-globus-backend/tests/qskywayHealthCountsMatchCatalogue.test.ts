import { describe, test, expect } from "vitest";
import request from "supertest";
import express from "express";
import { qskywayRouter } from "../src/routes/qskyway";

/**
 * Счётчики каталога в `/health` совпадают с тем, что модуль реально отдаёт.
 *
 * ПОВОД (29.08.2026). Мутация показала, что их не проверяет никто — ни в
 * одну сторону:
 *
 *   vertiports -> 99   не поймана
 *   vertiports -> 0    не поймана
 *
 * Обе выжили, значит это не ловушка «значение заменено собой»: 0 и 99 не
 * могут оба быть правдой. Поле просто без сторожа.
 *
 * Замер: `/health` отдаёт vertiports=7, buildings=475; `/city` отдаёт
 * массивы той же длины.
 *
 * ЧЕМ СВЕРЯЕМ. Не константой, а ВТОРЫМ НАШИМ ОТВЕТОМ. Число в здоровье
 * читают как охват платформы («в городе семь площадок»), а работает
 * человек со списком из `/city`. Расходятся они — врёт одно из двух, и
 * узнать об этом лучше здесь, чем от того, кто не нашёл седьмую площадку.
 *
 * Этот приём в модуле уже дал семь находок за одно окно: у поля, которое
 * читает человек, почти всегда есть сосед про то же самое, и спорят они
 * тихо. Константу же закреплять нельзя — города пополняются, и сторож
 * краснел бы на пополнении каталога.
 */
const app = express();
app.use(express.json());
app.use("/api/qskyway", qskywayRouter);

describe("здоровье и каталог говорят одно и то же", () => {
  test("vertiports и buildings совпадают с массивами из /city", async () => {
    const h = await request(app).get("/api/qskyway/health");
    const c = await request(app).get("/api/qskyway/city");
    expect(h.status).toBe(200);
    expect(c.status).toBe(200);

    const vp = c.body.vertiports as unknown[];
    const bl = c.body.buildings as unknown[];

    // Отрицательный контроль: на пустых массивах совпадение «ноль с
    // нулём» выполнилось бы само собой и ничего бы не значило.
    expect(Array.isArray(vp) && vp.length > 0, "/city не отдал площадок — сверять не с чем").toBe(true);
    expect(Array.isArray(bl) && bl.length > 0, "/city не отдал зданий — сверять не с чем").toBe(true);

    expect(
      h.body.vertiports,
      "здоровье обещает площадок " + h.body.vertiports + ", а каталог отдаёт " + vp.length,
    ).toBe(vp.length);
    expect(
      h.body.buildings,
      "здоровье обещает зданий " + h.body.buildings + ", а каталог отдаёт " + bl.length,
    ).toBe(bl.length);
  }, 60000);
});
