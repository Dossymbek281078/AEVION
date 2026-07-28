/**
 * QLearn — повторная запись на курс и поведение при сбое базы.
 *
 * Два дефекта одного семейства с сегодняшними: (а) при повторной записи
 * возвращался свежесгенерированный enrollmentId, которого в базе нет —
 * клиент получал 201 и идентификатор, по которому ничего не найдётся;
 * (б) сбой базы молча проваливался в in-memory ветку, а в проде memCourses
 * пуст, поэтому ответом было «Course not found» — то есть про существующий
 * курс говорилось, что его нет.
 */
import { describe, test, expect, beforeEach, vi } from "vitest";
import crypto from "crypto";
import request from "supertest";
import express from "express";

function signJwt(payload: Record<string, unknown>, secret = "dev-auth-secret"): string {
  const b64 = (s: string) =>
    Buffer.from(s).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const header = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000) }));
  const sig = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `${header}.${body}.${sig}`;
}

const { sqlLog, mockQuery } = vi.hoisted(() => ({ sqlLog: [] as string[], mockQuery: vi.fn() }));

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: mockQuery, connect: async () => ({ query: mockQuery, release: () => {} }) }),
}));

vi.mock("../src/lib/ensureQLearnTables", () => ({
  isQLearnDbReady: () => true,
  getQLearnDbError: () => null,
  ensureQLearnTables: async () => {},
}));

// eslint-disable-next-line import/first
import { qlearnRouter } from "../src/routes/qlearn";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/qlearn", qlearnRouter);
  return app;
}

function stubDb(opts: { duplicate?: boolean; courseExists?: boolean; blowUp?: boolean }) {
  const { duplicate = false, courseExists = true, blowUp = false } = opts;
  mockQuery.mockImplementation(async (sql: string) => {
    sqlLog.push(sql.trim().split("\n")[0].trim());
    if (sql.includes('FROM "QLearnCourse"') && sql.includes("SELECT")) {
      if (blowUp) throw new Error("база отвалилась");
      return courseExists ? { rows: [{ id: "c-1" }], rowCount: 1 } : { rows: [], rowCount: 0 };
    }
    if (sql.includes('INSERT INTO "QLearnEnrollment"')) {
      return duplicate ? { rows: [], rowCount: 0 } : { rows: [{ id: "enr-new" }], rowCount: 1 };
    }
    if (sql.includes('FROM "QLearnEnrollment"')) {
      return { rows: [{ id: "enr-existing" }], rowCount: 1 };
    }
    return { rows: [], rowCount: 1 };
  });
}

const token = signJwt({ sub: "user-1", email: "a@b.c" });
const enroll = () =>
  request(makeApp()).post("/api/qlearn/courses/c-1/enroll").set("Authorization", `Bearer ${token}`).send({});

const counted = () => sqlLog.filter((s) => s.includes('UPDATE "QLearnCourse"')).length;

beforeEach(() => {
  sqlLog.length = 0;
  mockQuery.mockReset();
});

describe("повторная запись на курс", () => {
  test("первая запись: 201 и счётчик +1", async () => {
    stubDb({ duplicate: false });
    const res = await enroll();
    expect(res.status).toBe(201);
    expect(counted()).toBe(1);
  });

  test("повтор отдаёт СУЩЕСТВУЮЩИЙ идентификатор, а не выдуманный", async () => {
    stubDb({ duplicate: true });
    const res = await enroll();
    expect(res.body.enrollmentId).toBe("enr-existing");
    expect(res.body.alreadyEnrolled).toBe(true);
  });

  test("повтор не накручивает счётчик записей на курс", async () => {
    stubDb({ duplicate: true });
    await enroll();
    expect(counted()).toBe(0);
  });

  test("несуществующий курс — 404", async () => {
    stubDb({ courseExists: false });
    expect((await enroll()).status).toBe(404);
  });
});

describe("сбой базы не выдаёт себя за отсутствие курса", () => {
  test("отвечает 503, а не «курс не найден»", async () => {
    stubDb({ blowUp: true });
    const res = await enroll();
    expect(res.status).toBe(503);
    expect(res.body.error).toBe("database_unavailable");
  });

  test("не притворяется, что курса нет", async () => {
    stubDb({ blowUp: true });
    const res = await enroll();
    expect(res.status).not.toBe(404);
  });
});

describe("транзакция вокруг записи и счётчика", () => {
  test("успешная запись коммитится", async () => {
    stubDb({ duplicate: false });
    await enroll();
    expect(sqlLog.some((l) => /^BEGIN/i.test(l))).toBe(true);
    expect(sqlLog.some((l) => /^COMMIT/i.test(l))).toBe(true);
  });

  test("несуществующий курс откатывается и не коммитится", async () => {
    stubDb({ courseExists: false });
    await enroll();
    expect(sqlLog.some((l) => /^ROLLBACK/i.test(l))).toBe(true);
    expect(sqlLog.some((l) => /^COMMIT/i.test(l))).toBe(false);
  });

  test("сбой базы откатывается", async () => {
    stubDb({ blowUp: true });
    await enroll();
    expect(sqlLog.some((l) => /^ROLLBACK/i.test(l))).toBe(true);
  });
});
