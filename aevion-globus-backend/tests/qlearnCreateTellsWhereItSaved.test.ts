import { describe, test, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

/**
 * База НАСТРОЕНА, но упала: создание и чтение обязаны сказать «не смог»,
 * а не выдать отсутствие или успех в памяти процесса.
 *
 * Замер 21–23.08.2026. Курс и урок при отказе базы уходили в память и
 * отвечали 201: автор считал курс созданным, добавлял к нему уроки и терял
 * всё при перезапуске. Чтения отвечали ОТСУТСТВИЕМ: урок «не найден», список
 * зачислений ПУСТ — человек решает, что не записан, и платит второй раз.
 *
 * Признак `storage: "memory"` остаётся верным для развёртывания БЕЗ базы,
 * где память и есть хранилище: он проверяется в qlearnNoDbTellsWhereItSaved.
 * Здесь база есть, и «сохранено в памяти» — ловушка, а не сведения.
 */

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: async (sql?: string) => {
      const head = String(sql ?? "").trimStart().toUpperCase();
      if (head.startsWith("CREATE") || head.startsWith("ALTER")) return { rows: [], rowCount: 0 };
      throw new Error("storage unreachable");
    },
  }),
  isDbConfigured: () => true,
}));
vi.mock("../src/lib/ensureQLearnTables", () => ({
  ensureQLearnTables: async () => {},
  isQLearnDbReady: () => true,
  getQLearnDbError: () => null,
}));

import { qlearnRouter } from "../src/routes/qlearn";

const TOKEN = jwt.sign({ sub: "author-1" }, "dev-auth-secret", { algorithm: "HS256", expiresIn: "1h" });

function app() {
  const a = express();
  a.use(express.json());
  a.use("/x", qlearnRouter);
  return a;
}

describe("база настроена, но упала: отказ вместо ложного успеха", () => {
  test("создание курса — 503, а не «создан» в памяти процесса", async () => {
    const res = await request(app())
      .post("/x/me/courses")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ title: "Курс", description: "о чём-то", category: "tech" });
    expect(res.status, `курс ответил ${res.status}: ${JSON.stringify(res.body)}`).toBe(503);
    expect(res.body?.error).toBe("storage_unavailable");
  });

  test("контроль: отказ приходит от ХРАНИЛИЩА, а не от разбора запроса", async () => {
    // Без обязательного поля ответ обязан остаться 400: иначе «503 на всё»
    // выглядело бы как работающая проверка, ничего на деле не проверяя.
    const res = await request(app())
      .post("/x/me/courses")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ description: "без названия" });
    expect(res.status).toBe(400);
  });

  test("отказ базы на прогрессе и завершении — 503, а не «зачисления нет»", async () => {
    // «Спросить не удалось» и «такого нет» — разные ответы. 404 на отказ базы
    // законен на вид и потому незаметен: человек решает, что записи нет, и
    // записывается заново.
    const prog = await request(app())
      .patch("/x/enrollments/enr-1/progress")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ progress: 50 });
    expect(prog.status, `прогресс ответил ${prog.status}: ${JSON.stringify(prog.body)}`).toBe(503);
    expect(prog.body?.error).toBe("storage_unavailable");

    const done = await request(app())
      .post("/x/enrollments/enr-1/complete")
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(done.status, `завершение ответило ${done.status}: ${JSON.stringify(done.body)}`).toBe(503);
    expect(done.body?.error).toBe("storage_unavailable");
  });

  test("отказ базы на чтениях — 503, а не «ничего нет»", async () => {
    // Три ручки отвечали отсутствием на неотвеченный вопрос: урок «не найден»,
    // список зачислений ПУСТ («вы никуда не записаны» — и человек платит
    // второй раз за тот же курс), курс «не найден» его же автору.
    const lesson = await request(app()).get("/x/courses/c1/lessons/l1");
    expect(lesson.status, `урок ответил ${lesson.status}`).toBe(503);

    const mine = await request(app())
      .get("/x/me/enrollments")
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(mine.status, `список зачислений ответил ${mine.status}`).toBe(503);
    expect(mine.body?.enrollments, "пустой список выдан за настоящий ответ").toBeUndefined();

    const marks = await request(app())
      .get("/x/me/bookmarks")
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(marks.status, `закладки ответили ${marks.status}`).toBe(503);
    expect(marks.body?.bookmarks, "пустой список выдан за «я ничего не отмечал»").toBeUndefined();

    const streak = await request(app())
      .get("/x/me/streak")
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(streak.status, `серия ответила ${streak.status}`).toBe(503);
    expect(streak.body?.current, "«серия 0» — утверждение о человеке, а не отказ").toBeUndefined();

    const mark = await request(app())
      .post("/x/courses/c1/bookmark")
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(mark.status, `постановка закладки ответила ${mark.status}`).toBe(503);

    const overview = await request(app())
      .get("/x/me/progress")
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(overview.status, `обзор обучения ответил ${overview.status}`).toBe(503);
    expect(
      overview.body?.summary,
      "пустая сводка выдана за факт о человеке: «вы ничего не проходите»",
    ).toBeUndefined();

    const addLesson = await request(app())
      .post("/x/me/courses/c1/lessons")
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ title: "Урок", content: "текст" });
    expect(addLesson.status, `добавление урока ответило ${addLesson.status}`).toBe(503);
  });
});
