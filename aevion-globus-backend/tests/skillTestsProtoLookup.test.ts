import { describe, test, expect, vi } from "vitest";
import request from "supertest";
import express from "express";

/**
 * Поиск теста по идентификатору из адреса шёл через `TESTS[req.params.id]`,
 * то есть по обычному объекту, который наследует ключи прототипа. Проверка
 * `if (!test)` пропускала функцию `Object`, и падение случалось дальше, на
 * `test.questions`.
 *
 * На проде 27.07.2026 это давало **500 internal_error** вместо 404 на
 * `GET /api/build/skill-tests/constructor`, `/toString`, `/__proto__`.
 * Публичная ручка, адрес набирается руками.
 */

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn(async () => ({ rows: [] })) }));

vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: mockQuery }) }));
vi.mock("../src/lib/build", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/build")>();
  return { ...actual, buildPool: { query: mockQuery } };
});

// eslint-disable-next-line import/first
import { skillBadgesRouter } from "../src/routes/build/skill-badges";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/build", skillBadgesRouter);
  return app;
}

describe("QBuild skill-tests: поиск теста по адресу", () => {
  test.each(["constructor", "toString", "__proto__", "valueOf", "hasOwnProperty"])(
    "прототипный ключ %s даёт 404, а не падение",
    async (key) => {
      const res = await request(makeApp()).get(`/api/build/skill-tests/${key}`);
      expect(res.status).toBe(404);
      expect(res.body.error).toBe("test_not_found");
    },
  );

  test("настоящий тест по-прежнему отдаётся", async () => {
    const res = await request(makeApp()).get("/api/build/skill-tests/welding");
    expect(res.status).toBe(200);
    expect(res.body?.test?.id ?? res.body?.data?.test?.id).toBe("welding");
  });

  test("несуществующий обычный идентификатор — тоже 404", async () => {
    const res = await request(makeApp()).get("/api/build/skill-tests/nope");
    expect(res.status).toBe(404);
  });
});
