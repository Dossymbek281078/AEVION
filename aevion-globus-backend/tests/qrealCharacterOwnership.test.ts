/**
 * QReal — персонажей чужого проекта править нельзя.
 *
 * До 28.07.2026 PATCH /projects/:id/characters/:cid менял персонажей по одному
 * идентификатору проекта, не глядя, чей это проект. Поле `userId` у проекта при
 * этом есть, и соседние ручки его проверяют — то есть проверка была просто
 * забыта. Идентификаторы UUID, перебором чужой проект не найти, но узнавший id
 * (например, из присланной ссылки) мог менять персонажей, а они участвуют в
 * сборке промтов рендера.
 */
import { describe, test, expect, beforeEach, vi } from "vitest";
import crypto from "crypto";
import request from "supertest";
import express from "express";

function signJwt(sub: string, secret = "dev-auth-secret"): string {
  const b = (x: Buffer) => x.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const h = b(Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const p = b(Buffer.from(JSON.stringify({ sub, iat: Math.floor(Date.now() / 1000) })));
  return `${h}.${p}.${b(crypto.createHmac("sha256", secret).update(`${h}.${p}`).digest())}`;
}

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: async () => ({ rows: [], rowCount: 0 }),
    connect: async () => ({ query: async () => ({ rows: [] }), release: () => {} }),
  }),
}));

// eslint-disable-next-line import/first
import { qrealRouter } from "../src/routes/qreal";

function app() {
  const a = express();
  a.use(express.json());
  a.use("/api/qreal", qrealRouter);
  return a;
}

const OWNER = signJwt("owner-1");
const STRANGER = signJwt("stranger-2");

/** Заводит проект от имени владельца и возвращает id проекта и первого персонажа. */
async function makeProject(): Promise<{ id: string; cid: string }> {
  const created = await request(app())
    .post("/api/qreal/projects")
    .set("Authorization", `Bearer ${OWNER}`)
    .send({ brief: "Степное утро, рассвет над холмами, длинный проезд камеры", format: "short" });
  const id = created.body?.project?.id ?? created.body?.id;
  expect(id, `проект не создался: ${JSON.stringify(created.body).slice(0, 200)}`).toBeTruthy();

  // Персонажи выводятся из раскадровки; если их нет, берём любого доступного.
  const detail = await request(app())
    .get(`/api/qreal/projects/${id}`)
    .set("Authorization", `Bearer ${OWNER}`);
  const cid = detail.body?.project?.characters?.[0]?.id ?? "c-1";
  return { id, cid };
}

let ctx: { id: string; cid: string };

beforeEach(async () => {
  ctx = await makeProject();
});

describe("правка персонажей уважает владельца", () => {
  test("посторонний получает 403", async () => {
    const res = await request(app())
      .patch(`/api/qreal/projects/${ctx.id}/characters/${ctx.cid}`)
      .set("Authorization", `Bearer ${STRANGER}`)
      .send({ name: "Подменённое имя" });
    expect(res.status).toBe(403);
  });

  test("без токена тоже не пускает", async () => {
    const res = await request(app())
      .patch(`/api/qreal/projects/${ctx.id}/characters/${ctx.cid}`)
      .send({ name: "Аноним" });
    expect(res.status).toBe(403);
  });

  test("владельцу правка доступна (403 он не получает)", async () => {
    const res = await request(app())
      .patch(`/api/qreal/projects/${ctx.id}/characters/${ctx.cid}`)
      .set("Authorization", `Bearer ${OWNER}`)
      .send({ name: "Имя от владельца" });
    expect(res.status).not.toBe(403);
  });
});
