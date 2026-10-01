/*
 * Пустое тело больше не создаёт проверку личности.
 *
 * 🔴 Замер на проде 01.10.2026: POST /api/bureau/verify/start без единого
 * заголовка и с ПУСТЫМ телом отвечал 201 и вставлял строку в
 * "BureauVerification"; у анонима userId и email остаются null. К этому дню в
 * таблице накопилось 126 проверок в состоянии pending, и разделить среди них
 * наши прогоны, ботов и живых людей уже невозможно — у строки нет ни имени, ни
 * адреса, ни владельца.
 *
 * Проверка идёт ЗАПРОСОМ к ручке через тот же роутер, что в проде.
 */
import { describe, expect, it } from "vitest";
import request from "supertest";
import express from "express";
import { bureauRouter } from "../src/routes/bureau";

function приложение() {
  const app = express();
  app.use(express.json());
  app.use("/api/bureau", bureauRouter);
  return app;
}

describe("анонимная запись проверки требует смысла", () => {
  it("пустое тело — 400, а не 201", async () => {
    const r = await request(приложение()).post("/api/bureau/verify/start").send({});
    expect(r.status, "пустое тело снова создаёт запись").toBe(400);
    expect(r.body.error).toBe("declared_name_required");
  });

  it("имя из пробелов — тоже 400", async () => {
    const r = await request(приложение()).post("/api/bureau/verify/start").send({ declaredName: "   " });
    expect(r.status).toBe(400);
  });

  it("контроль: с именем запрос НЕ отбивается этой проверкой", async () => {
    /*
     * Без контроля сторож был бы зелёным и у ручки, которая отвечает 400 всем
     * подряд, — то есть у сломанной. Базы в тесте нет, поэтому дальше запрос
     * честно падает на вставке; важно, что падает НЕ на нашей проверке.
     */
    const r = await request(приложение())
      .post("/api/bureau/verify/start")
      .send({ declaredName: "Иван Петров", declaredCountry: "KZ" });
    expect(r.status, "имя названо, а ручка всё равно отбивает по форме").not.toBe(400);
  });
});
