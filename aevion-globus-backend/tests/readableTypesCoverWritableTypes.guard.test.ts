import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import request from "supertest";

/*
 * 🔴 Утверждение: про каждый тип события, который мы ПРИНИМАЕМ на запись,
 * можно СПРОСИТЬ у читающей ручки.
 *
 * Повод 06.10.2026. Списка было два: пишущая ручка принимала `cta_click` и
 * `feature_use`, а `/by-type` знала семь типов и отвечала на них
 * `no_known_types`. Нажатия кнопок DevHub лежали в журнале, а спросить про них
 * было нечем — и это читалось как «144 человека вошли и ничего не нажали».
 *
 * Сторож идёт настоящим путём POST → журнал → GET и проверяет ТЕЛО: наличие
 * имени в списке само ничего не доказывает, доказывает посчитанное число.
 */
const каталог = mkdtempSync(join(tmpdir(), "aevion-types-"));
const файл = join(каталог, "events.jsonl");
process.env.EVENTS_FILE = файл;

beforeEach(() => {
  writeFileSync(файл, "");
});

afterAll(() => {
  rmSync(каталог, { recursive: true, force: true });
});

async function приложение() {
  const { eventsRouter } = await import("../src/routes/events");
  const app = express();
  app.use(express.json());
  app.use("/api/pricing/events", eventsRouter);
  return app;
}

describe("читающая ручка знает всё, что принимает пишущая", () => {
  it("🔴 нажатие кнопки записывается И считается по типу", async () => {
    const app = await приложение();
    for (const type of ["cta_click", "feature_use"]) {
      await request(app)
        .post("/api/pricing/events")
        .send({ type, sid: `с-${type}`, path: "/en/devhub" })
        .expect(204);
    }

    const день = new Date().toISOString().slice(0, 10);
    const r = await request(app).get(
      `/api/pricing/events/by-type?types=cta_click,feature_use&day=${день}`,
    );
    expect(r.status, "читающая ручка не знает типа, который сама же приняла").toBe(200);
    expect(r.body.поТипу.cta_click.всего).toBe(1);
    expect(r.body.поТипу.feature_use.всего).toBe(1);
  });

  it("🔴 ни один принимаемый тип не отвечает «no_known_types»", async () => {
    const app = await приложение();
    const { ALLOWED_TYPES } = await import("../src/routes/events");
    const все = [...ALLOWED_TYPES].join(",");
    const r = await request(app).get(`/api/pricing/events/by-type?types=${все}`);
    expect(r.status, `непринимаемых для вопроса типов: ${r.body?.known?.length}`).toBe(200);
  });

  it("КОНТРОЛЬ: выдуманный тип по-прежнему отвергается, а не считается", async () => {
    // Иначе «знает всё» выродилось бы в «принимает что попало», и опечатка в
    // имени события тихо дала бы свой столбец с нулём.
    const app = await приложение();
    const r = await request(app).get("/api/pricing/events/by-type?types=выдуманный_тип");
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("no_known_types");
  });

  it("КОНТРОЛЬ: пишущая ручка тоже отвергает выдуманный тип", async () => {
    const app = await приложение();
    await request(app)
      .post("/api/pricing/events")
      .send({ type: "выдуманный_тип", sid: "с", path: "/" })
      .expect(400);
  });
});
