import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import express from "express";
import { qventureRouter } from "../src/routes/qventure";

/**
 * Бизнес-план не уходит в публичный отчёт QVenture.
 *
 * `StoredAnalysis.input` — присланный предпринимателем план. Комментарий у поля
 * говорит: «business plans are confidential and analyses are public by default»,
 * и снимается он функцией `redactInput()` (типизированной через
 * `Omit<StoredAnalysis, "input">`, то есть под контролем компилятора — это
 * сделано хорошо).
 *
 * Но аудит 28.07 признал ручку чистой ЧТЕНИЕМ, а за тот же день чтение дважды
 * оказалось слабее мутации: тест на вспомогательной функции проходил полностью,
 * когда её просто перестали вызывать. Здесь на кону не внутренний идентификатор,
 * а конфиденциальный документ чужого бизнеса.
 *
 * Тест идёт НАСТОЯЩИМ путём: сначала `POST /analyze` (он и сохраняет запись),
 * затем публичные `GET /analyses` и `GET /analyses/:id`. Postgres не нужен —
 * без него запись живёт в памяти модуля.
 */

const PLAN = "СЕКРЕТНЫЙ-ПЛАН-МАРКЕР-" + "деталь".repeat(12);
let app: express.Express;
let id: string;

beforeAll(async () => {
  app = express();
  app.use(express.json());
  app.use("/api/qventure", qventureRouter);
  const res = await request(app).post("/api/qventure/analyze").send({
    name: "Компания для проверки",
    sector: "saas",
    stage: "seed",
    description: PLAN,
  });
  expect(res.status, "не удалось создать анализ — остальные проверки были бы про пустоту").toBe(200);
  id = res.body.data.id as string;
  expect(id).toBeTruthy();
});

describe("публичный отчёт QVenture не содержит присланный план", () => {
  it("ответ на сам /analyze уже без плана", async () => {
    // Автор своего плана и так знает, но ответ этой ручки кладётся в отчёт,
    // поэтому плана в нём быть не должно уже здесь.
    const res = await request(app).post("/api/qventure/analyze").send({
      name: "Ещё одна", sector: "saas", stage: "seed", description: PLAN,
    });
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body), "план вернулся в ответе /analyze").not.toContain(PLAN);
    expect(res.body.data).not.toHaveProperty("input");
  });

  it("публичная карточка анализа не содержит плана", async () => {
    const res = await request(app).get(`/api/qventure/analyses/${encodeURIComponent(id)}`);
    expect(res.status).toBe(200);
    // Полезная часть на месте.
    expect(res.body.data.name).toBe("Компания для проверки");
    expect(res.body.data.verdict).toBeTruthy();
    // А плана нет — ни полем, ни вложенным.
    expect(res.body.data).not.toHaveProperty("input");
    expect(JSON.stringify(res.body), "план утёк в публичной карточке анализа").not.toContain(PLAN);
  });

  it("список анализов не содержит плана", async () => {
    const res = await request(app).get("/api/qventure/analyses?limit=50");
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain(PLAN);
    for (const item of res.body.data as Array<Record<string, unknown>>) {
      expect(item).not.toHaveProperty("input");
    }
  });

  it("PDF отчёта не печатает план", async () => {
    // Хуже утечки в JSON: PDF скачивают и передают дальше.
    const res = await request(app).get(`/api/qventure/analyses/${encodeURIComponent(id)}/pdf`);
    expect(res.status).toBe(200);
    const body = res.body instanceof Buffer ? res.body.toString("latin1") : String(res.text ?? "");
    // Кириллица в PDF кодируется, поэтому ищем и латинскую часть маркера —
    // она в поток попала бы как есть.
    expect(body).not.toContain("МАРКЕР");
    expect(body.includes(PLAN)).toBe(false);
  });
});
