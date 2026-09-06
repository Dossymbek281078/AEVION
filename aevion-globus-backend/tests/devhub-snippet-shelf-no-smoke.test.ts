import { describe, test, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

import { devhubRouter, __resetDevHubStore } from "../src/routes/devhub";

// Полка сниппетов — первое, что видит посетитель витрины /devhub.
// Замер 05.09.2026 на проде: все 22 записи публичной выдачи были мусором
// смоук-задач («console.log hello from smoke test»). Этот сторож закрепляет:
// служебные сниппеты (тег `smoke` / `smoke-*`) не попадают в выдачу по
// умолчанию, но ЯВНЫЙ запрос ?tag= их по-прежнему находит — иначе сломались
// бы сами смоук-проверки.
describe("публичная полка сниппетов не показывает смоук-мусор", () => {
  const app = express();
  app.use(express.json());
  app.use("/api/devhub", devhubRouter);

  beforeEach(() => {
    __resetDevHubStore();
  });

  async function post(title: string, tags: string[]) {
    const r = await request(app)
      .post("/api/devhub/snippets")
      .send({ title, content: "console.log(1)", language: "javascript", tags });
    expect(r.status, `создание «${title}» не удалось: ${JSON.stringify(r.body)}`).toBe(201);
  }

  test("смоук скрыт из выдачи по умолчанию, обычный сниппет виден", async () => {
    await post("Smoke snippet", ["smoke", "smoke-1787146831509"]);
    await post("Дебаунс на 10 строк", ["react"]);

    const r = await request(app).get("/api/devhub/snippets");
    expect(r.status).toBe(200);
    const titles = r.body.snippets.map((s: { title: string }) => s.title);
    expect(titles).toContain("Дебаунс на 10 строк");
    expect(titles, "смоук-мусор уехал на витрину").not.toContain("Smoke snippet");
  });

  test("явный ?tag=smoke по-прежнему находит служебные — смоук-задача не слепнет", async () => {
    await post("Smoke snippet", ["smoke", "smoke-1787146831509"]);

    const r = await request(app).get("/api/devhub/snippets").query({ tag: "smoke" });
    expect(r.status).toBe(200);
    expect(r.body.snippets.length, "смоук-проверка перестала видеть свою запись").toBeGreaterThan(0);
  });
});
