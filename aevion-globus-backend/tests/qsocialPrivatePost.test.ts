import { describe, test, expect, beforeEach, vi } from "vitest";
import crypto from "crypto";
import request from "supertest";
import express from "express";

/**
 * У поста есть флаг `isPublic`, и лента его честно соблюдает:
 *
 *   SELECT * FROM "QSocialPost" WHERE "isPublic"=TRUE …     (путь через базу)
 *   .filter((p) => p.isPublic)                              (путь через память)
 *
 * А выдача по идентификатору не проверяла флаг НИ НА ОДНОМ из двух путей. То
 * есть автор прятал пост из ленты, а по прямой ссылке его читал кто угодно.
 * Один и тот же признак соблюдался в одном месте и игнорировался в другом.
 *
 * Отвечаем 404, а не 403: 403 подтвердил бы, что пост существует.
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
import { qsocialRouter } from "../src/routes/qsocial";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/qsocial", qsocialRouter);
  return app;
}

const AUTHOR = "user-author";
const authorToken = `Bearer ${signJwt({ sub: AUTHOR, email: "a@test.aev", role: "USER" })}`;
const strangerToken = `Bearer ${signJwt({ sub: "user-stranger", email: "s@test.aev", role: "USER" })}`;

function servePost(isPublic: boolean) {
  mockQuery.mockReset();
  mockQuery.mockImplementation(async (sql: string) => {
    if (String(sql).includes('FROM "QSocialPost"')) {
      return {
        rows: [
          {
            id: "post-1",
            userId: AUTHOR,
            content: "личная запись",
            mediaUrl: null,
            type: "text",
            likesCount: 0,
            commentsCount: 0,
            isPublic,
            tags: [],
            createdAt: new Date().toISOString(),
            // служебное поле: наружу уходить не должно
            moderationFlag: "under_review",
          },
        ],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 0 };
  });
}

const get = (token?: string) => {
  const r = request(makeApp()).get("/api/qsocial/posts/post-1");
  return token ? r.set("Authorization", token) : r;
};

describe("QSocial: непубличный пост не читается по прямой ссылке", () => {
  beforeEach(() => mockQuery.mockReset());

  test("непубличный пост посторонним не отдаётся — и без входа тоже", async () => {
    servePost(false);
    expect((await get()).status).toBe(404);
    servePost(false);
    expect((await get(strangerToken)).status).toBe(404);
  });

  test("автор свой непубличный пост видит", async () => {
    servePost(false);
    const res = await get(authorToken);
    expect(res.status).toBe(200);
    expect(res.body.post.id).toBe("post-1");
  });

  test("публичный пост читается кем угодно", async () => {
    servePost(true);
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.body.post.content).toBe("личная запись");
  });

  test("служебные поля наружу не уходят", async () => {
    servePost(true);
    const res = await get();
    expect(res.body.post).not.toHaveProperty("moderationFlag");
    const allowed = new Set([
      "id", "userId", "content", "mediaUrl", "type", "likesCount", "commentsCount",
      "isPublic", "tags", "createdAt",
    ]);
    expect(Object.keys(res.body.post).filter((k) => !allowed.has(k))).toEqual([]);
  });

  test("запрос к базе больше не «выбрать всё»", async () => {
    servePost(true);
    await get();
    const sql = mockQuery.mock.calls.map((c) => String(c[0])).find((q) => q.includes('FROM "QSocialPost"'));
    expect(sql).not.toMatch(/SELECT\s+\*/i);
  });
});
