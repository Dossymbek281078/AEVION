import { describe, test, expect, vi } from "vitest";
import express from "express";
import request from "supertest";

/**
 * ЧАСТИЧНЫЙ отказ: проект читается, а его файлы — нет.
 *
 * Честная оговорка, ради которой этот файл и написан отдельно. При ПОЛНОМ отказе
 * базы обработчик отвечает 503 ещё на чтении ПРОЕКТА, и до файлов дело не
 * доходит. Я это сперва не заметил: написал два теста, получил зелёный и только
 * мутация показала, что зелёный приходит не от той строки — код с файлами был
 * недостижим.
 *
 * Поэтому подмена различает запросы: проект возвращается, файлы падают. Так
 * выглядит частичный отказ — недоступна одна таблица, повреждён индекс, права
 * на неё отозваны. Тогда прежний код отдавал пустой список файлов с кодом 200, и
 * проект выглядел стёртым.
 */

const PROJECT = {
  id: "p1", userId: "anonymous", name: "проект", description: null,
  status: "active", stack: "react", createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(), envVars: {}, files: [],
};

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: async (sql?: string) => {
      const q = String(sql ?? "");
      const head = q.trimStart().toUpperCase();
      if (head.startsWith("CREATE") || head.startsWith("ALTER")) return { rows: [], rowCount: 0 };
      if (q.includes("DevHubProject")) return { rows: [PROJECT], rowCount: 1 };
      throw new Error("files table unreachable");
    },
  }),
  isDbConfigured: () => true,
}));
vi.mock("../src/lib/ensureDevHubTables", () => ({
  ensureDevHubTables: async () => {},
  isDevHubDbReady: () => true,
  getDevHubDbError: () => null,
}));

import { devhubRouter } from "../src/routes/devhub";

function app() {
  const a = express();
  a.use(express.json());
  a.use("/x", devhubRouter);
  return a;
}

describe("файлы проекта при частичном отказе", () => {
  test("контроль: проект ЧИТАЕТСЯ — значит проверяем именно файлы", async () => {
    // Без этого контроля тест зеленел бы от 503 на чтении проекта, как и было
    // в первой версии.
    //
    // Ручка выбрана та, что читает ТОЛЬКО проект: страница проекта (/projects/:id)
    // сама тянет список файлов и потому под частичным отказом тоже падает —
    // контроль на ней ничего бы не доказал.
    const res = await request(app()).get("/x/projects/p1/database");
    expect(res.status, "проект недоступен — проверка была бы не о том").not.toBe(503);
    expect(res.status).not.toBe(404);
  });

  test("список файлов не подменяется пустым", async () => {
    const res = await request(app()).get("/x/projects/p1/files");
    expect(res.status, "пустой список читается как «проект без файлов»").not.toBe(200);
    expect(res.status).toBe(503);
    expect(String(res.body?.warning ?? "")).toMatch(/недоступно/);
  });

  test("удаление файла не подтверждается, если база его не удалила", async () => {
    const res = await request(app())
      .delete("/x/projects/p1/files/index.ts")
      .send({});
    expect(res.body?.ok, "удаление подтверждено, хотя не произошло").not.toBe(true);
    expect(res.status).toBe(503);
  });
});
