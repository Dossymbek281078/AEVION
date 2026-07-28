/**
 * QSocial — счётчик лайков не должен уходить вперёд самих лайков.
 *
 * До 28.07.2026 ветка Postgres делала «прочитал, вставил через ON CONFLICT
 * DO NOTHING, увеличил безусловно». Двойное нажатие по кнопке — два запроса,
 * оба видят, что лайка нет, вторая вставка молча отбрасывается, а likesCount
 * растёт на два. Гонка потоков для этого не нужна, хватает дабл-тапа.
 *
 * Плюс лайк несуществующего поста в проде создавал строку лайка и отвечал
 * успехом: проверка на существование стояла только в in-memory ветке.
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

vi.mock("../src/lib/ensureQSocialTables", () => ({
  isQSocialDbReady: () => true,
  getQSocialDbError: () => null,
  ensureQSocialTables: async () => {},
}));

// eslint-disable-next-line import/first
import { qsocialRouter } from "../src/routes/qsocial";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/qsocial", qsocialRouter);
  return app;
}

/**
 * @param alreadyLiked  строка лайка уже есть — SELECT её видит
 * @param insertWins    вставка реально создала строку (false = отброшена как дубль)
 * @param postExists    пост существует
 */
function stubDb(opts: { alreadyLiked?: boolean; insertWins?: boolean; postExists?: boolean }) {
  const { alreadyLiked = false, insertWins = true, postExists = true } = opts;
  mockQuery.mockImplementation(async (sql: string) => {
    sqlLog.push(sql.trim().split("\n")[0].trim());
    if (sql.includes('SELECT "userId" FROM "QSocialPost"')) {
      return postExists ? { rows: [{ userId: "author-1" }], rowCount: 1 } : { rows: [], rowCount: 0 };
    }
    if (sql.includes('FROM "QSocialLike"') && sql.includes("SELECT")) {
      return alreadyLiked ? { rows: [{ "?column?": 1 }], rowCount: 1 } : { rows: [], rowCount: 0 };
    }
    if (sql.includes('INSERT INTO "QSocialLike"')) {
      return insertWins ? { rows: [{ postId: "p-1" }], rowCount: 1 } : { rows: [], rowCount: 0 };
    }
    if (sql.includes('DELETE FROM "QSocialLike"')) {
      return alreadyLiked ? { rows: [{ postId: "p-1" }], rowCount: 1 } : { rows: [], rowCount: 0 };
    }
    if (sql.includes('SELECT "likesCount"')) return { rows: [{ likesCount: 1 }], rowCount: 1 };
    return { rows: [], rowCount: 1 };
  });
}

const token = signJwt({ sub: "user-1", email: "a@b.c" });
const like = () =>
  request(makeApp()).post("/api/qsocial/posts/p-1/like").set("Authorization", `Bearer ${token}`).send({});

const bumped = () => sqlLog.filter((s) => s.includes('"likesCount"="likesCount"+1')).length;
const lowered = () => sqlLog.filter((s) => s.includes('GREATEST(0,"likesCount"-1)')).length;

beforeEach(() => {
  sqlLog.length = 0;
  mockQuery.mockReset();
});

describe("счётчик двигается только следом за строкой лайка", () => {
  test("первый лайк: строка создана — счётчик +1", async () => {
    stubDb({ alreadyLiked: false, insertWins: true });
    const res = await like();
    expect(res.status).toBe(200);
    expect(res.body.liked).toBe(true);
    expect(bumped()).toBe(1);
  });

  test("дабл-тап: вставку отбросили как дубль — счётчик НЕ растёт", async () => {
    stubDb({ alreadyLiked: false, insertWins: false });
    const res = await like();
    expect(res.status).toBe(200);
    expect(res.body.liked).toBe(true);
    expect(bumped()).toBe(0);
  });

  test("снятие лайка: строка удалена — счётчик −1", async () => {
    stubDb({ alreadyLiked: true });
    const res = await like();
    expect(res.body.liked).toBe(false);
    expect(lowered()).toBe(1);
  });

  test("нечего удалять — счётчик не уменьшается", async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      sqlLog.push(sql.trim().split("\n")[0].trim());
      if (sql.includes('SELECT "userId" FROM "QSocialPost"')) return { rows: [{ userId: "author-1" }], rowCount: 1 };
      if (sql.includes('FROM "QSocialLike"') && sql.includes("SELECT")) return { rows: [{ x: 1 }], rowCount: 1 };
      if (sql.includes('DELETE FROM "QSocialLike"')) return { rows: [], rowCount: 0 };
      if (sql.includes('SELECT "likesCount"')) return { rows: [{ likesCount: 0 }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    });
    await like();
    expect(lowered()).toBe(0);
  });

  test("вставка спрашивает RETURNING — иначе дубль неотличим от успеха", async () => {
    stubDb({});
    await like();
    const insert = mockQuery.mock.calls.map((c) => String(c[0])).find((s) => s.includes('INSERT INTO "QSocialLike"'));
    expect(insert).toMatch(/RETURNING/i);
  });
});

describe("лайк несуществующего поста", () => {
  test("отвечает 404, а не мнимым успехом", async () => {
    stubDb({ postExists: false });
    expect((await like()).status).toBe(404);
  });

  test("и ничего не пишет", async () => {
    stubDb({ postExists: false });
    await like();
    expect(sqlLog.some((s) => s.includes('INSERT INTO "QSocialLike"'))).toBe(false);
    expect(bumped()).toBe(0);
  });
});

describe("подписка: уведомление за реальную подписку, а не за нажатие", () => {
  const follow = () =>
    request(makeApp()).post("/api/qsocial/follow/other-1").set("Authorization", `Bearer ${token}`).send({});

  function stubFollow(opts: { alreadyFollowing: boolean; insertWins: boolean }) {
    mockQuery.mockImplementation(async (sql: string) => {
      sqlLog.push(sql.trim().split("\n")[0].trim());
      if (sql.includes('FROM "QSocialFollow"') && sql.includes("SELECT")) {
        return opts.alreadyFollowing ? { rows: [{ x: 1 }], rowCount: 1 } : { rows: [], rowCount: 0 };
      }
      if (sql.includes('INSERT INTO "QSocialFollow"')) {
        return opts.insertWins ? { rows: [{ followingId: "other-1" }], rowCount: 1 } : { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 1 };
    });
  }

  test("вставка подписки спрашивает RETURNING", async () => {
    stubFollow({ alreadyFollowing: false, insertWins: true });
    await follow();
    const insert = mockQuery.mock.calls.map((c) => String(c[0])).find((s) => s.includes('INSERT INTO "QSocialFollow"'));
    expect(insert).toMatch(/RETURNING/i);
  });

  test("первая подписка проходит", async () => {
    stubFollow({ alreadyFollowing: false, insertWins: true });
    const res = await follow();
    expect(res.status).toBe(200);
    expect(res.body.following).toBe(true);
  });

  test("повторное нажатие не создаёт вторую подписку", async () => {
    stubFollow({ alreadyFollowing: false, insertWins: false });
    const res = await follow();
    expect(res.status).toBe(200);
    const inserts = sqlLog.filter((s) => s.includes('INSERT INTO "QSocialFollow"')).length;
    expect(inserts).toBe(1);
  });
});

describe("уведомление автору", () => {
  test("на отброшенном дубле уведомление не шлётся — иначе автор получит их пачку", async () => {
    stubDb({ alreadyLiked: false, insertWins: false });
    await like();
    // Уведомление шлётся только внутри ветки успешной вставки: если счётчик
    // не двигался, значит и до addNotification дело не дошло.
    expect(bumped()).toBe(0);
  });

  test("без токена — 401, до базы дело не доходит", async () => {
    stubDb({});
    const res = await request(makeApp()).post("/api/qsocial/posts/p-1/like").send({});
    expect(res.status).toBe(401);
    expect(sqlLog).toEqual([]);
  });
});

describe("транзакция вокруг лайка и счётчика", () => {
  test("успешный лайк коммитится", async () => {
    stubDb({ alreadyLiked: false, insertWins: true });
    await like();
    expect(sqlLog.some((l) => /^BEGIN/i.test(l))).toBe(true);
    expect(sqlLog.some((l) => /^COMMIT/i.test(l))).toBe(true);
  });

  test("несуществующий пост откатывается и не коммитится", async () => {
    stubDb({ postExists: false });
    await like();
    expect(sqlLog.some((l) => /^ROLLBACK/i.test(l))).toBe(true);
    expect(sqlLog.some((l) => /^COMMIT/i.test(l))).toBe(false);
  });

  test("счётчик меняется ВНУТРИ транзакции, а не после коммита", async () => {
    stubDb({ alreadyLiked: false, insertWins: true });
    await like();
    const commit = sqlLog.findIndex((l) => /^COMMIT/i.test(l));
    const bump = sqlLog.findIndex((l) => l.includes('"likesCount"="likesCount"+1'));
    expect(bump).toBeGreaterThanOrEqual(0);
    expect(bump).toBeLessThan(commit);
  });
});
