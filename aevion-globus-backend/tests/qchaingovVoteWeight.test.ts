import { describe, test, expect, beforeEach, vi } from "vitest";
import crypto from "crypto";
import request from "supertest";
import express from "express";

/**
 * Вес голоса приходил ТЕЛОМ ЗАПРОСА и принимался вплоть до миллиона, а итог
 * считается `SUM("weight")`. То есть любой вошедший пользователь одним запросом
 * перевешивал всех остальных — и это не теория, а прямое следствие двух строк:
 *
 *   const { choice, weight = 1 } = req.body;
 *   ... INSERT ... VALUES ($1,$2,$3,$4,$5,$6)   // сюда уходит его же число
 *
 * Тот же класс, что «клиент заявил — сервер списал» на денежном пути, только
 * здесь клиентским числом решается исход голосования.
 *
 * Правило теперь: право голоса определяет СЕРВЕР. Пока источника силы голоса
 * нет (AEV-взвешивание из описания модуля не подключено) — одно лицо, один
 * голос. В режиме «weighted» тело задаёт долю собственного права, а не число
 * из воздуха.
 */

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

const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));
vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: mockQuery }) }));

// eslint-disable-next-line import/first
import { qchaingovRouter } from "../src/routes/qchaingov";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/qchaingov", qchaingovRouter);
  return app;
}

const AUTH = `Bearer ${signJwt({ sub: "voter-1", email: "v1@test.aev", role: "USER" })}`;

/** Пул отвечает так, будто предложение открыто и принимает два варианта. */
function serveProposal(voteMode: string) {
  mockQuery.mockReset();
  mockQuery.mockImplementation(async (sql: string) => {
    const q = String(sql);
    if (q.includes('FROM "QChainGovProposal"') && q.includes("LIMIT 1")) {
      return { rows: [{ status: "open", options: ["yes", "no"], voteMode }], rowCount: 1 };
    }
    return { rows: [], rowCount: 1 };
  });
}

function vote(body: unknown) {
  return request(makeApp())
    .post("/api/qchaingov/proposals/p1/votes")
    .set("Authorization", AUTH)
    .send(body as object);
}

/** Вес, который реально ушёл в INSERT. */
function insertedWeight(): number | undefined {
  const insert = mockQuery.mock.calls.find((c) => String(c[0]).includes('INSERT INTO "QChainGovVote"'));
  return insert?.[1]?.[4] as number | undefined;
}

describe("QChainGov: силу голоса определяет сервер", () => {
  beforeEach(() => mockQuery.mockReset());

  test("обычный голос весит 1, что бы ни прислал клиент", async () => {
    serveProposal("yes-no-abstain");
    const res = await vote({ choice: "yes" });
    expect(res.status).toBe(201);
    expect(insertedWeight()).toBe(1);
  });

  test("миллион в теле больше не проходит — отказ, а не тихое игнорирование", async () => {
    serveProposal("yes-no-abstain");
    const res = await vote({ choice: "yes", weight: 1_000_000 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("weight_not_accepted_in_this_mode");
    const insert = mockQuery.mock.calls.find((c) => String(c[0]).includes('INSERT INTO "QChainGovVote"'));
    expect(insert, "голос не должен быть записан").toBeFalsy();
  });

  test("weight: 1 в обычном режиме принимается — это то же самое, что ничего не слать", async () => {
    serveProposal("yes-no-abstain");
    expect((await vote({ choice: "yes", weight: 1 })).status).toBe(201);
  });

  test("в режиме weighted тело задаёт долю своего права", async () => {
    serveProposal("weighted");
    const res = await vote({ choice: "yes", weight: 0.25 });
    expect(res.status).toBe(201);
    expect(insertedWeight()).toBe(0.25);
  });

  test("доля больше единицы в режиме weighted отбивается", async () => {
    serveProposal("weighted");
    const res = await vote({ choice: "yes", weight: 5 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("weight_must_be_fraction_0_to_1");
  });

  test("ноль и отрицательная доля отбиваются", async () => {
    serveProposal("weighted");
    expect((await vote({ choice: "yes", weight: 0 })).status).toBe(400);
    expect((await vote({ choice: "yes", weight: -1 })).status).toBe(400);
  });

  test("бесконечность из JSON отбивается", async () => {
    serveProposal("weighted");
    // через объект не выразить: JSON.stringify превращает Infinity в null
    const res = await request(makeApp())
      .post("/api/qchaingov/proposals/p1/votes")
      .set("Authorization", AUTH)
      .set("Content-Type", "application/json")
      .send('{"choice":"yes","weight":1e400}');
    expect(res.status).toBe(400);
  });

  test("вариант вне списка по-прежнему отбивается", async () => {
    serveProposal("yes-no-abstain");
    const res = await vote({ choice: "maybe" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_choice");
  });
});
