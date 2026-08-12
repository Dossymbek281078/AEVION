// Список уроков Kids AI: сколько их всего и сколько показано.
//
// Ответ отдаёт поле `total`, а считается оно по УЖЕ ОБРЕЗАННОМУ списку:
// сначала `list = list.slice(0, limit)`, потом `total: list.length`. То есть
// при сорока уроках и `limit=20` ответ говорит «всего 20». Клиент, который
// рисует «показано 20 из 20», не покажет кнопку «дальше» — половина каталога
// становится недостижимой, и признака этого нет: код 200, поле на месте,
// число выглядит окончательным.
//
// В ветке с базой то же самое в более коварном виде: `rows.rowCount` — это
// количество ВЕРНУВШИХСЯ строк, а не совпавших в таблице, а запрос идёт с
// LIMIT.

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";

import { kidsAiContentRouter } from "../src/routes/kidsAiContent";
import { KIDS_AI_SEED_LESSONS } from "../src/data/kidsAiSeed";

let app: express.Express;
let prevDbUrl: string | undefined;

beforeEach(() => {
  prevDbUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL; // ветка в памяти
  app = express();
  app.use(express.json());
  app.use("/api/kids-ai", kidsAiContentRouter);
});

afterEach(() => {
  if (prevDbUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = prevDbUrl;
});

describe("Kids AI — список уроков", () => {
  test("total — сколько уроков всего, а не сколько уместилось на странице", async () => {
    const limit = 5;
    expect(KIDS_AI_SEED_LESSONS.length).toBeGreaterThan(limit); // иначе тест ничего не мерит

    const r = await request(app).get(`/api/kids-ai/lessons?limit=${limit}`);

    expect(r.status).toBe(200);
    expect(r.body.lessons).toHaveLength(limit);
    expect(r.body.total).toBe(KIDS_AI_SEED_LESSONS.length);
  });

  test("фильтр сужает и список, и total — считать надо после фильтра", async () => {
    const lang = KIDS_AI_SEED_LESSONS[0].language;
    const expected = KIDS_AI_SEED_LESSONS.filter((l) => l.language === lang).length;

    const r = await request(app).get(`/api/kids-ai/lessons?lang=${encodeURIComponent(lang)}&limit=2`);

    expect(r.status).toBe(200);
    // total обязан отвечать на вопрос «сколько подходит под фильтр», иначе
    // фильтр выглядит сломанным: показано 2, а всего якобы тоже 2.
    expect(r.body.total).toBe(expected);
    expect(r.body.lessons.length).toBeLessThanOrEqual(2);
  });

  test("без limit показаны все — total совпадает с длиной списка", async () => {
    const r = await request(app).get("/api/kids-ai/lessons?limit=500");

    expect(r.status).toBe(200);
    expect(r.body.total).toBe(KIDS_AI_SEED_LESSONS.length);
    expect(r.body.lessons).toHaveLength(KIDS_AI_SEED_LESSONS.length);
  });
});
