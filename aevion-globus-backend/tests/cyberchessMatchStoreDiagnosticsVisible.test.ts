import { describe, test, expect, vi } from "vitest";
import express from "express";
import request from "supertest";

// Счётчики записи должны быть ВИДНЫ снаружи. 18.08.2026.
//
// Учёт записи в хранилище партий я завёл в тот же день — и чуть не оставил его
// без ручки. Счётчик, которого нельзя спросить, отличается от отсутствующего
// только тем, что создаёт ощущение контроля: строка в логе есть, а логи никто
// не открывает.
//
// Проверяется и обратное: наружу едут ЧИСЛА, без текста ошибки. Публичная
// диагностика с сырым сообщением pg выдаёт адрес, порт и пользователя базы.

vi.mock("pg", () => {
  class Pool {
    async query() {
      return { rows: [], rowCount: 0 };
    }
    on() {}
  }
  return { default: { Pool }, Pool };
});

import matchmakingRouter from "../src/routes/cyberchessMatchmaking";

const app = express();
app.use(express.json());
app.use("/api/cyberchess/matchmaking", matchmakingRouter);

describe("диагностика хранилища партий доступна снаружи", () => {
  test("в ответе есть счётчики записи", async () => {
    const res = await request(app).get("/api/cyberchess/matchmaking/debug/stats");

    expect(res.status).toBe(200);
    expect(res.body.storage).toBeDefined();
    for (const field of ["writes", "writeErrors", "claimUnknown"]) {
      expect(res.body.storage).toHaveProperty(field);
      expect(typeof res.body.storage[field]).toBe("number");
    }
  });

  test("наружу не едет текст ошибки базы", async () => {
    const res = await request(app).get("/api/cyberchess/matchmaking/debug/stats");
    const body = JSON.stringify(res.body);

    // Категория допустима, сообщение — нет.
    expect(body).not.toMatch(/ECONNREFUSED|password authentication|does not exist|at Pool\./);
    // lastErrorKind — одно слово или null, а не предложение.
    const kind = res.body.storage.lastErrorKind;
    expect(kind === null || (typeof kind === "string" && kind.length <= 20)).toBe(true);
  });
});
